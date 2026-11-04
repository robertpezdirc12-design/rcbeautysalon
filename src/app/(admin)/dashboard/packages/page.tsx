import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ToteIcon,
  SparkleIcon,
  UsersIcon,
} from "@/components/icons"
import { getPackagesOverview } from "@/app/actions/catalog"
import {
  getPrepaidLiability,
  listPrepaidPurchases,
} from "@/app/actions/prepaid"
import { prisma } from "@/lib/prisma"
import { getSessionOrg } from "@/lib/tenant"
import { getServerI18n } from "@/lib/i18n/server"
import { PackagesClient } from "@/components/admin/catalog/packages-client"
import { requirePagePermission } from "@/lib/auth/guards"
import { formatCurrency } from "@/lib/utils/format"

// ============================================================
// PACKAGES PAGE (EPIC #1 Phase 4b, §11 universal catalog)
// #80: ONE prepaid primitive — paketi seans + darilni boni;
// poleg kataloga sta vidna ODGOVORNOST (liability — vnaprej prejeti
// denar NI dobiček) in prodane instance s kodami.
// ============================================================

export default async function PackagesPage() {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("products.manage")
  const [{ t }, overview, liability, purchases, org] = await Promise.all([
    getServerI18n(),
    getPackagesOverview(),
    getPrepaidLiability(),
    listPrepaidPurchases(),
    getSessionOrg(),
  ])
  const p = t.catalogDocs.packages

  const customers = org
    ? await prisma.customer.findMany({
        where: { organizationId: org.id },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
        take: 200,
      })
    : []

  const active = overview.packages.filter((x) => x.isActive).length
  const activeListValue = overview.packages
    .filter((x) => x.isActive)
    .reduce((s, x) => s + x.listValue, 0)
  const stats = [
    { label: p.title, value: String(overview.packages.length), icon: ToteIcon, accent: "text-primary-text" },
    { label: p.active, value: String(active), icon: SparkleIcon, accent: "text-emerald-500" },
    { label: p.listValue, value: formatCurrency(activeListValue), icon: UsersIcon, accent: "text-amber-500" },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{p.title}</h1>
          <p className="text-muted-foreground">{p.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-lg bg-muted p-2 ${s.accent}`}>
                <s.icon size={18} />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none">{s.value}</div>
                <div className="text-muted-foreground mt-1 text-xs leading-tight">
                  {s.label}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* #80: ODGOVORNOST — ena kartica, ki jo lastnik MORA videti. */}
      <Card className="border-amber-200 dark:border-amber-900">
        <CardHeader>
          <CardTitle className="text-base">{p.liabilityTitle}</CardTitle>
          <CardDescription>{p.liabilityHint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(liability.giftCardBalance)}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {p.liabilityGiftCards} · {liability.giftCardCount}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold">{liability.packageSessions}</div>
            <div className="text-muted-foreground mt-1 text-xs">
              {p.liabilityPackages} · {liability.packageCount}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {formatCurrency(liability.estimatedSessionValue)}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {p.liabilityEstimated}
            </div>
          </div>
        </CardContent>
      </Card>

      <PackagesClient
        packages={overview.packages}
        catalog={overview.catalog}
        customers={customers}
        labels={p}
      />

      {/* #80: prodane instance — kode, stanje, ostanki. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{p.purchasesTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {p.purchasesEmpty}
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-sm">
                    <th className="pb-2 font-medium">{p.name}</th>
                    <th className="pb-2 font-medium">{p.kindLabel}</th>
                    <th className="pb-2 font-medium">Koda</th>
                    <th className="pb-2 font-medium">Kupec</th>
                    <th className="pb-2 text-right font-medium">{p.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((pu) => (
                    <tr key={pu.id} className="border-b last:border-0">
                      <td className="py-2 text-sm font-medium">{pu.productName}</td>
                      <td className="py-2 text-sm">
                        {pu.kind === "GIFT_CARD" ? p.badgeGiftCard : p.badgePackage}
                      </td>
                      <td className="py-2 font-mono text-xs">{pu.code}</td>
                      <td className="text-muted-foreground py-2 text-sm">
                        {pu.buyer ?? "—"}
                      </td>
                      <td className="py-2 text-right text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            pu.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : pu.status === "PENDING"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {p.purchaseStatus[
                            pu.status as keyof typeof p.purchaseStatus
                          ] ?? pu.status}
                        </span>
                        {pu.kind === "GIFT_CARD" && pu.balance !== null && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            {formatCurrency(pu.balance)}
                          </span>
                        )}
                        {pu.kind !== "GIFT_CARD" && pu.sessionsLeft !== null && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            {pu.sessionsLeft} seans
                          </span>
                        )}
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
