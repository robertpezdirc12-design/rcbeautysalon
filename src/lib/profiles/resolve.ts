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

import { getProfile } from "./registry"
import { applyOverrides, parseOverrides } from "./overrides"
import { applySecondaryProfile } from "./secondary"
import type { ActivityProfile } from "./types"
import {
  effectiveCapabilities,
  effectivePublicCapabilities,
  type ModuleStateMap,
} from "@/lib/modules/catalog"

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
    if (row.state === "ACTIVE" || row.state === "DEACTIVATED" || row.state === "HIDDEN") {
      map[row.moduleId] = row.state
    }
  }
  return map
}

function buildProfile(
  org: OrgLike | null | undefined,
  mode: "dashboard" | "public"
): ActivityProfile {
  const withSecondary = applySecondaryProfile(
    getProfile(org?.vertical),
    org?.secondaryVertical
  )
  const withOverrides = applyOverrides(withSecondary, parseOverrides(org?.profileOverrides))
  const caps =
    mode === "public"
      ? effectivePublicCapabilities(
          withOverrides.capabilities as unknown as Record<string, string>,
          statesFromOrg(org)
        )
      : effectiveCapabilities(
          withOverrides.capabilities as unknown as Record<string, string>,
          statesFromOrg(org)
        )
  return { ...withOverrides, capabilities: caps } as unknown as ActivityProfile
}

// #105-nadaljevanje: sejna varianta (getSessionEffectiveProfile) je prestavljena
// v ./session — ta modul ostane ČIST (brez @/lib/tenant → next-auth verige),
// da ga javne površine (public-cta, sitemap-builder) lahko uvažajo tudi v
// testnem okolju brez ESM-težav next-auth beta različice.

/**
 * Effective profile for an already-loaded org (public pages pass
 * the resolved tenant org here).
 */
export function resolveEffectiveProfile(org: OrgLike | null | undefined): ActivityProfile {
  return buildProfile(org, "dashboard")
}

/**
 * Efektivni profil za JAVNO stran: HIDDEN modul je izklopljen (javni
 * vhodi 404/skriti), plošča pa ostane delujoča. Javne površine (proxy
 * vrata, javne strani, javni CTA) uporabljajo TA resolver.
 */
export function resolvePublicEffectiveProfile(
  org: OrgLike | null | undefined
): ActivityProfile {
  return buildProfile(org, "public")
}
