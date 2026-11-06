"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"

import { getSessionEffectiveProfile } from "@/lib/profiles/session"
import { validateFieldValues, deriveRecordTitle } from "@/lib/field-validation"
import type { ProfileFieldDef } from "@/lib/profiles/types"
import type { Prisma } from "@prisma/client"

// ============================================================
// EXTENSION RECORD REGISTRY (EPIC #1 §13 — Phase 6)
// Universal, data-driven CRUD for the entities that the tenant's
// ENABLED EXTENSIONS declare (vehicle-workshop → vehicle/tire_set,
// batch-production → batch, …). Nothing here knows anything about
// specific industries: (extensionId, entityKey) select the
// declaration, values are validated server-side against the
// declarative field list, storage is one org-scoped table
// (ExtensionRecord). Adding a new extension needs NO code here.
// All queries/actions are strictly org-scoped via requirePermissionOrg.
// ============================================================

export interface ExtensionEntityInfo {
  extensionId: string
  extensionName: string
  key: string
  name: string
  description: string
  fields: ProfileFieldDef[]
  recordCount: number
}

export interface ExtensionRecordItem {
  id: string
  entityKey: string
  entityName: string
  extensionName: string
  title: string
  data: Record<string, unknown>
  customerId: string | null
  customerName: string | null
  createdAt: string
  updatedAt: string
}

/** Entities contributed by the effective profile's extensions (+ counts). */
export async function getExtensionEntities(): Promise<ExtensionEntityInfo[]> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const profile = await getSessionEffectiveProfile()

  const out: ExtensionEntityInfo[] = []
  for (const extId of profile.extensions) {
    const ext = (await import("@/lib/profiles/extensions")).getExtension(extId)
    if (!ext) continue
    for (const entity of ext.entities) {
      const count = await prisma.extensionRecord.count({
        where: { organizationId: org.id, extensionId: ext.id, entityKey: entity.key },
      })
      out.push({
        extensionId: ext.id,
        extensionName: ext.name,
        key: entity.key,
        name: entity.name,
        description: entity.description,
        fields: entity.fields,
        recordCount: count,
      })
    }
  }
  return out
}

/** Org-scoped records for one entity (newest first). */
export async function listExtensionRecords(
  entityKey: string
): Promise<ExtensionRecordItem[]> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const profile = await getSessionEffectiveProfile()

  // Guard: entityKey must belong to one of the profile's enabled
  // extensions — never serve arbitrary keys (§17).
  const owning = await findEntityOwner(profile.extensions, entityKey)
  if (!owning) return []

  const records = await prisma.extensionRecord.findMany({
    where: { organizationId: org.id, entityKey },
    include: { customer: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 500,
  })

  return records.map((r) => ({
    id: r.id,
    entityKey: r.entityKey,
    entityName: owning.entity.name,
    extensionName: owning.extension.name,
    title: r.title,
    data: (r.data && typeof r.data === "object" ? r.data : {}) as Record<string, unknown>,
    customerId: r.customerId,
    customerName: r.customer?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

async function findEntityOwner(
  extensionIds: string[],
  entityKey: string
): Promise<{
  extension: { id: string; name: string }
  entity: { key: string; name: string; fields: ProfileFieldDef[] }
} | null> {
  const { getExtension } = await import("@/lib/profiles/extensions")
  for (const id of extensionIds) {
    const ext = getExtension(id)
    const entity = ext?.entities.find((e) => e.key === entityKey)
    if (ext && entity) {
      return {
        extension: { id: ext.id, name: ext.name },
        entity: { key: entity.key, name: entity.name, fields: entity.fields },
      }
    }
  }
  return null
}

export interface SaveRecordResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
  id?: string
}

export interface SaveRecordInput {
  entityKey: string
  values: Record<string, unknown>
  customerId?: string | null
}

/**
 * Create an extension record. Values are validated against the
 * declarative fields of the entity (server-side — the client can
 * never inject unknown fields). Title is derived from the first
 * meaningful value.
 */
export async function createExtensionRecord(
  input: SaveRecordInput
): Promise<SaveRecordResult> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const profile = await getSessionEffectiveProfile()

  const owning = await findEntityOwner(profile.extensions, input.entityKey)
  if (!owning) return { ok: false, error: "ENTITY_NOT_ENABLED" }

  const { errors, clean } = validateFieldValues(owning.entity.fields, input.values)
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "VALIDATION", fieldErrors: errors }
  }

  // Customer must belong to this tenant (§3 isolation).
  const customerId = input.customerId || null
  if (customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: org.id },
      select: { id: true },
    })
    if (!c) return { ok: false, error: "INVALID_CUSTOMER" }
  }

  const created = await prisma.extensionRecord.create({
    data: {
      organizationId: org.id,
      extensionId: owning.extension.id,
      entityKey: owning.entity.key,
      title: deriveRecordTitle(owning.entity.fields, clean, owning.entity.name),
      data: clean as unknown as Prisma.InputJsonValue,
      customerId,
    },
  })

  revalidatePath("/dashboard/records")
  revalidatePath("/dashboard/work-orders")
  return { ok: true, id: created.id }
}

