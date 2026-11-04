"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requirePermissionOrg } from "@/lib/auth/guards"
import {
  CAMPAIGN_KINDS,
  defaultCampaignCopy,
  type CampaignKind,
} from "@/lib/marketing/campaigns"

// ============================================================
// #95 — MARKETING AVTOMATIKA (admin akcije)
// Org-scoped (requirePermissionOrg customers.manage). Ena kampanja
// na vrsto; privzeta besedila se ustvarijo ob prvem odpiranju.
// Vstavitve se izračunajo ob pošiljanju (job) — tu samo validacija.
// ============================================================

export interface MarketingCampaignView {
  kind: CampaignKind
  enabled: boolean
  thresholdDays: number
  subject: string
  body: string
  lastRunAt: string | null
  sentCount: number
}

export async function getMarketingOverview(): Promise<{
  campaigns: MarketingCampaignView[]
  businessName: string
  bookingLink: string
}> {
  const { org } = await requirePermissionOrg("customers.manage")

  const rows = await prisma.marketingCampaign.findMany({
    where: { organizationId: org.id },
    include: { _count: { select: { sends: true } } },
  })
  const byKind = new Map(rows.map((r) => [r.kind, r]))

  const campaigns: MarketingCampaignView[] = CAMPAIGN_KINDS.map((kind) => {
    const row = byKind.get(kind)
    const defaults = defaultCampaignCopy(
      kind,
      org.name,
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/s/${org.slug}/booking`
    )
    return {
      kind,
      enabled: row?.enabled ?? false,
      thresholdDays: row?.thresholdDays ?? 60,
      subject: row?.subject ?? defaults.subject,
      body: row?.body ?? defaults.body,
      lastRunAt: row?.lastRunAt?.toISOString() ?? null,
      sentCount: row?._count.sends ?? 0,
    }
  })

  return {
    campaigns,
    businessName: org.name,
    bookingLink: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/s/${org.slug}/booking`,
  }
}

export async function updateMarketingCampaign(
  kind: CampaignKind,
  input: { enabled: boolean; thresholdDays: number; subject: string; body: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { org } = await requirePermissionOrg("customers.manage")

    if (!CAMPAIGN_KINDS.includes(kind)) {
      return { success: false, error: "Neznana vrsta kampanje." }
    }

    const subject = (input.subject ?? "").trim()
    const body = (input.body ?? "").trim()
    if (subject.length < 3 || body.length < 10) {
      return { success: false, error: "Zadeva in telo morata biti izpolnjena." }
    }
    const thresholdDays = Math.min(
      Math.max(Math.round(Number(input.thresholdDays) || 60), 7),
      365
    )

    const defaults = defaultCampaignCopy(
      kind,
      org.name,
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/s/${org.slug}/booking`
    )

    await prisma.marketingCampaign.upsert({
      where: { organizationId_kind: { organizationId: org.id, kind } },
      create: {
        organizationId: org.id,
        kind,
        enabled: input.enabled,
        thresholdDays,
        subject: subject || defaults.subject,
        body: body || defaults.body,
      },
      update: {
        enabled: input.enabled,
        thresholdDays: kind === "REACTIVATION" ? thresholdDays : undefined,
        subject: subject || defaults.subject,
        body: body || defaults.body,
      },
    })

    revalidatePath("/dashboard/marketing")
    return { success: true }
  } catch (error) {
    console.error("updateMarketingCampaign failed:", error)
    return { success: false, error: "Shranjevanje kampanje ni uspelo. Poskusite znova." }
  }
}

/** Število zadetkov za predogled (koliko strank bi danes dobilo sporočilo). */
export async function previewCampaignMatchCount(
  kind: CampaignKind,
  thresholdDays: number
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const { org } = await requirePermissionOrg("customers.manage")

    if (kind === "REACTIVATION") {
      const tzRow = await prisma.salonConfig.findUnique({
        where: { organizationId: org.id },
        select: { timezone: true },
      })
      void tzRow
      // Groba ocena: stranke z zadnjim zaključenim obiskom v ±0 dnevu okoli
      // praga — natančnost ima job (dnevna enakost); tu obseg okna za pogled.
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - thresholdDays)
      const count = await prisma.appointment.count({
        where: {
          organizationId: org.id,
          status: "COMPLETED",
          startTime: { gte: new Date(cutoff.toISOString().slice(0, 10) + "T00:00:00Z") },
        },
      })
      return { success: true, count }
    }
    // NO_SHOW: ne-prisoti v zadnjih 7 dneh (okvirno).
    const since = new Date()
    since.setDate(since.getDate() - 7)
    const count = await prisma.appointment.count({
      where: {
        organizationId: org.id,
        status: "NO_SHOW",
        startTime: { gte: since },
      },
    })
    return { success: true, count }
  } catch (error) {
    console.error("previewCampaignMatchCount failed:", error)
    return { success: false, error: "Ocena ni uspela." }
  }
}

// NB: "use server" dovoljuje samo async eksporte — PLACEHOLDERS/interpolate
// importira UI direktno iz src/lib/marketing/campaigns.
