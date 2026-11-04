import { Suspense } from "react"
import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import { LoginSkeleton } from "@/components/auth/login-skeleton"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = {
  title: "Prijava | Poslovna platforma",
  description:
    "Prijavite se v svoj račun za upravljanje terminov, ogled storitev in dostop do posebnih funkcij.",
  robots: { index: false, follow: false },
}

/**
 * P2 #68 — auth branding follows the EXPLICIT tenant context, never a
 * fallback. The footer links carry `/login?org=<slug>` (#53 made /login
 * platform-level, so the proxy sets no ORG_HEADER here and getPublicOrg()
 * would resolve to "the oldest published tenant" — i.e. every login page
 * was branded by a random business). No org param → NEUTRAL platform
 * branding; never another tenant's name.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>
}) {
  const { org: orgSlug } = await searchParams
  const org = orgSlug
    ? await prisma.organization.findFirst({
        where: { slug: orgSlug, status: "ACTIVE" },
        select: { name: true, logo: true, slug: true },
      })
    : null
  return (
    <main>
      <Suspense fallback={<LoginSkeleton />}>
        <LoginForm
          orgName={org?.name ?? null}
          orgLogo={org?.logo ?? null}
          orgSlug={org?.slug ?? null}
        />
      </Suspense>
    </main>
  )
}
