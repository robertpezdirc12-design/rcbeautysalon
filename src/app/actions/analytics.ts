"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"

import {
  KPIData,
  RevenueDataPoint,
  TopService,
  TopProduct,
  AppointmentsByStatus,
  EnquiriesByStatus,
  StaffPerformance,
  PeriodType,
  AnalyticsPeriod,
} from "@/lib/interfaces"
import {
  startOfDay,
  endOfDay,
  subDays,
  subMonths,
  format,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  endOfWeek,
  endOfMonth,
} from "date-fns"
import { sl } from "date-fns/locale"

// Helper function to get date ranges based on period type
function getAnalyticsPeriod(period: PeriodType): AnalyticsPeriod {
  const now = new Date()
  const endDate = endOfDay(now)

  let startDate: Date
  let previousStartDate: Date
  let previousEndDate: Date

  switch (period) {
    case "7d":
      startDate = startOfDay(subDays(now, 7))
      previousEndDate = startOfDay(subDays(now, 7))
      previousStartDate = startOfDay(subDays(now, 14))
      break
    case "30d":
      startDate = startOfDay(subDays(now, 30))
      previousEndDate = startOfDay(subDays(now, 30))
      previousStartDate = startOfDay(subDays(now, 60))
      break
    case "90d":
      startDate = startOfDay(subDays(now, 90))
      previousEndDate = startOfDay(subDays(now, 90))
      previousStartDate = startOfDay(subDays(now, 180))
      break
    case "12m":
      startDate = startOfDay(subMonths(now, 12))
      previousEndDate = startOfDay(subMonths(now, 12))
      previousStartDate = startOfDay(subMonths(now, 24))
      break
    default:
      startDate = startOfDay(subDays(now, 30))
      previousEndDate = startOfDay(subDays(now, 30))
      previousStartDate = startOfDay(subDays(now, 60))
  }

  return { startDate, endDate, previousStartDate, previousEndDate }
}

// Helper para calcular % de cambio.
// P1 #5 (walkthrough): previous === 0 → null ("Ni prejšnjih podatkov"),
// NIKOLI izmišljen +100 % (0 → 512,79 € ni +100 %).
function calculateChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100 * 10) / 10
}

export async function getKPIData(period: PeriodType = "30d"): Promise<KPIData> {
  const { org } = await requirePermissionOrg("analytics.view")

  const { startDate, endDate, previousStartDate, previousEndDate } = getAnalyticsPeriod(period)

  // ============ PERÍODO ACTUAL ============

  // Revenue de appointments (depósitos pagados)
  const appointmentRevenue = await prisma.appointment.aggregate({
    where: {
      organizationId: org.id,
      depositPaid: true,
      createdAt: { gte: startDate, lte: endDate }
    },
    _sum: { depositAmount: true }
  })

  // Revenue de orders (productos vendidos)
  const orderRevenue = await prisma.order.aggregate({
    where: {
      organizationId: org.id,
      status: "PAID",
      createdAt: { gte: startDate, lte: endDate }
    },
    _sum: { total: true }
  })

  // Total appointments
  const totalAppointments = await prisma.appointment.count({
    where: {
      organizationId: org.id,
      createdAt: { gte: startDate, lte: endDate }
    }
  })

  // Total enquiries (form submissions) — E4-2a, derived only
  const totalEnquiries = await prisma.formSubmission.count({
    where: {
      organizationId: org.id,
      createdAt: { gte: startDate, lte: endDate }
    }
  })

  // Total orders pagadas
  const totalOrders = await prisma.order.count({
    where: {
      organizationId: org.id,
      status: "PAID",
      createdAt: { gte: startDate, lte: endDate }
    }
  })

  // Customers únicos (que hicieron appointment u order)
  const [appointmentCustomers, orderCustomers] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId: org.id,
        createdAt: { gte: startDate, lte: endDate },
        customerId: { not: null }
      },
      select: { customerId: true },
      distinct: ["customerId"]
    }),
    prisma.order.findMany({
      where: {
        organizationId: org.id,
        status: "PAID",
        createdAt: { gte: startDate, lte: endDate },
        customerId: { not: null }
      },
      select: { customerId: true },
      distinct: ["customerId"]
    })
  ])

  const uniqueCustomerIds = new Set([
    ...appointmentCustomers.map(a => a.customerId),
    ...orderCustomers.map(o => o.customerId)
  ])
  const totalCustomers = uniqueCustomerIds.size

  // ============ PERÍODO ANTERIOR ============

  const prevAppointmentRevenue = await prisma.appointment.aggregate({
    where: {
      organizationId: org.id,
      depositPaid: true,
      createdAt: { gte: previousStartDate, lte: previousEndDate }
    },
    _sum: { depositAmount: true }
  })

  const prevOrderRevenue = await prisma.order.aggregate({
    where: {
      organizationId: org.id,
      status: "PAID",
      createdAt: { gte: previousStartDate, lte: previousEndDate }
    },
    _sum: { total: true }
  })

  const prevTotalAppointments = await prisma.appointment.count({
    where: {
      organizationId: org.id,
      createdAt: { gte: previousStartDate, lte: previousEndDate }
    }
  })

  const prevTotalOrders = await prisma.order.count({
    where: {
      organizationId: org.id,
      status: "PAID",
      createdAt: { gte: previousStartDate, lte: previousEndDate }
    }
  })

  // Previous-period enquiries — E4-2a
  const prevTotalEnquiries = await prisma.formSubmission.count({
    where: {
      organizationId: org.id,
      createdAt: { gte: previousStartDate, lte: previousEndDate }
    }
  })

  const [prevAppointmentCustomers, prevOrderCustomers] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId: org.id,
        createdAt: { gte: previousStartDate, lte: previousEndDate },
        customerId: { not: null }
      },
      select: { customerId: true },
      distinct: ["customerId"]
    }),
    prisma.order.findMany({
      where: {
        organizationId: org.id,
        status: "PAID",
        createdAt: { gte: previousStartDate, lte: previousEndDate },
        customerId: { not: null }
      },
      select: { customerId: true },
      distinct: ["customerId"]
    })
  ])

  const prevUniqueCustomerIds = new Set([
    ...prevAppointmentCustomers.map(a => a.customerId),
    ...prevOrderCustomers.map(o => o.customerId)
  ])
  const prevTotalCustomers = prevUniqueCustomerIds.size

  // ============ CALCULAR VALORES FINALES ============

  const currentRevenue =
    (appointmentRevenue._sum.depositAmount?.toNumber() ?? 0) +
    (orderRevenue._sum.total?.toNumber() ?? 0)

  const previousRevenue =
    (prevAppointmentRevenue._sum.depositAmount?.toNumber() ?? 0) +
    (prevOrderRevenue._sum.total?.toNumber() ?? 0)

  return {
    totalRevenue: currentRevenue,
    totalAppointments,
    totalOrders,
    totalCustomers,
    totalEnquiries,
    revenueChange: calculateChange(currentRevenue, previousRevenue),
    appointmentsChange: calculateChange(totalAppointments, prevTotalAppointments),
    ordersChange: calculateChange(totalOrders, prevTotalOrders),
    customersChange: calculateChange(totalCustomers, prevTotalCustomers),
    enquiriesChange: calculateChange(totalEnquiries, prevTotalEnquiries),
  }
}

