"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BarChart } from "@tremor/react"
import { StaffPerformance } from "@/lib/interfaces"
import { useI18n } from "@/lib/i18n/provider"
import { useFormatPrice } from "@/lib/currency"
import { UserCogIcon } from "@/components/icons"

interface StaffPerformanceChartProps {
  data: StaffPerformance[]
}

export function StaffPerformanceChart({ data }: StaffPerformanceChartProps) {
  const { t } = useI18n()
  const fmt = useFormatPrice()
  const chartData = data.map((staff) => ({
    name: staff.name,
    Appointments: staff.appointments,
    Revenue: staff.revenue,
  }))

  const totalAppointments = data.reduce((sum, s) => sum + s.appointments, 0)
  const totalRevenue = data.reduce((sum, s) => sum + s.revenue, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2.5 dark:bg-purple-900/30">
              <UserCogIcon size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t.analytics.staffPerformance.title}{" "}
                <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
                  {t.analytics.staffPerformance.titleAccent}
                </span>
              </CardTitle>
              <CardDescription>{t.analytics.staffPerformance.description}</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-rose-500" />
              <span className="text-muted-foreground">
                {t.analytics.staffPerformance.totalAppointments(totalAppointments)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">
                {t.analytics.staffPerformance.totalRevenue}:{" "}
                <span className="font-semibold text-foreground">{fmt(totalRevenue)}</span>
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="[&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50">
            <BarChart
              className="h-72"
              data={chartData}
              index="name"
              categories={[t.analytics.staffPerformance.categories[0], t.analytics.staffPerformance.categories[1]]}
              colors={["rose", "amber"]}
              yAxisWidth={60}
              showAnimation
              showGridLines
              valueFormatter={(value: number) => value.toLocaleString()}
            />
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">{t.analytics.staffPerformance.noData}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
