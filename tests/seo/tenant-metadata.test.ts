// ============================================================
// P1 — Per-tenant SEO (root layout generateMetadata)
// Pure builders only: context routing, canonical/OG/noindex
// rules, relative media URL absolutization.
// ============================================================

import { describe, it, expect } from "vitest"
import type { Metadata } from "next"
import {
  absoluteMediaUrl,
  buildTenantJsonLd,
  buildTenantMetadata,
  resolveAppUrl,
  tenantDescription,
  tenantOgImageUrl,
  tenantTitle,
} from "@/lib/seo"
import { isEmailServiceConfigured } from "@/lib/email/config"
import { DEFAULT_VERTICAL_CONTENT } from "./helpers/site-content"
import type { SiteContent } from "@/lib/site-content"

function contentWith(overrides: Partial<SiteContent>): SiteContent {
  return {
    ...DEFAULT_VERTICAL_CONTENT,
    ...overrides,
  } as SiteContent
}

const org = { name: "Salon Luna", slug: "salon-luna", logo: "/img/logo.png" }

describe("resolveAppUrl", () => {
  it("prefers NEXT_PUBLIC_APP_URL and strips trailing slash", () => {
    expect(
      resolveAppUrl({ NEXT_PUBLIC_APP_URL: "https://app.example.org/" })
    ).toBe("https://app.example.org")
  })

  it("falls back to VERCEL_URL", () => {
    expect(resolveAppUrl({ VERCEL_URL: "rcbeautysalon-phi.vercel.app" })).toBe(
      "https://rcbeautysalon-phi.vercel.app"
    )
  })

  it("falls back to localhost", () => {
    expect(resolveAppUrl({})).toBe("http://localhost:3000")
  })
})

describe("tenantTitle / tenantDescription", () => {
  it("uses SEO overrides when present", () => {
    const content = contentWith({
      seo: { title: "Frizerski salon Luna", description: "Najboljši striži v Ljubljani" },
    })
    expect(tenantTitle(content, org.name)).toBe("Frizerski salon Luna")
    expect(tenantDescription(content, org.name)).toBe(
      "Najboljši striži v Ljubljani"
    )
  })

  it("falls back to hero and org name, ignores whitespace-only entries", () => {
    const content = contentWith({
      hero: { ...DEFAULT_VERTICAL_CONTENT.hero, subtitle: "Vaš frizer v centru" },
      seo: { title: "   ", description: "" },
    })
    expect(tenantTitle(content, org.name)).toBe(org.name)
    expect(tenantDescription(content, org.name)).toBe("Vaš frizer v centru")
  })
})

describe("absoluteMediaUrl", () => {
  it("passes absolute URLs through", () => {
    expect(absoluteMediaUrl("https://cdn.example.org/x.jpg", "https://app.si")).toBe(
      "https://cdn.example.org/x.jpg"
    )
  })

  it("absolutizes relative media paths", () => {
    expect(absoluteMediaUrl("/api/media/hero.jpg", "https://app.si")).toBe(
      "https://app.si/api/media/hero.jpg"
    )
  })

  it("returns null for empty input", () => {
    expect(absoluteMediaUrl(null, "https://app.si")).toBeNull()
    expect(absoluteMediaUrl("   ", "https://app.si")).toBeNull()
  })
})

const appUrl = "https://rcbeautysalon-phi.vercel.app"
const content = contentWith({
  hero: { ...DEFAULT_VERTICAL_CONTENT.hero, imageUrl: "/api/media/hero.jpg" },
  seo: { title: "Salon Luna — frizerstvo", description: "Rezervirajte online" },
})

