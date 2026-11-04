"use server"

import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { CreateProductInput } from "@/lib/interfaces"
import { getResolvedOrg } from "@/lib/tenant"
import { getPublicOrg } from "@/lib/tenant"
import { UnauthorizedError, requirePermissionOrg } from "@/lib/auth/guards"
import { enforcePlanLimit } from "@/lib/plans/resolve"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import { isLowStock, resolveReorderPoint, FALLBACK_REORDER_POINT } from "@/lib/inventory/low-stock"

export type UpdateProductInput = Partial<CreateProductInput>

/**
 * Resolve the organization for functions used by BOTH the public site and the
 * admin dashboard: admins/staff get their session org, everyone else gets the
 * public (tenant) org.
 */
async function resolveRequestOrg() {
  // Tenant header (/s/[slug]) always wins over the session to avoid
  // cross-tenant leakage when a signed-in admin browses another salon.
  return getResolvedOrg()
}

// Get featured products for homepage
export const getFeaturedProducts = cache(async () => {
  const org = await getPublicOrg()
  if (!org) return []

  const products = await prisma.product.findMany({
    where: { isActive: true, isFeatured: true, organizationId: org.id },
    include: { category: true },
    take: 4,
    orderBy: { name: "asc" },
  })

  return products.map((p) => ({
    ...p,
    price: p.price.toNumber(),
    compareAtPrice: p.compareAtPrice?.toNumber() ?? null,
  }))
})

// Get all products for shop page
export const getShopProducts = cache(async () => {
  const org = await getPublicOrg()
  if (!org) return []

  const products = await prisma.product.findMany({
    where: { isActive: true, organizationId: org.id },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
  })

  return products.map((product) => ({
    ...product,
    price: product.price.toNumber(),
    compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
  }))
})

// Admin: Get all products with counts
//
// #78: the retail layer — the list must SCALE. Prej je ta query naložil
// VSE izdelke najemnika na vsak render (FREE 20, PRO 500, SCALE neomejeno)
// brez filtra, sortiranja ali paginga. Zdaj:
//   • `take`/`skip` + `count` za paginacijo (privzeto 25 na stran),
//   • filtri: search, categoryId, stock ("all" | "low" | "out" | "inactive"),
//   • sortiranje: createdAt | name | price | stock.
// "low"/"out" so org-scoped SQL filtri (-stock, ne per-product prag —
// točni per-product prag razreši low-stock helper v UI/stats sloju).
export type AdminProductSort = "createdAt" | "name" | "price" | "stock"

export interface AdminProductsQuery {
  search?: string
  categoryId?: string
  stock?: "all" | "low" | "out" | "inactive"
  sort?: AdminProductSort
  page?: number
  perPage?: number
}