export async function getRevenueChartData(period: PeriodType = "30d"): Promise<RevenueDataPoint[]> {
  const { org } = await requirePermissionOrg("analytics.view")

  const { startDate, endDate } = getAnalyticsPeriod(period)

  // Determinar intervalos según el período
  let intervals: Date[]
  let dateFormat: string

  if (period === "7d" || period === "30d") {
    intervals = eachDayOfInterval({ start: startDate, end: endDate })
    // P2 #17 (walkthrough): slovenske osi — "4. okt." namesto EN "Oct 4"
    dateFormat = "d. MMM"
  } else if (period === "90d") {
    intervals = eachWeekOfInterval({ start: startDate, end: endDate })
    dateFormat = "d. MMM"
  } else {
    intervals = eachMonthOfInterval({ start: startDate, end: endDate })
    dateFormat = "LLL yyyy"
  }

  // Obtener todos los appointments y orders en el rango
  const [appointments, orders] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId: org.id,
        depositPaid: true,
        createdAt: { gte: startDate, lte: endDate }
      },
      select: {
        createdAt: true,
        depositAmount: true
      }
    }),
    prisma.order.findMany({
      where: {
        organizationId: org.id,
        status: "PAID",
        createdAt: { gte: startDate, lte: endDate }
      },
      select: {
        createdAt: true,
        total: true
      }
    })
  ])

  // Agrupar por intervalo
  const result: RevenueDataPoint[] = intervals.map((intervalStart) => {


    let intervalEnd: Date

    if (period === "7d" || period === "30d") {
      intervalEnd = endOfDay(intervalStart)
    } else if (period === "90d") {
      intervalEnd = endOfWeek(intervalStart)
    } else {
      intervalEnd = endOfMonth(intervalStart)
    }

    // Sumar appointments en este intervalo
    const appointmentRevenue = appointments
      .filter(a => a.createdAt >= intervalStart && a.createdAt <= intervalEnd)
      .reduce((sum, a) => sum + (a.depositAmount?.toNumber() ?? 0), 0)

    // Sumar orders en este intervalo
    const productRevenue = orders
      .filter(o => o.createdAt >= intervalStart && o.createdAt <= intervalEnd)
      .reduce((sum, o) => sum + (o.total?.toNumber() ?? 0), 0)

    return {
      date: format(intervalStart, dateFormat, { locale: sl }),
      appointments: Math.round(appointmentRevenue * 100) / 100,
      products: Math.round(productRevenue * 100) / 100
    }
  })

  return result
}

