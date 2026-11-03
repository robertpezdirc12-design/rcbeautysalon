import { Suspense } from "react"
import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import { LoginSkeleton } from "@/components/auth/login-skeleton"
import { getPublicOrg } from "@/lib/tenant"

export const metadata: Metadata = {
  title: "Prijava | Poslovna platforma",
  description:
    "Prijavite se v svoj račun za upravljanje terminov, ogled storitev in dostop do posebnih funkcij.",
  robots: { index: false, follow: false },
}

export default async function LoginPage() {
  // P2 #17 (audit-2026-11): when the login is reached from a tenant site
  // (x-org-slug header), brand it with the salon's logo/name and offer a
  // way back instead of dropping the customer onto platform branding.
  const org = await getPublicOrg().catch(() => null)
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
