import type { Metadata } from "next"
import { StaffStatsCards } from "@/components/staff/staff-stats-cards"
import { StaffTodayAppointments } from "@/components/staff/staff-today-appointments"
import { StaffQuickActions } from "@/components/staff/staff-quick-actions"
import { StaffProfileCard } from "@/components/staff/staff-profile-card"
import {
  getStaffPortalStats,
  getStaffTodaysAppointments,
  getStaffProfile,
} from "@/app/actions/staff"
import { getSessionOrg } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = {
  title: "Portal za osebje | Poslovna platforma",
  description: "Upravljajte svoje termine in urnik",
}

export default async function StaffDashboardPage() {
  const [stats, appointments, staffProfile, org] = await Promise.all([
    getStaffPortalStats(),
    getStaffTodaysAppointments(),
    getStaffProfile(),
    getSessionOrg(),
  ])

  const profile = staffProfile.success ? staffProfile.staff ?? null : null

  // #104: valuta najemnika za strežniško formatiranje cene (brez client hooka).
  const currency =
    (org &&
      (
        await prisma.salonConfig.findUnique({
          where: { organizationId: org.id },
          select: { currency: true },
        })
      )?.currency) ??
    "EUR"

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dobrodošli nazaj!</h1>
        <p className="text-muted-foreground mt-1">
          Tu je vaš današnji pregled
        </p>
      </div>

      {/* Stats Cards */}
      <StaffStatsCards
        currency={currency}
        stats={
          stats?.stats || {
            todaysAppointments: 0,
            completedThisMonthAppointments: 0,
            monthlyEarnings: 0,
            monthlyAppointments: 0,
           
          }
        }
      />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's Appointments - Takes 2 columns */}
        <div className="lg:col-span-2">
          <StaffTodayAppointments
            appointments={appointments?.appointments || []}
          />
        </div>

        {/* Sidebar - Profile & Quick Actions */}
        <div className="space-y-6">
          {/* Profile Card */}
          <StaffProfileCard profile={profile} />

          {/* Quick Actions */}
          <StaffQuickActions />
        </div>
      </div>
    </div>
  )
}
