import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { PublicNavbar } from "@/components/layouts/public-navbar"
import Footer from "@/components/layouts/footer"
import { getPublicOrg, ORG_HEADER } from "@/lib/tenant"
import { resolvePublicCta } from "@/lib/public-cta"
import { resolvePublishGate } from "@/lib/publish-gate"
import { MaintenanceScreen } from "@/components/public/maintenance-screen"
import { CartOrgScope } from "@/components/shop/cart-org-scope"
import { PublicI18nProvider } from "@/components/providers/public-i18n-provider"
import { getLocaleFromCookies } from "@/lib/i18n/server"

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const org = await getPublicOrg()

  // P1 #27 (re-audit 2026-11): enako kot v (public) layoutu — neznana
  // vertikala / suspendiran tenant pod /s/[slug] → pravi HTTP 404 (prej
  // 200 + vzdrževalna stran). Klic v layoutu = shell faza = status 404.
  const slugHeader = (await headers()).get(ORG_HEADER)
  if (slugHeader && !org) {
    notFound()
  }

  // Publication gate (EPIC #3 E3-1): same rule as the (public) layout —
  // drafts/unpublished tenants are private; owner sees a preview, everyone
  // else a neutral maintenance screen (also covers /shop and /inquiry).
  const gate = await resolvePublishGate(org)
  if (org && gate !== "published") {
    if (gate === "hidden") {
      return <MaintenanceScreen />
    }
    return (
      <PublicI18nProvider org={org}>
        <PublicNavbar
          org={{
            slug: org.slug,
            name: org.name,
            logo: org.logo,
          }}
          cta={null}
        />
        <CartOrgScope slug={org.slug} />
        <div className="bg-amber-100 text-amber-950 border-b border-amber-200 px-4 py-2 text-center text-sm font-medium dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Predogled — ta stran še ni objavljena. Obiščevalci vidijo vzdrževalno
          stran, dokler je ne objavite v nastavitvah.
        </div>
        <main>{children}</main>
        <Footer />
      </PublicI18nProvider>
    )
  }

  const cta = resolvePublicCta(org?.vertical, await getLocaleFromCookies(), org?.profileOverrides)

  return (
    <PublicI18nProvider org={org}>
      <PublicNavbar
        org={{
          slug: org?.slug ?? null,
          name: org?.name ?? "Salon",
          logo: org?.logo ?? null,
        }}
        cta={cta.enabled ? { label: cta.label, href: cta.href } : null}
      />
      <CartOrgScope slug={org?.slug ?? null} />
      <main>{children}</main>
      <Footer />
    </PublicI18nProvider>
  )
}
