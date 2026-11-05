// ============================================================
// #58–#64 — MIXED-SITE BATCH (vertical switch, catalog fill,
// capability-gated body, publish coherence, team anchor,
// checklist predicates, resolution cache).
//
// The production defect chain: a beekeeper switched to seamstress
// kept the beekeeper hero/about/CTA (#58) around a seamstress price
// list (#60 let the body render it), the publish gate waved it
// through (#61), the header showed a dead "Ekipa" anchor (#62),
// the checklist showed a fake staff obligation (#63), and
// "Dopolni katalog" was a no-op/mixer (#59) — while publishing
// looked broken for ~20 s (#64).
// ============================================================

import { describe, it, expect } from "vitest"
import { srcOf } from "./helpers/source"
import {
  detectContentActivityMismatch,
  defaultSiteContent,
  mergeSiteContent,
} from "@/lib/site-content"
import {
  hasUnpublishedChanges,
  validatePublishRequirements,
} from "@/lib/publication"
import { sectionsForProfile } from "@/lib/home-sections"
import { PROFILES } from "@/lib/profiles/registry"
import {
  verticalSiteContent,
  isSampleImageUrl,
} from "@/lib/verticals"
import { buildSetupChecklist } from "@/lib/profiles/setup-checklist"

// ------------------------------------------------------------
// #58 — vertical switch reseeds (or explicitly keeps) content
// ------------------------------------------------------------

describe("#58 — updateOrgVertical content modes", () => {
  const action = srcOf("src/app/actions/site-content.ts")

  it("source guard: contentMode is a required explicit choice on published tenants", () => {
    expect(action).toContain('contentMode?: "keep" | "reseed"')
    expect(action).toContain('parsePublishState(org.publishState) === "PUBLISHED"')
    // server-side enforcement — no caller can bypass the dialog
    expect(action).toContain("Izberite, ali želite obdržati trenutno vsebino")
  })

  it("source guard: reseed writes verticalSiteContent of the NEW preset", () => {
    expect(action).toContain("verticalSiteContent(preset.id)")
  })

  it("source guard: every switch bumps contentVersion (pending-changes banner)", () => {
    expect(action).toContain("contentVersion: { increment: 1 }")
  })

  it("source guard: untouched-content detection compares against the current vertical's defaults", () => {
    expect(action).toContain("isSiteContentUntouched(org.id, org.vertical)")
  })

  it("pure semantics: hasUnpublishedChanges flips true after the bump (published tenant)", () => {
    // The switch increments contentVersion (e.g. 4 → 5) while the
    // snapshot keeps the published version (4) → banner must show.
    expect(hasUnpublishedChanges(5, 4)).toBe(true)
    expect(hasUnpublishedChanges(4, 4)).toBe(false)
  })
})

// ------------------------------------------------------------
// #59 — "Dopolni katalog" fills the MISSING halves independently
// ------------------------------------------------------------

