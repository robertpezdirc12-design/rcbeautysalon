import { headers } from "next/headers"
import Script from "next/script"
import { prisma } from "@/lib/prisma"
import { PublicNavbar } from "@/components/layouts/public-navbar"
import Footer from "@/components/layouts/footer"
import { getPublicOrg, ORG_HEADER } from "@/lib/tenant"
import { resolvePublicCta } from "@/lib/public-cta"
import { resolvePublishGate } from "@/lib/publish-gate"
import { MaintenanceScreen } from "@/components/public/maintenance-screen"
import { CartOrgScope } from "@/components/shop/cart-org-scope"
import { analyticsScriptIdFor } from "@/lib/analytics/measurement-id"
import { PublicI18nProvider } from "@/components/providers/public-i18n-provider"
import { getLocaleFromCookies } from "@/lib/i18n/server"

/**
 * Whether the tenant's home page will actually render the #services and
 * #shop sections (both require featured + active content). The navbar uses
 * this to drop anchors that would be dead — e.g. a product-only tenant
 * has no services section to scroll to.
 */
async function resolveAvailableSections(
  organizationId: string
): Promise<{ services: boolean; shop: boolean }> {
  const [featuredServices, featuredProducts] = await Promise.all([
    prisma.service.count({
      where: { organizationId, isActive: true, isFeatured: true },
    }),
    prisma.product.count({
      where: { organizationId, isActive: true, isFeatured: true },
    }),
  ])
  return { services: featuredServices > 0, shop: featuredProducts > 0 }
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const org = await getPublicOrg()

  // Suspension gate (EPIC #3 E3-5): a SPECIFIC tenant site was requested
  // (/s/[slug]) but its org is unavailable (SUSPENDED or otherwise
  // inactive). Render the neutral maintenance screen — never another
  // tenant's content under this URL, not even for the owner.
  const slugHeader = (await headers()).get(ORG_HEADER)
  if (slugHeader && !org) {
    return <MaintenanceScreen />
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
          availableSections={await resolveAvailableSections(org.id)}
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
          availableSections={org ? await resolveAvailableSections(org.id) : undefined}
        />
        <CartOrgScope slug={org?.slug ?? null} />
        <main id="main" tabIndex={-1}>{children}</main>
        <Footer />
      </PublicI18nProvider>
    </>
  )
}
