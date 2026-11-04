import Link from "next/link"
import { ArrowLeftIcon } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getOrderById } from "@/app/actions/orders"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"
import { formatCurrency } from "@/lib/utils/format"
import { notFound } from "next/navigation"

// P2 #71 — branje enega naročila. IDOR varovalka živi v akciji:
// getOrderById išče findFirst({ where: { id, organizationId: org.id } })
// (NIČ findUnique({ id })) — naročilo tujega najemnika vrne null, stran
// pa rendra nadzorno not-found (nikoli javno lupino).

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePagePermission("orders.manage")
  const { id } = await params
  const [{ t }, order] = await Promise.all([getServerI18n(), getOrderById(id)])

  if (!order) notFound()

  // P2 #70: kontakt, ki pripada TO naročilu — gostova polja imajo
  // prednost; povezana stranka se pokaže kot namig, kadar obstaja.
  const contactName = order.guestName || order.customer?.name || t.orders.guest
  const contactEmail = order.guestEmail || order.customer?.email || "-"
  const contactPhone = order.guestPhone || order.customer?.phone || "-"
  const hasBothIdentities = !!(
    order.guestName &&
    order.customer &&
    (order.customer.name !== order.guestName ||
      (order.customer.email ?? "") !== (order.guestEmail ?? ""))
  )

  const orderNumber = order.id.slice(-8).toUpperCase()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard/orders"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeftIcon size={14} />
            {t.orders.detail.backToList}
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {t.orders.title} <span className="font-mono">#{orderNumber}</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {t.orders.statusLabels[order.status] ?? order.status}
          </Badge>
          {order.paymentMethod === "offline" ? (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {t.orders.offlineBadge}
            </Badge>
          ) : (
            <Badge variant="secondary">{t.orders.detail.onlineBadge}</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{t.orders.detail.contactTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">{t.orders.table.customer}</p>
              <p className="font-medium">{contactName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">{t.orders.csv.email}</p>
              {contactEmail !== "-" ? (
                <a
                  href={`mailto:${contactEmail}`}
                  className="hover:text-primary font-medium underline-offset-2 hover:underline"
                >
                  {contactEmail}
                </a>
              ) : (
                <p className="font-medium">-</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-xs">{t.orders.detail.phone}</p>
              {contactPhone !== "-" ? (
                <a
                  href={`tel:${contactPhone.replace(/\s+/g, "")}`}
                  className="hover:text-primary font-medium underline-offset-2 hover:underline"
                >
                  {contactPhone}
                </a>
              ) : (
                <p className="font-medium">-</p>
              )}
            </div>
            {hasBothIdentities && order.customer?.name && (
              <div className="bg-muted rounded-md p-3">
                <p className="text-xs font-medium">{t.orders.detail.matchedCustomer}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {order.customer.name}
                  {order.customer.email ? ` · ${order.customer.email}` : ""}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t.orders.detail.matchedCustomerHint}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items + totals */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t.orders.detail.itemsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t.orders.detail.product}</th>
                    <th className="pb-2 font-medium">{t.orders.detail.quantity}</th>
                    <th className="pb-2 font-medium">{t.orders.detail.unitPrice}</th>
                    <th className="pb-2 text-right font-medium">{t.orders.detail.lineTotal}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">
                        {item.product?.name ?? "—"}
                      </td>
                      <td className="py-3">{item.quantity}</td>
                      <td className="py-3">{formatCurrency(item.price)}</td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(item.price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-1.5 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.orders.detail.subtotal}</span>
                <span className="font-medium">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.orders.detail.taxIncluded}</span>
                <span>{formatCurrency(order.tax)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>{t.orders.detail.total}</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes (delivery address for offline orders) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.orders.detail.notesTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground whitespace-pre-line text-sm">
            {order.notes?.trim() || t.orders.detail.noNotes}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
