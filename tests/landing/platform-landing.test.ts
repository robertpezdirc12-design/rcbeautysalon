// ============================================================
// F1 — URL-localised platform landing
//   "/"  (sl) and "/en" (en): copy parity, owner positioning,
//   real example assets, honest claims, hreflang, <html lang>.
//
// These are pure/structural checks: no DB, no browser, no Next.js boot.
// ============================================================

import { describe, it, expect } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { landingSl, landingEn } from "@/lib/i18n/dict/landing"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { listProfileOptions } from "@/lib/profiles/registry"
import {
  PLATFORM_LOCALE_HEADER,
  platformLocaleForPath,
  resolveHtmlLocale,
  resolvePlatformLandingLocale,
} from "@/lib/i18n/platform-locale"
import {
  PLATFORM_LANDING_HEADER,
  PLATFORM_LANDING_HEADER_VALUE,
  isPlatformLandingPath,
  isPlatformLandingRequest,
} from "@/lib/platform-shell"
import { platformSitemapEntries } from "@/lib/sitemap-builder"

const read = (p: string) => readFileSync(join(__dirname, "../../", p), "utf8")

/** Rekurzivna primerjava oblik: vsak SL ključ obstaja v EN (in obratno). */
function expectSameShape(a: unknown, b: unknown, path = "") {
  if (a !== null && typeof a === "object") {
    expect(b, `object at ${path}`).toBeTruthy()
    const aKeys = Object.keys(a as object).sort()
    const bKeys = Object.keys(b as object).sort()
    expect(bKeys, `keys at ${path}`).toEqual(aKeys)
    for (const key of aKeys) {
      expectSameShape(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        `${path}.${key}`
      )
    }
    return
  }
  expect(typeof b, `primitive at ${path}`).toBe(typeof a)
}

