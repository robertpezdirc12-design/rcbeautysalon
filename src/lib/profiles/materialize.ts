// ============================================================
// PROFILE MATERIALIZATION (EPIC #1 §4) — copies profile form/
// workflow templates into per-tenant DB definitions (copy-on-
// write) so the owner can customize them without code and
// without mutating the shared profile.
// Server-only. Idempotent: upserts by (organizationId, key).
// ============================================================

import { prisma } from "@/lib/prisma"
import { getProfile } from "./registry"
import type { ActivityProfile } from "./types"
import type { Prisma } from "@prisma/client"

/** Materialize the profile's form + workflow templates for one org. */
export async function materializeProfileAssets(
  orgId: string,
  profileId: string
): Promise<{ profile: ActivityProfile; forms: number; workflows: number }> {
  const profile = getProfile(profileId)

  for (const form of profile.forms) {
    await prisma.formDefinition.upsert({
      where: { organizationId_key: { organizationId: orgId, key: form.key } },
      create: {
        organizationId: orgId,
        key: form.key,
        name: form.name,
        description: form.description,
        version: 1,
        isActive: true,
        fields: form.fields as unknown as Prisma.InputJsonValue,
        // P1 #69: provenance — marks this row as profile-owned so an
        // activity switch can deactivate it without touching owner rows.
        sourceProfile: profile.id,
      },
      update: {
        // Never clobber owner edits: only create if missing (update is a
        // no-op). Provenance for pre-#69 rows is backfilled by migration.
      },
    })
  }

  for (const wf of profile.workflows) {
    await prisma.workflowDefinition.upsert({
      where: { organizationId_key: { organizationId: orgId, key: wf.key } },
      create: {
        organizationId: orgId,
        key: wf.key,
        name: wf.name,
        entity: wf.entity,
        version: 1,
        isActive: true,
        sourceProfile: profile.id,
        stages: {
          create: wf.stages.map((s, i) => ({
            key: s.key,
            name: s.name,
            description: s.description,
            order: i,
            slaHours: s.slaHours,
            isFinal: !!s.isFinal,
          })),
        },
      },
      update: {
        // Same as forms: create-if-missing semantics.
      },
    })
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { profileVersion: `v${profile.version}` },
  })

  return { profile, forms: profile.forms.length, workflows: profile.workflows.length }
}

/** Ensure every active org has definitions for its current profile (backfill). */
export async function materializeForAllOrganizations(): Promise<
  { orgId: string; slug: string; vertical: string; forms: number; workflows: number }[]
> {
  const orgs = await prisma.organization.findMany({
    select: { id: true, slug: true, vertical: true },
  })
  const results: { orgId: string; slug: string; vertical: string; forms: number; workflows: number }[] = []
  for (const org of orgs) {
    const r = await materializeProfileAssets(org.id, org.vertical)
    results.push({ orgId: org.id, slug: org.slug, vertical: org.vertical, forms: r.forms, workflows: r.workflows })
  }
  return results
}

// ============================================================
// P1 #69 — ACTIVITY SWITCH FOR PROFILE-OWNED ASSETS
// Forms/workflows are materialized once at signup; the vertical switch
// (#58 family) must re-materialize the NEW profile's templates and
// deactivate the OLD profile's rows — never delete (submissions and
// owner data survive), never touch owner-created rows (sourceProfile = null).
// ============================================================

export interface ProfileAssetSwitchCounts {
  formsAdded: number
  workflowsAdded: number
  formsDeactivated: number
  workflowsDeactivated: number
}

/**
 * Deactivate profile-owned definitions whose sourceProfile is NOT in the
 * effective set (primary + secondary activity). Owner-created rows
 * (sourceProfile = null) and already-inactive rows are untouched.
 */
export async function deactivateForeignProfileAssets(
  orgId: string,
  keepProfileIds: string[],
  counts?: ProfileAssetSwitchCounts
): Promise<ProfileAssetSwitchCounts> {
  const out: ProfileAssetSwitchCounts = counts ?? {
    formsAdded: 0,
    workflowsAdded: 0,
    formsDeactivated: 0,
    workflowsDeactivated: 0,
  }
  const keep = keepProfileIds.filter(Boolean)
  if (keep.length === 0) return out

  const forms = await prisma.formDefinition.updateMany({
    where: {
      organizationId: orgId,
      isActive: true,
      sourceProfile: { not: null, notIn: keep },
    },
    data: { isActive: false },
  })
  out.formsDeactivated += forms.count

  const workflows = await prisma.workflowDefinition.updateMany({
    where: {
      organizationId: orgId,
      isActive: true,
      sourceProfile: { not: null, notIn: keep },
    },
    data: { isActive: false },
  })
  out.workflowsDeactivated += workflows.count

  return out
}

/**
 * Preview ONLY (no writes): what a switch to the target profile would do
 * to the tenant's forms/workflows. Powers the switch dialog (#69).
 */
export async function previewProfileAssetSwitch(
  orgId: string,
  targetProfileId: string,
  keepProfileIds: string[] = []
): Promise<ProfileAssetSwitchCounts> {
  const keep = [...new Set([targetProfileId, ...keepProfileIds].filter(Boolean))]
  const [foreignForms, foreignWorkflows, currentForms, currentWorkflows] =
    await Promise.all([
      prisma.formDefinition.count({
        where: {
          organizationId: orgId,
          isActive: true,
          sourceProfile: { not: null, notIn: keep },
        },
      }),
      prisma.workflowDefinition.count({
        where: {
          organizationId: orgId,
          isActive: true,
          sourceProfile: { not: null, notIn: keep },
        },
      }),
      prisma.formDefinition.count({
        where: { organizationId: orgId, sourceProfile: targetProfileId },
      }),
      prisma.workflowDefinition.count({
        where: { organizationId: orgId, sourceProfile: targetProfileId },
      }),
    ])
  const profile = getProfile(targetProfileId)
  const templateForms = profile.forms.length
  const templateWorkflows = profile.workflows.length
  return {
    // missing templates the switch would materialize
    formsAdded: Math.max(0, templateForms - currentForms),
    workflowsAdded: Math.max(0, templateWorkflows - currentWorkflows),
    formsDeactivated: foreignForms,
    workflowsDeactivated: foreignWorkflows,
  }
}