export interface AdminProductsResult {
  products: {
    id: string
    name: string
    sku: string | null
    barcode: string | null
    brand: string | null
    unit: string
    vatRate: number | null
    price: number
    compareAtPrice: number | null
    stockQuantity: number
    trackInventory: boolean
    forSale: boolean
    reorderPoint: number | null
    isActive: boolean
    images: string[]
    categoryName: string | null
    orderCount: number
  }[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

const ADMIN_PRODUCTS_PER_PAGE = 25

export async function getAdminProducts(
  query: AdminProductsQuery | string = {}
): Promise<AdminProductsResult> {
  const { org } = await requirePermissionOrg("products.manage")

  // Back-compat: stari klic je bil getAdminProducts(search?: string).
  const q: AdminProductsQuery =
    typeof query === "string" ? { search: query || undefined } : query

  const page = Math.max(1, Math.floor(q.page ?? 1))
  const perPage = Math.min(
    100,
    Math.max(1, Math.floor(q.perPage ?? ADMIN_PRODUCTS_PER_PAGE))
  )

  // Org privzeti prag za "low" SQL filter — iz SalonConfiga (#78),
  // enako privzeto vrednost kot low-stock helper.
  const config =
    q.stock === "low"
      ? await prisma.salonConfig.findUnique({
          where: { organizationId: org.id },
          select: { defaultReorderPoint: true },
        })
      : null
  const orgDefault = config?.defaultReorderPoint ?? 10

  const where = {
    organizationId: org.id,
    ...(q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: "insensitive" as const } },
            { sku: { contains: q.search, mode: "insensitive" as const } },
            { barcode: { contains: q.search, mode: "insensitive" as const } },
            { brand: { contains: q.search, mode: "insensitive" as const } },
            { description: { contains: q.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.stock === "out"
      ? { stockQuantity: { lte: 0 } }
      : q.stock === "low"
        ? { stockQuantity: { gt: 0, lte: orgDefault } }
        : q.stock === "inactive"
          ? { isActive: false }
          : {}),
  }

  const orderBy =
    q.sort === "name"
      ? ({ name: "asc" } as const)
      : q.sort === "price"
        ? ({ price: "asc" } as const)
        : q.sort === "stock"
          ? ({ stockQuantity: "asc" } as const)
          : ({ createdAt: "desc" } as const)

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        _count: { select: { orderItems: true } },
      },
      orderBy,
      take: perPage,
      skip: (page - 1) * perPage,
    }),
    prisma.product.count({ where }),
  ])

  return {
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      brand: product.brand,
      unit: product.unit,
      vatRate: product.vatRate ? product.vatRate.toNumber() : null,
      price: product.price.toNumber(),
      compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
      stockQuantity: product.stockQuantity,
      trackInventory: product.trackInventory,
      forSale: product.forSale,
      reorderPoint: product.reorderPoint,
      isActive: product.isActive,
      images: product.images,
      categoryName: product.category?.name ?? null,
      orderCount: product._count.orderItems,
    })),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

// Admin: Get product statistics
//
// #78: prag NI več trdo kodirana 10 — razreši ga low-stock helper
// (product.reorderPoint ?? org.defaultReorderPoint). Ker je prag
// per-izdelek, "low" ne more biti en SQL count: preberemo samo
// (stockQuantity, reorderPoint) očiščenih izdelkov in filtriramo v JS
// z ISTIM helperjem, ki ga uporablja tabela — kartica in tabela se
// zato ne moreta razlikovati.
export async function getProductStats() {
  const { org } = await requirePermissionOrg("products.manage")

  const [totalProducts, outOfStock, , trackedRows] = await Promise.all([
    prisma.product.count({ where: { organizationId: org.id } }),
    prisma.product.count({
      where: { stockQuantity: { equals: 0 }, organizationId: org.id },
    }),
    prisma.product.count({
      where: { stockQuantity: { gt: 0 }, organizationId: org.id },
    }),
    prisma.product.findMany({
      where: { organizationId: org.id, stockQuantity: { gt: 0 } },
      select: { stockQuantity: true, reorderPoint: true },
    }),
  ])

  // Org privzeti prag (defaultReorderPoint je del SalonConfiga);
  // per-izdelek override razreši helper.
  const config = await prisma.salonConfig.findUnique({
    where: { organizationId: org.id },
    select: { defaultReorderPoint: true },
  })
  const orgDefault = config?.defaultReorderPoint ?? null

  const lowStock = trackedRows.filter((r) =>
    isLowStock(r.stockQuantity, resolveReorderPoint(r.reorderPoint, orgDefault))
  ).length

  const inStock = totalProducts - lowStock - outOfStock

  // #78: the page's table needs the SAME org default for the row colour —
  // expose it so no second constant can appear.
  return {
    totalProducts,
    inStock,
    lowStock,
    outOfStock,
    defaultReorderPoint: orgDefault ?? FALLBACK_REORDER_POINT,
  }
}

// Get product by ID (admin edit)
// SECURITY (E4-6b): admin-only — previously any caller with an id could
// read inactive products, stock quantities and variant data. The only
// caller is the guarded dashboard edit page; the comment claiming a
// public shop detail use was stale (public reads use getShopProducts /
// getFeaturedProducts, active-only).
// Cached to avoid duplicate fetches in generateMetadata + page component
export const getProductById = cache(async (id: string) => {
  await requirePermissionOrg("products.manage")
  const org = await resolveRequestOrg()
  if (!org) return null

  const product = await prisma.product.findFirst({
    where: { id, organizationId: org.id },
    include: {
      category: true,
      // Variants feed the stock-movement ledger card (E2-2).
      variants: {
        where: { isActive: true },
        select: { id: true, name: true, stockQuantity: true },
        orderBy: { position: "asc" },
      },
    },
  })

  if (!product) return null

  return {
    ...product,
    price: product.price.toNumber(),
    compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
    // #78: retail layer — Decimal → number za formo.
    vatRate: product.vatRate ? product.vatRate.toNumber() : null,
  }
})

