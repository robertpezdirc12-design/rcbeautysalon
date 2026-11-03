import { Card, CardContent } from "@/components/ui/card"
import {
  ToteIcon,
  SparkleIcon,
  UsersIcon,
} from "@/components/icons"
import { getPackagesOverview } from "@/app/actions/catalog"
import { getServerI18n } from "@/lib/i18n/server"
import { PackagesClient } from "@/components/admin/catalog/packages-client"
import { requirePagePermission } from "@/lib/auth/guards"
import { formatCurrency } from "@/lib/utils/format"

// ============================================================
// PACKAGES PAGE (EPIC #1 Phase 4b, §11 universal catalog)
// Sellable bundles of services and/or products at a package
// price. Rendered when the profile enables shop OR services.
// ============================================================

export default async function PackagesPage() {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("products.manage")
  const [{ t }, overview] = await Promise.all([
    getServerI18n(),
    getPackagesOverview(),
  ])
  const p = t.catalogDocs.packages

  const active = overview.packages.filter((x) => x.isActive).length
  const activeListValue = overview.packages
    .filter((x) => x.isActive)
    .reduce((s, x) => s + x.listValue, 0)
  const stats = [
    { label: p.title, value: String(overview.packages.length), icon: ToteIcon, accent: "text-primary" },
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

      <PackagesClient
        packages={overview.packages}
        catalog={overview.catalog}
        labels={p}
      />
    </div>
  )
}
