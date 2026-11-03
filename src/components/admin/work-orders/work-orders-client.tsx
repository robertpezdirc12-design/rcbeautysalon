"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlusIcon } from "@/components/icons"
import {
  createWorkOrder,
  listWorkOrderCustomers,
  type WorkOrderListItem,
  type WorkflowDefinitionInfo,
} from "@/app/actions/work-orders"
import { listExtensionRecordOptions } from "@/app/actions/records"
import { useI18n } from "@/lib/i18n/provider"
import { formatCurrency } from "@/lib/utils/format"

// ============================================================
// WORK ORDERS TABLE + CREATE DIALOG (client)
// Stage badges use the workflow stage name; ordering keeps OPEN
// first. Creation starts an order in the workflow's first stage.
// ============================================================

interface Labels {
  newOrder: string
  empty: string
  emptyHint: string
  number: string
  titleField: string
  customer: string
  stage: string
  dueDate: string
  priority: string
  status: string
  created: string
  noCustomer: string
  noDueDate: string
  statusLabels: Record<string, string>
  priorityLabels: Record<string, string>
  viewDetails: string
}

interface CreateLabels {
  title: string
  description: string
  titleLabel: string
  titlePlaceholder: string
  customerLabel: string
  dueDateLabel: string
  priorityLabel: string
  notesLabel: string
  submit: string
  cancel: string
  created: string
}

interface WorkOrdersClientProps {
  orders: WorkOrderListItem[]
  definitions: WorkflowDefinitionInfo[]
  labels: Labels
  createLabels: CreateLabels
  locale: string
}

const priorityColors: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  NORMAL: "bg-secondary text-secondary-foreground",
  HIGH: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  URGENT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

