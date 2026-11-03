"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  CurrencyDollarIcon,
  CalendarCheckIcon,
  ShoppingBagIcon,
  UsersIcon,
  TrendingUpIcon,
  EnvelopeIcon,
} from "@/components/icons"
import { KPIData } from "@/lib/interfaces"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/provider"
import { useFormatPrice } from "@/lib/currency"
import { enquiryChangeDisplay } from "@/lib/analytics/trends"

interface KPICardsProps {
  data: KPIData
}

export function KPICards({ data }: KPICardsProps) {
  const { t } = useI18n()
  const fmt = useFormatPrice()
  const enquiryDisplay = enquiryChangeDisplay(data.enquiriesChange, data.totalEnquiries)
  const cards: {
    title: string
    metric: string
    change: number | null
    noData?: boolean
    icon: typeof CurrencyDollarIcon
    color: string
    bgColor: string
  }[] = [
    {
      title: t.analytics.kpi.totalRevenue,
      metric: fmt(data.totalRevenue),
      change: data.revenueChange,
      icon: CurrencyDollarIcon,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      title: t.analytics.kpi.appointments,
      metric: data.totalAppointments.toLocaleString(),
      change: data.appointmentsChange,
      icon: CalendarCheckIcon,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: t.analytics.kpi.productOrders,
      metric: data.totalOrders.toLocaleString(),
      change: data.ordersChange,
      icon: ShoppingBagIcon,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      title: t.analytics.kpi.customers,
      metric: data.totalCustomers.toLocaleString(),
      change: data.customersChange,
      icon: UsersIcon,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      title: t.analytics.kpi.enquiries,
      metric: data.totalEnquiries.toLocaleString(),
      change: data.enquiriesChange,
      noData: enquiryDisplay.kind === "no-data",
      icon: EnvelopeIcon,
      color: "text-teal-600 dark:text-teal-400",
      bgColor: "bg-teal-100 dark:bg-teal-900/30",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title} className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={cn("rounded-lg p-2", card.bgColor)}>
              <card.icon size={20} className={card.color} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{card.metric}</div>
            <ChangeBadge change={card.change} noData={card.noData} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ChangeBadge({
  change,
  noData = false,
}: {
  change: number | null
  noData?: boolean
}) {
  const { t } = useI18n()

  // P1 #5 (walkthrough): ni prejšnjega obdobja → pošteno "Ni prejšnjih podatkov",
  // ne izmišljen +100 % / -100 %.
  if (noData || change === null) {
    return (
      <div className="mt-2 text-sm text-muted-foreground">
        {noData && change !== null ? t.analytics.kpi.noEnquiryData : t.analytics.kpi.noPreviousData}
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-1 text-sm">
      <TrendingUpIcon
        size={14}
        className={cn(
          change > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : change < 0
              ? "text-red-600 dark:text-red-400 rotate-180"
              : "text-muted-foreground"
        )}
      />
      <span
        className={cn(
          "font-medium",
          change > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : change < 0
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground"
        )}
      >
        {change > 0 ? "+" : ""}
        {change.toFixed(1)}%
      </span>
      <span className="text-muted-foreground">{t.analytics.kpi.vsLastPeriod}</span>
    </div>
  )
}
