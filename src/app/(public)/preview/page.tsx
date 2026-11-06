import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { getTrustedOrgSlug, getOrgBySlug } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { hasUnpublishedChanges, parsePublishState } from "@/lib/publication"
import { mergeSiteContent } from "@/lib/site-content"
import { upgradeLegacyDefaultCopy } from "@/lib/verticals"
import {
  getPublicFeaturedProducts,
  getPublicFeaturedServices,
  getPublicFeaturedStaff,
} from "@/lib/public-site"
import { HomeContent } from "@/components/landing/home-content"
import { resolveCtaLinks, resolveCtaSectionHref } from "@/lib/public-cta"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import { isCapabilityEnabled } from "@/lib/profiles/registry"
import { PreviewBanner } from "@/components/public/preview-banner"

// ============================================================
// DRAFT PREVIEW (EPIC #3 E3-2) — /s/[slug]/preview
//
// Renders the WORKING site content (draft) instead of the published
// snapshot. Strictly owner/staff-only: anyone else is redirected to
// the public site, so drafts can never leak.
// ============================================================

export default async function PreviewPage() {
  // V-1 (issue #102): only the proxy-SIGNED header selects the tenant.
  const slug = await getTrustedOrgSlug()
  if (!slug) redirect("/")

  const org = await getOrgBySlug(slug)
  if (!org) redirect("/")

  // Owner gate: only this tenant's own signed-in users may preview drafts.
  const session = await auth()
  if (session?.user?.organizationId !== org.id) {
    redirect(`/s/${org.slug}`)
  }

  const config = await prisma.salonConfig.findUnique({
    where: { organizationId: org.id },
    select: { siteContent: true, publishedContentVersion: true },
  })

  // ALWAYS the live working content — that is the point of the preview.
  // #100 MARKEC: zastarela platformsko privzeta besedila demo najemnika se
  // nadgradijo enako kot na javni strani — predogled je resničen (WYSIWYG).
  const content = upgradeLegacyDefaultCopy(
    mergeSiteContent(config?.siteContent, org.vertical),
    org.slug,
    org.vertical
  )
  const [featuredServices, featuredProducts, featuredStaff] = await Promise.all([
    getPublicFeaturedServices(org.id),
    getPublicFeaturedProducts(org.id),
    getPublicFeaturedStaff(org.id),
  ])

  const state = parsePublishState(org.publishState)
  const unpublished = hasUnpublishedChanges(
    org.contentVersion,
    config?.publishedContentVersion ?? null
  )

  return (
    <div>
      <PreviewBanner
        state={state}
        hasUnpublishedChanges={unpublished}
        siteUrl={`/s/${org.slug}`}
      />
      <main>
        <HomeContent
          org={{ slug: org.slug, name: org.name, logo: org.logo }}
          content={content}
          ctaLinks={resolveCtaLinks(org, content)}
          ctaSectionHref={resolveCtaSectionHref(org, content.cta.buttonHref)}
          serviceCtaLabel={
            resolveEffectiveProfile(org).capabilities.appointments !== "disabled"
              ? "Rezerviraj"
              : "Poglej"
          }
          featuredServices={featuredServices}
          featuredProducts={featuredProducts}
          featuredStaff={featuredStaff}
          hasServices={featuredServices.length > 0}
          hasProducts={featuredProducts.length > 0}
          // P2 #75: predogled pokaže formo za oceno podjetja za profile brez
          // storitev — ista pravila kot javna stran.
          canReviewBusiness={
            !isCapabilityEnabled(resolveEffectiveProfile(org), "services")
          }
        />
      </main>
    </div>
  )
}
