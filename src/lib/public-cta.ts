import { term } from "@/lib/profiles/registry"
import { resolvePublicEffectiveProfile } from "@/lib/profiles/resolve"
import type { WebsiteCtaMode } from "@/lib/profiles/types"
import type { CtaLink } from "@/lib/site-content"

// ============================================================
// PUBLIC CTA RESOLVER (EPIC #1 §4/§7 — Phase 4, overrides Phase 5)
// The public site's primary call-to-action is determined by the
// tenant's activity profile — NOT hardcoded to booking:
//   booking → /booking   (appointment-based businesses)
//   inquiry/quote → /inquiry (dynamic forms, e.g. seamstress)
//   order → /shop        (product businesses, e.g. beekeeping)
// Phase 5: the EFFECTIVE profile (shared + owner overrides) drives
// the CTA — a module the owner turned off never shows its CTA
// (falls back to /contact). Tenant-edited SiteContent CTAs remain
// authoritative for booking-mode tenants; profile terminology
// supplies the labels for the non-booking modes.
//
// #105-nadaljevanje (audit 2026-11): vsi resolverji SEDAJ gredo čez
// resolveEffectiveProfile() — vertikala → sekundarna dejavnost →
// profileOverrides → ORGANIZATIONMODULESTATES (zadnja beseda). Prej
// je ta datoteka gledala SAMO profileOverrides, zato je najemnik z
// izklopljenim modulom (npr. rezervacije DEACTIVATED, čeprav profil
// privzeto dopušča) v navbarju še vedno videl "Rezerviraj", ki je
// nato /booking pravilno preusmeril — stale CTA. Obratno: modul
// izrecno AKTIVIRAN prek modula je ostal skrit. Org kontekst je obvezen
// argument, da klicatelj NE more pozabiti podati moduleStates.
// ============================================================

/** Minimalni org kontekst za resolvanje efektivnega profila. */
export interface PublicOrgCtx {
  vertical: string | null | undefined
  secondaryVertical?: string | null
  profileOverrides?: unknown
  moduleStates?: { moduleId: string; state: string }[] | null
}

/** Effective profile za javne strani (org je že resolvan — moduli zadnja beseda). */
function effective(org: PublicOrgCtx | null | undefined) {
  return resolvePublicEffectiveProfile({
    vertical: org?.vertical ?? null,
    secondaryVertical: org?.secondaryVertical ?? null,
    profileOverrides: org?.profileOverrides,
    moduleStates: org?.moduleStates ?? null,
  })
}

export interface PublicCta {
  mode: WebsiteCtaMode
  label: string
  href: string
  /** False when the CTA target module is disabled for this profile. */
  enabled: boolean
}

/** Short navbar CTA per profile mode. */
export function resolvePublicCta(
  org: PublicOrgCtx | null | undefined,
  locale: "sl" | "en" = "sl"
): PublicCta {
  const profile = effective(org)
  const mode = profile.website.ctaMode

  switch (mode) {
    case "booking":
      return {
        mode,
        label: locale === "en" ? "Book now" : "Rezerviraj",
        href: "/booking",
        enabled: profile.capabilities.appointments !== "disabled",
      }
    case "order":
      return {
        mode,
        label: term(profile, "bookingCta", locale),
        href: "/shop",
        enabled: profile.capabilities.shop !== "disabled",
      }
    case "inquiry":
    case "quote":
    default:
      return {
        mode,
        label: term(profile, "bookingCta", locale),
        href: "/inquiry",
        enabled: profile.capabilities.forms !== "disabled",
      }
  }
}

/**
 * Hero (and CTA section) links: booking tenants keep their
 * editable SiteContent CTAs; everyone else is driven by the
 * profile so a seamstress never sees "Rezerviraj termin".
 */
export function resolveCtaLinks(
  org: PublicOrgCtx | null | undefined,
  content: { hero: { primaryCta: CtaLink; secondaryCta?: CtaLink | null } }
): { primaryCta: CtaLink; secondaryCta: CtaLink | null } {
  const profile = effective(org)
  const mode = profile.website.ctaMode

  if (mode === "booking") {
    if (profile.capabilities.appointments === "disabled") {
      // Owner disabled the appointments module — hero falls back to contact.
      const primary: CtaLink = { label: term(profile, "bookingCta", "sl"), href: "/contact" }
      return { primaryCta: primary, secondaryCta: content.hero.secondaryCta ?? null }
    }
    return {
      primaryCta: content.hero.primaryCta,
      secondaryCta: content.hero.secondaryCta ?? null,
    }
  }

  const href = mode === "order" ? "/shop" : "/inquiry"
  const enabled =
    mode !== "order"
      ? profile.capabilities.forms !== "disabled"
      : profile.capabilities.shop !== "disabled"
  const primary: CtaLink = enabled
    ? { label: term(profile, "bookingCta", "sl"), href }
    : { label: term(profile, "bookingCta", "sl"), href: "/contact" }

  return {
    primaryCta: primary,
    // Keep the tenant's secondary CTA (e.g. shop) unless it duplicates the primary.
    secondaryCta:
      content.hero.secondaryCta && content.hero.secondaryCta.href !== primary.href
        ? content.hero.secondaryCta
        : null,
  }
}

/** Whether the booking flow makes sense for this tenant at all. */
export function isBookingEnabled(org: PublicOrgCtx | null | undefined): boolean {
  const profile = effective(org)
  return (
    profile.website.ctaMode === "booking" &&
    profile.capabilities.appointments !== "disabled"
  )
}

/**
 * Bottom CTA-section href guard (§21 — Phase 6 fix).
 * Seeds written before profile CTA modes default buttonHref to
 * "/booking" even for non-appointment profiles. For NON-booking
 * tenants such a stale href is remapped to the profile's real
 * target (order → /shop, inquiry/quote → /inquiry). Owner-set
 * custom hrefs that do NOT point at booking are kept as-is;
 * booking tenants keep full owner control.
 */
export function resolveCtaSectionHref(
  org: PublicOrgCtx | null | undefined,
  configuredHref: string
): string {
  const profile = effective(org)
  if (profile.website.ctaMode === "booking") return configuredHref
  const stale =
    !configuredHref ||
    configuredHref.startsWith("/booking") ||
    configuredHref.startsWith("/s/") && configuredHref.endsWith("/booking")
  if (!stale) return configuredHref
  return profile.website.ctaMode === "order" ? "/shop" : "/inquiry"
}
