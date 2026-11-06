import { cache } from "react"
import { getSessionOrg } from "@/lib/tenant"
import { resolveEffectiveProfile } from "./resolve"
import type { ActivityProfile } from "./types"

// ============================================================
// SEJNA VARIANTA EFEKTIVNEGA PROFILA (#105-nadaljevanje)
//
// Prestavljeno iz resolve.ts: resolve.ts mora ostati ČIST (samo registry +
// overrides + secondary + moduleStates), ker ga javne površine (public-cta,
// sitemap-builder) uvažajo tudi v vitest okolju — import @/lib/tenant bi
// potegnil next-auth (ESM-težava beta različice v testih).
// ============================================================

/**
 * Effective profile of the current admin session's org
 * (shared profile + secondary-activity union + owner overrides + moduleStates).
 */
export const getSessionEffectiveProfile = cache(async (): Promise<ActivityProfile> => {
  const org = await getSessionOrg()
  // Enak tok kot resolveEffectiveProfile — tu le z org iz seje.
  return resolveEffectiveProfile(org)
})
