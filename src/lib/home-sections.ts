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
  /** P2 #75: „Izjave strank" je lastna sekcija — ne več pasavica ekipe. */
  reviews: boolean
}

/** Pure: drop sections the profile's capability matrix disables. */
export function sectionsForProfile(
  featured: {
    services: boolean
    shop: boolean
    team: boolean
    /** Podatkovna vrata (število aktivnih ocen > 0) — brez njih bi glava
     *  kazala mrtvo sidro „Mnenja" pri 0 ocen (isto pravilo kot #62). */
    reviews: boolean
  },
  profile: ActivityProfile
): HomeSectionFlags {
  return {
    services:
      featured.services && isCapabilityEnabled(profile, "services"),
    shop: featured.shop && isCapabilityEnabled(profile, "shop"),
    team: featured.team && isCapabilityEnabled(profile, "staff"),
    // P2 #75: capabilities.reviews je od zdaj DEJANSKO bran (prej mrtva
    // stikalo v vseh 11 profilih) — in podatkovna vrata preprečijo mrtvo
    // sidro pri 0 ocen; telo sekcije samo vrne null pri 0 vrsticah.
    reviews: featured.reviews && isCapabilityEnabled(profile, "reviews"),
  }
}
