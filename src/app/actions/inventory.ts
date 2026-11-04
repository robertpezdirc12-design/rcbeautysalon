"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getSessionEffectiveProfile } from "@/lib/profiles/resolve"
import { computeStockDelta, type StockDirectionValue } from "@/lib/inventory/stock"
import { isLowStock, resolveReorderPoint } from "@/lib/inventory/low-stock"

// ============================================================
// INVENTORY RUNTIME (EPIC #2 E2-2) — stock movement ledger.
// Manual receipts/issues update the product/variant stock AND
// append a ledger row in ONE transaction; negative stock is
// rejected (§11). All queries/actions are strictly org-scoped
// via requirePermissionOrg. Traceability links (supplier/batch) must
// belong to the same tenant AND to an extension the profile
// actually enables — the client can never inject foreign ids.
// ============================================================

const movementInputSchema = z.object({
  productId: z.string().min(1).max(64),
  productVariantId: z.string().min(1).max(64).nullable().optional(),
  direction: z.enum(["IN", "OUT"]),
  quantity: z.number().int().positive().max(1_000_000),
  note: z.string().max(500).nullable().optional(),
  supplierRecordId: z.string().min(1).max(64).nullable().optional(),
  batchRecordId: z.string().min(1).max(64).nullable().optional(),
  // #78: RETURN is a first-class receipt source (customer brought it back).
  // DELIVERY/STOCKTAKE have their own dedicated flows below — the generic
  // manual form must not pretend to be a delivery document or a count.
  source: z.enum(["MANUAL", "RETURN"]).optional(),
})

export type MovementInput = z.input<typeof movementInputSchema>

/** Error codes the UI maps to bilingual text. */
export type MovementErrorCode =
  | "VALIDATION"
  | "INVALID_QUANTITY"
  | "NEGATIVE_STOCK"
  | "NOT_FOUND"
  | "VARIANT_MISMATCH"
  | "RECORD_LINK"
  | "NOT_TRACKED"
  | "GENERIC"

export interface MovementResult {
  ok: boolean
  error?: MovementErrorCode
  fieldErrors?: Record<string, string>
  nextStock?: number
}

export interface StockMovementItem {
  id: string
  direction: StockDirectionValue
  quantity: number
  source: "MANUAL" | "ORDER" | "DELIVERY" | "STOCKTAKE" | "RETURN"
  note: string | null
  variantName: string | null
  supplierTitle: string | null
  batchTitle: string | null
  orderNumber: string | null
  createdByName: string | null
  createdAt: string
}

export interface StockLinkOptions {
  suppliers: { id: string; title: string }[]
  batches: { id: string; title: string }[]
}

/**
 * Record ONE manual stock movement (receipt or issue) and update
 * the stock state atomically. The pure rule (computeStockDelta)
 * decides BEFORE any write — a rejected movement leaves both the
 * state and the ledger untouched.
 */
