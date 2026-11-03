import { useFormatPrice } from "@/lib/currency"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CalendarCheckIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
} from "@/components/icons"

interface StaffStatsCardsProps {
  stats: {
    todaysAppointments: number
    monthlyAppointments: number
    monthlyEarnings: number
    completedThisMonthAppointments: number
  }
}

export function StaffStatsCards({ stats }: StaffStatsCardsProps) {
  const fmt = useFormatPrice()
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Today's Appointments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Današnji termini
          </CardTitle>
          <CalendarCheckIcon size={20} className="text-primary-text" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.todaysAppointments}</div>
          <p className="text-muted-foreground text-xs">Razporejeno za danes</p>
        </CardContent>
      </Card>

      {/* This Month */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Ta mesec
          </CardTitle>
          <ClockIcon size={20} className="text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.monthlyAppointments}</div>
          <p className="text-muted-foreground text-xs">Skupno število terminov</p>
        </CardContent>
      </Card>

      {/* Monthly Earnings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Mesečni zaslužek
          </CardTitle>
          <CurrencyDollarIcon size={20} className="text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {fmt(stats.monthlyEarnings)}
          </div>
          <p className="text-muted-foreground text-xs">
            Na podlagi zaključenih storitev
          </p>
        </CardContent>
      </Card>

      {/* Completed This Month */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Zaključeni
          </CardTitle>
          <CheckCircleIcon size={20} className="text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {stats.completedThisMonthAppointments}
          </div>
          <p className="text-muted-foreground text-xs">Ta mesec</p>
        </CardContent>
      </Card>
    </div>
  )
}
