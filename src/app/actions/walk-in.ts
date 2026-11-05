"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { getResolvedOrg } from "@/lib/tenant"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import { isCapabilityEnabled } from "@/lib/profiles/registry"
import {
  canTransition,
  generateTicketCode,
  pickNextToServe,
  queuePosition,
  sanitizeWalkInInput,
  waitingQueue,
  type WalkInStatus,
} from "@/lib/walkin/queue"

// ============================================================
// #98 (AD-02) — WALK-IN VRSTA (akcije)
// Modul je capability-gated na OBEH poteh: javna prijava deluje samo,
// ko najemnikov profil ima walkIn ≠ disabled (izklop v Modulih = javni
// vhod onemogočen, podatki ostanejo); staff dejanja so org-scoped z
// guardom. Pozicija se izpelje iz vrstnega reda — breh dirk.
// ============================================================

/** Modul je vklopljen za najemnika (capability + overrides, ne vertikala). */
async function resolveWalkInOrg() {
  const org = await getResolvedOrg()
  if (!org) return null
  const profile = resolveEffectiveProfile(org)
  if (!isCapabilityEnabled(profile, "walkIn")) return null
  return org
}

/** Javno (gost): prijava v vrsto brez računa. */
export async function joinWalkInQueue(input: {
  name: unknown
  phone: unknown
  serviceId?: unknown
}): Promise<{ success: boolean; ticketCode?: string; error?: string }> {
  const org = await resolveWalkInOrg()
  if (!org) {
    return { success: false, error: "Vrsta ni na voljo." }
  }

  const clean = sanitizeWalkInInput(input)
  if (clean.name.length < 2) {
    return { success: false, error: "Vnesite ime (vsaj 2 znaka)." }
  }

  // Storitev je neobvezna in mora biti TA najemnikova + aktivna.
  let serviceId: string | null = null
  if (typeof input.serviceId === "string" && input.serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: input.serviceId, organizationId: org.id, isActive: true },
      select: { id: true },
    })
    serviceId = service?.id ?? null
  }

  const entry = await prisma.walkInEntry.create({
    data: {
      organizationId: org.id,
      name: clean.name,
      phone: clean.phone,
      serviceId,
      ticketCode: generateTicketCode(),
    },
  })

  return { success: true, ticketCode: entry.ticketCode }
}

/** Javno (gost): status po kodi vstopnice — brez PII tujcev. */
export async function getWalkInStatus(
  ticketCode: unknown
): Promise<{ success: boolean; position?: number | null; servingNow?: boolean; error?: string }> {
  const org = await resolveWalkInOrg()
  if (!org || typeof ticketCode !== "string") {
    return { success: false, error: "Vrsta ni na voljo." }
  }

  const entry = await prisma.walkInEntry.findUnique({
    where: { ticketCode: ticketCode.trim().toUpperCase() },
  })
  if (!entry || entry.organizationId !== org.id) {
    return { success: false, error: "Vstopnice ni bilo mogoče najti." }
  }

  if (entry.status === "SERVING") {
    return { success: true, servingNow: true, position: 0 }
  }
  if (entry.status !== "WAITING") {
    return { success: true, position: null }
  }

  const rows = await prisma.walkInEntry.findMany({
    where: { organizationId: org.id, status: { in: ["WAITING", "SERVING"] } },
    select: { id: true, status: true, createdAt: true },
  })
  const position = queuePosition(
    rows.map((r) => ({ id: r.id, status: r.status as WalkInStatus, createdAt: r.createdAt.toISOString() })),
    entry.id
  )
  return { success: true, position: position ?? null }
}

/** Zaposleni: živa vrsta (WAITING + SERVING) s položaji. */
export async function getWalkInQueue(): Promise<{
  success: boolean
  waiting?: { id: string; name: string; ticketCode: string; position: number; service?: string | null; createdAt: string }[]
  serving?: { id: string; name: string; ticketCode: string; service?: string | null }[]
  error?: string
}> {
  const { org } = await requirePermissionOrg("appointments.manage")

  const profile = resolveEffectiveProfile(org)
  if (!isCapabilityEnabled(profile, "walkIn")) {
    return { success: false, error: "Modul walk-in vrste je izklopljen." }
  }

  const rows = await prisma.walkInEntry.findMany({
    where: { organizationId: org.id, status: { in: ["WAITING", "SERVING"] } },
    include: { service: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  })

  const queue = rows.map((r) => ({
    id: r.id,
    name: r.name,
    ticketCode: r.ticketCode,
    status: r.status as WalkInStatus,
    service: r.service?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  }))

  return {
    success: true,
    waiting: waitingQueue(queue).map((e, i) => ({
      id: e.id,
      name: e.name,
      ticketCode: e.ticketCode,
      position: i + 1,
      service: e.service,
      createdAt: e.createdAt,
    })),
    serving: queue.filter((e) => e.status === "SERVING").map((e) => ({
      id: e.id,
      name: e.name,
      ticketCode: e.ticketCode,
      service: e.service,
    })),
  }
}

/** Zaposleni: pokliči NASLEDNJEGA (najstarejši WAITING → SERVING). */
export async function callNextWalkIn(): Promise<{ success: boolean; name?: string; error?: string }> {
  const { org } = await requirePermissionOrg("appointments.manage")
  const profile = resolveEffectiveProfile(org)
  if (!isCapabilityEnabled(profile, "walkIn")) {
    return { success: false, error: "Modul walk-in vrste je izklopljen." }
  }

  const rows = await prisma.walkInEntry.findMany({
    where: { organizationId: org.id, status: "WAITING" },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })
  const next = pickNextToServe(
    rows.map((r) => ({ id: r.id, status: "WAITING" as const, createdAt: r.createdAt.toISOString() }))
  )
  if (!next) return { success: false, error: "Vrsta je prazna." }

  await prisma.walkInEntry.update({ where: { id: next.id }, data: { status: "SERVING" } })
  revalidatePath("/dashboard/walk-in")
  return { success: true, name: rows.find((r) => r.id === next.id)?.name }
}

/** Zaposleni: prehod statusa ene vstopnice (SERVING/SERVED/LEFT), preverjeno. */
export async function transitionWalkIn(
  entryId: string,
  to: "SERVING" | "SERVED" | "LEFT"
): Promise<{ success: boolean; error?: string }> {
  const { org } = await requirePermissionOrg("appointments.manage")

  const entry = await prisma.walkInEntry.findFirst({
    where: { id: entryId, organizationId: org.id },
    select: { id: true, status: true },
  })
  if (!entry) return { success: false, error: "Vstopnice ni bilo mogoče najti." }

  if (!canTransition(entry.status as WalkInStatus, to)) {
    return { success: false, error: "Prehod ni dovoljen." }
  }

  await prisma.walkInEntry.update({
    where: { id: entry.id },
    data: { status: to, ...(to === "SERVED" ? { servedAt: new Date() } : {}) },
  })
  revalidatePath("/dashboard/walk-in")
  return { success: true }
}
