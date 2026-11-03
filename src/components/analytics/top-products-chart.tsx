"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BarList } from "@tremor/react"
import { TopProduct } from "@/lib/interfaces"
import { PackageIcon } from "@/components/icons"
import { useI18n } from "@/lib/i18n/provider"
import { useFormatPrice } from "@/lib/currency"

interface TopProductsChartProps {
  data: TopProduct[]
}

export function TopProductsChart({ data }: TopProductsChartProps) {
  const { t } = useI18n()
  const fmt = useFormatPrice()
  const chartData = data.map((product) => ({
    name: product.name,
    value: product.sales,
  }))

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-100 p-2.5 dark:bg-amber-900/30">
            <PackageIcon size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <CardTitle className="text-base">
              {t.analytics.topProducts.title}{" "}
              <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
                {t.analytics.topProducts.titleAccent}
              </span>
            </CardTitle>
            <CardDescription>{t.analytics.topProducts.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {data.length > 0 ? (
          <div className="space-y-6">
            <div className="[&_p]:text-foreground">
              <BarList
                data={chartData}
                color="amber"
                showAnimation
              />
            </div>
            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue</p>
              {data.map((product) => (
                <div key={product.name} className="flex items-center justify-between text-sm">
                  <span className="truncate text-muted-foreground pr-2">
                    {product.name}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {fmt(product.revenue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground text-sm">{t.analytics.topProducts.noData}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
