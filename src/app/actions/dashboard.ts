"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { requireAdminOrg } from "@/lib/tenant"

import { endOfWeek } from "date-fns"
import { startOfWeek } from "date-fns"
import { subMonths } from "date-fns"
import { endOfMonth } from "date-fns"
import { startOfMonth } from "date-fns"

// Get dashboard statistics — LANDING-PAGE COUNTS available to EVERY admin
// (restricted or not): the dashboard root is every member's home and shows
// non-financial counts. FINANCIAL aggregates are split into
// `getRevenueStats` (finances.view) so "admin brez financ" never sees
// revenue anywhere (E4-6b).
export async function getDashboardStats() {
  const { org } = await requireAdminOrg()

  const now = new Date()
  const currentMonthStart = startOfMonth(now)
  const currentMonthEnd = endOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))
  const weekStart = startOfWeek(now)
  const weekEnd = endOfWeek(now)

  const [
    totalCustomers,
    weeklyCustomers,
    totalAppointments,
    monthlyAppointments,
    totalOrders,
    currentMonthOrders,
    lastMonthOrders,
  ] = await Promise.all([
    prisma.customer.count({ where: { organizationId: org.id } }),
    prisma.customer.count({
      where: { organizationId: org.id, createdAt: { gte: weekStart, lte: weekEnd } },
    }),
    prisma.appointment.count({ where: { organizationId: org.id } }),
    prisma.appointment.count({
      where: { organizationId: org.id, createdAt: { gte: currentMonthStart, lte: currentMonthEnd } },
    }),
    prisma.order.count({
      where: { organizationId: org.id, status: { in: ["PAID", "COMPLETED"] } },
    }),
    prisma.order.count({
      where: {
        organizationId: org.id,
        status: { in: ["PAID", "COMPLETED"] },
        createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
      },
    }),
    prisma.order.count({
      where: {
        organizationId: org.id,
        status: { in: ["PAID", "COMPLETED"] },
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
    }),
  ])

  // P1 #5 (walkthrough): ni prejšnjega meseca → null ("Ni prejšnjih podatkov"),
  // nikoli izmišljen +100 %.
  const ordersChange =
    lastMonthOrders > 0
      ? ((currentMonthOrders - lastMonthOrders) / lastMonthOrders) * 100
      : null

  return {
    appointments: { total: totalAppointments, monthly: monthlyAppointments },
    customers: { total: totalCustomers, weekly: weeklyCustomers },
    orders: { total: totalOrders, change: ordersChange },
  }
}

// Revenue this month vs. last — FINANCIAL aggregate, finances.view only.
export async function getRevenueStats() {
  const { org } = await requirePermissionOrg("finances.view")

  const now = new Date()
  const currentMonthStart = startOfMonth(now)
  const currentMonthEnd = endOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))

  const [currentMonthRevenue, lastMonthRevenue] = await Promise.all([
    prisma.order.aggregate({
      where: {
        organizationId: org.id,
        status: "COMPLETED",
        createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: {
        organizationId: org.id,
        status: "COMPLETED",
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      _sum: { total: true },
    }),
  ])

  const currentRevenue = Number(currentMonthRevenue._sum.total || 0)
  const lastRevenue = Number(lastMonthRevenue._sum.total || 0)
  // P1 #5 (walkthrough): ni prejšnjega meseca → null ("Ni prejšnjih podatkov").
  const revenueChange =
    lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : null

  return {
    revenue: { total: currentRevenue, change: revenueChange },
  }
}

//Get Today's Appointments
export async function getTodaysAppointments() {
  const { org } = await requirePermissionOrg("appointments.view")

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const appointments = await prisma.appointment.findMany({
    where: {
      organizationId: org.id,
      startTime: {
        gte: startOfToday,
        lte: endOfToday,
      },
      status: { not: "CANCELLED" },
    },
    include: {
      staff: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
      services: {
        include: {
          service: { select: { id: true, name: true, duration: true } },
        },
      },
    },
    orderBy: { startTime: "asc" },
  })
  return appointments.map((appointment) => ({
    ...appointment,
  }))
}

//Get Recent Activity
export async function getRecentActivities() {
  const { org } = await requirePermissionOrg("appointments.view")

  const [recentAppointments, recentOrders, recentCustomers] = await Promise.all(
    [
      prisma.appointment.findMany({
        take: 3,
        orderBy: { createdAt: "desc" },
        where: { organizationId: org.id },
        select: {
          id: true,
          createdAt: true,
          customer: { select: { id: true, name: true } },
          guestName: true,
        },
      }),
      prisma.order.findMany({
        take: 3,
        orderBy: { createdAt: "desc" },
        where: {
          organizationId: org.id,
          status: { in: ["PAID", "COMPLETED"] },
        },
        select: {
          id: true,
          createdAt: true,
          customer: { select: { id: true, name: true } },
          guestName: true,
        },
      }),
      prisma.customer.findMany({
        take: 3,
        orderBy: { createdAt: "desc" },
        where: { organizationId: org.id },
        select: { id: true, name: true, createdAt: true },
      }),
    ]
  )
  const activities = [
    ...recentAppointments.map((apt) => ({
      id: apt.id,
      type: "appointment" as const,
      name: apt.customer?.name || apt.guestName || "Guest",
      createdAt: apt.createdAt,
      color: "green" as const,
    })),
    ...recentOrders.map((order) => ({
      id: order.id,
      type: "order" as const,
      name: order.customer?.name || order.guestName || "Guest",
      createdAt: order.createdAt,
      color: "blue" as const,
    })),
    ...recentCustomers.map((customer) => ({
      id: customer.id,
      type: "customer" as const,
      name: customer.name,
      createdAt: customer.createdAt,
      color: "amber" as const,
    })),
  ]

  return activities
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
}
