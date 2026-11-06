"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { recordConfigChange } from "@/lib/config-history/record"
import {
  MODULES,
  dependentsOf,
  missingDependencies,
  getModule,
  type ModuleState,
  type ModuleStateMap,
} from "@/lib/modules/catalog"

// ============================================================
// #100 8.C (F2) — MODULI (akcije)
// Vklop/izklop na ravni podjetja NEODVISNO od vertikale. Izklop
// NIKOLI ne izgubi podatkov; odvisnosti so deklarirane (opozorilo
// pred izklopom, jasno sporočilo ob vklopu — ne tiho kaskado).
// Vsaka sprememba gre v ConfigChangeLog (revizija/rollback).
// ============================================================

export interface ModuleView {
  id: string
  nameSl: string
  nameEn: string
  descriptionSl: string
  descriptionEn: string
  dependsOn: string[]
  /** Efektivno stanje (brez vrstice = vertikalni privzeti ACTIVE). */
  state: ModuleState
  /** Ali capability izhaja iz profila kot "disabled" (nudi vklop v F5; v1 samo informativno). */
  profileDisabled: boolean
}

export async function getModuleOverview(): Promise<{
  modules: ModuleView[]
  dependentWarnings: Record<string, string[]>
}> {
  const { org } = await requirePermissionOrg("settings.manage")

  const rows = await prisma.organizationModuleState.findMany({
    where: { organizationId: org.id },
    select: { moduleId: true, state: true },
  })
  const states: ModuleStateMap = {}
  for (const r of rows) {
    if (r.state === "ACTIVE" || r.state === "DEACTIVATED" || r.state === "HIDDEN") {
      states[r.moduleId] = r.state
    }
  }

  const profile = org
  void profile

  const modules: ModuleView[] = MODULES.map((m) => ({
    id: m.id,
    nameSl: m.nameSl,
    nameEn: m.nameEn,
    descriptionSl: m.descriptionSl,
    descriptionEn: m.descriptionEn,
    dependsOn: m.dependsOn,
    state: states[m.id] ?? "ACTIVE",
    profileDisabled: false,
  }))

  const dependentWarnings: Record<string, string[]> = {}
  for (const m of MODULES) {
    dependentWarnings[m.id] = dependentsOf(m.id).map((d) => d.nameSl)
  }

  return { modules, dependentWarnings }
}

export async function setModuleState(
  moduleId: string,
  state: ModuleState
): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
  const { org, session } = await requirePermissionOrg("settings.manage")

  const mod = getModule(moduleId)
  if (!mod || !MODULES.some((m) => m.id === moduleId)) {
    return { success: false, error: "Neznan modul." }
  }

  const rows = await prisma.organizationModuleState.findMany({
    where: { organizationId: org.id },
    select: { moduleId: true, state: true },
  })
  const states: ModuleStateMap = {}
  for (const r of rows) {
    if (r.state === "ACTIVE" || r.state === "DEACTIVATED" || r.state === "HIDDEN") {
      states[r.moduleId] = r.state
    }
  }

  const previous = states[moduleId] ?? "ACTIVE"

  // Izklop: moduli, ki so odvisni od tega, ostanejo vklopljeni — vrnemo
  // OPOZORILO (uporabnik potrdi; ne tiho kaskado).
  let warnings: string[] = []
  if (state === "DEACTIVATED") {
    const dependents = dependentsOf(moduleId).filter(
      (d) => (states[d.id] ?? "ACTIVE") === "ACTIVE"
    )
    if (dependents.length > 0) {
      warnings = dependents.map(
        (d) => `Modul »${d.nameSl}« je odvisen od tega modula — preveri njegovo delovanje.`
      )
    }
  }

  // Vklop: manjkajoče odvisnosti jasno povej (sprememba samo zahtevanega
  // modula — brez tihe kaskade; lastnik odpre ostale, ko jih potrebuje).
  if (state === "ACTIVE") {
    const missing = missingDependencies(moduleId, states)
    if (missing.length > 0 && previous !== "DEACTIVATED") {
      return {
        success: false,
        error: `Najprej vklopi odvisne module: ${missing.map((m) => m.nameSl).join(", ")}.`,
      }
    }
    if (missing.length > 0) {
      warnings = missing.map(
        (m) => `Odvisni modul »${m.nameSl}« je izklopljen — vklopi ga, če potrebuješ.`
      )
    }
  }

  await prisma.organizationModuleState.upsert({
    where: { organizationId_moduleId: { organizationId: org.id, moduleId } },
    create: { organizationId: org.id, moduleId, state },
    update: { state },
  })

  const actorEmail = session.user.email ?? "unknown"
  await recordConfigChange({
    organizationId: org.id,
    actorEmail,
    entityKey: `module:${moduleId}`,
    action: previous === state ? "UPDATE" : "UPDATE",
    summary: `Modul ${mod.nameSl}: ${previous} → ${state}`,
    previous: { state: previous },
    next: { state },
  }).catch(() => undefined)

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { success: true, warnings }
}
