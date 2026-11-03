"use client"

import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ReceiptIcon, StorefrontIcon } from "@/components/icons"
import { useFormatPrice } from "@/lib/currency"

interface OrdersSummaryProps {
  stats: {
    totalOrders: number
    completedOrders: number
    pendingOrders: number
    totalSpent: number
  } | null
}

export function OrdersSummary({ stats }: OrdersSummaryProps) {
  const fmt = useFormatPrice()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ReceiptIcon size={20} className="text-primary-text" />
          <CardTitle className="text-lg">Naročila</CardTitle>
        </div>
        <CardDescription>Zgodovina vaših nakupov</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-primary-text text-2xl font-bold">
              {stats?.pendingOrders || 0}
            </p>
            <p className="text-muted-foreground text-xs">V obdelavi</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-2xl font-bold text-green-600">
              {stats?.completedOrders || 0}
            </p>
            <p className="text-muted-foreground text-xs">Zaključena</p>
          </div>
        </div>

        {/* Total Spent */}
        <div className="bg-muted/50 mt-4 rounded-lg p-3 text-center">
          <p className="text-muted-foreground text-xs">Skupaj porabljeno</p>
          <p className="text-primary-text text-xl font-bold">
            {fmt(stats?.totalSpent || 0)}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Link href="/my-orders">
            <Button variant="outline" className="w-full">
              Prikaži vsa naročila
            </Button>
          </Link>
          <Link href="/shop">
            <Button className="w-full">
              <StorefrontIcon size={16} className="mr-2" />
              Obišči trgovino
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
