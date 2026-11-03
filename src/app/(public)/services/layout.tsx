import { notFound } from "next/navigation"
import { getPublicOrg } from "@/lib/tenant"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import { isCapabilityEnabled } from "@/lib/profiles/registry"

/**
 * P2 #46 — vrata za /services v SHELL fazi.
 *
 * notFound() v STRANI (page.tsx) pride PREPOZNO: layout shell je že
 * spran, zato brskalnik/iskalniki vidijo HTTP 200 s 404 vsebino —
 * mehki 404 (isti razred napake, ki jo je P1 #27 popravil za neznane
 * najemnike). V layoutu segmenta se 404 status pošlje PRED streamingom
 * (isti vzorec kot inquiry/layout.tsx za booking → dom, P0 #24).
 *
 * Profil, ki IZKLOPI storitve (npr. čebelarstvo), ne objavlja strani
 * /services — niti z zapuščenimi vrsticami v bazi (brez migracije).
 */
export default async function ServicesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const org = await getPublicOrg()
  if (
    org &&
    !isCapabilityEnabled(resolveEffectiveProfile(org), "services")
  ) {
    notFound()
  }
  return <>{children}</>
}
