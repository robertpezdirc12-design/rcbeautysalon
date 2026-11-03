import "server-only"

import { PrismaClient, Prisma } from "@prisma/client"
import { getProfile, PROFILES } from "@/lib/profiles/registry"

// ============================================================
// P0 #23 (re-audit 2026-11) — BACKFILL KOT USKLAJEVANJE, NE PRIPENJANJE
//
// Prejšnji backfill je bil SAMO aditiven: vsaksekrat, ko se je
// org.vertical spremenil, so stare definicije obrazcev/delovnih
// tokov ostale isActive: true za vedno — rc-beauty (lepotni salon)
// je javno prikazoval vnos vozila (vulkanizer) in merilni list
// (šiviljstvo). Poleg tega je getProfile() neznano vertikalo
// utišal v "generic" in saloni brez materializiranih obrazcev so
// ostali prazni.
//
// Usklajevalna pravila (idempotentno, varno za ponovni zagon):
//  1. MATERIALIZACIJA: vsak obrazec/delovni tok iz TRENUTNEGA profila,
//     ki (organizationId, key) še ne obstaja → ustvari (ne-prepiši
//     pravilo ostaja: obstoječe vrstice se ne urejajo).
//  2. USKLAJEVANJE: vrstica z isActive=true, katere key je iz PRIŠLEGA
//     profila (že znan v registry), a NI v trenutnem profilu →
//     isActive=false. Nikoli ne Brisemo — samo deaktiviramo.
//  3. LASTNIŠKE VRSTICE: ključi, ki ne ustrezajo NOBENEMU znanemu
//     profilnemu ključu, so lastniške kreacije — ostanejo nespremenjene.
// ============================================================

/** Vsi ključi obrazcev, ki jih katerikoli registriran profil deklarira. */
function allKnownFormKeys(): Set<string> {
  const keys = new Set<string>()
  for (const profile of Object.values(PROFILES)) {
    for (const form of profile.forms) keys.add(form.key)
  }
  return keys
}

/** Vsi ključi delovnih tokov, ki jih katerikoli registriran profil deklarira. */
function allKnownWorkflowKeys(): Set<string> {
  const keys = new Set<string>()
  for (const profile of Object.values(PROFILES)) {
    for (const wf of profile.workflows) keys.add(wf.key)
  }
  return keys
}

export interface ReconcileOrgResult {
  slug: string
  vertical: string
  profileId: string
  createdForms: number
  deactivatedForms: string[]
  createdWorkflows: number
  deactivatedWorkflows: string[]
}

export interface ReconcileResult {
  orgs: ReconcileOrgResult[]
  totals: {
    createdForms: number
    deactivatedForms: number
    createdWorkflows: number
    deactivatedWorkflows: number
  }
}

/**
 * Materializira + uskladi profilne vsebine (FormDefinition,
 * WorkflowDefinition) za VSE organizacije glede na njihovo trenutno
 * vertikalo. Idempotentno.
 */
export async function reconcileProfileAssets(
  client: PrismaClient | Pick<PrismaClient, "organization" | "formDefinition" | "workflowDefinition">,
  options: { onlyOrgId?: string } = {}
): Promise<ReconcileResult> {
  const knownFormKeys = allKnownFormKeys()
  const knownWorkflowKeys = allKnownWorkflowKeys()

  const orgs = await client.organization.findMany({
    where: options.onlyOrgId ? { id: options.onlyOrgId } : undefined,
    select: { id: true, slug: true, name: true, vertical: true },
    orderBy: { createdAt: "asc" },
  })

  const result: ReconcileResult = {
    orgs: [],
    totals: {
      createdForms: 0,
      deactivatedForms: 0,
      createdWorkflows: 0,
      deactivatedWorkflows: 0,
    },
  }

  for (const org of orgs) {
    const profile = getProfile(org.vertical)
    const desiredFormKeys = new Set(profile.forms.map((f) => f.key))
    const desiredWorkflowKeys = new Set(profile.workflows.map((w) => w.key))

    let createdForms = 0
    const deactivatedForms: string[] = []
    let createdWorkflows = 0
    const deactivatedWorkflows: string[] = []

    // 1) Materializacija obrazcev trenutnega profila (aditivno, brez prepisa).
    for (const form of profile.forms) {
      const existing = await client.formDefinition.findUnique({
        where: { organizationId_key: { organizationId: org.id, key: form.key } },
        select: { id: true },
      })
      if (!existing) {
        await client.formDefinition.create({
          data: {
            organizationId: org.id,
            key: form.key,
            name: form.name,
            description: form.description,
            version: 1,
            isActive: true,
            fields: form.fields as unknown as Prisma.InputJsonValue,
          },
        })
        createdForms++
      }
    }

    // 2) Usklajevanje: prišleški profili se deaktivirajo (nikoli izbrišejo).
    //    Lastniški ključi (ne ustrezajo nobenemu profilu) ostanejo dotaknjeni.
    const activeForms = await client.formDefinition.findMany({
      where: { organizationId: org.id, isActive: true },
      select: { id: true, key: true },
    })
    for (const row of activeForms) {
      if (desiredFormKeys.has(row.key)) continue
      if (!knownFormKeys.has(row.key)) continue // lastniška kreacija
      await client.formDefinition.update({
        where: { id: row.id },
        data: { isActive: false },
      })
      deactivatedForms.push(row.key)
    }

    // Enako za delovne toke.
    for (const wf of profile.workflows) {
      const existing = await client.workflowDefinition.findUnique({
        where: { organizationId_key: { organizationId: org.id, key: wf.key } },
        select: { id: true },
      })
      if (!existing) {
        await client.workflowDefinition.create({
          data: {
            organizationId: org.id,
            key: wf.key,
            name: wf.name,
            entity: wf.entity,
            version: 1,
            isActive: true,
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
        })
        createdWorkflows++
      }
    }

    const activeWorkflows = await client.workflowDefinition.findMany({
      where: { organizationId: org.id, isActive: true },
      select: { id: true, key: true },
    })
    for (const row of activeWorkflows) {
      if (desiredWorkflowKeys.has(row.key)) continue
      if (!knownWorkflowKeys.has(row.key)) continue
      await client.workflowDefinition.update({
        where: { id: row.id },
        data: { isActive: false },
      })
      deactivatedWorkflows.push(row.key)
    }

    // Posodobi profilno različico (isti kontrakt kot prvotni backfill).
    await client.organization.update({
      where: { id: org.id },
      data: { profileVersion: `v${profile.version}` },
    })

    result.orgs.push({
      slug: org.slug,
      vertical: org.vertical,
      profileId: profile.id,
      createdForms,
      deactivatedForms,
      createdWorkflows,
      deactivatedWorkflows,
    })
    result.totals.createdForms += createdForms
    result.totals.deactivatedForms += deactivatedForms.length
    result.totals.createdWorkflows += createdWorkflows
    result.totals.deactivatedWorkflows += deactivatedWorkflows.length
  }

  return result
}
