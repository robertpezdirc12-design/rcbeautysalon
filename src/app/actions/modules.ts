"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  requireSession,
  resolveSessionOrganization,
  UnauthorizedError,
} from "@/lib/auth/guards"
import { getEffectivePermissions } from "@/lib/permissions/effective"
import { recordConfigChange } from "@/lib/config-history/record"
import {
  MODULES,
  dependentsOf,
  missingDependencies,
  getModule,
  type ModuleState,
  type ModuleStateMap,
} from "@/lib/modules/catalog"
import {
  isTransitionAllowed,
  modulePolicyFor,
  type ModuleCategory,
} from "@/lib/modules/policy"
// VSTOPNA IZKUŠNJA (2026-11): čista opt-in logika (seed + plan aktivacije)
// je v src/lib/modules/activation.ts — en vir resnice, testabilno,
// komponente in akcije ga delita.
import {
  baseCapabilitiesOf,
  planActivation,
} from "@/lib/modules/activation"
import type { CapabilityState } from "@/lib/profiles/types"

// NOTE (#1318): začetno seedanje modulov (`seedNewOrgModuleStates`) je bilo
// prestavljeno v INTERNI servis src/lib/modules/seeding.ts (ne-"use server"),
// da ta javni "use server" modul ne izpostavlja več akcije brez preverjanja
// pravic (klicljive za poseganje v stanje modulov katere koli org).

/**
 * F5.4.2 §3 — upravljanje modulov je ORG-SCOPED in PERMISSION-BASED
 * (ne samo po globalni vlogi). To je namerna, ciljana razlika od
 * `requirePermissionOrg` (ki omeji na ADMIN): lastnik (ADMIN) in člani s
 * custom vlogo, ki vsebuje `settings.manage`, lahko upravljajo module
 * SVOJE organizacije; STAFF ali član brez tega dovoljenja je zavrnjen
 * (fail-closed). Ključ je PERMISIJI PO ORGANIZACIJI, nikoli globalna vloga.
 */
async function requireModuleManageOrg(): Promise<{
  session: { user: { id: string; email?: string | null; name?: string | null } }
  org: { id: string; vertical: string | null; secondaryVertical?: string | null; profileOverrides: unknown }
}> {
  const session = await requireSession()
  const org = await resolveSessionOrganization(session)
  if (!org) {
    throw new UnauthorizedError("No organization found for this account")
  }
  const perms = await getEffectivePermissions(session.user.id, org.id)
  if (!perms.includes("settings.manage")) {
    throw new UnauthorizedError(
      "You do not have permission to perform this action"
    )
  }
  return {
    session: session as never,
    org: {
      id: org.id,
      vertical: org.vertical,
      secondaryVertical: (org as { secondaryVertical?: string | null }).secondaryVertical ?? null,
      profileOverrides: org.profileOverrides,
    },
  }
}

export interface ModuleView {
  id: string
  nameSl: string
  nameEn: string
  descriptionSl: string
  descriptionEn: string
  dependsOn: string[]
  /** Kategorija, ki jo podjetnik vidi (F5.4.1). */
  category: ModuleCategory
  /** Bazno stanje iz profila (authority before moduleStates). */
  baseState: CapabilityState
  /** Efektivno storitveno stanje (katero dejansko velja — after policy). */
  effectiveState: CapabilityState
  /** Trenutni modulni state iz moduleStates (brez vrstice = ACTIVE privzeto). */
  state: ModuleState
  /** Ali je modul funkcionalno aktiven (plošča deluje). */
  active: boolean
  /** Ali je javno skrit (HIDDEN), a ploščno aktiven. */
  hidden: boolean
  /** Ali drži razlog za zaklenjeno/nedovoljeno (SL/EN). */
  reasonSl?: string
  reasonEn?: string
}

async function loadStates(orgId: string): Promise<ModuleStateMap> {
  const rows = await prisma.organizationModuleState.findMany({
    where: { organizationId: orgId },
    select: { moduleId: true, state: true },
  })
  const states: ModuleStateMap = {}
  for (const r of rows) {
    if (r.state === "ACTIVE" || r.state === "DEACTIVATED" || r.state === "HIDDEN") {
      states[r.moduleId] = r.state
    }
  }
  return states
}

function policyReason(base: CapabilityState, state: ModuleState): { reasonSl?: string; reasonEn?: string } {
  // Politika "VSI MODULI ZA VSE" (2026): required in optional sta oba preklopljiva,
  // disabled ne obstaja več. Noben modul nima več blokirnega razloga.
  void base
  void state
  return {}
}

