import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { isInternalTenantSlug } from "@/lib/tenant-flags"
import { tenantSitemapXml, resolveAppUrl } from "@/lib/sitemap-builder"
import { sectionsForProfile } from "@/lib/home-sections"
import { getProfile } from "@/lib/profiles/registry"
import { normalizeSections } from "@/lib/site-content"
import { buildTenantJsonLd } from "@/lib/seo"
import { reminderWindow, dueReminderWhere } from "@/lib/jobs/send-due-reminders"
import { isAuthorizedCron } from "@/app/api/cron/tick/route"

const read = (p: string) => readFileSync(__dirname + "/../" + p, "utf8")

// ============================================================
// P1 #76 · P1 #77 · P1 #83 · P2 #75 · P2 #86 — zlati set regresij
// za naslednji batch popravkov. Vsak test je napisan natanko proti
// regresiji, ki jo issue opisuje.
// ============================================================

// ------------------------------------------------------------
// P1 #76 — sistemski časovnik
// ------------------------------------------------------------
describe("P1 #76: scheduler exists and is safe", () => {
  it("vercel.json exists with a cron entry pointing at /api/cron/tick", () => {
    const raw = read("vercel.json")
    expect(raw).toContain("/api/cron/tick")
    // #76 follow-up (commit 1e5f6b4): Vercel plan allows ONE daily cron —
    // the schedule is daily at 03:00 UTC; an external scheduler can hit
    // /api/cron/tick more often (documented in the issue).
    expect(raw).toContain("0 3 * * *")
  })

  it("cron route refuses requests without a valid Bearer CRON_SECRET", () => {
    expect(isAuthorizedCron(null, "s3cret")).toBe(false)
    expect(isAuthorizedCron("Bearer wrong", "s3cret")).toBe(false)
    expect(isAuthorizedCron("Bearer s3cret", undefined)).toBe(false)
    expect(isAuthorizedCron("Bearer s3cret", "s3cret")).toBe(true)
  })

  it("reminder window is 23–25h ahead (24h reminder ± 1h)", () => {
    const now = new Date("2026-01-15T10:00:00Z")
    const { horizonStart, horizonEnd } = reminderWindow(now)
    expect(horizonStart.getTime() - now.getTime()).toBe(23 * 3_600_000)
    expect(horizonEnd.getTime() - now.getTime()).toBe(25 * 3_600_000)
  })

  it("reminders are contractually scoped: PENDING/CONFIRMED only, reminderSentAt null", () => {
    const where = dueReminderWhere(new Date("2026-01-15T10:00:00Z"))
    expect(where.status).toEqual({ in: ["PENDING", "CONFIRMED"] })
    expect(where.reminderSentAt).toBeNull()
    expect((where.startTime as { gte: Date; lt: Date }).gte).toBeTruthy()
  })

  it("JobRun model exists in the schema (silent cron failure is visible)", () => {
    const schema = read("prisma/schema.prisma")
    expect(schema).toContain("model JobRun")
  })

  it("every confirmation send writes confirmationSentAt afterwards", () => {
    for (const file of [
      "src/app/actions/appointments.ts",
      "src/app/actions/stripe.ts",
      "src/app/api/webhooks/stripe/route.ts",
    ]) {
      const src = read(file)
      expect(src.includes("confirmationSentAt"), file).toBe(true)
    }
  })
})

// ------------------------------------------------------------
// P1 #77 — SKU je edinstven PER NAJEMNIKA, ne platformsko
// ------------------------------------------------------------
describe("P1 #77: Product.sku is per-tenant unique", () => {
  const schema = read("prisma/schema.prisma")

  it("Product.sku has NO platform-wide @unique", () => {
    const productBlock = schema.slice(
      schema.indexOf("model Product {"),
      schema.indexOf("model Order {")
    )
    expect(productBlock).not.toMatch(/^\s*sku\s+String\?\s+@unique/m)
    expect(productBlock).toContain("@@unique([organizationId, sku])")
  })

  it("migration drops the global index", () => {
    const migration = read(
      "prisma/migrations/20261128000000_p77_product_sku_per_tenant/migration.sql"
    )
    expect(migration).toContain('DROP INDEX IF EXISTS "Product_sku_key"')
  })

  it("duplicate SKU inside one tenant reads as a human field error (P2002 caught)", () => {
    const actions = read("src/app/actions/products.ts")
    expect(actions).toContain("P2002")
    expect(actions).toContain("Ta SKU je že uporabljen v vaši trgovini.")
  })
})

