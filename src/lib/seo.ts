import type { Metadata } from "next"
import type { SiteContent } from "@/lib/site-content"
import { isInternalTenantSlug } from "@/lib/tenant-flags"

/**
 * Per-tenant SEO (P1) — čiste funkcije, testabilne brez DB.
 *
 * Konteksti:
 *  - "tenant": zahteva pod /s/[slug] (x-org-slogan header) — polni OG/Twitter,
 *    canonical na /s/{slug}, indeksirano le, če je najemnik objavljen
 *  - "bare": anonimni goli javni dosežek (prva objavljena organizacija) —
 *    kot tenant, canonical usmerja na kanonični /s/{slug} URL
 *  - "private": brandanje iz prijavljene seje (dashboard) ali skriti osnutek —
 *    samo naslov/opis + noindex (dashboard ne sme biti indeksiran,
 *    kanonični URL na dashboard straneh bi bil zavajajoč)
 */

export type SeoContext = "tenant" | "bare" | "private"

export interface TenantSeoOrg {
  name: string
  slug: string
  logo: string | null
  /** Vertikala (beauty/frizer/nails/cosmetica/seamstress) — določa JSON-LD @type. */
  vertical?: string | null
}

export interface TenantSeoInput {
  org: TenantSeoOrg
  content: SiteContent
  appUrl: string
  context: SeoContext
  indexable: boolean
}

