"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AreaChart } from "@tremor/react"
import { RevenueDataPoint } from "@/lib/interfaces"
import { useI18n } from "@/lib/i18n/provider"
import { useFormatPrice } from "@/lib/currency"

interface RevenueChartProps {
  data: RevenueDataPoint[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  const { t } = useI18n()
  const fmt = useFormatPrice()
  const totalAppointments = data.reduce((sum, d) => sum + d.appointments, 0)
  const totalProducts = data.reduce((sum, d) => sum + d.products, 0)
  // #80: prodaje vnaprej (darilni boni + paketi) — ločena vrstica.
  const totalPrepaid = data.reduce((sum, d) => sum + (d.prepaid ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>
              {t.analytics.revenue.title}{" "}
              <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
                {t.analytics.revenue.titleAccent}
              </span>
            </CardTitle>
            <CardDescription>
              {t.analytics.revenue.description}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-rose-500" />
              <span className="text-muted-foreground">
                {t.analytics.revenue.legendAppointments}: <span className="font-semibold text-foreground">{fmt(totalAppointments)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">
                {t.analytics.revenue.legendProducts}: <span className="font-semibold text-foreground">{fmt(totalProducts)}</span>
              </span>
            </div>
            {/* #80: prodaje vnaprej — LOČENA vrstica prihodka. */}
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">
                {t.analytics.revenue.legendPrepaid}: <span className="font-semibold text-foreground">{fmt(totalPrepaid)}</span>
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="[&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50">
            <AreaChart
              className="h-72"
              data={data}
              index="date"
              categories={["appointments", "products", "prepaid"]}
              colors={["rose", "amber", "emerald"]}
              valueFormatter={(value) => fmt(value)}
              showLegend={false}
              showAnimation
              curveType="monotone"
              showGridLines={true}
              showXAxis={true}
              showYAxis={true}
            />
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">{t.analytics.revenue.noData}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
