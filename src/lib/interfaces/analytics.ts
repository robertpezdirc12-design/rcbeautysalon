// Analytics interfaces - These define the data shape for your queries

export interface KPIData {
  totalRevenue: number
  totalAppointments: number
  totalOrders: number
  totalCustomers: number
  // Form submissions (enquiries/quote requests) — E4-2a
  totalEnquiries: number
  // Comparisons with previous period (percentage change).
  // null = ni prejšnjega obdobja z podatki (P1 #5) — UI pokaže
  // "Ni prejšnjih podatkov" namesto izmišljenega +100 %.
  revenueChange: number | null
  appointmentsChange: number | null
  ordersChange: number | null
  customersChange: number | null
  enquiriesChange: number | null
}

export interface RevenueDataPoint {
  date: string // Format: "Jan 1", "Jan 2", etc.
  appointments: number // Revenue from appointments
  products: number // Revenue from product sales
}

export interface TopService {
  name: string
  bookings: number
  revenue: number
}

export interface TopProduct {
  name: string
  sales: number
  revenue: number
}

export interface AppointmentsByStatus {
  status: string
  count: number
}

/** Form submissions by workflow status (E4-2a: NEW | IN_REVIEW | PROCESSED). */
export interface EnquiriesByStatus {
  status: string
  count: number
}

export interface StaffPerformance {
  name: string
  appointments: number
  revenue: number
  // #79: payroll — tips collected and the FROZEN commission sum for the period.
  // Separate lines, never merged into service revenue.
  tips: number
  commission: number
}

export interface RevenueByCategory {
  category: string
  revenue: number
}

export interface AnalyticsPeriod {
  startDate: Date
  endDate: Date
  previousStartDate: Date
  previousEndDate: Date
}

// Helper to get date ranges
export type PeriodType = "7d" | "30d" | "90d" | "12m"
