// ============================================================
// HOME SECTION FLAGS (P2 #46 + #47, extended #60 + #62) — pure
// decision layer for which home-page sections exist.
//
// Two independent gates combine:
//   1. DATA gate — the section only exists when its featured grid
//      would actually render (featured services/products, any
//      active staff). #62: team is data-gated like the others —
//      a "Ekipa" anchor at 0 staff was a dead link on every
//      fresh tenant.
//   2. CAPABILITY gate — the activity profile may disable the module
//      entirely (beekeeping: services + staff "disabled"). A disabled
//      capability must never render a section, even if legacy rows
//      exist in the DB (no migration needed for existing tenants).
//
// Used by BOTH the header (both public layouts via
// resolveAvailableSections) AND the home body (#60) — one decision
// point, so the two surfaces are structurally incapable of
// disagreeing.
// ============================================================

import { isCapabilityEnabled, type ActivityProfile } from "@/lib/profiles/registry"

export interface HomeSectionFlags {
  services: boolean
  shop: boolean
  team: boolean
}

/** Pure: drop sections the profile's capability matrix disables. */
export function sectionsForProfile(
  featured: { services: boolean; shop: boolean; team: boolean },
  profile: ActivityProfile
): HomeSectionFlags {
  return {
    services:
      featured.services && isCapabilityEnabled(profile, "services"),
    shop: featured.shop && isCapabilityEnabled(profile, "shop"),
    team: featured.team && isCapabilityEnabled(profile, "staff"),
  }
}
