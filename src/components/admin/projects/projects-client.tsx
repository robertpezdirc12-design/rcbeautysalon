"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusIcon } from "@/components/icons"
import {
  createProject,
  type ProjectListItem,
  type ProjectLinkOptions,
  type ProjectErrorCode,
} from "@/app/actions/projects"
import { useI18n } from "@/lib/i18n/provider"

// ============================================================
// PROJECTS TABLE + CREATE DIALOG (client, E2-3).
// Active projects first (server order), deadline warnings and
// derived progress. Creation returns the detail page; tasks are
// managed there. All mutations are server actions — the client
// only renders state and maps error codes to bilingual text.
// ============================================================

export interface ProjectsClientLabels {
  newProject: string
  colProject: string
  colCustomer: string
  colDeadline: string
  colProgress: string
  colStatus: string
  colTasks: string
  noProjects: string
  noProjectsFiltered: string
  filterAll: string
  noDeadline: string
  overdueBadge: string
  dueSoonBadge: string
  statusLabels: Record<string, string>
  // Create dialog
  nameLabel: string
  namePlaceholder: string
  startDate: string
  deadlineLabel: string
  budgetLabel: string
  budgetPlaceholder: string
  customerLabel: string
  customerPlaceholder: string
  workOrderLabel: string
  workOrderPlaceholder: string
  notesLabel: string
  notesPlaceholder: string
  optionalSection: string
  submitProject: string
  cancelEdit: string
  workOrderShort: string
}

interface StatItem {
  key: string
  label: string
  value: number
}

interface ProjectsClientProps {
  projects: ProjectListItem[]
  stats: StatItem[]
  linkOptions: ProjectLinkOptions
  labels: ProjectsClientLabels
}

const statusColors: Record<string, string> = {
  PLANNING: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  IN_PROGRESS: "bg-primary/10 text-primary-text",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  CANCELLED: "bg-muted text-muted-foreground line-through",
}

const FILTERS = ["ALL", "PLANNING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "sl-SI", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function ProjectsClient({ projects, stats, linkOptions, labels }: ProjectsClientProps) {
  const router = useRouter()
  const { locale } = useI18n()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL")
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    deadline: "",
    budget: "",
    customerId: "",
    workOrderId: "",
    notes: "",
  })

  const visible = useMemo(
    () => (filter === "ALL" ? projects : projects.filter((p) => p.status === filter)),
    [projects, filter]
  )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(labels.nameLabel)
      return
    }
    startTransition(async () => {
      const result = await createProject({
        name: form.name,
        startDate: form.startDate || null,
        deadline: form.deadline || null,
        budget: form.budget ? Number(form.budget) : null,
        customerId: form.customerId || null,
        workOrderId: form.workOrderId || null,
        notes: form.notes || null,
      })
      if (result.ok) {
        toast.success(labels.submitProject)
        setOpen(false)
        setForm({ name: "", startDate: "", deadline: "", budget: "", customerId: "", workOrderId: "", notes: "" })
        if (result.id) router.push(`/dashboard/projects/${result.id}`)
        else router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const errorText = (code?: ProjectErrorCode) => {
    const map: Record<string, string> = {
      VALIDATION: labels.nameLabel,
      LINK_MISMATCH: labels.customerPlaceholder,
    }
    return (code && map[code]) || "Dejanje ni uspelo. Poskusite znova."
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Select value={filter} onValueChange={(v) => setFilter(v as (typeof FILTERS)[number])}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{labels.filterAll}</SelectItem>
            {FILTERS.slice(1).map((f) => (
              <SelectItem key={f} value={f}>
                {labels.statusLabels[f] ?? f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <PlusIcon size={16} className="mr-1" />
              {labels.newProject}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{labels.newProject}</DialogTitle>
              <DialogDescription>{labels.optionalSection}</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">{labels.nameLabel}</Label>
                <Input
                  id="project-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={labels.namePlaceholder}
                  maxLength={120}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="project-start">{labels.startDate}</Label>
                  <Input
                    id="project-start"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-deadline">{labels.deadlineLabel}</Label>
                  <Input
                    id="project-deadline"
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="project-budget">{labels.budgetLabel}</Label>
                  <Input
                    id="project-budget"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    placeholder={labels.budgetPlaceholder}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-customer">{labels.customerLabel}</Label>
                  <Select
                    value={form.customerId || "none"}
                    onValueChange={(v) => setForm({ ...form, customerId: v === "none" ? "" : v })}
                  >
                    <SelectTrigger id="project-customer">
                      <SelectValue placeholder={labels.customerPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {linkOptions.customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-workorder">{labels.workOrderLabel}</Label>
                <Select
                  value={form.workOrderId || "none"}
                  onValueChange={(v) => setForm({ ...form, workOrderId: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="project-workorder">
                    <SelectValue placeholder={labels.workOrderPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {linkOptions.workOrders.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {labels.workOrderShort} #{w.number} — {w.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-notes">{labels.notesLabel}</Label>
                <Textarea
                  id="project-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder={labels.notesPlaceholder}
                  rows={3}
                  maxLength={2000}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  {labels.cancelEdit}
                </Button>
                <Button type="submit" disabled={pending}>
                  {labels.submitProject}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <div className="text-muted-foreground px-6 py-12 text-center text-sm">
              {projects.length === 0 ? labels.noProjects : labels.noProjectsFiltered}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{labels.colProject}</TableHead>
                    <TableHead className="hidden md:table-cell">{labels.colCustomer}</TableHead>
                    <TableHead className="hidden sm:table-cell">{labels.colDeadline}</TableHead>
                    <TableHead>{labels.colProgress}</TableHead>
                    <TableHead className="hidden lg:table-cell">{labels.colTasks}</TableHead>
                    <TableHead>{labels.colStatus}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((p) => (
                    <TableRow key={p.id} className="hover:bg-accent/50">
                      <TableCell>
                        <Link
                          href={`/dashboard/projects/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                        {p.customerName ?? "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">
                            {p.deadline ? formatDate(p.deadline, locale) : labels.noDeadline}
                          </span>
                          {p.deadlineState === "OVERDUE" && (
                            <Badge variant="destructive" className="w-fit text-xs">
                              {labels.overdueBadge}
                            </Badge>
                          )}
                          {p.deadlineState === "DUE_SOON" && (
                            <Badge className="w-fit bg-amber-100 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              {labels.dueSoonBadge}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-24 items-center gap-2">
                          <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                            <div
                              className="bg-primary h-full rounded-full transition-all"
                              style={{ width: `${p.progress.pct}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground w-9 text-xs tabular-nums">
                            {p.progress.pct}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-sm tabular-nums lg:table-cell">
                        {p.progress.done}/{p.progress.total}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[p.status] ?? "bg-muted"} w-fit border-transparent text-xs`}>
                          {labels.statusLabels[p.status] ?? p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