export async function createStockMovement(
  input: MovementInput
): Promise<MovementResult> {
  const parsed = movementInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION" }
  }
  const data = parsed.data

  const { session, org } = await requirePermissionOrg("products.manage")

  // Product must belong to THIS tenant (§3 isolation).
  const product = await prisma.product.findFirst({
    where: { id: data.productId, organizationId: org.id },
    select: { id: true, name: true, trackInventory: true, stockQuantity: true },
  })
  if (!product) return { ok: false, error: "NOT_FOUND" }
  if (!product.trackInventory) return { ok: false, error: "NOT_TRACKED" }

  // Variant (optional) must belong to the product.
  let variant: { id: string; stockQuantity: number } | null = null
  if (data.productVariantId) {
    const v = await prisma.productVariant.findFirst({
      where: {
        id: data.productVariantId,
        productId: product.id,
        organizationId: org.id,
      },
      select: { id: true, stockQuantity: true },
    })
    if (!v) return { ok: false, error: "VARIANT_MISMATCH" }
    if (!v.stockQuantity && v.stockQuantity !== 0) {
      return { ok: false, error: "VALIDATION" }
    }
    variant = { id: v.id, stockQuantity: v.stockQuantity }
  }

  // Traceability links must exist in THIS tenant and belong to an
  // entity the effective profile actually enables.
  const profile = await getSessionEffectiveProfile()
  const supplierEnabled = profile.extensions.includes("suppliers")
  const batchEnabled = profile.extensions.includes("batch-production")

  if (data.supplierRecordId) {
    if (!supplierEnabled) return { ok: false, error: "RECORD_LINK" }
    const rec = await prisma.extensionRecord.findFirst({
      where: {
        id: data.supplierRecordId,
        organizationId: org.id,
        entityKey: "supplier",
      },
      select: { id: true },
    })
    if (!rec) return { ok: false, error: "RECORD_LINK" }
  }
  if (data.batchRecordId) {
    if (!batchEnabled) return { ok: false, error: "RECORD_LINK" }
    const rec = await prisma.extensionRecord.findFirst({
      where: {
        id: data.batchRecordId,
        organizationId: org.id,
        entityKey: "batch",
      },
      select: { id: true },
    })
    if (!rec) return { ok: false, error: "RECORD_LINK" }
  }

  const currentStock = variant ? variant.stockQuantity : product.stockQuantity
  const computed = computeStockDelta(
    currentStock,
    data.direction as StockDirectionValue,
    data.quantity
  )
  if (!computed.ok) {
    return {
      ok: false,
      error: computed.reason === "NEGATIVE_STOCK" ? "NEGATIVE_STOCK" : "INVALID_QUANTITY",
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1) STATE — product or variant stock.
      if (variant) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stockQuantity: computed.nextStock },
        })
      } else {
        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: computed.nextStock },
        })
      }

      // 2) LEDGER — append-only row for the same event.
      await tx.stockMovement.create({
        data: {
          organizationId: org.id,
          productId: product.id,
          productVariantId: variant?.id ?? null,
          direction: data.direction,
          quantity: data.quantity,
          source: data.source ?? "MANUAL",
          note: data.note?.trim() || null,
          supplierRecordId: data.supplierRecordId ?? null,
          batchRecordId: data.batchRecordId ?? null,
          createdById: session.user.id,
        },
      })
    })
  } catch (error) {
    console.error("[inventory] movement transaction failed:", error)
    return { ok: false, error: "GENERIC" }
  }

  revalidatePath("/dashboard/products")
  revalidatePath(`/dashboard/products/${product.id}/edit`)
  revalidatePath("/dashboard")

  return { ok: true, nextStock: computed.nextStock }
}

/** Ledger entries for one product (org-scoped, newest first). */
export async function listStockMovements(
  productId: string
): Promise<StockMovementItem[]> {
  const { org } = await requirePermissionOrg("products.manage")

  // Guard: product must belong to this tenant — never serve foreign rows.
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId: org.id },
    select: { id: true },
  })
  if (!product) return []

  const rows = await prisma.stockMovement.findMany({
    where: { organizationId: org.id, productId },
    include: {
      productVariant: { select: { name: true } },
      supplierRecord: { select: { title: true } },
      batchRecord: { select: { title: true } },
      order: { select: { id: true, guestName: true, customer: { select: { name: true } } } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    quantity: r.quantity,
    source: r.source,
    note: r.note,
    variantName: r.productVariant?.name ?? null,
    supplierTitle: r.supplierRecord?.title ?? null,
    batchTitle: r.batchRecord?.title ?? null,
    orderNumber: r.order
      ? (r.order.customer?.name ?? r.order.guestName ?? r.order.id)
      : null,
    createdByName: r.createdBy?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  }))
}

/**
 * Picker options for the movement form. Suppliers come from the
 * `suppliers` extension entity, batches from `batch-production` —
 * both only when the effective profile enables them.
 */
export async function getStockLinkOptions(): Promise<StockLinkOptions> {
  const { org } = await requirePermissionOrg("products.manage")
  const profile = await getSessionEffectiveProfile()

  const suppliers = profile.extensions.includes("suppliers")
    ? await prisma.extensionRecord.findMany({
        where: { organizationId: org.id, entityKey: "supplier" },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
        take: 200,
      })
    : []

  const batches = profile.extensions.includes("batch-production")
    ? await prisma.extensionRecord.findMany({
        where: { organizationId: org.id, entityKey: "batch" },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
        take: 200,
      })
    : []

  return {
    suppliers: suppliers.map((s) => ({ id: s.id, title: s.title })),
    batches: batches.map((b) => ({ id: b.id, title: b.title })),
  }
}

/** Dashboard widget input: stock counts + the lowest-stock items. */
export interface StockSummary {
  inStock: number
  low: number
  out: number
  lowItems: { id: string; name: string; stockQuantity: number }[]
}

/**
 * Seštevek zaloge za dashboard widget (lowStock).
 *
 * #78: prag NI več trdo kodirana 10 — per-izdelek reorderPoint razreši
 * low-stock helper (isti helper kot stats kartica in tabela), tako da se
 * widget in /dashboard/products ne moreta razlikovati.
 */
