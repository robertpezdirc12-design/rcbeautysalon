import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Script from "next/script"
import { prisma } from "@/lib/prisma"
import { PublicNavbar } from "@/components/layouts/public-navbar"
import Footer from "@/components/layouts/footer"
import { getPublicOrg, ORG_HEADER } from "@/lib/tenant"
import { resolveAvailableSections } from "@/lib/public-site"
import { resolvePublicCta } from "@/lib/public-cta"
import { resolvePublishGate } from "@/lib/publish-gate"
import { MaintenanceScreen } from "@/components/public/maintenance-screen"
import { CartOrgScope } from "@/components/shop/cart-org-scope"
import { analyticsScriptIdFor } from "@/lib/analytics/measurement-id"
import { PublicI18nProvider } from "@/components/providers/public-i18n-provider"
import { getLocaleFromCookies } from "@/lib/i18n/server"

/**
 * P2 #46/#47: section flags so the navbar never links an anchor that
 * does not exist (data gate) or a module the profile disables
 * (capability gate). Shared with the (customer) layout — navigation
 * must be identical on every public route.
 */
async function availableSectionsFor(org: {
  id: string
  vertical: string | null
  secondaryVertical?: string | null
  profileOverrides: unknown
}) {
  return resolveAvailableSections(org.id, org)
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const org = await getPublicOrg()

  // P1 #27 (re-audit 2026-11): UNKNOWN slug ali SUSPENDED tenant pod
  // /s/[slug] prej vrnila HTTP 200 ("Stran ni objavljena") — soft 404,
  // ki ga iskalniki indeksirajo. Zdaj notFound() → pravi HTTP 404 z
  // blagovno stranjo (app/not-found.tsx). Klic je v LAYOUTU (shell
  // faza), tako da se 404 status pošlje, PREDEN streaming začne.
  // Layout niha ne dostopa do podatkov drugega najemnika (E3-8 ostaja).
  const slugHeader = (await headers()).get(ORG_HEADER)
  if (slugHeader && !org) {
    notFound()
  }

  // Publication gate (EPIC #3 E3-1): non-published tenants are private.
  // The owner/staff of THIS tenant still sees the full site as a preview,
  // with a clear banner; everyone else gets a neutral maintenance screen
  // (no tenant data is leaked — not even the business name).
  const gate = await resolvePublishGate(org)
  if (org && gate !== "published") {
    if (gate === "hidden") {
      return <MaintenanceScreen />
    }
    // E4-2b: owner preview of an UNPUBLISHED site — intentionally NO
    // analytics script (visits here are not public traffic and the
    // owner's measurement ID is scoped to the published site only).
    return (
      <PublicI18nProvider org={org}>
        <PublicNavbar
          org={{
            slug: org.slug,
            name: org.name,
            logo: org.logo,
          }}
          cta={null}
          availableSections={await availableSectionsFor(org)}
        />
        <CartOrgScope slug={org.slug} />
        <div className="bg-amber-100 text-amber-950 border-b border-amber-200 px-4 py-2 text-center text-sm font-medium dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Predogled — ta stran še ni objavljena. Obiščevalci vidijo vzdrževalno
          stran, dokler je ne objavite v nastavitvah.
        </div>
        <main id="main" tabIndex={-1}>{children}</main>
        <Footer />
      </PublicI18nProvider>
    )
  }

  // E4-2b — owner-supplied analytics (GA4). The script is injected ONLY
  // when a PUBLISHED tenant site is being served AND the owner saved a
  // valid measurement ID. Null for the platform-root default tenant
  // without a site, hidden states and invalid/absent IDs — the platform
  // itself never tracks anyone (analyticsScriptIdFor is the single
  // testable decision point for this rule).
  let analyticsId: string | null = null
  if (org && gate === "published") {
    const config = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { analyticsMeasurementId: true },
    })
    analyticsId = analyticsScriptIdFor({
      gate,
      measurementId: config?.analyticsMeasurementId,
    })
  }

  const cta = resolvePublicCta(org?.vertical, await getLocaleFromCookies(), org?.profileOverrides)

  const skipLabel = (await getLocaleFromCookies()) === "en" ? "Skip to content" : "Preskoči na vsebino"

  return (
    <>
      {/* P2 #12 (audit-2026-11): skip link — first focusable element
          (WCAG 2.4.1 Bypass Blocks), target is <main id="main"> below. */}
      <a
        href="#main"
        className="bg-background text-foreground sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:px-4 focus:py-2 focus:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-primary"
      >
        {skipLabel}
      </a>
      {analyticsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${analyticsId}');`}
          </Script>
        </>
      )}
      <PublicI18nProvider org={org}>
        <PublicNavbar
          org={{
            slug: org?.slug ?? null,
            name: org?.name ?? "Salon",
            logo: org?.logo ?? null,
          }}
          cta={cta.enabled ? { label: cta.label, href: cta.href } : null}
          availableSections={
            org ? await availableSectionsFor(org) : undefined
          }
        />
        <CartOrgScope slug={org?.slug ?? null} />
        <main id="main" tabIndex={-1}>{children}</main>
        <Footer />
      </PublicI18nProvider>
    </>
  )
}
