import { Card, CardContent } from "@/components/ui/card"
import {
  FileTextIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  WarningCircleIcon,
} from "@/components/icons"
import { getDocumentsOverview } from "@/app/actions/documents"
import { getServerI18n } from "@/lib/i18n/server"
import { DocumentsClient } from "@/components/admin/catalog/documents-client"
import { requirePagePermission } from "@/lib/auth/guards"
import { formatCurrency } from "@/lib/utils/format"

// ============================================================
// DOCUMENTS PAGE (EPIC #1 Phase 4b, §13 documents capability)
// Quotes (predračuni) + invoices (računi) with per-tenant
// numbering. Rendered only for documents-capable profiles.
// ============================================================

export default async function DocumentsPage() {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("finances.view")
  const [{ t }, overview] = await Promise.all([
    getServerI18n(),
    getDocumentsOverview(),
  ])
  const d = t.catalogDocs.documents

  const stats = [
    { label: d.stats.quotesSent, value: String(overview.stats.quotesSent), icon: FileTextIcon, accent: "text-primary-text" },
    { label: d.stats.quotesAccepted, value: String(overview.stats.quotesAccepted), icon: CheckCircleIcon, accent: "text-emerald-500" },
    { label: d.stats.invoicesIssued, value: String(overview.stats.invoicesIssued), icon: ClockIcon, accent: "text-amber-500" },
    { label: d.stats.unpaidTotal, value: formatCurrency(overview.stats.unpaidTotal), icon: CurrencyDollarIcon, accent: "text-violet-500" },
    { label: d.stats.overdue, value: String(overview.stats.overdueCount), icon: WarningCircleIcon, accent: "text-red-500" },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{d.title}</h1>
          <p className="text-muted-foreground">{d.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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

      <DocumentsClient
        quotes={overview.quotes}
        invoices={overview.invoices}
        openWorkOrders={overview.openWorkOrders}
        labels={d}
      />
    </div>
  )
}
