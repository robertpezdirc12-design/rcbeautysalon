import type { Metadata } from "next"
import { auth } from "@/lib/auth/auth"
import { StartWizard } from "@/components/onboarding/start-wizard"

export const metadata: Metadata = {
  title: "Ustvari svoj salon",
  description:
    "Registrirajte svoj frizerski, nail ali kozmetični salon in takoj dobite spletno stran z rezervacijami in trgovino.",
}

// P1 #40 (onboarding audit 2026-11): čarovnik mora poznati sejo —
// prijavljen uporabnik ne ustvarja novega računa (korak 3 ne sprašuje
// po geslu in ne more zavrniti njegovega e-poštnega naslova).
export default async function StartPage() {
  const session = await auth()
  return (
    <StartWizard
      authedEmail={session?.user?.email ?? null}
      authedName={session?.user?.name ?? null}
    />
  )
}
