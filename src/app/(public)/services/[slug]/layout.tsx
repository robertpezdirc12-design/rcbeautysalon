import { notFound } from "next/navigation"
import { getPublicSiteData, getPublicServiceBySlug } from "@/lib/public-site"

// ============================================================
// P1 #27 (re-audit 2026-11) — SHELL-FAZA 404 ZA STOREVICE
//
// `notFound()` v PAGE-u pride PREPOZNO: Next.js splakne odzivno
// lupino (HTTP 200), še preden se stran do konca izriše (streaming),
// zato so manjkajoče storitve dobile status 200 (soft 404).
// Preverjanje obstoja je prestavljeno v LAYOUT — ta je del lupine,
// zato `notFound()` tu steče PRED splakom in odgovor dobi pravi
// HTTP 404. Poizvedba je React-cacheirana (isti klic kot v strani,
// brez dodatnega strela na bazo).
// ============================================================

export default async function ServiceDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const site = await getPublicSiteData()
  const service = site ? await getPublicServiceBySlug(site.org.id, slug) : null

  if (!site || !service) {
    notFound()
  }

  return <>{children}</>
}