// ------------------------------------------------------------
// P1 #83 — najemniški sitemap opisuje SAMO enega najemnika
// ------------------------------------------------------------
describe("P1 #83: tenant sitemap isolation", () => {
  const now = new Date("2026-01-15T10:00:00Z")
  const org = {
    slug: "qa-cebelar-test",
    updatedAt: now,
    vertical: "beekeeping",
    profileOverrides: null,
  }

  it("every URL in a tenant sitemap belongs to THAT tenant only", () => {
    const xml = tenantSitemapXml(org)
    expect(xml).toContain("/s/qa-cebelar-test")
    // NIKOLI tuj slug:
    expect(xml).not.toContain("/s/studio-nika")
    expect(xml).not.toContain("/s/rc-beauty")
    const locs = xml.match(/<loc>([^<]+)<\/loc>/g) ?? []
    expect(locs.length).toBeGreaterThan(0)
    for (const loc of locs) {
      expect(loc, loc).toContain("/s/qa-cebelar-test")
    }
  })

  it("qa-* slugs are now internal (excluded from discovery) — #83 exact regression", () => {
    expect(isInternalTenantSlug("qa-cebelar-test")).toBe(true)
    expect(isInternalTenantSlug("qa-verify-52")).toBe(true)
    expect(isInternalTenantSlug("demo-frizer")).toBe(true)
    expect(isInternalTenantSlug("studio-test-lepote")).toBe(true)
    expect(isInternalTenantSlug("rc-beauty")).toBe(false)
    expect(isInternalTenantSlug("studio-nika")).toBe(false)
  })

  it("proxy does NOT rewrite /s/<slug>/sitemap.xml nor /s/<slug>/robots.txt", () => {
    const proxy = read("src/proxy.ts")
    expect(proxy).toContain('"/sitemap.xml"')
    expect(proxy).toContain('"/robots.txt"')
  })

  it("per-tenant routes exist and 404 unpublished/internal tenants", () => {
    const sitemapRoute = read("src/app/s/[slug]/sitemap.xml/route.ts")
    expect(sitemapRoute).toContain("isInternalTenantSlug")
    expect(sitemapRoute).toContain('"PUBLISHED"')
    expect(sitemapRoute).toContain("status: 404")
    const robotsRoute = read("src/app/s/[slug]/robots.txt/route.ts")
    expect(robotsRoute).toContain("/s/${slug}/sitemap.xml")
  })

  it("global platform sitemap is unchanged (lists published tenants)", () => {
    const global = read("src/app/sitemap.ts")
    expect(global).toContain('publishState: "PUBLISHED"')
  })
})