const statusColors: Record<string, string> = {
  OPEN: "bg-primary/10 text-primary-text",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  CANCELLED: "bg-muted text-muted-foreground line-through",
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "sl-SI", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function WorkOrdersClient({
  orders,
  definitions,
  labels,
  createLabels,
  locale,
}: WorkOrdersClientProps) {
  const router = useRouter()
  const { profile } = useI18n()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [customers, setCustomers] = useState<
    { id: string; name: string; email: string | null }[]
  >([])
  const [recordOptions, setRecordOptions] = useState<
    { id: string; entityName: string; title: string; customerName: string | null }[]
  >([])
  const [form, setForm] = useState({
    title: "",
    customerId: "",
    dueDate: "",
    priority: "NORMAL",
    notes: "",
    linkedRecordId: "",
  })

  // Extension registries (vehicles, …) can be linked to a work order (§13).
  const hasExtensions = profile.extensions.length > 0
  const linkedRecordLabel =
    locale === "sl" ? "Povezan zapis iz evidenc" : "Linked registry record"

  const openDialog = async () => {
    setOpen(true)
    if (customers.length === 0) {
      try {
        setCustomers(await listWorkOrderCustomers())
      } catch {
        // non-fatal: the order can be created without a customer
      }
    }
    if (hasExtensions && recordOptions.length === 0) {
      try {
        setRecordOptions(await listExtensionRecordOptions())
      } catch {
        // non-fatal: the order can be created without a linked record
      }
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error(labels.titleField)
      return
    }
    startTransition(async () => {
      const result = await createWorkOrder({
        title: form.title,
        customerId: form.customerId || null,
        dueDate: form.dueDate || null,
        priority: form.priority,
        notes: form.notes || null,
        linkedRecordId: form.linkedRecordId || null,
      })
      if (result.ok) {
        toast.success(createLabels.created)
        setOpen(false)
        setForm({ title: "", customerId: "", dueDate: "", priority: "NORMAL", notes: "", linkedRecordId: "" })
        router.push(`/dashboard/work-orders/${result.id}`)
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const errorText = (code?: string) => {
    const map: Record<string, string> = {
      MISSING_TITLE: createLabels.titleLabel,
      NO_WORKFLOW: "Aktiven proces ne obstaja.",
    }
    return (code && map[code]) || "Dejanje ni uspelo. Poskusite znova."
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{labels.titleField}s</CardTitle>
          <CardDescription>
            {definitions[0]?.name} · {orders.length}
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openDialog}>
              <PlusIcon size={16} className="mr-2" />
              {labels.newOrder}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={submit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{createLabels.title}</DialogTitle>
                <DialogDescription>{createLabels.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5">
                <Label htmlFor="wo-title">{createLabels.titleLabel} *</Label>
                <Input
                  id="wo-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={createLabels.titlePlaceholder}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="wo-customer">{createLabels.customerLabel}</Label>
                  <Select
                    value={form.customerId || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, customerId: v === "none" ? "" : v }))
                    }
                  >
                    <SelectTrigger id="wo-customer">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wo-due">{createLabels.dueDateLabel}</Label>
                  <Input
                    id="wo-due"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wo-priority">{createLabels.priorityLabel}</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                >
                  <SelectTrigger id="wo-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(labels.priorityLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wo-notes">{createLabels.notesLabel}</Label>
                <Textarea
                  id="wo-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Optional link to an extension registry record (vehicle, …) */}
              {hasExtensions && (
                <div className="space-y-1.5">
                  <Label htmlFor="wo-record">{linkedRecordLabel}</Label>
                  <Select
                    value={form.linkedRecordId || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, linkedRecordId: v === "none" ? "" : v }))
                    }
                  >
                    <SelectTrigger id="wo-record">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {recordOptions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.entityName}: {r.title}
                          {r.customerName ? ` — ${r.customerName}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  {createLabels.cancel}
                </Button>
                <Button type="submit" disabled={pending}>
                  {createLabels.submit}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-medium">{labels.empty}</p>
            <p className="text-muted-foreground mt-1 text-sm">{labels.emptyHint}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                  <th className="px-2 py-3">{labels.number}</th>
                  <th className="px-2 py-3">{labels.titleField}</th>
                  <th className="hidden px-2 py-3 md:table-cell">{labels.customer}</th>
                  <th className="px-2 py-3">{labels.stage}</th>
                  <th className="hidden px-2 py-3 sm:table-cell">{labels.dueDate}</th>
                  <th className="hidden px-2 py-3 lg:table-cell">{labels.priority}</th>
                  <th className="px-2 py-3">{labels.status}</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-muted/50 border-b transition-colors last:border-0"
                  >
                    <td className="px-2 py-3 font-mono text-xs">
                      #{String(o.number).padStart(3, "0")}
                    </td>
                    <td className="max-w-56 px-2 py-3">
                      <Link
                        href={`/dashboard/work-orders/${o.id}`}
                        className="hover:text-primary-text font-medium hover:underline"
                      >
                        {o.title}
                      </Link>
                      {o.linkedRecord && (
                        <div className="text-muted-foreground text-xs">
                          {o.linkedRecord.title}
                        </div>
                      )}
                      {o.total !== null && (
                        <div className="text-muted-foreground text-xs">
                          {formatCurrency(o.total)}
                        </div>
                      )}
                    </td>
                    <td className="hidden px-2 py-3 md:table-cell">
                      {o.customerName ?? <span className="text-muted-foreground">{labels.noCustomer}</span>}
                    </td>
                    <td className="px-2 py-3">
                      {o.status === "OPEN" && o.currentStageName ? (
                        <span className="bg-primary/10 text-primary-text rounded-full px-2.5 py-0.5 text-xs font-medium">
                          {o.currentStageName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="hidden px-2 py-3 text-xs sm:table-cell">
                      {o.dueDate ? (
                        formatDate(o.dueDate, locale)
                      ) : (
                        <span className="text-muted-foreground">{labels.noDueDate}</span>
                      )}
                    </td>
                    <td className="hidden px-2 py-3 lg:table-cell">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[o.priority] ?? priorityColors.NORMAL}`}
                      >
                        {labels.priorityLabels[o.priority] ?? o.priority}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[o.status] ?? ""}`}
                      >
                        {labels.statusLabels[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <Link href={`/dashboard/work-orders/${o.id}`}>
                        <Button variant="ghost" size="sm">
                          {labels.viewDetails}
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
  )
}

export function workOrderErrorText(code?: string): string {
  return code ?? "GENERIC"
}