export async function getTopServices(period: PeriodType = "30d"): Promise<TopService[]> {
  const { org } = await requirePermissionOrg("analytics.view")

  const { startDate, endDate } = getAnalyticsPeriod(period)

  // Obtener servicios con sus appointments
  const appointmentServices = await prisma.appointmentService.findMany({
    where: {
      appointment: {
        organizationId: org.id,
        depositPaid: true,
        createdAt: { gte: startDate, lte: endDate }
      }
    },
    include: {
      service: {
        select: { name: true, price: true }
      },
      appointment: {
        select: { depositAmount: true }
      }
    }
  })

  // Agrupar por servicio
  const serviceMap = new Map<string, { name: string; bookings: number; revenue: number }>()

  appointmentServices.forEach(as => {
    const existing = serviceMap.get(as.serviceId)
    const servicePrice = as.service.price?.toNumber() ?? 0

    if (existing) {
      existing.bookings += 1
      existing.revenue += servicePrice
    } else {
      serviceMap.set(as.serviceId, {
        name: as.service.name,
        bookings: 1,
        revenue: servicePrice
      })
    }
  })

  // Convertir a array y ordenar por bookings
  const result = Array.from(serviceMap.values())
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 5)

  return result
}

export async function getTopProducts(period: PeriodType = "30d"): Promise<TopProduct[]> {
  const { org } = await requirePermissionOrg("analytics.view")

  const { startDate, endDate } = getAnalyticsPeriod(period)

  // Obtener order items con sus productos
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        organizationId: org.id,
        status: "PAID",
        createdAt: { gte: startDate, lte: endDate }
      }
    },
    include: {
      product: {
        select: { name: true }
      }
    }
  })

  // Agrupar por producto
  const productMap = new Map<string, { name: string; sales: number; revenue: number }>()

  orderItems.forEach(item => {
    const existing = productMap.get(item.productId)
    const itemRevenue = item.price.toNumber() * item.quantity

    if (existing) {
      existing.sales += item.quantity
      existing.revenue += itemRevenue
    } else {
      productMap.set(item.productId, {
        name: item.product.name,
        sales: item.quantity,
        revenue: itemRevenue
      })
    }
  })

  // Convertir a array y ordenar por ventas
  const result = Array.from(productMap.values())
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5)

  return result
}

export async function getAppointmentsByStatus(period: PeriodType = "30d"): Promise<AppointmentsByStatus[]> {
  const { org } = await requirePermissionOrg("analytics.view")

  const { startDate, endDate } = getAnalyticsPeriod(period)

  const statusCounts = await prisma.appointment.groupBy({
    by: ["status"],
    where: {
      organizationId: org.id,
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: {
      status: true
    }
  })

  return statusCounts.map(item => ({
    status: item.status,
    count: item._count.status
  }))
}

export async function getStaffPerformance(period: PeriodType = "30d"): Promise<StaffPerformance[]> {
  const { org } = await requirePermissionOrg("analytics.view")

  const { startDate, endDate } = getAnalyticsPeriod(period)

  // Obtener appointments completados con info del staff
  const appointments = await prisma.appointment.findMany({
    where: {
      organizationId: org.id,
      status: "COMPLETED",
      depositPaid: true,
      createdAt: { gte: startDate, lte: endDate }
    },
    include: {
      staff: {
        select: { name: true }
      }
    }
  })

  // Agrupar por staff
  const staffMap = new Map<string, { name: string; appointments: number; revenue: number }>()

  appointments.forEach(apt => {
    const existing = staffMap.get(apt.staffId)
    const revenue = apt.depositAmount?.toNumber() ?? 0

    if (existing) {
      existing.appointments += 1
      existing.revenue += revenue
    } else {
      staffMap.set(apt.staffId, {
        name: apt.staff.name,
        appointments: 1,
        revenue: revenue
      })
    }
  })

  // Convertir a array y ordenar por appointments
  const result = Array.from(staffMap.values())
    .sort((a, b) => b.appointments - a.appointments)

  return result
}

// E4-2a — enquiries (form submissions) by workflow status for the
// selected period. Derived only: a groupBy over existing rows, no
// counters are written. Org-scoped via requirePermissionOrg.
export async function getEnquiriesByStatus(
  period: PeriodType = "30d"
): Promise<EnquiriesByStatus[]> {
  const { org } = await requirePermissionOrg("analytics.view")

  const { startDate, endDate } = getAnalyticsPeriod(period)

  const statusCounts = await prisma.formSubmission.groupBy({
    by: ["status"],
    where: {
      organizationId: org.id,
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: { _all: true }
  })

  const ORDER = ["NEW", "IN_REVIEW", "PROCESSED"]
  return statusCounts
    .map(row => ({ status: row.status, count: row._count._all }))
    .sort((a, b) => {
      const ia = ORDER.indexOf(a.status)
      const ib = ORDER.indexOf(b.status)
      // unknown statuses keep last, alphabetical
      if (ia === -1 && ib === -1) return a.status.localeCompare(b.status)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
}
