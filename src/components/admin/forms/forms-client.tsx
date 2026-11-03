"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CheckCircleIcon } from "@/components/icons"
import {
  setSubmissionStatus,
  toggleFormDefinition,
  createWorkOrderFromSubmission,
  type AdminFormDefinition,
  type AdminFormSubmission,
} from "@/app/actions/forms"
import { FormEditorDialog, type FormEditorLabels } from "./form-editor-dialog"

// ============================================================
// FORMS ADMIN (client) — definition cards (activation toggle,
// field preview) + submissions inbox with status pipeline and
// optional conversion into work orders.
// ============================================================

interface FormsClientProps {
  definitions: AdminFormDefinition[]
  submissions: AdminFormSubmission[]
  canWorkOrders: boolean
  editorLabels: FormEditorLabels
  labels: {
    definitions: string
    active: string
    inactive: string
    submissions: string
    submissionsTitle: string
    emptySubmissions: string
    emptySubmissionsHint: string
    contact: string
    noContact: string
    viewData: string
    markInReview: string
    markProcessed: string
    markNew: string
    createWorkOrder: string
    createdWorkOrder: string
    statusLabels: Record<string, string>
    deactivateConfirm: string
  }
}

const statusBadge: Record<string, string> = {
  NEW: "bg-primary/10 text-primary-text",
  IN_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  PROCESSED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
}

function valueToText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "boolean") return v ? "✓" : "—"
  return String(v)
}

export function FormsClient({
  definitions,
  submissions,
  canWorkOrders,
  editorLabels,
  labels,
}: FormsClientProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  const onToggle = (def: AdminFormDefinition, next: boolean) => {
    if (!next && !window.confirm(labels.deactivateConfirm)) return
    setBusyId(def.id)
    startTransition(async () => {
      const result = await toggleFormDefinition(def.id, next)
      setBusyId(null)
      if (result.ok) router.refresh()
      else toast.error("Napaka pri shranjevanju.")
    })
  }

  const onStatus = (sub: AdminFormSubmission, status: "NEW" | "IN_REVIEW" | "PROCESSED") => {
    setBusyId(sub.id)
    startTransition(async () => {
      const result = await setSubmissionStatus(sub.id, status)
      setBusyId(null)
      if (result.ok) router.refresh()
      else toast.error("Napaka.")
    })
  }

  const onConvert = (sub: AdminFormSubmission) => {
    setBusyId(sub.id)
    startTransition(async () => {
      const result = await createWorkOrderFromSubmission(sub.id)
      setBusyId(null)
      if (result.ok && result.workOrderId) {
        toast.success(labels.createdWorkOrder)
        router.push(`/dashboard/work-orders/${result.workOrderId}`)
      } else {
        toast.error(result.error === "NO_WORKFLOW" ? "Aktiven proces ne obstaja." : "Napaka.")
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Definitions */}
      <section aria-label={labels.definitions} className="space-y-4">
        <h2 className="text-lg font-semibold">{labels.definitions}</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {definitions.map((def) => (
            <Card key={def.id} className={def.isActive ? "" : "opacity-70"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{def.name}</CardTitle>
                    {def.description && (
                      <CardDescription className="mt-1 line-clamp-2">
                        {def.description}
                      </CardDescription>
                    )}
                  </div>
                  <Switch
                    checked={def.isActive}
                    onCheckedChange={(v) => onToggle(def, v)}
                    disabled={pending && busyId === def.id}
                    aria-label={def.isActive ? labels.active : labels.inactive}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      def.isActive
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {def.isActive ? labels.active : labels.inactive}
                  </span>
                  <span className="text-muted-foreground">
                    {def.fields.length}{" "}
                    {def.fields.length === 1 ? "polje" : def.fields.length === 2 ? "polji" : "polja"}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {def.submissionCount} {labels.submissions.toLowerCase()}
                  </span>
                  <span className="text-muted-foreground">· v{def.version}</span>
                </div>
                <ul className="text-muted-foreground space-y-1 text-xs">
                  {def.fields.slice(0, 4).map((field) => (
                    <li key={field.key} className="flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${field.required ? "bg-primary" : "bg-border"}`}
                      />
                      {field.label}
                      <span className="ml-auto rounded bg-muted px-1 py-0.5 text-[10px] uppercase">
                        {field.type}
                      </span>
                    </li>
                  ))}
                  {def.fields.length > 4 && (
                    <li className="text-muted-foreground/70">
                      + {def.fields.length - 4} …
                    </li>
                  )}
                </ul>
                <div className="border-t pt-3">
                  <FormEditorDialog
                    definitionId={def.id}
                    definitionName={def.name}
                    initialName={def.name}
                    initialFields={def.fields}
                    labels={editorLabels}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Submissions */}
      <section aria-label={labels.submissionsTitle} className="space-y-4">
        <h2 className="text-lg font-semibold">{labels.submissionsTitle}</h2>
        <Card>
          <CardContent className="p-0">
            {submissions.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircleIcon size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">{labels.emptySubmissions}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {labels.emptySubmissionsHint}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Obrazec</TableHead>
                      <TableHead>{labels.contact}</TableHead>
                      <TableHead className="hidden md:table-cell">Podatki</TableHead>
                      <TableHead>Stanje</TableHead>
                      <TableHead className="text-right">Dejanja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <div className="font-medium">{sub.formName}</div>
                          <div className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(sub.createdAt), {
                              addSuffix: true,
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {sub.contact.name || sub.contact.email || sub.contact.phone ? (
                            <div className="text-sm">
                              {sub.contact.name && <div className="font-medium">{sub.contact.name}</div>}
                              {sub.contact.email && (
                                <a
                                  href={`mailto:${sub.contact.email}`}
                                  className="text-primary-text hover:underline"
                                >
                                  {sub.contact.email}
                                </a>
                              )}
                              {sub.contact.phone && (
                                <div className="text-muted-foreground text-xs">{sub.contact.phone}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">{labels.noContact}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden max-w-64 md:table-cell">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                {labels.viewData}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
                              <DialogHeader>
                                <DialogTitle>
                                  {sub.formName}
                                  {sub.customerName ? ` · ${sub.customerName}` : ""}
                                </DialogTitle>
                              </DialogHeader>
                              <dl className="space-y-3 text-sm">
                                {Object.entries(sub.data).map(([k, v]) => (
                                  <div
                                    key={k}
                                    className="border-border/60 flex justify-between gap-4 border-b pb-2 last:border-0"
                                  >
                                    <dt className="text-muted-foreground">{k}</dt>
                                    <dd className="text-right font-medium">
                                      {valueToText(v)}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[sub.status] ?? ""}`}
                          >
                            {labels.statusLabels[sub.status] ?? sub.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {sub.status === "NEW" && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={pending && busyId === sub.id}
                                onClick={() => onStatus(sub, "IN_REVIEW")}
                              >
                                {labels.markInReview}
                              </Button>
                            )}
                            {sub.status !== "PROCESSED" && canWorkOrders && (
                              <Button
                                size="sm"
                                disabled={pending && busyId === sub.id}
                                onClick={() => onConvert(sub)}
                              >
                                {labels.createWorkOrder}
                              </Button>
                            )}
                            {sub.status !== "PROCESSED" && !canWorkOrders && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={pending && busyId === sub.id}
                                onClick={() => onStatus(sub, "PROCESSED")}
                              >
                                {labels.markProcessed}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