describe("buildTenantMetadata", () => {
  // Next Metadata tipi so široki zveze (OGImage | OGImage[] ipd.) —
  // v testih jih preberemo prek ozkih prilagajanj.
  function ogImages(md: Metadata): { url: string }[] | undefined {
    return md.openGraph?.images as { url: string }[] | undefined
  }
  function twitterCard(md: Metadata): string | undefined {
    return (md.twitter as { card?: string } | undefined)?.card
  }

  it("tenant context: canonical + OG + index when published", () => {
    const md = buildTenantMetadata({
      org,
      content,
      appUrl,
      context: "tenant",
      indexable: true,
    })
    expect(md.title).toBe("Salon Luna — frizerstvo")
    expect(md.alternates?.canonical).toBe(`${appUrl}/s/salon-luna`)
    expect(md.robots).toEqual({ index: true, follow: true })
    expect(md.openGraph?.url).toBe(`${appUrl}/s/salon-luna`)
    expect(ogImages(md)?.[0]?.url).toBe(`${appUrl}/api/media/hero.jpg`)
    expect(twitterCard(md)).toBe("summary_large_image")
  })

  it("tenant context: noindex for draft (owner preview)", () => {
    const md = buildTenantMetadata({
      org,
      content,
      appUrl,
      context: "tenant",
      indexable: false,
    })
    expect(md.robots).toEqual({ index: false, follow: false })
  })

  it("bare context: canonical to /s/slug so / and /s/slug dedupe", () => {
    const md = buildTenantMetadata({
      org,
      content,
      appUrl,
      context: "bare",
      indexable: true,
    })
    expect(md.alternates?.canonical).toBe(`${appUrl}/s/salon-luna`)
    expect(md.openGraph?.siteName).toBe("Salon Luna")
  })

  it("private context (dashboard): no canonical/OG and noindex", () => {
    const md = buildTenantMetadata({
      org,
      content,
      appUrl,
      context: "private",
      indexable: false,
    })
    expect(md.alternates).toBeUndefined()
    expect(md.openGraph).toBeUndefined()
    expect(md.twitter).toBeUndefined()
    expect(md.robots).toEqual({ index: false, follow: false })
    expect(md.title).toBe("Salon Luna — frizerstvo")
  })

  it("falls back to logo when hero image missing; platform OG image as last resort", () => {
    const noHero = contentWith({
      hero: { ...DEFAULT_VERTICAL_CONTENT.hero, imageUrl: undefined },
    })
    const md = buildTenantMetadata({
      org,
      content: noHero,
      appUrl,
      context: "tenant",
      indexable: true,
    })
    expect(md.alternates?.canonical).toBe(`${appUrl}/s/salon-luna`)
    expect(ogImages(md)?.[0]?.url).toBe(`${appUrl}/img/logo.png`)

    // Brez hero in logotipa — platforma vedno ponudi OG sliko (družabni
    // predogled na WhatsApp/Facebook), kartica pa velika.
    const noLogoOrg = { ...org, logo: null }
    const md2 = buildTenantMetadata({
      org: noLogoOrg,
      content: noHero,
      appUrl,
      context: "tenant",
      indexable: true,
    })
    expect(ogImages(md2)?.[0]?.url).toBe(`${appUrl}/og-default.png`)
    expect(twitterCard(md2)).toBe("summary_large_image")
  })
})

describe("tenantOgImageUrl", () => {
  it("hero > logo > default platform OG image", () => {
    expect(tenantOgImageUrl(content, org.logo, appUrl)).toBe(
      `${appUrl}/api/media/hero.jpg`
    )
    const noHero = contentWith({
      hero: { ...DEFAULT_VERTICAL_CONTENT.hero, imageUrl: undefined },
    })
    expect(tenantOgImageUrl(noHero, org.logo, appUrl)).toBe(
      `${appUrl}/img/logo.png`
    )
    expect(tenantOgImageUrl(noHero, null, appUrl)).toBe(
      `${appUrl}/og-default.png`
    )
  })
})

describe("buildTenantJsonLd", () => {
  it("returns null when not indexable (draft/private)", () => {
    expect(
      buildTenantJsonLd({ org, content, appUrl, indexable: false })
    ).toBeNull()
  })

  it("builds LocalBusiness with vertical @type, URL, image and opening hours", () => {
    const ld = buildTenantJsonLd({
      org: { ...org, vertical: "frizer" },
      content,
      appUrl,
      indexable: true,
    }) as Record<string, unknown>
    expect(ld["@context"]).toBe("https://schema.org")
    expect(ld["@type"]).toBe("HairSalon")
    expect(ld.name).toBe("Salon Luna")
    expect(ld.url).toBe(`${appUrl}/s/salon-luna`)
    expect(ld.image).toBe(`${appUrl}/api/media/hero.jpg`)
    const hours = ld.openingHoursSpecification as Array<Record<string, unknown>>
    expect(hours.length).toBeGreaterThan(0)
    expect(hours[0]["@type"]).toBe("OpeningHoursSpecification")
  })

  it("unknown vertical falls back to neutral LocalBusiness; empty hours/s social omitted (P1 #36)", () => {
    const bare = contentWith({
      openingHours: [],
      social: { instagram: "", facebook: undefined } as unknown as SiteContent["social"],
    })
    const ld = buildTenantJsonLd({
      org: { ...org, vertical: "generic" },
      content: bare,
      appUrl,
      indexable: true,
    }) as Record<string, unknown>
    expect(ld["@type"]).toBe("LocalBusiness")
    expect(ld.openingHoursSpecification).toBeUndefined()
    expect(ld.sameAs).toBeUndefined()
  })
})

describe("isEmailServiceConfigured", () => {
  it("false without key or with placeholder key", () => {
    expect(isEmailServiceConfigured({})).toBe(false)
    expect(isEmailServiceConfigured({ RESEND_API_KEY: "re_placeholder_not_configured" })).toBe(false)
    expect(isEmailServiceConfigured({ RESEND_API_KEY: "   " })).toBe(false)
  })

  it("true with a real key", () => {
    expect(isEmailServiceConfigured({ RESEND_API_KEY: "re_abc123" })).toBe(true)
  })
})
