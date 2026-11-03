import { redirect } from "next/navigation"
import { getResolvedOrg } from "@/lib/tenant"
import { orgPath } from "@/lib/org-path"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"

// P0 #24 (re-audit 2026-11) — INQUIRY GUARD V SHELL FAZI
// Booking-capable tenants keep their calendar; the inquiry page is for
// inquiry/quote/order profiles. Stražar v LAYOUTU (shell faza) → pravi
// 307 namesto 200 + odjemalske navigacije.

export default async function InquiryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const org = await getResolvedOrg()
  const profile = resolveEffectiveProfile(org)
  if (profile.website.ctaMode === "booking") {
    redirect(orgPath(org?.slug, "/"))
  }
  return <>{children}</>
}
