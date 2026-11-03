"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BarList } from "@tremor/react"
import { TopService } from "@/lib/interfaces"
import { ScissorsIcon } from "@/components/icons"
import { useI18n } from "@/lib/i18n/provider"
import { useFormatPrice } from "@/lib/currency"

interface TopServicesChartProps {
  data: TopService[]
}

export function TopServicesChart({ data }: TopServicesChartProps) {
  const { t } = useI18n()
  const fmt = useFormatPrice()
  const chartData = data.map((service) => ({
    name: service.name,
    value: service.bookings,
  }))

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-rose-100 p-2.5 dark:bg-rose-900/30">
            <ScissorsIcon size={20} className="text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <CardTitle className="text-base">
              {t.analytics.topServices.title}{" "}
              <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
                {t.analytics.topServices.titleAccent}
              </span>
            </CardTitle>
            <CardDescription>{t.analytics.topServices.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {data.length > 0 ? (
          <div className="space-y-6">
            <div className="[&_p]:text-foreground">
              <BarList
                data={chartData}
                color="rose"
                showAnimation
              />
            </div>
            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.analytics.topServices.revenueLabel}</p>
              {data.map((service) => (
                <div key={service.name} className="flex items-center justify-between text-sm">
                  <span className="truncate text-muted-foreground pr-2">
                    {service.name}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {fmt(service.revenue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground text-sm">{t.analytics.topServices.noData}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
