import { Suspense } from "react"
import type { Metadata } from "next"
import { RegisterForm } from "@/components/auth/register-form"
import { RegisterSkeleton } from "@/components/auth/register-skeleton"
import { prisma } from "@/lib/prisma"

// P2 #74: registracija ustvari STRANKO (CLIENTE) — naslov pove, kaj
// nastaja ("Ustvari račun"), ne "poslovna platforma". Z ?org= poimenuje
// najemnika, pri katerem bo gost kupoval/rezerviral (isti vzorec kot
// /login?org= v #68). Zahtevki providerjev gredo na /start — ne tukaj.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>
}): Promise<Metadata> {
  const { org: orgSlug } = await searchParams
  const org = orgSlug
    ? await prisma.organization.findFirst({
        where: { slug: orgSlug, status: "ACTIVE" },
        select: { name: true },
      })
    : null
  return {
    title: org ? `Ustvari račun · ${org.name}` : "Ustvari račun",
    description:
      "Račun za rezervacije, povpraševanja in nakupe na strani svojega podjetja.",
    robots: { index: false, follow: false },
  }
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterSkeleton />}>
      <RegisterForm />
    </Suspense>
  )
}
