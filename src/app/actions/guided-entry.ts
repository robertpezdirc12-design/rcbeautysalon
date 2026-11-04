"use server"

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { listProfileOptions, getProfile } from "@/lib/profiles/registry"
import { materializeProfileAssets } from "@/lib/profiles/materialize"
import { seedOrganizationCatalog, PALETTES } from "@/lib/verticals"
import { modulesForVertical } from "@/lib/profiles/modules"

// ============================================================
// GUIDED ENTRY ("vodeni vstop") — the dashboard's first-run wizard.
//
// Contract (user-facing promise):
//   1. FIRST the owner picks WHO they are (frizer / vulkanizer &
//      avtoservis / kozmetika / …) — before editing anything.
//   2. The workspace then opens ONLY with the modules of that
//      activity ("kaj je zakupil") — capabilities, terminology,
//      sidebar and forms/workflows all resolve from the profile.
//   3. CHANGING the activity switches everything to it: capabilities,
//      terminology, forms/workflows materialize for the new profile.
//      Owner overrides are cleared (they belonged to the old matrix).
//
// Honesty rules:
//   • Same-vertical confirmation is NON-destructive (existing tenants
//     just confirm what they already have — one click, nothing lost).
//   • Changing vertical NEVER deletes business data (appointments,
//     orders, customers). The sample catalog is only re-seeded when
//     the tenant has no catalog yet; an in-use catalog is reported
//     back so the wizard can tell the owner to adjust it manually.
//   • Site content (texts/images) is NOT touched — the owner edits
//     it in "Izgled in vsebina"; the landing stays theirs.
// ============================================================

export interface GuidedEntryInput {
  vertical: string
  palette?: string
  /** P2 second-level answers — optional, never blocking. */
  teamSize?: "solo" | "small" | "team"
  onlineBooking?: "yes" | "no"
}

/**
 * P2 answers shape persisted on Organization.onboardingAnswers. The
 * answers VISIBLY change the product: "solo" removes the staff step
 * from the activation checklist; onlineBooking "no" rewords the publish
 * step (no 24/7 bookings promised).
 */
export interface OnboardingAnswers {
  teamSize?: "solo" | "small" | "team"
  onlineBooking?: "yes" | "no"
}

export interface GuidedEntryResult {
  success: boolean
  error?: string
  /** True when the activity actually CHANGED (vs. confirming the current one). */
  changed?: boolean
  /** Profile label of the (new) activity. */
  label?: string
  /** Modules the workspace now opens with ("kaj je zakupil"). */
  modules?: { key: string; labelSl: string; labelEn: string; state: "required" | "optional" }[]
  /** Set when the existing catalog could not be re-seeded (in use). */
  catalogNote?: "in-use"
}

/** Context for the guided-entry wizard (settings managers only). */
export interface GuidedEntryContext {
  currentVertical: string
  currentPalette: string
  /** ISO timestamp or null — null means the wizard has not been completed yet. */
  verticalChosenAt: string | null
  /** Previously saved P2 answers — the wizard pre-fills them on re-run. */
  answers: OnboardingAnswers
}

export async function getGuidedEntryContext(): Promise<GuidedEntryContext | { error: string }> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    return {
      currentVertical: org.vertical,
      currentPalette: org.palette,
      verticalChosenAt: org.verticalChosenAt?.toISOString() ?? null,
      answers: parseOnboardingAnswers(org.onboardingAnswers),
    }
  } catch (error) {
    console.error("getGuidedEntryContext failed:", error)
    return { error: "Ni mogoče naložiti vodenega vstopa." }
  }
}

function parseOnboardingAnswers(value: unknown): OnboardingAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const obj = value as Record<string, unknown>
  const out: OnboardingAnswers = {}
  if (obj.teamSize === "solo" || obj.teamSize === "small" || obj.teamSize === "team") {
    out.teamSize = obj.teamSize
  }
  if (obj.onlineBooking === "yes" || obj.onlineBooking === "no") {
    out.onlineBooking = obj.onlineBooking
  }
  return out
}

export async function completeGuidedEntry(input: GuidedEntryInput): Promise<GuidedEntryResult> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")

    const profile = listProfileOptions().find((p) => p.id === input.vertical)
    if (!profile) {
      return { success: false, error: "Izberite veljavno dejavnost." }
    }
    const palette = input.palette && PALETTES[input.palette] ? input.palette : org.palette

    const changed = org.vertical !== profile.id

    // Sample catalog: seeded only when the tenant has no categories yet.
    // An in-use catalog is never wiped here — the wizard reports it.
    let catalogNote: "in-use" | undefined
    if (changed) {
      const existingCategories = await prisma.category.count({
        where: { organizationId: org.id },
      })
      if (existingCategories === 0) {
        await seedOrganizationCatalog(org.id, profile.id)
      } else {
        const hasAppointments = await prisma.appointment.count({
          where: { organizationId: org.id },
        })
        const hasOrders = await prisma.order.count({
          where: { organizationId: org.id },
        })
        if (hasAppointments === 0 && hasOrders === 0) {
          // No business data references the catalog — safe to replace the
          // SAMPLE catalog so the workspace truly "switches to mehanik".
          // Package items cascade away with their services/products.
          await prisma.prepaidProduct.deleteMany({ where: { organizationId: org.id } })
          await prisma.service.deleteMany({ where: { organizationId: org.id } })
          await prisma.product.deleteMany({ where: { organizationId: org.id } })
          await prisma.category.deleteMany({ where: { organizationId: org.id } })
          await seedOrganizationCatalog(org.id, profile.id)
        } else {
          catalogNote = "in-use"
        }
      }
    }

    // Materialize forms/workflows for the (new) profile — upsert semantics,
    // never clobbers owner edits, creates what the old profile lacked.
    const materialized = await materializeProfileAssets(org.id, profile.id)

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        vertical: profile.id,
        palette,
        verticalChosenAt: new Date(),
        profileVersion: String(materialized.profile.version),
        // P2 second-level answers persist even when the owner leaves the
        // questions untouched (undefined keys keep the old value).
        onboardingAnswers: {
          ...parseOnboardingAnswers(org.onboardingAnswers),
          ...(input.teamSize ? { teamSize: input.teamSize } : {}),
          ...(input.onlineBooking ? { onlineBooking: input.onlineBooking } : {}),
        },
        // Owner overrides belonged to the OLD capability matrix — a
        // different vertical starts from its own clean defaults; the
        // owner re-tunes modules afterwards in Settings → Moduli.
        ...(changed
          ? { profileOverrides: Prisma.JsonNull as typeof Prisma.JsonNull }
          : {}),
      },
    })

    const fullProfile = getProfile(profile.id)
    return {
      success: true,
      changed,
      label: fullProfile.label,
      modules: modulesForVertical(profile.id),
      catalogNote,
    }
  } catch (error) {
    console.error("completeGuidedEntry failed:", error)
    return { success: false, error: "Prijava dejavnosti ni uspela. Poskusite znova." }
  }
}