export async function getModuleOverview(): Promise<{
  modules: ModuleView[]
  dependentWarnings: Record<string, string[]>
}> {
  const { org } = await requireModuleManageOrg()

  // F5.4.1 §2: proaktivno uredi shranjena stanja, ki niso v skladu s politiko
  // profila (required DEACTIVATED, disabled ACTIVE/HIDDEN) — brez brisanja podatkov.
  await reconcileModuleStates()

  const base = baseCapabilitiesOf(org)
  const states = await loadStates(org.id)

  const modules: ModuleView[] = MODULES.map((m) => {
    const baseState = (base[m.id] ?? "optional") as CapabilityState
    // #1318 default-manjkajoče-vrstice: če row za modul v DB manjka (seed
    // ni uspel ali še ni bil ustvarjen), default je po buildSeedRows politiki
    // required → ACTIVE, optional/disabled → DEACTIVATED. Nikoli ne smemo
    // vsega "brez vrstice" razumeti kot ACTIVE — to bi opt-in vtišalo.
    const fallback: ModuleState = baseState === "required" ? "ACTIVE" : "DEACTIVATED"
    const state = states[m.id] ?? fallback
    const policy = modulePolicyFor(baseState, state)
    const { reasonSl, reasonEn } = policyReason(baseState, state)
    return {
      id: m.id,
      nameSl: m.nameSl,
      nameEn: m.nameEn,
      descriptionSl: m.descriptionSl,
      descriptionEn: m.descriptionEn,
      dependsOn: m.dependsOn,
      category: categoryFor(baseState, policy.active),
      baseState,
      effectiveState: policy.effective,
      state,
      active: policy.active,
      hidden: policy.hidden,
      reasonSl,
      reasonEn,
    }
  })

  const dependentWarnings: Record<string, string[]> = {}
  for (const m of MODULES) dependentWarnings[m.id] = dependentsOf(m.id).map((d) => d.nameSl)

  return { modules, dependentWarnings }
}

/**
 * Kategorija za prikaz (politika "VSI MODULI ZA VSE", 2026): noben modul ni
 * več "disabled". required moduli so "recommended" (privzeto aktivni, a
 * preklopljivi), optional pa "available".
 */
function categoryFor(base: CapabilityState, active: boolean): ModuleCategory {
  if (base === "required" || base === "optional") {
    return active ? "recommended" : "available"
  }
  // defensive: star disabled / neznano → available (vse preklopljivo).
  return "available"
}

