// ============================================================
// HOME SECTION FLAGS (P2 #46 + #47) — pure decision layer for
// which home-page sections a tenant's header may anchor to.
//
// Two independent gates combine:
//   1. DATA gate — the section only exists when its featured grid
//      would actually render (featured services/products).
//   2. CAPABILITY gate — the activity profile may disable the module
//      entirely (beekeeping: services + staff "disabled"). A disabled
//      capability must never render a nav anchor, even if legacy rows
//      exist in the DB (no migration needed for existing tenants).
//
// Used by BOTH public layouts ((public) and (customer)) so the header
// navigation is identical on every public route (#46 acceptance).
// ============================================================

import { isCapabilityEnabled, type ActivityProfile } from "@/lib/profiles/registry"

export interface HomeSectionFlags {
  services: boolean
  shop: boolean
  team: boolean
}

/** Pure: drop sections the profile's capability matrix disables. */
export function sectionsForProfile(
  featured: { services: boolean; shop: boolean },
  profile: ActivityProfile
): HomeSectionFlags {
  return {
    services:
      featured.services && isCapabilityEnabled(profile, "services"),
    shop: featured.shop && isCapabilityEnabled(profile, "shop"),
    team: isCapabilityEnabled(profile, "staff"),
  }
}
