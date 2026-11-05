"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

import { UnauthorizedError, requirePermissionOrg } from "@/lib/auth/guards"
import { recordConfigChange } from "@/lib/config-history/record"
import { mergeSiteContent, type SiteContent } from "@/lib/site-content"
import { computeRevert, hasUnpublishedChanges, parsePublishState } from "@/lib/publication"
import type { PublicationStatus } from "@/app/actions/publication"
import { PALETTES, verticalSiteContent, upgradeLegacyDefaultCopy } from "@/lib/verticals"
import type { CatalogSeedReport } from "@/lib/verticals"

/**
 * P2 #58: was the stored content ever edited? The wizard stores exactly
 * `verticalSiteContent(vertical)` at signup; anything else (or nothing
 * stored — null renders the same defaults) counts as untouched. Key-order
 * insensitive so a save-round-trip of identical content stays "untouched".
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonicalize(v)])
    )
  }
  return value
}

export async function isSiteContentUntouched(orgId: string, vertical: string): Promise<boolean> {
  const config = await prisma.salonConfig.findUnique({
    where: { organizationId: orgId },
    select: { siteContent: true },
  })
  if (!config?.siteContent) return true
  return (
    JSON.stringify(canonicalize(config.siteContent)) ===
    JSON.stringify(canonicalize(verticalSiteContent(vertical)))
  )
}

/** Full branding + content payload for the "Izgled in vsebina" editor. */
export async function getOrgBranding() {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    const config = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: {
        siteContent: true,
        publishedContentVersion: true,
      },
    })
    return {
      success: true,
      org: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        logo: org.logo,
        vertical: org.vertical,
        palette: org.palette,
        siteUrl: `/s/${org.slug}`,
      },
      siteContent: upgradeLegacyDefaultCopy(
        mergeSiteContent(config?.siteContent, org.vertical),
        org.slug
      ),
      publication: {
        state: parsePublishState(org.publishState),
        publishedAt: org.publishedAt,
        hasUnpublishedChanges: hasUnpublishedChanges(
          org.contentVersion,
          config?.publishedContentVersion ?? null
        ),
        hasPublishedSnapshot: config?.publishedContentVersion != null,
        // Advisories are the PublicationCard's concern (computed there).
        warnings: [],
      } satisfies PublicationStatus,
      /** P2 #58: defaults the switch dialog's content-mode choice. */
      contentUntouched: await isSiteContentUntouched(org.id, org.vertical),
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error loading org branding:", error)
    return { success: false, error: "Failed to load branding." }
  }
}

/**
 * Saves the whole site content JSON (hero, about, features, CTA, hours,
 * social, SEO, sections). Every save creates a NEW content version (E3-2) —
 * the working draft — while the published snapshot stays untouched, so the
 * public site only changes when the owner publishes.
 */
export async function updateSiteContent(content: SiteContent) {
  try {
    const { org, session } = await requirePermissionOrg("settings.manage")

    // Minimal server-side sanitization: plain strings only, bounded lengths.
    const clean = JSON.parse(JSON.stringify(content)) as SiteContent
    if (!clean.hero?.title || typeof clean.hero.title !== "string") {
      return { success: false, error: "Hero naslov je obvezen." }
    }

    // F5: prejšnji osnutek (za verzijo v ConfigChangeLog).
    const config = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { siteContent: true },
    })

    await prisma.$transaction([
      prisma.salonConfig.upsert({
        where: { organizationId: org.id },
        create: {
          organizationId: org.id,
          name: org.name,
          siteContent: clean as unknown as object,
        },
        update: { siteContent: clean as unknown as object },
      }),
      prisma.organization.update({
        where: { id: org.id },
        data: { contentVersion: { increment: 1 } },
      }),
    ])

    // #100 F5: vsako shranjevanje osnutka = verzija (ConfigChangeLog,
    // append-only) — zgodovina vsebine brez izgube delujoče različice.
    await recordConfigChange({
      organizationId: org.id,
      actorEmail: session.user.email ?? "unknown",
      entityKey: "site-content",
      action: "UPDATE",
      summary: "Osnutek vsebine shranjen",
      previous: (config?.siteContent ?? undefined) as unknown as Record<string, unknown>,
      next: clean as unknown as Record<string, unknown>,
    }).catch(() => undefined)

    revalidatePath("/", "layout")
    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating site content:", error)
    return { success: false, error: "Failed to update site content." }
  }
}