// ------------------------------------------------------------
// P2 #75 — ocene: lastna sekcija, najemnik direktno, aggregateRating
// ------------------------------------------------------------
describe("P2 #75: reviews are a first-class section", () => {
  it("testimonials are NO LONGER keyed on the team section", () => {
    const home = read("src/components/landing/home-content.tsx")
    expect(home).not.toContain('key === "team" && <TestimonialsSection')
    expect(home).toContain('reviews: (\n      <TestimonialsSection')
  })

  it("sectionsForProfile reads capabilities.reviews (was a dead switch) and data-gates the anchor", () => {
    const profile = getProfile("beekeeping") // reviews: "optional", staff disabled
    const enabled = sectionsForProfile(
      { services: true, shop: true, team: false, reviews: true },
      profile
    )
    expect(enabled.reviews).toBe(true)
    expect(enabled.team).toBe(false)

    const noData = sectionsForProfile(
      { services: true, shop: true, team: true, reviews: false },
      profile
    )
    expect(noData.reviews).toBe(false)

    const disabledProfile = getProfile("seamstress") // reviews: "disabled"
    const off = sectionsForProfile(
      { services: true, shop: true, team: true, reviews: true },
      disabledProfile
    )
    expect(off.reviews).toBe(false)
  })

  it("'reviews' is a real SectionKey inserted after team for legacy tenants", () => {
    const stored = normalizeSections([
      { key: "hero", visible: true },
      { key: "team", visible: true },
      { key: "shop", visible: true },
      { key: "cta", visible: true },
    ])
    expect(stored).not.toBeNull()
    const keys = stored!.map((s) => s.key)
    expect(keys).toContain("reviews")
    // kanonična pozicija: takoj za team, NE na koncu pod cta
    expect(keys.indexOf("reviews")).toBe(keys.indexOf("team") + 1)
  })

  it("Review.organizationId exists and serviceId is nullable (schema)", () => {
    const schema = read("prisma/schema.prisma")
    const reviewBlock = schema.slice(
      schema.indexOf("model Review {"),
      schema.indexOf("model ServiceGallery")
    )
    expect(reviewBlock).toMatch(/serviceId\s+String\?/)
    expect(reviewBlock).toMatch(/organizationId\s+String\s*\n/)
    expect(reviewBlock).toContain("organization Organization")
  })

  it("JSON-LD emits aggregateRating only from real rows", () => {
    const base = {
      org: { name: "X", slug: "x", logo: null, vertical: "beauty" },
      content: {
        openingHours: [],
        social: {},
        seo: {},
        hero: { eyebrow: "", title: "", subtitle: "", primaryCta: { label: "", href: "" }, secondaryCta: null },
        features: { title: "", subtitle: "", items: [] },
        services: { title: "", subtitle: "" },
        about: { title: "", paragraphs: [], stats: [], imageUrl: null },
        team: { title: "", subtitle: "" },
        shop: { title: "", subtitle: "" },
        cta: { title: "", text: "", buttonLabel: "", buttonHref: "", imageUrl: null },
        sections: [],
      } as never,
      appUrl: "https://x.test",
      indexable: true,
    }
    const withRating = buildTenantJsonLd({
      ...base,
      aggregateRating: { ratingValue: "4.7", reviewCount: 12 },
    })
    expect((withRating as { aggregateRating?: unknown }).aggregateRating).toBeTruthy()
    expect((withRating as { aggregateRating: { ratingValue: string; reviewCount: number } }).aggregateRating.ratingValue).toBe("4.7")

    const without = buildTenantJsonLd({ ...base })
    expect((without as { aggregateRating?: unknown }).aggregateRating).toBeUndefined()
  })

  it("createReview resolves the tenant server-side (never from the form)", () => {
    const actions = read("src/app/actions/reviews.ts")
    expect(actions).toContain("organizationId: org.id")
    expect(actions).toContain("hasPurchased")
  })
})

// ------------------------------------------------------------
// P2 #86 — potrditev rezervacije ne bere tujih terminov
// ------------------------------------------------------------
describe("P2 #86: booking success is tenant-scoped", () => {
  it("the appointment lookup is findFirst scoped by organizationId, never findUnique by id", () => {
    const page = read("src/app/(public)/booking/success/page.tsx")
    expect(page).not.toContain("prisma.appointment.findUnique")
    expect(page).toContain("prisma.appointment.findFirst")
    expect(page).toContain("organizationId: site.org.id")
  })

  it("foreign and unknown ids share the same 'not found' state (no oracle)", () => {
    const page = read("src/app/(public)/booking/success/page.tsx")
    // isti UI vejivec za !appointment — tuji id in neznani id padeta v isti
    // "Rezervacija ni bila najdena" prikaz
    expect(page).toContain("Rezervacija ni bila najdena")
  })
})
