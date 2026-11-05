"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"

import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import {
  hasUnpublishedChanges,
  parsePublishState,
  validatePublishRequirements,
} from "@/lib/publication"
import {
  mergeSiteContent,
  type ContentActivityMismatch,
} from "@/lib/site-content"
import { isSampleImageUrl, upgradeLegacyDefaultCopy } from "@/lib/verticals"
import { revalidatePath } from "next/cache"

export interface PublicationStatus {
  state: ReturnType<typeof parsePublishState>
  publishedAt: Date | null
  /** True when the working content differs from the published snapshot (E3-2). */
  hasUnpublishedChanges: boolean
  /** True when a published snapshot exists (false = pre-E3-2 tenant). */
  hasPublishedSnapshot: boolean
  /** P2 #61: non-blocking pre-publish advisories (sample imagery, hidden legacy rows). */
  warnings: string[]
}

/** Current publication state for the Settings card. */
export async function getPublicationStatus(): Promise<PublicationStatus> {
  const { org } = await requirePermissionOrg("settings.manage")
  const [config, serviceCount, productCount] = await Promise.all([
    prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { email: true, phone: true, siteContent: true, publishedContentVersion: true },
    }),
    prisma.service.count({ where: { organizationId: org.id } }),
    prisma.product.count({ where: { organizationId: org.id } }),
  ])
  const profile = resolveEffectiveProfile(org)

  // P2 #61: pre-publish advisories computed with the SAME validator the
  // publish action uses — behavior can never drift between surfaces.
  const rendered = upgradeLegacyDefaultCopy(
    mergeSiteContent(config?.siteContent, org.vertical),
    org.slug
  )
  const usesOnlySampleImages =
    isSampleImageUrl(rendered.hero.imageUrl) &&
    isSampleImageUrl(rendered.about.imageUrl) &&
    isSampleImageUrl(rendered.cta.imageUrl)
  const validation = validatePublishRequirements({
    orgName: org.name,
    contactEmail: config?.email ?? null,
    contactPhone: config?.phone ?? null,
    serviceCount,
    productCount,
    capabilities: {
      services: profile.capabilities.services,
      shop: profile.capabilities.shop,
    },
    siteContent: config?.siteContent ?? null,
    vertical: org.vertical,
    usesOnlySampleImages,
  })

  return {
    state: parsePublishState(org.publishState),
    publishedAt: org.publishedAt,
    hasUnpublishedChanges: hasUnpublishedChanges(
      org.contentVersion,
      config?.publishedContentVersion ?? null
    ),
    hasPublishedSnapshot: config?.publishedContentVersion != null,
    warnings: validation.warnings,
  }
}

/**
 * Publish the tenant site. Runs the requirement gate FIRST: on failure the
 * publish state is untouched (a failed publish can never replace a working
 * site) and the caller receives actionable errors.
 *
 * A successful publish also SNAPSHOTS the current site content (E3-2): the
 * public site renders the snapshot, so draft edits stay private until the next
 * publish. Tenants without a stored snapshot keep rendering live content
 * (pre-E3-2 behavior, unchanged).
 */
export async function publishSite(): Promise<
  | { success: true; warnings: string[] }
  | { success: false; errors: string[]; mismatch: ContentActivityMismatch | null }
> {
  const { org } = await requirePermissionOrg("settings.manage")

  const [config, serviceCount, productCount] = await Promise.all([
    prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { email: true, phone: true, siteContent: true },
    }),
    prisma.service.count({ where: { organizationId: org.id } }),
    prisma.product.count({ where: { organizationId: org.id } }),
  ])
  const profile = resolveEffectiveProfile(org)

  // P2 #61: what the site will actually RENDER is the merged content —
  // sample-imagery detection runs on that view (missing fields fall back
  // to the preset samples).
  const rendered = upgradeLegacyDefaultCopy(
    mergeSiteContent(config?.siteContent, org.vertical),
    org.slug
  )
  const usesOnlySampleImages =
    isSampleImageUrl(rendered.hero.imageUrl) &&
    isSampleImageUrl(rendered.about.imageUrl) &&
    isSampleImageUrl(rendered.cta.imageUrl)

  const validation = validatePublishRequirements({
    orgName: org.name,
    contactEmail: config?.email ?? null,
    contactPhone: config?.phone ?? null,
    serviceCount,
    productCount,
    capabilities: {
      services: profile.capabilities.services,
      shop: profile.capabilities.shop,
    },
    siteContent: config?.siteContent ?? null,
    vertical: org.vertical,
    usesOnlySampleImages,
  })

  if (!validation.ok) {
    return { success: false, errors: validation.errors, mismatch: validation.mismatch }
  }

  const snapshotVersion = org.contentVersion
  const snapshotContent = config?.siteContent ?? undefined
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: org.id },
      data: { publishState: "PUBLISHED", publishedAt: new Date() },
    }),
    // Freeze exactly the content that is now live. Null siteContent is fine —
    // the public site falls back to the vertical defaults (as it always has).
    prisma.salonConfig.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        name: org.name,
        siteContent: snapshotContent,
        publishedSiteContent: snapshotContent,
        publishedContentVersion: snapshotVersion,
      },
      update: {
        publishedSiteContent: snapshotContent,
        publishedContentVersion: snapshotVersion,
      },
    }),
  ])

  revalidatePath("/", "layout")
  return { success: true, warnings: validation.warnings }
}

/** Unpublish (take the site back to maintenance). Data is never touched. */
export async function unpublishSite(): Promise<{ success: true }> {
  const { org } = await requirePermissionOrg("settings.manage")
  await prisma.organization.update({
    where: { id: org.id },
    data: { publishState: "UNPUBLISHED" },
  })
  revalidatePath("/", "layout")
  return { success: true }
}