/** App URL za absolutne OG/canonical povezave (env injiciran za teste). */
export function resolveAppUrl(
  env: Record<string, string | undefined> = process.env
): string {
  const explicit = env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, "")

  const vercel = env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`

  return "http://localhost:3000"
}

/** SEO naslov najemnika: SEO vnos > ime salona. */
export function tenantTitle(content: SiteContent, orgName: string): string {
  const custom = content.seo.title?.trim()
  return custom || orgName
}

/** SEO opis najemnika: SEO vnos > hero podnasov > varno prazno. */
export function tenantDescription(
  content: SiteContent,
  orgName: string
): string {
  const custom = content.seo.description?.trim()
  if (custom) return custom
  const subtitle = content.hero.subtitle?.trim()
  return subtitle || orgName
}

/** Relativne medijske poti (/api/media/…) pretvori v absolutne URL-je. */
export function absoluteMediaUrl(
  url: string | null | undefined,
  appUrl: string
): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith("/")) return `${appUrl}${trimmed}`
  return `${appUrl}/${trimmed}`
}

/**
 * OG slika najemnika: hero slika > logotip > privzeta platforma OG slika.
 * Brez slike družabni deljenje (WhatsApp/Facebook — v Sloveniji ključni
 * kanal) ne pokaže predogleda, zato imamo vedno zanesljiv zadnji pregled.
 */
export function tenantOgImageUrl(
  content: SiteContent,
  orgLogo: string | null,
  appUrl: string
): string {
  return (
    absoluteMediaUrl(content.hero.imageUrl, appUrl) ??
    absoluteMediaUrl(orgLogo, appUrl) ??
    `${appUrl}/og-default.png`
  )
}

export interface JsonLdOpeningHour {
  day: number
  open: string | null
  close: string | null
}

/**
 * P1 #36 (re-audit 2026-11): preslikava vertikale → schema.org tip.
 * Prej je bila zadnja možnost "BeautySalon", zato je splošni/neznan
 * profil opisoval napačen posel; "seamstress" je (pravilno) dajal
 * ClothingStore — kar je razkrilo, da rc-beauty nosi napačno vertikalo
 * (glej #24 — podatkovni popravek). Neznana vertikala → nevtralni
 * LocalBusiness, nikoli več trdovratno napačen tip.
 */
const SCHEMA_TYPE_BY_VERTICAL: Record<string, string> = {
  beauty: "BeautySalon",
  frizer: "HairSalon",
  barber: "HairSalon",
  nails: "NailSalon",
  cosmetica: "BeautySalon",
  massage: "DaySpa",
  epilation: "BeautySalon",
  "tire-service": "AutoRepair",
  seamstress: "ClothingStore",
  beekeeping: "Store",
  generic: "LocalBusiness",
}

export function schemaTypeForVertical(
  vertical: string | null | undefined
): string {
  return (vertical && SCHEMA_TYPE_BY_VERTICAL[vertical]) || "LocalBusiness"
}

/**
 * JSON-LD LocalBusiness (tip po vertikali) — Google bogati rezultati
 * (delovni čas, povezave, opis) brez ročnega vnosa. Vključuje samo
 * podatke, ki jih lastnik dejansko je nastavil (brez izmišljenih naslovov).
 */
export function buildTenantJsonLd({
  org,
  content,
  appUrl,
  indexable,
}: {
  org: TenantSeoOrg
  content: SiteContent
  appUrl: string
  indexable: boolean
}): Record<string, unknown> | null {
  if (!indexable) return null

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]
  const hours = (content.openingHours || [])
    .filter((h) => h.open && h.close)
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: days[h.day % 7],
      opens: h.open,
      closes: h.close,
    }))

  const sameAs = Object.values(content.social || {}).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u)
  )

  return {
    "@context": "https://schema.org",
    "@type": schemaTypeForVertical(org.vertical),
    name: org.name,
    description: tenantDescription(content, org.name),
    url: `${appUrl}/s/${org.slug}`,
    image: tenantOgImageUrl(content, org.logo, appUrl),
    ...(hours.length > 0 ? { openingHoursSpecification: hours } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  }
}

export function buildTenantMetadata({
  org,
  content,
  appUrl,
  context,
  indexable,
  path,
}: TenantSeoInput & {
  /** P1 #26: pot trenutne strani (npr. "/services") — canonical na VSAKO
   * stran kaže nase, ne na koren najemnika. Prazen/neznan → koren. */
  path?: string
}): Metadata {
  const title = tenantTitle(content, org.name)
  const description = tenantDescription(content, org.name)

  // P1 #28 (re-audit 2026-11): demo/test najemniki so noindex, tudi če
  // so tehnično objavljeni — sitemap jih že izključuje, to je obramba
  // v globino proti indeksiranju notranjih testnih podatkov.
  const indexAllowed = indexable && !isInternalTenantSlug(org.slug)

  // P1 #26 (re-audit 2026-11): canonical je VEDNO samo-referencirajoč
  // URL trenutne strani (prej je vsaka podstran kazala na koren
  // najemnika — 25+ strani "dvojniki" domače strani).
  const canonicalPath = path && path !== "/" ? `/s/${org.slug}${path}` : `/s/${org.slug}`

  const base: Metadata = {
    title,
    description,
    icons: { icon: org.logo || "/favicon.svg" },
    manifest: "/manifest.json",
    robots: indexAllowed
      ? { index: true, follow: true }
      : { index: false, follow: false },
  }

  // Zasebni kontekst (dashboard / skriti osnutek): brez OG in kanoničnega URL.
  if (context === "private") {
    return base
  }

  const ogImage = tenantOgImageUrl(content, org.logo, appUrl)

  return {
    ...base,
    metadataBase: new URL(appUrl),
    alternates: {
      canonical: `${appUrl}${canonicalPath}`,
    },
    openGraph: {
      title,
      description,
      url: `${appUrl}${canonicalPath}`,
      siteName: org.name,
      type: "website",
      locale: "sl_SI",
      images: ogImage ? [{ url: ogImage, alt: org.name }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

/**
 * P1 #26: pomožnik za PODSTRANI, ki gradijo svoj Metadata (title/description)
 * in morajo samo dodati samo-referencirajoč canonical + dedično robots pravilo.
 * metadataBase podedujejo od root layouta, zato je relativna pot dovolj.
 */
export function canonicalMetadata(
  slug: string | null | undefined,
  path: string,
  extra?: Metadata
): Metadata {
  if (!slug) return extra ?? {}
  return {
    ...extra,
    alternates: {
      ...(extra?.alternates ?? {}),
      canonical: `/s/${slug}${path}`,
    },
  }
}

/** P1 #26: noindex za ne-indeksirane poteh (košarica, checkout, prijava). */
export function noIndexMetadata(extra?: Metadata): Metadata {
  return {
    ...extra,
    robots: { index: false, follow: true },
  }
}