export async function getStockSummary(): Promise<StockSummary> {
  const { org } = await requirePermissionOrg("products.manage")

  const [out, trackedRows] = await Promise.all([
    prisma.product.count({
      where: { organizationId: org.id, stockQuantity: { equals: 0 } },
    }),
    prisma.product.findMany({
      where: { organizationId: org.id, stockQuantity: { gt: 0 } },
      select: { id: true, name: true, stockQuantity: true, reorderPoint: true },
      orderBy: { stockQuantity: "asc" },
    }),
  ])

  const config = await prisma.salonConfig.findUnique({
    where: { organizationId: org.id },
    select: { defaultReorderPoint: true },
  })
  const orgDefault = config?.defaultReorderPoint ?? null

  const lowRows = trackedRows.filter((r) =>
    isLowStock(r.stockQuantity, resolveReorderPoint(r.reorderPoint, orgDefault))
  )

  return {
    inStock: trackedRows.length - lowRows.length,
    low: lowRows.length,
    out,
    lowItems: lowRows.slice(0, 5).map((r) => ({
      id: r.id,
      name: r.name,
      stockQuantity: r.stockQuantity,
    })),
  }
}

// ============================================================
// #78: PREJEM BLAGA (DELIVERY) — "prejeli smo dobavo" kot EN dogodek.
// En submission = N StockMovement vrstic z ISTO referenco (vir DELIVERY,
// skupni note "Dobava {documentNumber}"), vsaka linija pa posodobi
// stockQuantity v isti transakciji. Prejem je Vedno IN — blago prihaja.
// ============================================================

const deliveryLineSchema = z.object({
  productId: z.string().min(1).max(64),
  quantity: z.number().int().positive().max(1_000_000),
  productVariantId: z.string().min(1).max(64).nullable().optional(),
})

const deliverySchema = z.object({
  documentNumber: z.string().max(100).optional(),
  supplierRecordId: z.string().min(1).max(64).nullable().optional(),
  lines: z.array(deliveryLineSchema).min(1, "Dobava mora imeti vsaj eno linijo").max(100),
})

export type DeliveryInput = z.input<typeof deliverySchema>

export interface DeliveryResult {
  ok: boolean
  error?:
    | "VALIDATION"
    | "NOT_FOUND"
    | "NOT_TRACKED"
    | "VARIANT_MISMATCH"
    | "RECORD_LINK"
    | "GENERIC"
  receivedCount?: number
}

/**
 * Prejmi dobavo: en dogodek, N linij, ena transakcija.
 * Vse linije morajo pripadati temu najemniku; sledljivost dobavitelja
 * velja samo, kadar profil omogoča `suppliers` extensijo (kot pri
 * ročnem premiku).
 */
export async function recordDelivery(input: DeliveryInput): Promise<DeliveryResult> {
  const parsed = deliverySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const data = parsed.data

  const { session, org } = await requirePermissionOrg("products.manage")

  // Enako kljucu vsak id: linije z istim izdelkom se seštejejo.
  const productIds = [...new Set(data.lines.map((l) => l.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId: org.id },
    select: { id: true, name: true, trackInventory: true, stockQuantity: true },
  })
  if (products.length !== productIds.length) {
    return { ok: false, error: "NOT_FOUND" }
  }
  const untracked = products.find((p) => !p.trackInventory)
  if (untracked) return { ok: false, error: "NOT_TRACKED" }

  const profile = await getSessionEffectiveProfile()
  const supplierEnabled = profile.extensions.includes("suppliers")
  if (data.supplierRecordId && !supplierEnabled) {
    return { ok: false, error: "RECORD_LINK" }
  }
  if (data.supplierRecordId) {
    const rec = await prisma.extensionRecord.findFirst({
      where: {
        id: data.supplierRecordId,
        organizationId: org.id,
        entityKey: "supplier",
      },
      select: { id: true },
    })
    if (!rec) return { ok: false, error: "RECORD_LINK" }
  }

  // Variante (opcijsko) morajo pripadati svojemu izdelku.
  const variantIds = data.lines
    .map((l) => l.productVariantId)
    .filter((v): v is string => typeof v === "string")
  const variants = variantIds.length
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds }, organizationId: org.id },
        select: { id: true, productId: true, stockQuantity: true },
      })
    : []
  for (const line of data.lines) {
    if (!line.productVariantId) continue
    const v = variants.find((x) => x.id === line.productVariantId)
    if (!v || v.productId !== line.productId) {
      return { ok: false, error: "VARIANT_MISMATCH" }
    }
  }

  const reference = data.documentNumber?.trim()
    ? `Dobava ${data.documentNumber.trim()}`
    : "Dobava"

  try {
    await prisma.$transaction(async (tx) => {
      for (const line of data.lines) {
        const product = products.find((p) => p.id === line.productId)!
        const variant = line.productVariantId
          ? variants.find((v) => v.id === line.productVariantId)!
          : null
        const computed = computeStockDelta(
          variant ? variant.stockQuantity : product.stockQuantity,
          "IN",
          line.quantity
        )
        // Zaloge ne morem povečati pod nič — IN ne more biti zavrnjen
        // razen pri pokvarjenem state-u; varovalka vseeno.
        if (!computed.ok) continue

        if (variant) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: { stockQuantity: computed.nextStock },
          })
        } else {
          await tx.product.update({
            where: { id: product.id },
            data: { stockQuantity: computed.nextStock },
          })
        }

        await tx.stockMovement.create({
          data: {
            organizationId: org.id,
            productId: product.id,
            productVariantId: variant?.id ?? null,
            direction: "IN",
            quantity: line.quantity,
            source: "DELIVERY",
            note: reference,
            supplierRecordId: data.supplierRecordId ?? null,
            createdById: session.user.id,
          },
        })
      }
    })
  } catch (error) {
    console.error("[inventory] delivery transaction failed:", error)
    return { ok: false, error: "GENERIC" }
  }

  revalidatePath("/dashboard/products")
  revalidatePath("/dashboard")

  return { ok: true, receivedCount: data.lines.length }
}

