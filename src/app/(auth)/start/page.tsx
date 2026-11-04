import type { Metadata } from "next"
import { auth } from "@/lib/auth/auth"
import { StartWizard } from "@/components/onboarding/start-wizard"
import { getVertical } from "@/lib/verticals"

// P1 #66: nevtralni naslov — platforma najema strani OBSIM VSEM obrtom
// (prej je obljubljala samo frizerske/nail/kozmetične salone).
export const metadata: Metadata = {
  title: "Ustvari svoje podjetje",
  description:
    "Izberite svojo dejavnost in takoj dobite spletno stran s katalogom, povpraševanji in trgovino. Vsebino urejate sami — objavite, ko ste pripravljeni.",
}

// P1 #40 (onboarding audit 2026-11): čarovnik mora poznati sejo —
// prijavljen uporabnik ne ustvarja novega računa (korak 3 ne sprašuje
// po geslu in ne more zavrniti njegovega e-poštnega naslova).
// P1 #66: deep-link iz izložbe — /start?vertical=<id> predizbere
// dejavnost (korak 1), neznana vrednost se VARNO prezre (nikoli tiho
// ne pade na "generic").
export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ vertical?: string }>
}) {
  const session = await auth()
  const { vertical } = await searchParams
  const initialVertical =
    vertical && getVertical(vertical).id === vertical ? vertical : null
  return (
    <StartWizard
      authedEmail={session?.user?.email ?? null}
      authedName={session?.user?.name ?? null}
      initialVertical={initialVertical}
    />
  )
}