describe("#59 — seedOrganizationCatalog independent guards + provenance", () => {
  const verticals = srcOf("src/lib/verticals.ts")

  it("source guard: the category guard no longer aborts the whole function", () => {
    expect(verticals).not.toMatch(/const existing = await prisma\.category\.count[\s\S]{0,80}if \(existing > 0\) return/)
  })

  it("source guard: products have their OWN guard (reachable for beekeeping)", () => {
    expect(verticals).toContain("existingProducts === 0")
  })

  it("source guard: provenance presetSeed is written on every seeded row", () => {
    expect(verticals.match(/presetSeed: preset\.id/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it("source guard: vertical switch replaces foreign preset samples, never owner rows", () => {
    expect(verticals).toContain("replaceForeignPreset")
    expect(verticals).toContain("appointmentServices: { none: {} }")
    expect(verticals).toContain("orderItems: { none: {} }")
  })

  it("CatalogSeedReport is exported for the toast", () => {
    expect(verticals).toContain("export interface CatalogSeedReport")
  })
})

// ------------------------------------------------------------
// #60 — home body uses the SAME gates as the header
// ------------------------------------------------------------

describe("#60 — body sections derive from sectionsForProfile", () => {
  const page = srcOf("src/app/(public)/page.tsx")

  it("source guard: page.tsx builds flags via sectionsForProfile (data + capability)", () => {
    expect(page).toContain("sectionsForProfile(")
    expect(page).toContain("hasServices={sections.services}")
    expect(page).toContain("hasProducts={sections.shop}")
    expect(page).toContain("staffEnabled={sections.team}")
  })

  it("source guard: the raw data-only gates are gone", () => {
    expect(page).not.toContain("hasServices={featuredServices.length > 0}")
    expect(page).not.toContain("hasProducts={featuredProducts.length > 0}")
  })

  it("beekeeping profile + seeded services → no services section anywhere", () => {
    // The decision layer itself: capability gate beats legacy data.
    const flags = sectionsForProfile(
      { services: true, shop: true, team: true, reviews: true },
      PROFILES.beekeeping
    )
    expect(flags.services).toBe(false)
    expect(flags.shop).toBe(true)
  })
})

// ------------------------------------------------------------
// #61 — publish gate refuses content from a different activity
// ------------------------------------------------------------

describe("#61 — detectContentActivityMismatch (pure)", () => {
  it("all presets pass their OWN content (no false positives)", () => {
    for (const id of Object.keys(PROFILES)) {
      const stored = verticalSiteContent(id)
      expect(detectContentActivityMismatch(stored, id)).toBeNull()
    }
  })

  it("null/absent content publishes normally (defaults are coherent by construction)", () => {
    expect(detectContentActivityMismatch(null, "seamstress")).toBeNull()
    expect(detectContentActivityMismatch(undefined, "beekeeping")).toBeNull()
    expect(detectContentActivityMismatch("junk", "beauty")).toBeNull()
  })

  it("the production defect: beekeeping content on a seamstress tenant IS detected", () => {
    const stored = verticalSiteContent("beekeeping")
    const mismatch = detectContentActivityMismatch(stored, "seamstress")
    expect(mismatch).not.toBeNull()
    expect(mismatch?.matchedVerticalId).toBe("beekeeping")
    expect(mismatch?.expectedVerticalId).toBe("seamstress")
    expect(mismatch?.foundTitle).toContain("Med, kot ga daje narava")
    expect(mismatch?.matchedVerticalLabel).toBeTruthy()
    expect(mismatch?.expectedVerticalLabel).toBeTruthy()
  })

  it("reverse direction: seamstress content on a beekeeping tenant IS detected", () => {
    const stored = verticalSiteContent("seamstress")
    const mismatch = detectContentActivityMismatch(stored, "beekeeping")
    expect(mismatch?.matchedVerticalId).toBe("seamstress")
  })

  it("partially edited content (threshold not met) does NOT block", () => {
    const stored = verticalSiteContent("beekeeping")
    // Owner customized the CTA → only hero+about still match (2/3 < 0.8).
    const edited = {
      ...stored,
      cta: { ...stored.cta, title: "Moja posebna ponudba tedna" },
    }
    expect(detectContentActivityMismatch(edited, "seamstress")).toBeNull()
  })

  it("shared-copy guard: generic tenant with its (beauty-equal) defaults is NOT flagged", () => {
    const stored = verticalSiteContent("generic")
    // generic's defaults equal beauty's — the hero-title equality guard
    // prevents a false mismatch against the beauty preset.
    expect(detectContentActivityMismatch(stored, "generic")).toBeNull()
  })

  it("missing hero but foreign about+cta still detects (present titles only)", () => {
    const defaults = defaultSiteContent("seamstress")
    const stored = { about: defaults.about, cta: defaults.cta }
    expect(detectContentActivityMismatch(stored, "beekeeping")?.matchedVerticalId).toBe(
      "seamstress"
    )
  })
})

describe("#61 — validatePublishRequirements coherence gate", () => {
  const base = {
    orgName: "Čebelarstvo Pri Kmetu",
    contactEmail: "med@example.si",
    contactPhone: null,
    serviceCount: 0,
    productCount: 6,
    capabilities: { services: "disabled", shop: "required" } as const,
  }

  it("mixed content BLOCKS publication with an actionable error + structured mismatch", () => {
    const r = validatePublishRequirements({
      ...base,
      siteContent: verticalSiteContent("beekeeping"),
      vertical: "seamstress",
    })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes("ne ustreza izbrani dejavnosti"))).toBe(true)
    expect(r.errors.some((e) => e.includes("Čebelarstvo"))).toBe(true)
    expect(r.mismatch?.matchedVerticalId).toBe("beekeeping")
  })

  it("coherent tenant publishes with no warnings", () => {
    const r = validatePublishRequirements({
      ...base,
      siteContent: verticalSiteContent("beekeeping"),
      vertical: "beekeeping",
      usesOnlySampleImages: false,
    })
    expect(r.ok).toBe(true)
    expect(r.warnings).toHaveLength(0)
    expect(r.mismatch).toBeNull()
  })

  it("disabled services capability + legacy rows → WARNING (hidden since #60), not a blocker", () => {
    const r = validatePublishRequirements({
      ...base,
      serviceCount: 3,
      productCount: 0,
      capabilities: { services: "disabled", shop: "required" },
      siteContent: null,
      vertical: "beekeeping",
    })
    // P2 #82: shop-required with 0 products no longer blocks either — an
    // empty shop is a warning (the public site hides it). The services
    // contradiction stays a warning.
    expect(r.ok).toBe(true)
    expect(r.errors).toHaveLength(0)
    expect(r.warnings.some((w) => w.includes("storitev"))).toBe(true)
    expect(r.warnings.some((w) => w.toLowerCase().includes("trgovina"))).toBe(true)
  })

  it("sample-only imagery produces a warning (never a blocker)", () => {
    const r = validatePublishRequirements({
      ...base,
      siteContent: null,
      vertical: "beekeeping",
      usesOnlySampleImages: true,
    })
    expect(r.ok).toBe(true)
    expect(r.warnings.some((w) => w.includes("vzorčne slike"))).toBe(true)
  })

  it("isSampleImageUrl recognizes preset paths and rejects owner uploads", () => {
    expect(isSampleImageUrl("/img/presets/honey.jpg")).toBe(true)
    expect(isSampleImageUrl("/img/media/hero/hero-bg.avif")).toBe(true)
    expect(isSampleImageUrl("/img/media/services/salon-interior.avif")).toBe(true)
    expect(isSampleImageUrl("services_my-upload_abc123")).toBe(false)
    expect(isSampleImageUrl(null)).toBe(false)
  })

  it("publishSite source guard passes the new fields to the validator", () => {
    const action = srcOf("src/app/actions/publication.ts")
    expect(action).toContain("siteContent: config?.siteContent ?? null")
    expect(action).toContain("vertical: org.vertical")
    expect(action).toContain("usesOnlySampleImages")
    expect(action).toContain("mismatch: validation.mismatch")
  })

  it("one-click fix action exists (Naloži vzorčno vsebino)", () => {
    const action = srcOf("src/app/actions/site-content.ts")
    expect(action).toContain("export async function loadSampleSiteContent")
  })
})

// ------------------------------------------------------------
// #62 — "Ekipa" anchor is data-gated (covered in sections tests;
// here: the resolver counts staff like the other sections)
// ------------------------------------------------------------

describe("#62 — resolveAvailableSections counts active staff", () => {
  it("source guard: staff count feeds the team flag", () => {
    const src = srcOf("src/lib/public-site.ts")
    expect(src).toContain("prisma.staff.count({ where: { organizationId, isActive: true } })")
    expect(src).toContain("team: activeStaff > 0")
  })
})

// ------------------------------------------------------------
// #63 — checklist hides steps the profile disables
// ------------------------------------------------------------

describe("#63 — checklist steps follow ONE predicate", () => {
  const baseInput = {
    verticalChosen: true,
    catalogTouched: false,
    catalogCapable: true,
    staffCount: 1,
    staffCapable: true,
    soloMode: false,
    customerCount: 0,
    customersCapable: true,
    appointmentCount: 0,
    orderCount: 0,
    appointmentsCapable: true,
    workOrdersCapable: true,
    published: false,
  }

  it("beekeeping (staff capability disabled, NOT solo) sees no staff step", () => {
    const c = buildSetupChecklist({ ...baseInput, staffCapable: false })
    expect(c.steps.find((s) => s.key === "staff")).toBeUndefined()
    expect(c.total).toBe(5)
    // nextKey can never point at a hidden step
    expect(c.nextKey).not.toBe("staff")
  })

  it("solo tenants still see no staff step (no regression)", () => {
    const c = buildSetupChecklist({ ...baseInput, soloMode: true })
    expect(c.steps.find((s) => s.key === "staff")).toBeUndefined()
  })

  it("staff-enabled tenant with only the owner keeps the step PENDING", () => {
    const c = buildSetupChecklist({ ...baseInput })
    const staff = c.steps.find((s) => s.key === "staff")
    expect(staff).toBeDefined()
    expect(staff?.done).toBe(false)
    expect(c.nextKey).toBe("catalog") // first unfinished, before staff
  })

  it("adding a second staff member completes the step", () => {
    const c = buildSetupChecklist({ ...baseInput, staffCount: 2 })
    expect(c.steps.find((s) => s.key === "staff")?.done).toBe(true)
  })

  it("total excludes hidden steps and allDone stays reachable", () => {
    const c = buildSetupChecklist({
      ...baseInput,
      staffCapable: false,
      catalogTouched: true,
      customerCount: 3,
      appointmentCount: 1,
      published: true,
    })
    expect(c.total).toBe(c.steps.length)
    expect(c.allDone).toBe(true)
    expect(c.nextKey).toBeNull()
  })

  it("catalog step is removed when no catalog capability exists at all", () => {
    const c = buildSetupChecklist({
      ...baseInput,
      catalogCapable: false,
    })
    expect(c.steps.find((s) => s.key === "catalog")).toBeUndefined()
  })
})

// ------------------------------------------------------------
// #64 — negative tenant resolution is never cached aggressively
// ------------------------------------------------------------

describe("#64 — resolution cache honesty", () => {
  it("source guard: resolve-tenant answers exists:false with no-store", () => {
    const route = srcOf("src/app/api/public/resolve-tenant/route.ts")
    expect(route).toContain('"Cache-Control": "no-store"')
    // P3 #73: STRUKTURNA trditev namesto rezine z dobesedno \n v
    // markerju (CRLF checkout je prej utopil marker in rezina je
    // zajela celotno datoteko). Negativno vejo locimo po "exists: false":
    // rezina od ZADNJEGA NextResponse.json( pred njo do NASLEDNJEGA.
    const falseIdx = route.indexOf("exists: false")
    expect(falseIdx).toBeGreaterThan(0)
    const callStart = route.lastIndexOf("NextResponse.json(", falseIdx)
    const callEnd = route.indexOf("NextResponse.json(", falseIdx)
    const negativeBranch = route.slice(
      callStart,
      callEnd === -1 ? route.length : callEnd
    )
    expect(negativeBranch).toContain("no-store")
    expect(negativeBranch).not.toContain("max-age=15")
  })

  it("source guard: positive answers are proxy-only (private, no-store) — honesty lives in the proxy TTL", () => {
    const route = srcOf("src/app/api/public/resolve-tenant/route.ts")
    // PR #103 review round 2: the endpoint is PROXY-ONLY (HMAC proof
    // gate) — its answers must never be stored/served by shared caches.
    // The short-TTL honesty property from #64 (publish visible quickly,
    // ~15 s worst case) is enforced by the PROXY's own in-memory cache
    // (pinned by the next guard), not by an HTTP shared-cache header.
    expect(route).toContain('"Cache-Control": "private, no-store"')
    expect(route).not.toContain("Cache-Control\": \"public")
  })

  it("source guard: proxy caches negatives for ~1 s only (publish visible immediately)", () => {
    const proxy = srcOf("src/proxy.ts")
    expect(proxy).toContain("info.exists ? 15_000 : 1_000")
  })
})

// ------------------------------------------------------------
// Cross-cutting: the merged view the body renders keeps coherence
// with the capability gates (regression lock for the #58 family)
// ------------------------------------------------------------

describe("#58 family — merged content respects the effective profile", () => {
  it("mergeSiteContent never injects foreign copy for a null draft", () => {
    const merged = mergeSiteContent(null, "seamstress")
    expect(merged.hero.title).toBe(verticalSiteContent("seamstress").hero.title)
  })

  it("the #58 dialog exposes both content modes in BOTH languages", () => {
    const settings = srcOf("src/lib/i18n/dict/settings.ts")
    for (const key of [
      "contentReseed:",
      "contentKeep:",
      "publishedImpact:",
      "seedAdded:",
    ]) {
      expect(settings.match(new RegExp(key, "g"))?.length).toBe(2)
    }
  })
})