/**
 * Discard draft edits: restore the working content to the last published
 * snapshot (E3-2). The working version re-aligns with the published version,
 * so drift detection does not report phantom "unpublished changes" for
 * content that is byte-identical to the published JSON.
 * Refuses (with a clear error) when the tenant has no published snapshot:
 * there, the working content IS the live content and nothing can be reverted.
 */
export async function revertSiteContentToPublished(): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    const config = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { publishedSiteContent: true, publishedContentVersion: true },
    })

    const revert = computeRevert({
      contentVersion: org.contentVersion,
      publishedSiteContent: config?.publishedSiteContent ?? null,
      publishedContentVersion: config?.publishedContentVersion ?? null,
    })
    if (!revert.ok) {
      return {
        success: false,
        error: "Ni shranjene objavljene verzije — trenutna vsebina je že objavljena.",
      }
    }

    await prisma.$transaction([
      prisma.salonConfig.update({
        where: { organizationId: org.id },
        data: { siteContent: revert.siteContent as object },
      }),
      prisma.organization.update({
        where: { id: org.id },
        data: { contentVersion: revert.contentVersion },
      }),
    ])

    revalidatePath("/", "layout")
    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error reverting site content:", error)
    return { success: false, error: "Failed to revert site content." }
  }
}

/** Palette switch (rose, amber, charcoal, ...). */
export async function updateOrgPalette(palette: string) {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    if (!PALETTES[palette]) {
      return { success: false, error: "Neznana paleta." }
    }
    await prisma.organization.update({
      where: { id: org.id },
      data: { palette },
    })
    revalidatePath("/", "layout")
    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating palette:", error)
    return { success: false, error: "Failed to update palette." }
  }
}

/** Logo update (URL from /api/upload). */
export async function updateOrgLogo(logo: string | null) {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    await prisma.organization.update({
      where: { id: org.id },
      data: { logo },
    })
    revalidatePath("/", "layout")
    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating logo:", error)
    return { success: false, error: "Failed to update logo." }
  }
}

/**
 * Vertical switch (P1 #58): updates the activity and gives the owner an
 * EXPLICIT choice about the site content — the old behavior kept the
 * previous trade's hero/about/CTA live and silently produced a public page
 * describing two businesses at once.
 *
 * - contentMode "reseed" → working content becomes the new activity's
 *   sample (verticalSiteContent) — the default when the owner never edited it.
 * - contentMode "keep"   → content stays; owner reviews/republishes.
 * - contentVersion is ALWAYS incremented → hasUnpublishedChanges flips true,
 *   the dashboard shows the pending-changes banner and the public site keeps
 *   serving the last PUBLISHED snapshot until the owner republishes.
 * - reseedCatalog fills the missing catalog halves of the new preset
 *   (P2 #59) and replaces foreign-preset sample rows (provenance).
 * - On a PUBLISHED tenant contentMode is REQUIRED — the caller must have
 *   shown the dialog naming the public impact.
 */