describe("landing dictionary", () => {
  it("sl/en have identical shapes and are both registered", () => {
    expectSameShape(landingSl, landingEn)
    expect(getDictionary("sl").landing).toBe(landingSl)
    expect(getDictionary("en").landing).toBe(landingEn)
  })

  it("all copy is non-empty in both languages", () => {
    const walk = (value: unknown, path: string) => {
      if (typeof value === "string") {
        expect(value.trim().length, `empty string at ${path}`).toBeGreaterThan(
          0
        )
        return
      }
      if (Array.isArray(value)) {
        value.forEach((v, i) => walk(v, `${path}[${i}]`))
        return
      }
      if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`)
      }
    }
    walk(landingSl, "sl")
    walk(landingEn, "en")
  })

  it("keeps the OWNER H1, tagline and strategic copy verbatim (15aa272)", () => {
    expect(landingSl.hero.h1Lead).toBe(
      "Tvoje podjetje. Tvoja spletna stran. Tvoje stranke."
    )
    expect(landingSl.hero.h1Accent).toBe("Tvoja platforma.")
    expect(landingSl.hero.tagline).toBe(
      "Your Business. Your Website. Your Customers. Your Platform."
    )
    expect(landingSl.hero.lead).toContain(
      "MARKEC ni samo še en izdelovalec spletnih strani"
    )
    // the owner's EN tagline is the EN H1, not a re-translation
    expect(`${landingEn.hero.h1Lead} ${landingEn.hero.h1Accent}`).toBe(
      "Your Business. Your Website. Your Customers. Your Platform."
    )
  })

  it("keeps the owner's three-step flow", () => {
    expect(landingSl.steps.items.map((s) => s.title)).toEqual([
      "Vstopite z računom",
      "Uredite v svojem prostoru",
      "Objavite — stranke pridejo",
    ])
    expect(landingEn.steps.items).toHaveLength(3)
  })

  it("no invented price, popularity claim or fake social proof", () => {
    const text = JSON.stringify({ sl: landingSl, en: landingEn })
    expect(text).not.toContain("Najpogostejša izbira")
    expect(text).not.toContain("Most popular")
    expect(text).not.toMatch(/€\s?\d/)
    expect(text).not.toContain("€/mesec")
    expect(text).not.toMatch(
      /\d{3,}\s*(strank|podjetij uporablja|customers trust)/i
    )
  })
})

describe("example cards = sample of 5 of 12", () => {
  const ids = listProfileOptions().map((v) => v.id)

  it("12 registered profiles still exist", () => {
    expect(ids).toHaveLength(12)
  })

  it("exactly 5 examples, no generic, same set in both languages", () => {
    expect(landingSl.examples.items).toHaveLength(5)
    expect(landingEn.examples.items).toHaveLength(5)
    expect(landingSl.examples.items.map((e) => e.vertical)).toEqual(
      landingEn.examples.items.map((e) => e.vertical)
    )
    expect(landingSl.examples.items.map((e) => e.vertical)).not.toContain(
      "generic"
    )
  })

  it("every vertical resolves to a real profile and every image exists", () => {
    for (const item of landingSl.examples.items) {
      expect(ids, `${item.vertical} must exist in the registry`).toContain(
        item.vertical
      )
      expect(item.image.startsWith("/img/presets/")).toBe(true)
      const file = join(__dirname, "../../public", item.image)
      expect(existsSync(file), `missing ${item.image}`).toBe(true)
      expect(item.alt.trim().length).toBeGreaterThan(0)
    }
    expect(
      existsSync(join(__dirname, "../../public/img/presets/hero-barber.jpg"))
    ).toBe(true)
  })

  it("sample caption states the real total", () => {
    expect(landingSl.examples.more).toContain("5 od 12")
    expect(landingEn.examples.more).toContain("5 of the 12")
  })
})

describe("URL locale (<html lang>)", () => {
  it("only the explicit /en path is URL-localised", () => {
    expect(platformLocaleForPath("/en")).toBe("en")
    expect(platformLocaleForPath("/en/")).toBe("en")
    expect(platformLocaleForPath("/en/faq")).toBe("en")
    expect(platformLocaleForPath("/")).toBeNull()
    expect(platformLocaleForPath("/login")).toBeNull()
    expect(platformLocaleForPath("/english")).toBeNull()
    expect(platformLocaleForPath("/s/frizer-ana")).toBeNull()
  })

  it("URL wins over the cookie; unknown/tampered header values are ignored", () => {
    expect(resolveHtmlLocale("sl", "en")).toBe("en")
    expect(resolveHtmlLocale("sl", null)).toBe("sl")
    expect(resolveHtmlLocale("en", null)).toBe("en")
    expect(resolveHtmlLocale("sl", "de")).toBe("sl")
    expect(resolveHtmlLocale("sl", "EN")).toBe("sl")
    expect(PLATFORM_LOCALE_HEADER).toBe("x-markec-locale")
  })

  it("proxy strips the incoming header and sets it only for /en", () => {
    const proxy = read("src/proxy.ts")
    expect(proxy).toContain("PLATFORM_LOCALE_HEADER")
    expect(proxy).toContain("requestHeaders.delete(PLATFORM_LOCALE_HEADER)")
    expect(proxy).toContain("platformLocaleForPath(pathname)")
    // /en must NOT be treated as a bare tenant content path
    const bare = proxy
      .split("\n")
      .find((l) => l.startsWith("const BARE_PUBLIC_PATH"))!
    expect(bare).not.toContain("en")
    // /en must not inherit a custom-domain tenant header/theme
    expect(proxy).toContain("verify-email|en)(\\/|$)")
  })

  it("root layout resolves <html lang> from the trusted header", () => {
    const layout = read("src/app/layout.tsx")
    expect(layout).toContain("resolveHtmlLocale")
    expect(layout).toContain("PLATFORM_LOCALE_HEADER")
    expect(layout).toContain("lang={htmlLocale}")
  })

  it("/en can never inherit a tenant theme or tenant JSON-LD", () => {
    const layout = read("src/app/layout.tsx")
    // resolveBrandOrg() has a session fallback; without this guard a
    // signed-in tenant owner would see their own palette/metadata here.
    expect(layout).toContain(
      'get(PLATFORM_LOCALE_HEADER) === "en") return null'
    )
  })
})

describe("SEO — both landing URLs", () => {
  it("explicit routes exist and both render the localised component", () => {
    const sl = read("src/app/(public)/page.tsx")
    const en = read("src/app/en/page.tsx")
    expect(sl).toContain('<PlatformLanding locale="sl" />')
    expect(en).toContain('<PlatformLanding locale="en" />')
    expect(en).toContain("export async function generateMetadata")
    expect(en).toContain('locale: "en_US"')
  })

  it("both pages take title/description from the landing dictionary", () => {
    const sl = read("src/app/(public)/page.tsx")
    const en = read("src/app/en/page.tsx")
    expect(sl).toContain("title: landingSl.meta.title")
    expect(sl).toContain("description: landingSl.meta.description")
    expect(en).toContain("title: t.title")
    expect(en).toContain("description: t.description")
    expect(landingSl.meta.title).toContain("MARKEC")
    expect(landingEn.meta.title).toContain("MARKEC")
  })

  it("reciprocal hreflang + x-default on both pages", () => {
    const sl = read("src/app/(public)/page.tsx")
    const en = read("src/app/en/page.tsx")
    for (const source of [sl, en]) {
      expect(source).toContain("languages:")
      expect(source).toContain("sl: appUrl")
      expect(source).toContain('"x-default": appUrl')
    }
    expect(sl).toContain("en: `${appUrl}/en`")
    expect(en).toContain("en: enUrl")
    expect(en).toContain("canonical: enUrl")
  })

  it("sitemap publishes / and /en with the same hreflang set", () => {
    const entries = platformSitemapEntries("https://markec.example")
    expect(entries.map((e) => e.url)).toEqual([
      "https://markec.example",
      "https://markec.example/en",
    ])
    for (const entry of entries) {
      expect(entry.alternates?.languages).toEqual({
        sl: "https://markec.example",
        en: "https://markec.example/en",
        "x-default": "https://markec.example",
      })
    }
  })

  it("crawlable endonym switcher, no IP/Accept-Language redirect", () => {
    const landing = read("src/components/landing/platform-landing.tsx")
    expect(landing).toContain('langLink("/", t.languages.sl')
    expect(landing).toContain('langLink("/en", t.languages.en')
    // endonyms, not flags or language codes, in BOTH dictionaries
    expect(landingSl.languages.sl).toBe("Slovenščina")
    expect(landingSl.languages.en).toBe("English")
    expect(landingEn.languages.sl).toBe("Slovenščina")
    expect(landingEn.languages.en).toBe("English")
    expect(landing).not.toContain("localStorage")
    expect(landing).not.toContain("accept-language")
  })
})

// ============================================================
// F2 — narrow SSR gate. CartProvider returns null on the server and
// used to blank the whole <body>, so crawlers saw no <h1> and no
// structured data. The proxy now tags only "/" and "/en"; the root
// layout omits that one wrapper there and emits JSON-LD in <head>.
// ============================================================
describe("F2 — server-rendered platform landing", () => {
  it("tags exactly the two marketing routes", () => {
    expect(isPlatformLandingPath("/")).toBe(true)
    expect(isPlatformLandingPath("/en")).toBe(true)
    expect(isPlatformLandingPath("/en/")).toBe(false)
    expect(isPlatformLandingPath("/english")).toBe(false)
    expect(isPlatformLandingPath("/login")).toBe(false)
    expect(isPlatformLandingPath("/dashboard")).toBe(false)
    expect(isPlatformLandingPath("/s/frizer-ana")).toBe(false)
  })

  it("accepts only the exact proxy value (no forged header)", () => {
    expect(PLATFORM_LANDING_HEADER).toBe("x-markec-platform-landing")
    expect(isPlatformLandingRequest(PLATFORM_LANDING_HEADER_VALUE)).toBe(true)
    expect(isPlatformLandingRequest(null)).toBe(false)
    expect(isPlatformLandingRequest("true")).toBe(false)
    expect(isPlatformLandingRequest("1 ")).toBe(false)
    expect(isPlatformLandingRequest("")).toBe(false)
  })

  it("URL decides <html lang> on the landing, never the admin cookie", () => {
    expect(resolvePlatformLandingLocale(null)).toBe("sl")
    expect(resolvePlatformLandingLocale("en")).toBe("en")
    expect(resolvePlatformLandingLocale("de")).toBe("sl")
    expect(resolvePlatformLandingLocale("EN")).toBe("sl")
  })

  it("proxy strips the incoming value and excludes tenant/custom-domain roots", () => {
    const proxy = read("src/proxy.ts")
    expect(proxy).toContain("requestHeaders.delete(PLATFORM_LANDING_HEADER)")
    expect(proxy).toContain("isPlatformLandingPath(pathname)")
    // a rewritten /s/<slug> -> / pass carries the signed tenant header
    expect(proxy).toContain("!requestHeaders.has(ORG_HEADER)")
    // "/" on a verified custom domain is that tenant's home, not ours;
    // "/en" is denylisted there on purpose (F1) and stays a platform route
    expect(proxy).toContain('pathname === "/en" || !isCustomDomainHost')
    expect(proxy).toContain(
      "requestHeaders.set(PLATFORM_LANDING_HEADER, PLATFORM_LANDING_HEADER_VALUE)"
    )
  })

  it("root layout keeps the gate everywhere else and moves JSON-LD into <head>", () => {
    const layout = read("src/app/layout.tsx")
    expect(layout).toContain("isPlatformLandingRequest(")
    expect(layout).toContain("isPlatformLanding ?")
    expect(layout).toContain("<CartProvider>{pageTree}</CartProvider>")
    expect(layout).toContain("resolvePlatformLandingLocale")
    expect(layout).toContain('"@type": "SoftwareApplication"')
    expect(layout).toContain('property="og:locale:alternate"')
  })

  it("landing component has an <h1> and no duplicate structured data", () => {
    const landing = read("src/components/landing/platform-landing.tsx")
    expect(landing).toContain("<h1")
    expect(landing).not.toContain("application/ld+json")
    expect(landing).not.toContain('property="og:locale:alternate"')
    // the component must remain a server component
    expect(landing).not.toContain('"use client"')
  })

  it("CartProvider is SSR-safe and no longer blanks the body (F2b)", () => {
    const cart = read("src/components/providers/cart-provider.tsx")
    // The client-only gate that returned null on the server is gone; the
    // provider must render its children on every render so the whole
    // platform server-renders instead of shipping an empty shell.
    expect(cart).not.toContain("isClient")
    expect(cart).not.toContain("return null")
    expect(cart).toContain("<>{children}</>")
  })
})