// ============================================================
// #78: INVENTURA (STOCKTAKE) — prešteto stanje se zapiše kot RAZLIKA
// (prešteto − sistem), NIČesar se ne prepiše direktno. Celotna vrednost
// evidence je v tem, da razlaga trenutno številko: vsak popravek ima
// svojo vrstico z virom STOCKTAKE. Inventura je reverzibilna z naslednjim
// štetjem. Ničelne razlike NE pišejo (brez šuma v evidenci).
// ============================================================

const stocktakeLineSchema = z.object({
  productId: z.string().min(1).max(64),
  counted: z.number().int().min(0).max(1_000_000),
})

const stocktakeSchema = z.object({
  note: z.string().max(200).optional(),
  lines: z.array(stocktakeLineSchema).min(1).max(500),
})

export type StockTakeInput = z.input<typeof stocktakeSchema>

export interface StockTakeResult {
  ok: boolean
  error?: "VALIDATION" | "NOT_FOUND" | "NOT_TRACKED" | "GENERIC"
  adjusted?: { productId: string; name: string; delta: number }[]
}

/**
 * Inventura: za vsak izdelek z NENIČELNO razliko zapiši premik
 * (sign razlike določi smer) in posodobi stanje v eni transakciji.
 */
export async function submitStockTake(input: StockTakeInput): Promise<StockTakeResult> {
  const parsed = stocktakeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const data = parsed.data

  const { session, org } = await requirePermissionOrg("products.manage")

  const productIds = [...new Set(data.lines.map((l) => l.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId: org.id },
    select: { id: true, name: true, trackInventory: true, stockQuantity: true },
  })
  if (products.length !== productIds.length) {
    return { ok: false, error: "NOT_FOUND" }
  }
  const untracked = products.find((p) => !p.trackInventory)
  if (untracked) return { ok: false, error: "NOT_TRACKED" }

  const adjusted: { productId: string; name: string; delta: number }[] = []
  try {
    await prisma.$transaction(async (tx) => {
      for (const line of data.lines) {
        const product = products.find((p) => p.id === line.productId)!
        const delta = line.counted - product.stockQuantity
        if (delta === 0) continue // neničelne razlike se pišejo SAMO

        const direction: StockDirectionValue = delta > 0 ? "IN" : "OUT"
        const computed = computeStockDelta(
          product.stockQuantity,
          direction,
          Math.abs(delta)
        )
        if (!computed.ok) continue // ne more iti pod nič (counted >= 0 to jamči)

        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: computed.nextStock },
        })
        await tx.stockMovement.create({
          data: {
            organizationId: org.id,
            productId: product.id,
            direction,
            quantity: Math.abs(delta),
            source: "STOCKTAKE",
            note:
              data.note?.trim() ||
              `Inventura: prešteto ${line.counted}, sistem ${product.stockQuantity}`,
            createdById: session.user.id,
          },
        })
        adjusted.push({ productId: product.id, name: product.name, delta })
      }
    })
  } catch (error) {
    console.error("[inventory] stocktake transaction failed:", error)
    return { ok: false, error: "GENERIC" }
  }

  revalidatePath("/dashboard/products")
  revalidatePath("/dashboard/products/stocktake")
  revalidatePath("/dashboard")

  return { ok: true, adjusted }
}