export async function updateOrgVertical(
  vertical: string,
  options: { reseedCatalog?: boolean; contentMode?: "keep" | "reseed" } = {}
) {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    const { getVertical, seedOrganizationCatalog } = await import("@/lib/verticals")
    const preset = getVertical(vertical)
    if (!preset) return { success: false, error: "Neznana panoga." }

    // P1 #58: published tenants must decide content handling explicitly
    // (the dialog states the public impact). Server-side enforcement —
    // not just UI — so no caller can bypass the choice.
    const published = parsePublishState(org.publishState) === "PUBLISHED"
    let contentMode = options.contentMode
    if (!contentMode) {
      if (published) {
        return {
          success: false as const,
          error: "Izberite, ali želite obdržati trenutno vsebino ali naložiti vzorčno vsebino nove dejavnosti.",
        }
      }
      contentMode = (await isSiteContentUntouched(org.id, org.vertical)) ? "reseed" : "keep"
    }

    const reseedSite = contentMode === "reseed"
    const siteContent = reseedSite
      ? (verticalSiteContent(preset.id) as unknown as object)
      : undefined

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        vertical: preset.id,
        // #87: keep the owner's colour only when it was an actual choice. If
        // it still equals the OLD activity's preset palette, it was never
        // touched by the owner — adopt the new trade's palette so the switch
        // looks complete (preset palettes differ across trades).
        palette:
          org.palette === getVertical(org.vertical)?.palette
            ? preset.palette
            : org.palette,
        // P1 #58: every switch bumps the version — the owner sees the
        // pending-changes banner and publishes deliberately.
        contentVersion: { increment: 1 },
      },
    })
    if (reseedSite) {
      await prisma.salonConfig.upsert({
        where: { organizationId: org.id },
        create: {
          organizationId: org.id,
          name: org.name,
          siteContent,
        },
        update: { siteContent },
      })
    }

    let seed: CatalogSeedReport | null = null
    if (options.reseedCatalog) {
      seed = await seedOrganizationCatalog(org.id, preset.id, { replaceForeignPreset: true })
    }

    // P1 #69: forms/workflows belong to the PROFILE — the switch must
    // re-materialize the new activity's templates and deactivate the old
    // profile's rows (never delete; owner-created rows stay untouched).
    // Effective set = primary + secondary activity.
    const { materializeProfileAssets, deactivateForeignProfileAssets } =
      await import("@/lib/profiles/materialize")
    const materialized = await materializeProfileAssets(org.id, preset.id)
    const assets = await deactivateForeignProfileAssets(org.id, [
      preset.id,
      org.secondaryVertical ?? "",
    ])
    assets.formsAdded = materialized.forms
    assets.workflowsAdded = materialized.workflows

    revalidatePath("/", "layout")
    return { success: true as const, contentMode, seed, assets }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating vertical:", error)
    return { success: false, error: "Failed to update vertical." }
  }
}

/**
 * P1 #69 — read-only preview for the switch dialog: what a switch to the
 * selected activity would change in forms/workflows (counts only).
 */
export async function previewVerticalSwitch(vertical: string): Promise<{
  success: boolean
  assets?: {
    formsAdded: number
    workflowsAdded: number
    formsDeactivated: number
    workflowsDeactivated: number
  }
}> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    const { previewProfileAssetSwitch } = await import("@/lib/profiles/materialize")
    const assets = await previewProfileAssetSwitch(org.id, vertical, [
      org.secondaryVertical ?? "",
    ])
    return { success: true, assets }
  } catch {
    return { success: false }
  }
}

/**
 * P2 #61 — one-click fix from the publish gate: replace the working content
 * with the current activity's sample. The published snapshot stays live
 * until the owner republishes (E3-2 contract).
 */
export async function loadSampleSiteContent(): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    const siteContent = verticalSiteContent(org.vertical) as unknown as object
    await prisma.$transaction([
      prisma.salonConfig.upsert({
        where: { organizationId: org.id },
        create: { organizationId: org.id, name: org.name, siteContent },
        update: { siteContent },
      }),
      prisma.organization.update({
        where: { id: org.id },
        data: { contentVersion: { increment: 1 } },
      }),
    ])
    revalidatePath("/", "layout")
    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error loading sample site content:", error)
    return { success: false, error: "Failed to load sample content." }
  }
}
