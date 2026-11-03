import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import {
  ClockIcon,
  CheckCircleIcon,
  ReceiptIcon,
  WarningCircleIcon,
  TrendingUpIcon,
} from "@/components/icons"
import { getWorkOrdersOverview } from "@/app/actions/work-orders"
import { getServerI18n } from "@/lib/i18n/server"
import { WorkOrdersClient } from "@/components/admin/work-orders/work-orders-client"
import { ProcessEditorDialog } from "@/components/admin/work-orders/process-editor-dialog"
import { requirePagePermission } from "@/lib/auth/guards"

// ============================================================
// WORK ORDERS PAGE (EPIC #1 §9/§10 — Phase 4)
// Rendered only for work-order-capable profiles (nav gate).
// Stats row is widget-driven (profile.dashboardWidgets), the
// table lists all orders with their current workflow stage.
// ============================================================

export default async function WorkOrdersPage() {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("workorders.manage")
  const [{ t, locale }, overview] = await Promise.all([
    getServerI18n(),
    getWorkOrdersOverview(),
  ])
  const w = t.workForms.workOrders

  const stats = [
    { key: "active", label: w.stats.active, value: overview.stats.active, icon: ReceiptIcon, accent: "text-primary-text" },
    { key: "dueSoon", label: w.stats.dueSoon, value: overview.stats.dueSoon, icon: ClockIcon, accent: "text-amber-500" },
    { key: "pendingApprovals", label: w.stats.pendingApprovals, value: overview.stats.pendingApprovals, icon: WarningCircleIcon, accent: "text-violet-500" },
    { key: "readyForDelivery", label: w.stats.readyForDelivery, value: overview.stats.readyForDelivery, icon: CheckCircleIcon, accent: "text-emerald-500" },
    { key: "completedThisMonth", label: w.stats.completedThisMonth, value: overview.stats.completedThisMonth, icon: TrendingUpIcon, accent: "text-muted-foreground" },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{w.title}</h1>
          <p className="text-muted-foreground">{w.subtitle}</p>
        </div>
        {/* Owner workflow customization (EPIC #1 §9 — Phase 5) */}
        {overview.definitions.length > 0 && (
          <ProcessEditorDialog
            definitionId={overview.definitions[0].id ?? ""}
            stages={overview.definitions[0].stages}
            labels={w.process}
          />
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.key}>
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

      <WorkOrdersClient
        orders={overview.orders}
        definitions={overview.definitions}
        labels={{
          newOrder: w.newOrder,
          empty: w.empty,
          emptyHint: w.emptyHint,
          number: w.number,
          titleField: w.titleField,
          customer: w.customer,
          stage: w.stage,
          dueDate: w.dueDate,
          priority: w.priority,
          status: w.status,
          created: w.created,
          noCustomer: w.noCustomer,
          noDueDate: w.noDueDate,
          statusLabels: w.statusLabels,
          priorityLabels: w.priorityLabels,
          viewDetails: t.common.actions.viewDetails,
        }}
        createLabels={{
          title: w.create.title,
          description: w.create.description,
          titleLabel: w.create.titleLabel,
          titlePlaceholder: w.create.titlePlaceholder,
          customerLabel: w.create.customerLabel,
          dueDateLabel: w.create.dueDateLabel,
          priorityLabel: w.create.priorityLabel,
          notesLabel: w.create.notesLabel,
          submit: w.create.submit,
          cancel: t.common.actions.cancel,
          created: w.create.created,
        }}
        locale={locale}
      />

      {/* Definitions summary */}
      {overview.definitions.length > 0 && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <span>
            {t.workForms.workOrders.detail.workflow}:
          </span>
          {overview.definitions.map((d) => (
            <span
              key={d.id}
              className="bg-muted rounded-md px-2 py-0.5 text-xs font-medium"
            >
              {d.name} · {d.stages.length} stopenj
            </span>
          ))}
          <Link
            href="/dashboard/forms"
            className="text-primary-text hover:underline"
          >
            {t.workForms.forms.title}
          </Link>
        </div>
      )}
    </div>
  )
}
