import { notFound } from "next/navigation"
import { getPublicSiteData, redirectBareToTenant } from "@/lib/public-site"
import { canonicalMetadata } from "@/lib/seo"
import { resolvePublicEffectiveProfile } from "@/lib/profiles/resolve"
import { isCapabilityEnabled } from "@/lib/profiles/registry"

import { WalkInPublicClient } from "@/components/public/walk-in-public"

// ============================================================
// #98 (AD-02) — ŽIVA VRSTA (javna stran)
// Gost se prijavi brez računa, dobi kodo vstopnice in vidi "ste X.
// na vrsti". Modul je capability-gated: izklopljen = pravi 404
// (§5.2 — javni vhod onemogočen, ne skrit gum).
// ============================================================

export async function generateMetadata() {
  const site = await getPublicSiteData()
  const orgName = site?.org.name ?? "Podjetje"
  return canonicalMetadata(site?.org.slug, "/vrsta", {
    title: `Živa vrsta | ${orgName}`,
    description: "Prijavite se v vrsto brez računa in spremljajte svojo pozicijo.",
  })
}

export default async function WalkInPublicPage() {
  await redirectBareToTenant("/vrsta")
  const site = await getPublicSiteData()
  if (!site?.org) notFound()

  // Vrata modula: izklopljen capability (tudi prek overrides) = 404.
  const profile = resolvePublicEffectiveProfile(site.org)
  if (!isCapabilityEnabled(profile, "walkIn")) notFound()

  return (
    <main id="main" tabIndex={-1}>
      <div className="container mx-auto max-w-md px-4 py-12">
        <div className="space-y-1 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Živa vrsta</h1>
          <p className="text-muted-foreground text-sm">
            {site.org.name} — prijavite se brez računa in brez čakanja na
            mestu: spremljajte svojo pozicijo od doma.
          </p>
        </div>

        <WalkInPublicClient />
      </div>
    </main>
  )
}
