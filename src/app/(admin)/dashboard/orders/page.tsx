import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EyeIcon } from "@/components/icons"
import { getAdminOrders, getOrderStats } from "@/app/actions/orders"
import { getServerI18n } from "@/lib/i18n/server"
import { OrderSearch } from "@/components/dashboard/order-search"
import { ExportOrdersButton } from "@/components/dashboard/export-orders-button"
import { requirePagePermission } from "@/lib/auth/guards"
import { formatCurrency } from "@/lib/utils/format"

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  PAID: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  REFUNDED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
}

interface OrdersPageProps {
  searchParams: Promise<{ search?: string }>
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("orders.manage")
  const { search } = await searchParams
  const [{ t }, orders, stats] = await Promise.all([
    getServerI18n(),
    getAdminOrders(search),
    getOrderStats(),
  ])
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t.orders.title}{" "}
            <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
              {t.orders.titleAccent}
            </span>
          </h1>
          <p className="text-muted-foreground">
            {t.orders.subtitle}
          </p>
        </div>
        <ExportOrdersButton orders={orders} />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.orders.stats.totalOrders}</CardDescription>
            <CardTitle className="text-3xl">{stats.totalOrders}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.orders.stats.pendingPickup}</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.orders.stats.completedToday}</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.completedToday}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.orders.stats.revenueThisMonth}</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(stats.revenueThisMonth)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <OrderSearch />

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t.orders.allOrders}</CardTitle>
          <CardDescription>{t.orders.inStorePickupDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t.orders.noOrders}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">{t.orders.table.orderId}</th>
                    <th className="pb-3 font-medium">{t.orders.table.customer}</th>
                    <th className="pb-3 font-medium">{t.orders.table.items}</th>
                    <th className="pb-3 font-medium">{t.orders.table.total}</th>
                    <th className="pb-3 font-medium">{t.orders.table.status}</th>
                    <th className="pb-3 font-medium">{t.orders.table.date}</th>
                    <th className="pb-3 font-medium">{t.orders.table.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="py-4">
                        <p className="font-mono font-medium text-sm">{order.id.slice(0, 8)}...</p>
                      </td>
                      <td className="py-4">
                        <div>
                          <p className="font-medium">
                            {order.customer?.name || order.guestName || t.orders.guest}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {order.customer?.email || order.guestEmail || "-"}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 text-sm">{t.orders.itemsCount(order._count.items)}</td>
                      <td className="py-4 font-medium">{formatCurrency(order.total)}</td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusColors[order.status]}`}>
                          {t.orders.statusLabels[order.status] ?? order.status}
                        </span>
                        {/* P1 #65: brez Stripe narejena naročila — lastnik vidi,
                            da gre za plačilo ob prevzemu (demand je zabeležen). */}
                        {(order as { paymentMethod?: string }).paymentMethod === "offline" && (
                          <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 ml-1.5 inline-flex rounded-full px-2 py-1 text-xs font-medium">
                            {t.orders.offlineBadge}
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-sm">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4">
                        <Link href={`/dashboard/orders/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            <EyeIcon size={16} className="mr-1" />
                            {t.common.actions.view}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
