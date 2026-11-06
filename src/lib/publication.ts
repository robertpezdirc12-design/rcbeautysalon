import type { CapabilityMatrix } from "@/lib/profiles/types"
import {
  detectContentActivityMismatch,
  type ContentActivityMismatch,
} from "@/lib/site-content"

/**
 * Publication lifecycle (EPIC #3, E3-1).
 *
 * A tenant site moves through DRAFT → PUBLISHED → (optionally) UNPUBLISHED.
 * This module holds the PURE publish requirements so the same rules can be
 * validated in tests, in the server action and shown in the UI — behavior can
 * never drift between surfaces.
 */

export type PublishState = "DRAFT" | "PUBLISHED" | "UNPUBLISHED"

export interface PublishRequirementsInput {
  /** Tenant display name (Organization.name). */
  orgName: string
  /** Contact details (SalonConfig) — at least one channel must exist. */
  contactEmail: string | null
  contactPhone: string | null
  /** Catalog counts per tenant. */
  serviceCount: number
  productCount: number
  /** Effective capability matrix (shared profile + owner overrides). */
  capabilities: Pick<CapabilityMatrix, "services" | "shop">
  /** #112-1: ali javna stran obljublja rezervacije (appointments + booking CTA). */
  bookingPromised: boolean
  /** #112-1: število AKTIVNIH osebje (rezervacije brez njih padejo na čakalno listo). */
  activeStaffCount: number
  /** P2 #61: raw stored content; null/undefined = vertical defaults (coherent). */
  siteContent?: unknown
  /** P2 #61: current activity id, e.g. "seamstress". */
  vertical?: string
  /** P2 #61: true when every image is still the preset sample (warning only). */
  usesOnlySampleImages?: boolean
}

export interface PublishValidation {
  ok: boolean
  /** Human-readable (Slovenian, the public site language) reasons blocking publication. */
  errors: string[]
  /** P2 #61: non-blocking advisories (sample imagery, legacy rows of a disabled capability). */
  warnings: string[]
  /** P2 #61: structured mismatch info — the UI turns it into a one-click fix. */
  mismatch: ContentActivityMismatch | null
}

/**
 * Server-side publish gate. Publication is refused (state unchanged) while any
 * requirement is unmet — a failed publish can never silently replace a site.
 */
