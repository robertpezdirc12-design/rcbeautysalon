"use server"

import { prisma } from "@/lib/prisma"
import { getResolvedOrg } from "@/lib/tenant"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { sendWaitlistNotifyEmail } from "@/lib/email/waitlist-notify"

// ============================================================
// #90 — ČAKALNA LISTA (honest waitlist v1)
// Public: gost se prijavi na listo za zaseden termin.
// Admin: lastnik pregleduje čakajoče in z enim klikom pošlje
// obvestilo s povezavo v rezervacijo (NIKOLI auto-book).
// Vsi vpogledi/pisanja so org-scoped — getResolvedOrg pri javnih
// klicih (header x-org-slog), requirePermissionOrg pri admin.
// ============================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface JoinWaitlistInput {
  name: string
  email: string
  phone?: string | null
  serviceId?: string | null
  preferredDate?: string | null // ISO date (yyyy-mm-dd) ali null
  notes?: string | null
}

export interface WaitlistActionResult {
  success: boolean
  error?: string
}

/** Javni vnos: prijava na čakalno listo trenutnega najemnika. */
export async function joinWaitlist(input: JoinWaitlistInput): Promise<WaitlistActionResult> {
  try {
    const org = await getResolvedOrg()
    if (!org) {
      return { success: false, error: "Poslovni profil ni prepoznan." }
    }

    const name = (input.name ?? "").trim()
    if (name.length < 2) {
      return { success: false, error: "Vnesite ime in priimek." }
    }

    const email = (input.email ?? "").trim().toLowerCase()
    if (!EMAIL_REGEX.test(email)) {
      return { success: false, error: "Vnesite veljaven e-poštni naslov." }
    }

    // Storitev mora pripadati temu najemniku (org-scoped, fail-closed).
    let serviceId: string | null = null
    if (input.serviceId) {
      const service = await prisma.service.findFirst({
        where: { id: input.serviceId, organizationId: org.id },
        select: { id: true },
      })
      if (!service) {
        return { success: false, error: "Izbrana storitev ni na voljo." }
      }
      serviceId = service.id
    }

    // Željeni datum: sprejmi samo veljaven ISO datum, sicer ignoriraj.
    let preferredDate: Date | null = null
    if (input.preferredDate) {
      const d = new Date(`${input.preferredDate}T00:00:00`)
      if (!Number.isNaN(d.getTime())) preferredDate = d
    }

    // Podvojen vnos: isti email + še WAITING pri istem najemniku
    // (storitev ne glede na datum) — pošteno povej, ne dupliciraj.
    const existing = await prisma.waitlistEntry.findFirst({
      where: {
        organizationId: org.id,
        email,
        status: "WAITING",
        ...(serviceId ? { serviceId } : {}),
      },
      select: { id: true },
    })
    if (existing) {
      return {
        success: false,
        error: "Na čakalni listi ste že vpisani — ob odprtju termina vas bomo obvestili.",
      }
    }

    await prisma.waitlistEntry.create({
      data: {
        organizationId: org.id,
        name: name.slice(0, 80),
        email: email.slice(0, 120),
        phone: input.phone?.trim().slice(0, 30) || null,
        serviceId,
        preferredDate,
        notes: input.notes?.trim().slice(0, 500) || null,
      },
    })

    return { success: true }
  } catch (error) {
    console.error("joinWaitlist failed:", error)
    return { success: false, error: "Prijava na čakalno listo ni uspela. Poskusite znova." }
  }
}

// ------------------------------------------------------------
// Admin — requirePermissionOrg; vsak vpis gre skozi org filter.
// ------------------------------------------------------------

/** Seznam vnosov čakalne liste (najnovejši najprej). */
export async function getWaitlistEntries(status?: "WAITING" | "NOTIFIED" | "BOOKED" | "EXPIRED") {
  const { org } = await requirePermissionOrg("appointments.view")
  return prisma.waitlistEntry.findMany({
    where: { organizationId: org.id, ...(status ? { status } : {}) },
    include: { service: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Obvesti EN vnos: email s povezavo v rezervacijski čarovnik
 * (storitev predizpolnjena, če je vnos nanjo vezan). Uspeh = email
 * poslan + status NOTIFIED. Neuspeh pošte NI tih — vrne napako.
 */
export async function notifyWaitlistEntry(id: string): Promise<WaitlistActionResult> {
  try {
    const { org } = await requirePermissionOrg("appointments.manage")

    const entry = await prisma.waitlistEntry.findFirst({
      where: { id, organizationId: org.id },
      include: { service: { select: { name: true, slug: true } } },
    })
    if (!entry) {
      return { success: false, error: "Vnos ne obstaja ali ni vaš." }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const bookingUrl = `${appUrl}/s/${org.slug}/booking${
      entry.service ? `?service=${entry.service.slug}` : ""
    }`

    const result = await sendWaitlistNotifyEmail({
      email: entry.email,
      name: entry.name,
      businessName: org.name,
      serviceName: entry.service?.name ?? null,
      bookingUrl,
    })

    if (!result.success) {
      return {
        success: false,
        error: `E-pošta ni poslana (${result.error ?? "neznan vzrok"}). Preverite pošiljanje in poskusite znova.`,
      }
    }

    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "NOTIFIED", notifiedAt: new Date() },
    })

    return { success: true }
  } catch (error) {
    console.error("notifyWaitlistEntry failed:", error)
    return { success: false, error: "Obveščanje ni uspelo. Poskusite znova." }
  }
}

/** Vnos označi kot rezerviran (lastnik je obiskal/poskrbel zunaj sistema). */
export async function markWaitlistBooked(id: string): Promise<WaitlistActionResult> {
  try {
    const { org } = await requirePermissionOrg("appointments.manage")
    const entry = await prisma.waitlistEntry.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!entry) {
      return { success: false, error: "Vnos ne obstaja ali ni vaš." }
    }
    await prisma.waitlistEntry.update({ where: { id }, data: { status: "BOOKED" } })
    return { success: true }
  } catch (error) {
    console.error("markWaitlistBooked failed:", error)
    return { success: false, error: "Zapis ni uspel. Poskusite znova." }
  }
}

/** Izbriše vnos (npr. gost sam odpovedal interes). */
export async function deleteWaitlistEntry(id: string): Promise<WaitlistActionResult> {
  try {
    const { org } = await requirePermissionOrg("appointments.manage")
    const entry = await prisma.waitlistEntry.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!entry) {
      return { success: false, error: "Vnos ne obstaja ali ni vaš." }
    }
    await prisma.waitlistEntry.delete({ where: { id } })
    return { success: true }
  } catch (error) {
    console.error("deleteWaitlistEntry failed:", error)
    return { success: false, error: "Brisanje ni uspelo. Poskusite znova." }
  }
}