/** Update an org-scoped extension record (re-validated, version-free). */
export async function updateExtensionRecord(
  id: string,
  input: SaveRecordInput
): Promise<SaveRecordResult> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const profile = await getSessionEffectiveProfile()

  const record = await prisma.extensionRecord.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true, entityKey: true },
  })
  if (!record) return { ok: false, error: "NOT_FOUND" }

  const owning = await findEntityOwner(profile.extensions, record.entityKey)
  if (!owning) return { ok: false, error: "ENTITY_NOT_ENABLED" }

  const { errors, clean } = validateFieldValues(owning.entity.fields, input.values)
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "VALIDATION", fieldErrors: errors }
  }

  const customerId = input.customerId || null
  if (customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: org.id },
      select: { id: true },
    })
    if (!c) return { ok: false, error: "INVALID_CUSTOMER" }
  }

  await prisma.extensionRecord.update({
    where: { id: record.id },
    data: {
      title: deriveRecordTitle(owning.entity.fields, clean, owning.entity.name),
      data: clean as unknown as Prisma.InputJsonValue,
      customerId,
    },
  })

  revalidatePath("/dashboard/records")
  revalidatePath("/dashboard/work-orders")
  return { ok: true, id: record.id }
}

/** Delete an org-scoped extension record (linked work orders keep history). */
export async function deleteExtensionRecord(id: string): Promise<{ ok: boolean }> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const record = await prisma.extensionRecord.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  })
  if (!record) return { ok: false }
  await prisma.extensionRecord.delete({ where: { id: record.id } })
  revalidatePath("/dashboard/records")
  revalidatePath("/dashboard/work-orders")
  return { ok: true }
}

/** Customers for the record dialogs (org-scoped, minimal fields). */
export async function listRecordCustomers(): Promise<
  { id: string; name: string; email: string | null }[]
> {
  const { org } = await requirePermissionOrg("workorders.manage")
  return prisma.customer.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 200,
  })
}

/** Minimal record list for pickers (e.g. attach a vehicle to a work order). */
export async function listExtensionRecordOptions(): Promise<
  { id: string; entityKey: string; entityName: string; title: string; customerName: string | null }[]
> {
  const { org } = await requirePermissionOrg("workorders.manage")
  const profile = await getSessionEffectiveProfile()
  if (profile.extensions.length === 0) return []

  const records = await prisma.extensionRecord.findMany({
    where: { organizationId: org.id },
    include: { customer: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 300,
  })

  const { getExtension } = await import("@/lib/profiles/extensions")
  return records
    .filter((r) => profile.extensions.includes(r.extensionId))
    .map((r) => {
      const ext = getExtension(r.extensionId)
      const entity = ext?.entities.find((e) => e.key === r.entityKey)
      return {
        id: r.id,
        entityKey: r.entityKey,
        entityName: entity?.name ?? r.entityKey,
        title: r.title,
        customerName: r.customer?.name ?? null,
      }
    })
}
