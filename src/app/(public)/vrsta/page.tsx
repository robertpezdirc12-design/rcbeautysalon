import { notFound } from "next/navigation"
import { getPublicSiteData, redirectBareToTenant } from "@/lib/public-site"
import { canonicalMetadata } from "@/lib/seo"
import { resolvePublicEffectiveProfile } from "@/lib/profiles/resolve"
import { GENERIC_PROFILE_ID, getProfile, isCapabilityEnabled } from "@/lib/profiles/registry"

import { WalkInPublicClient } from "@/components/public/walk-in-public"

// ============================================================
// #98 (AD-02) — ŽIVA VRSTA (javna stran)
// Gost se prijavi brez računa, dobi kodo vstopnice in vidi "ste X.
// na vrsti". Modul je capability-gated: izklopljen = pravi 404
// (§5.2 — javni vhod onemogočen, ne skrit gum).
// lastnik (#112 UX nadaljevanje): obiskovalec mora TAKOJ videti,
// katera dejavnost se tu izvaja (frizer/mehanik/…) — naslov je
// "{dejavnost} — živa vrsta", pod njim 3 jasni koraki.
// ============================================================

export async function generateMetadata() {
  const site = await getPublicSiteData()
  const orgName = site?.org.name ?? "Podjetje"
  const vertical = site?.org.vertical
  const activity =
    vertical && vertical !== GENERIC_PROFILE_ID ? getProfile(vertical).label : null
  return canonicalMetadata(site?.org.slug, "/vrsta", {
    title: activity ? `${activity} — živa vrsta | ${orgName}` : `Živa vrsta | ${orgName}`,
    description: activity
      ? `Vrsta pri ${activity} ${orgName}: vpišite ime brez računa in spremljajte, kdaj ste na vrsti.`
      : "Vpišite se v vrsto brez računa in spremljajte svojo pozicijo.",
  })
}

export default async function WalkInPublicPage() {
  await redirectBareToTenant("/vrsta")
  const site = await getPublicSiteData()
  if (!site?.org) notFound()

  // Vrata modula: izklopljen capability (tudi prek overrides) = 404.
  const profile = resolvePublicEffectiveProfile(site.org)
  if (!isCapabilityEnabled(profile, "walkIn")) notFound()

  // Dejavnost iz vertikale (generična brez vertikale = brez oznake).
  const vertical = site.org.vertical
  const activity =
    vertical && vertical !== GENERIC_PROFILE_ID ? getProfile(vertical).label : null

  return (
    <main id="main" tabIndex={-1}>
      <div className="container mx-auto max-w-md px-4 py-12">
        <div className="space-y-2 text-center">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {site.org.name}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            {activity ? (
              <>
                {activity} — <span className="text-primary-text">živa vrsta</span>
              </>
            ) : (
              "Živa vrsta"
            )}
          </h1>
          <p className="text-muted-foreground text-sm">Brez čakanja v prostoru — 3 koraki:</p>
          <ol className="text-foreground/90 space-y-1 text-left text-sm">
            <li>
              <span className="text-primary-text font-bold">1.</span> Vpišite ime spodaj —
              dobite svojo številko.
            </li>
            <li>
              <span className="text-primary-text font-bold">2.</span> Na telefonu vidite, kdaj
              ste na vrsti (lahko spremljate od doma).
            </li>
            <li>
              <span className="text-primary-text font-bold">3.</span> Ko ste na vrsti, pridete
              noter.
            </li>
          </ol>
        </div>

        <WalkInPublicClient />

        <p className="text-muted-foreground mt-3 text-center text-xs">
          Brez računa · Brezplačno
        </p>
      </div>
    </main>
  )
}