export async function setModuleState(
  moduleId: string,
  state: ModuleState
): Promise<{ success: boolean; error?: string; warnings?: string[]; allowed?: boolean }> {
  const { org, session } = await requireModuleManageOrg()

  const mod = getModule(moduleId)
  if (!mod || !MODULES.some((m) => m.id === moduleId)) {
    return { success: false, error: "Neznan modul." }
  }

  // Politika "VSI MODULI ZA VSE" (2026): vse dejavnosti smejo vklopiti/izklopiti
  // vsak modul (required in optional sta oba popustljiva). A v vodiču je treba
  // najprej omogočiti odvisnosti (odvisni moduli se ne vklopijo samodejno).
  const base = baseCapabilitiesOf(org)
  const baseState = (base[moduleId] ?? "optional") as CapabilityState
  const transition = isTransitionAllowed(baseState, state)
  if (!transition.ok) {
    return { success: false, error: transition.reasonSl, allowed: false }
  }

  const rows = await loadStates(org.id)
  const states: ModuleStateMap = { ...rows }
  const previous = states[moduleId] ?? "ACTIVE"

  // Izklop: moduli odvisni od tega ostanejo — opozorilo (ni tihe kaskade).
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

  // Vklop: manjkajoča odvisnost jasno povej (ne samodejno vklopi, lastnik odloči).
  if (state === "ACTIVE") {
    const missing = missingDependencies(moduleId, states).filter((m) => {
      // prepovedane odvisnosti (disabled) so izkoreninjene — vse je preklopljivo.
      const depBase = (base[m.id] ?? "optional") as CapabilityState
      return depBase !== "disabled"
    })
    if (missing.length > 0 && previous !== "DEACTIVATED") {
      return {
        success: false,
        error: `Najprej vklopi odvisne module: ${missing.map((m) => m.nameSl).join(", ")}.`,
        allowed: true,
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
    action: "UPDATE",
    summary: `Modul ${mod.nameSl}: ${previous} → ${state}`,
    previous: { state: previous },
    next: { state },
  }).catch(() => undefined)

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { success: true, warnings, allowed: true }
}

// ============================================================
// VSTOPNA IZKUŠNJA (2026-11) — "Dodaj modul" (en klik, z odvisnostmi).
// Razlika od setModuleState: lastnik klika "Dodaj" na kartici modula,
// sistem pa (a) izračuna plan s planActivation (čista logika), (b) če je
 // modul odvisen od izklopljenih modulov, jih vklopi SKUPAJ (lastnik je z
 // enim klikom potrdil celoten nabor), (c) vsako spremembo zapiše v
 // ConfigChangeLog. Disabled odvisnost blokira celotno aktivacijo
// (fail-closed, v skladu z avtoritativno politiko).
// ============================================================
export async function enableModuleWithDependencies(
  moduleId: string,
  locale: "sl" | "en" = "sl"
): Promise<{ success: boolean; error?: string; enabled: string[] }> {
  const { org, session } = await requireModuleManageOrg()

  const mod = getModule(moduleId)
  if (!mod || !MODULES.some((m) => m.id === moduleId)) {
    return { success: false, error: "Neznan modul.", enabled: [] }
  }

  const base = baseCapabilitiesOf(org)
  const rows = await loadStates(org.id)
  const plan = planActivation(moduleId, base, rows)
  if (!plan.ok) {
    return {
      success: false,
      error: (locale === "en" ? plan.reasonEn : plan.reasonSl) ?? "Modul ni mogoče vklopiti.",
      enabled: [],
    }
  }

  const actorEmail = session.user.email ?? "unknown"
  const enabled: string[] = []
  const pending = plan.toEnable.map((m) => ({ m, previous: rows[m.id] ?? "ACTIVE" as ModuleState }))
    .filter(({ previous }) => previous !== "ACTIVE") // že aktivni preskoči

  // #1318 atomsko: aktivacija modulov + zgodovina sprememb v eni transakciji,
  // da prekinitev na pol poti nikoli ne pusti delno vklopljene mreže.
  await prisma.$transaction(async (tx) => {
    for (const { m, previous } of pending) {
      await tx.organizationModuleState.upsert({
        where: { organizationId_moduleId: { organizationId: org.id, moduleId: m.id } },
        create: { organizationId: org.id, moduleId: m.id, state: "ACTIVE" },
        update: { state: "ACTIVE" },
      })
      await recordConfigChange({
        organizationId: org.id,
        actorEmail,
        entityKey: `module:${m.id}`,
        action: "UPDATE",
        summary: `Modul ${m.nameSl}: ${previous} → ACTIVE (vklop prek mreže modulov)`,
        previous: { state: previous },
        next: { state: "ACTIVE" },
        tx, // #1318: log gre skozi ISTO transakcijo kot vklop.
      }).catch(() => undefined)
    }
  })
  enabled.push(...pending.map(({ m }) => m.id))

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/modules")
  revalidatePath("/dashboard/settings")
  return { success: true, enabled }
}

// ============================================================
// REKONCILIACIJA SHIRANJENIH STANJ — kompatibilna vstopna točka.
// Politika "VSI MODULI ZA VSE" (2026): required in optional sta oba
// popustljiva, disabled ne obstaja več (baseCapabilitiesOf ga dvigne
// na optional), zato ni več "neskladnih" stanj za popravljati.
// Kliče se idempotentno iz getModuleOverview (samo za lastnika).
// ============================================================
export async function reconcileModuleStates(): Promise<{ fixed: number }> {
  const { org } = await requireModuleManageOrg()
  const base = baseCapabilitiesOf(org)
  const rows = await prisma.organizationModuleState.findMany({
    where: { organizationId: org.id },
    select: { id: true, moduleId: true, state: true },
  })

  // Politika "VSI MODULI ZA VSE" (2026): required in optional sta oba
  // popustljiva, disabled ne obstaja več (baseCapabilitiesOf ga dvigne na
  // optional). Zato ni več "neskladnih" shranjenih stanj, ki bi jih bilo
  // treba popravljati — vsaka vrstica je veljavna. Funkcija ostane
  // idempotentna in vrača 0 (ohranjamo jo kot kompatibilno vstopno točko).
  void base
  void rows
  return { fixed: 0 }
}