// Create product
export async function createProduct(data: CreateProductInput) {
  try {
    const { org } = await requirePermissionOrg("products.manage")

    // Plan entitlements (EPIC #3 E3-3): block NEW products at the plan
    // limit — never touches existing content (downgrade tolerance).
    const limit = await enforcePlanLimit(org, "products", await getLocaleFromCookies())
    if (!limit.ok) {
      return { success: false, error: limit.message, code: limit.code }
    }

    // Extract categoryId from data
    const { categoryId, ...productData } = data

    // Validate the category belongs to this organization
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, organizationId: org.id },
        select: { id: true },
      })
      if (!category) {
        return { success: false, error: "Invalid category" }
      }
    }

    const product = await prisma.product.create({
      data: {
        ...productData,
        organization: { connect: { id: org.id } },
        ...(categoryId && { category: { connect: { id: categoryId } } }),
      },
    })

    revalidatePath("/dashboard/products")
    revalidatePath("/shop")

    return {
      success: true,
      product: {
        ...product,
        price: product.price.toNumber(),
        compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
      },
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    // #77: SKU is unique per TENANT (@@unique([organizationId, sku])) — a
    // collision inside one tenant must read as a field error, never as a raw
    // Prisma constraint name.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return {
        success: false,
        error: "Ta SKU je že uporabljen v vaši trgovini.",
      }
    }
    console.error("Error creating product:", error)
    return { success: false, error: "Failed to create product." }
  }
}

// Update product
export async function updateProduct(id: string, data: UpdateProductInput) {
  try {
    const { org } = await requirePermissionOrg("products.manage")

    // Extract categoryId from data
    const { categoryId, ...productData } = data

    // Verify ownership before mutating
    const existing = await prisma.product.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!existing) {
      return { success: false, error: "Product not found" }
    }

    // Validate the category belongs to this organization
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, organizationId: org.id },
        select: { id: true },
      })
      if (!category) {
        return { success: false, error: "Invalid category" }
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...productData,
        ...(categoryId !== undefined && {
          category: categoryId
            ? { connect: { id: categoryId } }
            : { disconnect: true },
        }),
      },
    })

    revalidatePath("/dashboard/products")
    revalidatePath("/shop")

    return {
      success: true,
      product: {
        ...product,
        price: product.price.toNumber(),
        compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
      },
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    // #77: same per-tenant SKU rule on update — human field error, no Prisma string.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return {
        success: false,
        error: "Ta SKU je že uporabljen v vaši trgovini.",
      }
    }
    console.error("Error updating product:", error)
    return { success: false, error: "Failed to update product." }
  }
}

// Delete product
export async function deleteProduct(id: string) {
  try {
    const { org } = await requirePermissionOrg("products.manage")

    // Verify ownership before mutating
    const existing = await prisma.product.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!existing) {
      return { success: false, error: "Product not found" }
    }

    const orderCount = await prisma.orderItem.count({
      where: { productId: id },
    })

    if (orderCount > 0) {
      return {
        success: false,
        error:
          "Cannot delete product with existing orders. Deactivate instead.",
      }
    }

    await prisma.product.delete({ where: { id } })

    revalidatePath("/dashboard/products")
    revalidatePath("/shop")

    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error deleting product:", error)
    return { success: false, error: "Failed to delete product." }
  }
}

// Toggle product active status
export async function toggleProductStatus(id: string) {
  try {
    const { org } = await requirePermissionOrg("products.manage")

    const product = await prisma.product.findFirst({
      where: { id, organizationId: org.id },
      select: { isActive: true },
    })

    if (!product) {
      return { success: false, error: "Product not found." }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
    })

    revalidatePath("/dashboard/products")
    revalidatePath("/shop")

    return { success: true, isActive: updated.isActive }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error toggling product status:", error)
    return { success: false, error: "Failed to toggle product status." }
  }
}
