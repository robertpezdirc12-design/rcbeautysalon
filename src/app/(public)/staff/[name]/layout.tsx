import { notFound } from "next/navigation"
import { getPublicSiteData, getPublicStaffBySlug } from "@/lib/public-site"

// P1 #27 (re-audit 2026-11) — SHELL-FAZA 404 ZA OSEBJE
// Ista logika kot za storitve: preverjanje obstoja v layoutu (del
// odzivne lupine) → notFound() daje pravi HTTP 404 namesto 200.
// Poizvedba je React-cacheirana (en strel na bazo na zahtevek).

export default async function StaffDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ name: string }>
}) {
  const { name } = await params
  const site = await getPublicSiteData()
  const staffMember = site ? await getPublicStaffBySlug(site.org.id, name) : null

  if (!site || !staffMember) {
    notFound()
  }

  return <>{children}</>
}
