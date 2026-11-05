// ============================================================
// EFFECTIVE PROFILE RESOLVER (EPIC #1 — Phase 5, server-only)
// Single source for every surface that needs the tenant's
// effective profile: shared registry profile + owner overrides
// stored on Organization.profileOverrides.
// React cache() keeps one resolution per request.
//
// #100 8.C (F2): moduleStates so ZADNJA BESEDA — izklop modula
// izklopi njegove capability-je neodvisno od vertikale (podatki
// ostanejo; javni vhodi izklopljenega modula so pravi 404). Brez
// vrstic moduleState = vertikalni privzeti (ni spremembe vedenja).
// ============================================================

import { cache } from "react"
import { getSessionOrg } from "@/lib/tenant"
import { getProfile } from "./registry"
import { applyOverrides, parseOverrides } from "./overrides"
import { applySecondaryProfile } from "./secondary"
import type { ActivityProfile } from "./types"
import { effectiveCapabilities, type ModuleStateMap } from "@/lib/modules/catalog"

interface OrgLike {
  vertical: string | null
  secondaryVertical?: string | null
  profileOverrides: unknown
  /** #100 8.C: organizationModuleStates (iz include) — neobvezno. */
  moduleStates?: { moduleId: string; state: string }[] | null
}

/** Iz org vrstice v map stanj (samo znane vrednosti). */
function statesFromOrg(org: OrgLike | null | undefined): ModuleStateMap {
  const map: ModuleStateMap = {}
  for (const row of org?.moduleStates ?? []) {
    if (row.state === "ACTIVE" || row.state === "DEACTIVATED") {
      map[row.moduleId] = row.state
    }
  }
  return map
}

/**
 * Effective profile of the current admin session's org
 * (shared profile + secondary-activity union + owner overrides + moduleStates).
 */
export const getSessionEffectiveProfile = cache(async (): Promise<ActivityProfile> => {
  const org = await getSessionOrg()
  const withSecondary = applySecondaryProfile(
    getProfile(org?.vertical),
    org?.secondaryVertical
  )
  const withOverrides = applyOverrides(withSecondary, parseOverrides(org?.profileOverrides))
  const caps = effectiveCapabilities(
    withOverrides.capabilities as unknown as Record<string, string>,
    statesFromOrg(org)
  )
  return { ...withOverrides, capabilities: caps } as unknown as ActivityProfile
})

/**
 * Effective profile for an already-loaded org (public pages pass
 * the resolved tenant org here).
 */
export function resolveEffectiveProfile(org: OrgLike | null | undefined): ActivityProfile {
  const withSecondary = applySecondaryProfile(
    getProfile(org?.vertical),
    org?.secondaryVertical
  )
  const withOverrides = applyOverrides(withSecondary, parseOverrides(org?.profileOverrides))
  const caps = effectiveCapabilities(
    withOverrides.capabilities as unknown as Record<string, string>,
    statesFromOrg(org)
  )
  return { ...withOverrides, capabilities: caps } as unknown as ActivityProfile
}
