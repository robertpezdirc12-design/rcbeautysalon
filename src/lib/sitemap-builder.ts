import type { MetadataRoute } from "next"
import { isBookingEnabled } from "@/lib/public-cta"
import { isCapabilityEnabled } from "@/lib/profiles/registry"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"

/**
 * Skupni gradnik URL-jev za sitemap (#83).
 *
 * P1 #83: vsak najemnik sme v svojem sitemap.xml videti SAMO sebe —
 * prej je bila vsaka najemniška pot /s/<slug>/sitemap.xml prepisana na
 * globalno /sitemap.xml, ki izpiše VSE objavljene najemnike (30 URL-jev,
 * 10 podjetij — kršitev osamljenosti). Platformski /sitemap.xml ostane
 * globalen ( legitimno odkrivanje platforme ), najemniški pa opisuje
 * ENEGA najemnika.
 *
 * Čista funkcija (registry + capability preverjanja brez I/O) — testabilna.
 */

/** Platformski app URL (isti izračun kot v src/app/sitemap.ts). */
export function resolveAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/+$/, "")
}

/** Minimalni del Organization, ki ga gradnik potrebuje.
 *  profileOverrides je JsonValue v bazi — parseOverrides() ga prevzame tako.
 *  #105-nadaljevanje: moduleStates (in secondaryVertical) so NEOBVEZNI, a
 *  najemniška ruta (getOrgBySlug) jih vedno poda — modulna vrata veljajo
 *  tudi za sitemap (izklopljen modul = URL ni indeksiran). */
export interface SitemapOrg {
  slug: string
  updatedAt: Date
  vertical: string | null
  secondaryVertical?: string | null
  profileOverrides: unknown
  moduleStates?: { moduleId: string; state: string }[] | null
}

/** URL-ji ENEGA najemnika — capability-vezani (isti pravila kot globalni sitemap). */
export function tenantSitemapEntries(org: SitemapOrg): MetadataRoute.Sitemap {
  const appUrl = resolveAppUrl()
  const base = `${appUrl}/s/${org.slug}`
  const lastModified = org.updatedAt

  // #105-nadaljevanje: polni resolve (vertikala → sekundarna → overrides →
  // moduleStates) — izklopljen modul njegovega URL-ja NE indeksiramo.
  const profile = resolveEffectiveProfile(org)

  const paths: Array<{ path: string; priority: number }> = [
    { path: "", priority: 1 },
  ]

  if (isCapabilityEnabled(profile, "services")) {
    paths.push({ path: "/services", priority: 0.7 })
  }

  if (isBookingEnabled(org)) {
    paths.push({ path: "/booking", priority: 0.7 })
  }

  if (isCapabilityEnabled(profile, "shop")) {
    paths.push({ path: "/shop", priority: 0.7 })
  }

  return paths.map(({ path, priority }) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority,
  }))
}

/**
 * F1 — the PLATFORM landing itself is a public, indexable page.
 *
 * P1 #39-5's old comment ("bare root redirects to /s/{slug}") is stale:
 * since P1 #66 the bare "/" serves <PlatformLanding /> with a 200 and a
 * self-referencing canonical. Both "/" and "/en" therefore belong in the
 * sitemap, each with the SAME reciprocal hreflang set + x-default.
 *
 * Pure function — no DB, testable in tests/landing/platform-landing.test.ts.
 */
export function platformSitemapEntries(
  baseUrl: string = resolveAppUrl()
): MetadataRoute.Sitemap {
  const base = baseUrl.replace(/\/+$/, "")
  const languages = {
    sl: base,
    en: `${base}/en`,
    "x-default": base,
  }
  return [
    {
      url: base,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages },
    },
    {
      url: `${base}/en`,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: { languages },
    },
  ]
}

/** XML odgovor za enega najemnika (application/xml, no-store — vsebina je glede na najemnika). */
export function tenantSitemapXml(org: SitemapOrg): string {
  const entries = tenantSitemapEntries(org)
  const urls = entries
    .map((e) => {
      const lastmod = `<lastmod>${new Date(e.lastModified as Date).toISOString()}</lastmod>`
      return `  <url><loc>${e.url}</loc>${lastmod}<changefreq>${e.changeFrequency}</changefreq><priority>${e.priority}</priority></url>`
    })
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
