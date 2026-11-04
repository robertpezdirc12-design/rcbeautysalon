"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { OrderStatus } from "@prisma/client"
import { auth } from "@/lib/auth/auth"
import { ORG_HEADER } from "@/lib/tenant"

// Admin: Get all orders with customer and items
export async function getAdminOrders(search?: string) {
  const { org } = await requirePermissionOrg("orders.manage")

  const orders = await prisma.order.findMany({
    where: {
      organizationId: org.id,
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: "insensitive" } },
              { customer: { name: { contains: search, mode: "insensitive" } } },
              { customer: { email: { contains: search, mode: "insensitive" } } },
              { guestName: { contains: search, mode: "insensitive" } },
              { guestEmail: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      customer: true,
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return orders.map((order) => ({
    ...order,
    subtotal: order.subtotal.toNumber(),
    tax: order.tax.toNumber(),
    total: order.total.toNumber(),
  }))
}

// Admin: Get order statistics
export async function getOrderStats() {
  const { org } = await requirePermissionOrg("orders.manage")

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalOrders, pending, completedToday, revenueThisMonth] =
    await Promise.all([
      prisma.order.count({ where: { organizationId: org.id } }),
      prisma.order.count({
        where: {
          organizationId: org.id,
          status: { in: ["PENDING", "PAID"] },
        },
      }),
      prisma.order.count({
        where: {
          organizationId: org.id,
          status: "COMPLETED",
          updatedAt: { gte: startOfDay },
        },
      }),
      prisma.order.aggregate({
        where: {
          organizationId: org.id,
          status: { in: ["PAID", "COMPLETED"] },
          createdAt: { gte: startOfMonth },
        },
        _sum: {
          total: true,
        },
      }),
    ])

  return {
    totalOrders,
    pending,
    completedToday,
    revenueThisMonth: revenueThisMonth._sum.total?.toNumber() || 0,
  }
}

// Admin: Get order by ID with full details
export async function getOrderById(id: string) {
  const { org } = await requirePermissionOrg("orders.manage")

  const order = await prisma.order.findFirst({
    where: { id, organizationId: org.id },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  })

  if (!order) return null

  return {
    ...order,
    subtotal: order.subtotal.toNumber(),
    tax: order.tax.toNumber(),
    total: order.total.toNumber(),
    items: order.items.map((item) => ({
      ...item,
      price: item.price.toNumber(),
    })),
  }
}

// Update order status
export async function updateOrderStatus(id: string, status: OrderStatus) {
  const { org } = await requirePermissionOrg("orders.manage")

  try {
    // Verify ownership before mutating
    const existing = await prisma.order.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!existing) {
      return { success: false, error: "Order not found" }
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    })

    revalidatePath("/dashboard/orders")

    return { success: true, order }
  } catch (error) {
    console.error("Error updating order status:", error)
    return { success: false, error: "Failed to update order status." }
  }
}

// Customer: Get order by ID (only their own orders)
export async function getOrderByIdForCustomer(id: string) {
  const session = await auth()

  if (!session?.user) {
    return null
  }

  const order = await prisma.order.findFirst({
    where: {
      id,
      customer: { userId: session.user.id },
    },
    include: {
      customer: true,
      organization: { select: { name: true, slug: true } },
      items: {
        include: {
          product: true,
        },
      },
    },
  })

  if (!order) return null

  return {
    ...order,
    subtotal: order.subtotal.toNumber(),
    tax: order.tax.toNumber(),
    total: order.total.toNumber(),
    items: order.items.map((item) => ({
      ...item,
      price: item.price.toNumber(),
    })),
  }
}

// Customer: Get all orders for the current user
export async function getCustomerOrders() {
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: "You must be logged in to view orders",
    }
  }

  // TENANT ISOLATION (EPIC #4 visual pass): under a tenant site
  // (/s/[slug]/my-orders — proxy sets x-org-slug) scope to THAT tenant;
  // another tenant's orders must never render under this brand. Unknown
  // slug -> empty list, never the global one. On the platform root the
  // user sees their own global order history (own data, own consent).
  let organizationId: string | null = null
  const slug = (await headers()).get(ORG_HEADER)
  if (slug) {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!org) return { success: true, orders: [] }
    organizationId = org.id
  }

  const orders = await prisma.order.findMany({
    where: {
      customer: { userId: session.user.id },
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  const convertedOrders = orders.map((order) => ({
    ...order,
    subtotal: order.subtotal.toNumber(),
    tax: order.tax.toNumber(),
    total: order.total.toNumber(),
    items: order.items.map((item) => ({
      ...item,
      price: item.price.toNumber(),
    })),
  }))

  return {
    success: true,
    orders: convertedOrders,
  }
}

// ============================================================
// #79: NAPITNINA na naročilu — zabeleži napitnino (gotovina ali
// kartica) pri oddaji/prevzemu. Ločena vrstica prihodka, ne del
// postavk.
// ============================================================
export async function recordOrderTip(
  id: string,
  input: { amount: number; method?: "cash" | "card" | null }
): Promise<{ success: boolean; error?: string }> {
  const { org } = await requirePermissionOrg("orders.manage")

  const amount = input.amount
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000) {
    return { success: false, error: "Neveljaven znesek napitnine" }
  }

  try {
    const existing = await prisma.order.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!existing) {
      return { success: false, error: "Order not found" }
    }

    await prisma.order.update({
      where: { id },
      data: {
        tipAmount: amount.toFixed(2),
        tipMethod: input.method ?? null,
      },
    })

    revalidatePath("/dashboard/orders")
    return { success: true }
  } catch (error) {
    console.error("Error recording order tip:", error)
    return { success: false, error: "Failed to record tip." }
  }
}