export function validatePublishRequirements(
  input: PublishRequirementsInput,
): PublishValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!input.orgName || input.orgName.trim().length === 0) {
    errors.push("Ime podjetja ni nastavljeno (Nastavitve → Osnovni podatki).")
  }

  const hasContact =
    (input.contactEmail && input.contactEmail.trim().length > 0) ||
    (input.contactPhone && input.contactPhone.trim().length > 0)
  if (!hasContact) {
    errors.push(
      "Manjka kontaktni podatek — dodajte vsaj e-pošto ali telefonsko številko (Nastavitve → Kontakt).",
    )
  }

  // Catalog requirement follows the EFFECTIVE capabilities, but only REQUIRED
  // capabilities block publication: a profile's required capabilities are its
  // identity (a beauty salon without services is not a beauty salon), while
  // optional capabilities the owner chose not to use are hidden from the site
  // anyway and must not block going live.
  if (input.capabilities.services === "required" && input.serviceCount < 1) {
    errors.push("Katalog je prazen — dodajte vsaj eno storitev.")
  }
  // #112-1: objava, ki obljublja rezervacije (appointments + booking CTA),
  // brez AKTIVNEGA osebja javno NE deluje — vsak gost pade na čakalno listo.
  // Blokada (ne opozorilo): "objavi → dobi rezervacije" je obljuba platforme.
  if (input.bookingPromised && input.activeStaffCount < 1) {
    errors.push(
      "Rezervacije brez osebja ne delujejo — dodajte vsaj enega aktivnega osebja (Osebje → Dodaj) ali izklopite rezervacije (Moduli → Rezervacije in koledar).",
    )
  }

  if (input.capabilities.shop === "required" && input.productCount < 1) {
    // #82: a required module that the tenant's PRESET cannot populate must not
    // block going live — 8 of 11 trades ship zero sample products, so this
    // gate was an invisible fourth onboarding step. The public site already
    // hides an empty shop section, so nothing broken reaches the visitor.
    warnings.push(
      "Trgovina je vklopljena, a prazna — stran bo objavljena brez trgovine.",
    )
  }

  // --------------------------------------------------------------
  // P2 #61 — COHERENCE gate (the mixed-site defence in depth):
  // 1. Stored content that verbatim belongs to a DIFFERENT preset blocks
  //    publication (the production defect: beekeeper hero around a
  //    seamstress price list went live because nothing asked).
  // 2. Legacy rows of a DISABLED capability are a warning only — since
  //    #60 the body/header never render them, so they cannot confuse
  //    visitors, but the owner should still know they exist.
  // --------------------------------------------------------------
  let mismatch: ContentActivityMismatch | null = null
  if (input.vertical) {
    mismatch = detectContentActivityMismatch(input.siteContent, input.vertical)
    if (mismatch) {
      errors.push(
        `Vsebina ne ustreza izbrani dejavnosti: naslov strani je «${mismatch.foundTitle}» ` +
          `(${mismatch.matchedVerticalLabel}), dejavnost pa je ${mismatch.expectedVerticalLabel}. ` +
          `Naložite vzorčno vsebino ali uredite vsebino pred objavo.`,
      )
    }

    if (
      input.capabilities.services === "disabled" &&
      input.serviceCount > 0
    ) {
      warnings.push(
        `V katalogu je ${input.serviceCount} storitev, vendar jih dejavnost ${input.vertical} ne prikazuje — obiščevalci jih ne bodo videli.`,
      )
    }
    if (input.capabilities.shop === "disabled" && input.productCount > 0) {
      warnings.push(
        `V trgovini je ${input.productCount} izdelkov, vendar jih dejavnost ${input.vertical} ne prikazuje — obiščevalci jih ne bodo videli.`,
      )
    }
  }

  if (input.usesOnlySampleImages) {
    warnings.push(
      "Uporabljate vzorčne slike — zamenjajte jih s svojimi pred objavo.",
    )
  }

  return { ok: errors.length === 0, errors, warnings, mismatch }
}

export const PUBLISH_STATES: PublishState[] = ["DRAFT", "PUBLISHED", "UNPUBLISHED"]

/** Tolerant parser for the DB string (unknown value never crashes rendering). */
export function parsePublishState(value: string | null | undefined): PublishState {
  return PUBLISH_STATES.includes((value ?? "") as PublishState)
    ? (value as PublishState)
    : "PUBLISHED"
}

// ------------------------------------------------------------
// Content versioning (EPIC #3 E3-2)
// ------------------------------------------------------------

/**
 * Does the tenant have site content changes that are NOT yet published?
 * `publishedContentVersion === null` means a pre-E3-2 tenant (no snapshot yet):
 * its live site renders the working content directly, so by definition nothing
 * is "unpublished" — the UI must not nag owners who never opted into the
 * draft/publish flow.
 */
export function hasUnpublishedChanges(
  contentVersion: number | null | undefined,
  publishedContentVersion: number | null | undefined
): boolean {
  if (contentVersion == null || publishedContentVersion == null) return false
  return contentVersion !== publishedContentVersion
}

export type ComputeRevertInput = {
  /** Current working content version (Organization.contentVersion). */
  contentVersion: number
  /** Snapshot fields from SalonConfig — null when the tenant never published. */
  publishedSiteContent: unknown
  publishedContentVersion: number | null
}

export type ComputeRevertResult =
  | {
      ok: true
      /** Working content restored to the published JSON. */
      siteContent: unknown
      /**
       * The working version AFTER the revert: re-aligned to the published
       * version, because the content now IS the published content — drift
       * detection must not report "unpublished changes" for identical JSON.
       */
      contentVersion: number
    }
  | { ok: false; reason: "no-published-version" }

/**
 * Pure revert semantics (EPIC #3 E3-2): restoring the working draft to the
 * last published content. A tenant that never published has nothing to revert
 * to — the working content IS the live content in that case.
 */
export function computeRevert(input: ComputeRevertInput): ComputeRevertResult {
  if (input.publishedSiteContent == null) {
    return { ok: false, reason: "no-published-version" }
  }
  return {
    ok: true,
    siteContent: input.publishedSiteContent,
    contentVersion: input.publishedContentVersion ?? input.contentVersion,
  }
}
