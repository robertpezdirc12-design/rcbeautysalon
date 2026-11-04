import { Suspense } from "react"
import type { Metadata } from "next"
import { RegisterForm } from "@/components/auth/register-form"
import { RegisterSkeleton } from "@/components/auth/register-skeleton"

export const metadata: Metadata = {
  title: "Registracija | Poslovna platforma",
  // P2 #68: nevtralen opis — platforma ni samo za lepoto.
  description: "Ustvarite račun za rezervacije, povpraševanja in nakupe na strani svojega podjetja.",
  robots: { index: false, follow: false },
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterSkeleton />}>
      <RegisterForm />
    </Suspense>
  )
}
