import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { isBookingEnabled } from "@/lib/public-cta"
import { getProfile, isCapabilityEnabled, type ActivityProfile } from "@/lib/profiles/registry"
import { applyOverrides, parseOverrides } from "@/lib/profiles/overrides"
import { isInternalTenantSlug } from "@/lib/tenant-flags"

/**
 * sitemap.xml (SEO odkrivanje) — javne strani vsake OBJAVLJENE organizacije.
 *
 * P1 #28 (re-audit 2026-11): sitemap je prej objavil vse najemnike,
 * tudi demo in testne (demo-*, test-*) — 73 URL-jev, ki KonkURIRAJO z
 * resnimi saloni in razkrivajo notranje testne podatke. Zdaj:
 *  - demo/test najemniki so izključeni (isInternalTenantSlug),
 *  - /booking se izpiše SAMO za najemnike z omogočenimi rezervacijami
 *    (prej je bil URL dvojnik /inquiry za ne-booking profile),
 *  - /shop se izpiše samo, ko profil sploh omogoča trgovino,
 *  - lastModified je posodobljen na org.updatedAt (koristen za recrawl).
 * Osnutki (draft) ostajajo izključeni (niso indeksirani).
 *
 * P0 #24 (reopen): revalidate 900 s — sitemap je brez tega statično
 * pečen ob buildu; sprememba vertikale/objave (npr. /booking izstop)
 * se v sitemap odrazi šele ob NASLEDNJEM deployu. Z revalidate se
 * osveži iz baze vsaj vsakih 15 min.
 */

// #24: glej komentar zgoraj — sitemap ni več statičen za večnost.
export const revalidate = 900

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/+$/, "")

  const orgs = await prisma.organization
    .findMany({
      where: { status: "ACTIVE", publishState: "PUBLISHED" },
      orderBy: { createdAt: "asc" },
      select: {
        slug: true,
        updatedAt: true,
        vertical: true,
        profileOverrides: true,
      },
    })
    .catch(() => [])

  const productionOrgs = orgs.filter((org) => !isInternalTenantSlug(org.slug))

  const tenantEntries: MetadataRoute.Sitemap = productionOrgs.flatMap((org) => {
    const base = `${appUrl}/s/${org.slug}`
    const lastModified = org.updatedAt

    // P2 #46: učinkovit profil (registrski profil + lastnikove prepone) —
    // zmogljivostno vezani URL-ji se izpišejo SAMO, ko jih najemnik dejansko
    // ponuja (prej je bil /services brezpogojen → prazna indeksirana stran
    // za profile, ki storitve izključujejo).
    const profile: ActivityProfile = applyOverrides(
      getProfile(org.vertical),
      parseOverrides(org.profileOverrides)
    )

    const paths: Array<{ path: string; priority: number }> = [
      { path: "", priority: 1 },
    ]

    // P2 #46: /services samo, ko profil sploh omogoča storitve.
    if (isCapabilityEnabled(profile, "services")) {
      paths.push({ path: "/services", priority: 0.7 })
    }

    // #28/#24: samo profili z dejansko omogočenimi rezervacijami.
    if (isBookingEnabled(org.vertical, org.profileOverrides)) {
      paths.push({ path: "/booking", priority: 0.7 })
    }

    // Trgovina samo, ko je zmogljivost shop dejansko omogočena.
    if (isCapabilityEnabled(profile, "shop")) {
      paths.push({ path: "/shop", priority: 0.7 })
    }

    return paths.map(({ path, priority }) => ({
      url: `${base}${path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority,
    }))
  })

  // P1 #39-5: goli korenski URL preusmerja na kanonično /s/{slug} pot
  // (permanentRedirect), zato ga v sitemap ne objavljamo več — vsi URL-ji
  // v sitemapu vračajo 200 s samo-referencirajočim canonicalom.
  return tenantEntries
}
