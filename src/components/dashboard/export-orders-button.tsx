"use client"

import { Button } from "@/components/ui/button"
import { ShoppingBagIcon } from "@/components/icons"
import { useI18n } from "@/lib/i18n/provider"
import { formatCurrency, formatDateStandard } from "@/lib/utils/format"

interface Order {
  id: string
  status: string
  total: number
  createdAt: Date
  customer: {
    name: string | null
    email: string | null
  } | null
  guestName: string | null
  guestEmail: string | null
  _count: {
    items: number
  }
}

interface ExportOrdersButtonProps {
  orders: Order[]
}

export function ExportOrdersButton({ orders }: ExportOrdersButtonProps) {
  const { t } = useI18n()

  const handleExport = () => {
    const headers = [
      t.orders.csv.orderId,
      t.orders.csv.customer,
      t.orders.csv.email,
      t.orders.csv.items,
      t.orders.csv.total,
      t.orders.csv.status,
      t.orders.csv.date,
    ]

    const rows = orders.map((order) => [
      // P1 #9 (walkthrough): kratek prijazen ID namesto celotnega cuid
      `#${order.id.slice(-6)}`,
      order.customer?.name || order.guestName || t.orders.guest,
      order.customer?.email || order.guestEmail || "-",
      order._count.items.toString(),
      formatCurrency(order.total),
      order.status,
      // P1 #6: sl-SI datum namesto US privzetega
      formatDateStandard(new Date(order.createdAt)),
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    link.setAttribute("href", url)
    link.setAttribute("download", `orders-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Button variant="outline" onClick={handleExport}>
      <ShoppingBagIcon size={16} className="mr-2" />
      {t.orders.exportOrders}
    </Button>
  )
}
