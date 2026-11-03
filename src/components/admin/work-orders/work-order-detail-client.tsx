"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  advanceWorkOrder,
  cancelWorkOrder,
  addWorkOrderNote,
  type WorkOrderDetail,
} from "@/app/actions/work-orders"

// ============================================================
// WORK ORDER DETAIL (client) — stage stepper with VALIDATED
// transitions (server allows adjacent stages only), cancel,
// internal notes and the append-only audit timeline.
// ============================================================

interface Labels {
  stage: string
  status: string
  priority: string
  customer: string
  dueDate: string
  notes: string
  created: string
  noCustomer: string
  statusLabels: Record<string, string>
  priorityLabels: Record<string, string>
  workflow: string
  history: string
  advance: string
  back: string
  cancel: string
  addNote: string
  notePlaceholder: string
  noteAdded: string
  noHistory: string
  stageOfTemplate: string
  finalStage: string
}

interface WorkOrderDetailClientProps {
  order: WorkOrderDetail
  labels: Labels
  errorLabels: Record<string, string>
  locale: string
}

export function WorkOrderDetailClient({
  order,
  labels,
  errorLabels,
  locale,
}: WorkOrderDetailClientProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState("")
  const recordsLinkLabel = locale === "sl" ? "Odpri evidence" : "Open records"

  const stages = order.workflow?.stages ?? []
  const currentStage = stages.find((s) => s.key === order.currentStageKey)
  const currentIndex = currentStage ? currentStage.order : -1
  const isOpen = order.status === "OPEN"
  const nextStage = isOpen && currentIndex >= 0 ? stages[currentIndex + 1] : undefined
  const prevStage = isOpen && currentIndex > 0 ? stages[currentIndex - 1] : undefined

  const errorText = (code?: string) =>
    (code && errorLabels[code]) || errorLabels.GENERIC

  const move = (toStageKey: string) => {
    startTransition(async () => {
      const result = await advanceWorkOrder(order.id, toStageKey)
      if (result.ok) {
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const cancel = () => {
    startTransition(async () => {
      const result = await cancelWorkOrder(order.id)
      if (result.ok) {
        toast.success(labels.statusLabels.CANCELLED)
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const submitNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return
    startTransition(async () => {
      const result = await addWorkOrderNote(order.id, note)
      if (result.ok) {
        toast.success(labels.noteAdded)
        setNote("")
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "sl-SI", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main column */}
      <div className="space-y-6 lg:col-span-2">
        {/* Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="text-muted-foreground text-xs font-mono">
                  #{String(order.number).padStart(3, "0")}
                </div>
                <h1 className="mt-1 text-xl font-bold sm:text-2xl">{order.title}</h1>
                <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>
                    {labels.status}:{" "}
                    <span className="text-foreground font-medium">
                      {labels.statusLabels[order.status] ?? order.status}
                    </span>
                  </span>
                  <span>
                    {labels.priority}:{" "}
                    <span className="text-foreground font-medium">
                      {labels.priorityLabels[order.priority] ?? order.priority}
                    </span>
                  </span>
                  <span>
                    {labels.dueDate}:{" "}
                    <span className="text-foreground font-medium">{fmtDate(order.dueDate)}</span>
                  </span>
                  {order.sourceSubmissionId && (
                    <span className="text-primary-text">⎘ {labels.created} (obrazec)</span>
                  )}
                </div>
              </div>
              {isOpen && (
                <Button variant="outline" size="sm" onClick={cancel} disabled={pending}>
                  {labels.cancel}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stage stepper */}
        {stages.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {labels.workflow}: {order.workflow?.name}
                </CardTitle>
                {currentIndex >= 0 && (
                  <span className="text-muted-foreground text-xs">
                    {labels.stageOfTemplate
                      .replace("{current}", String(currentIndex + 1))
                      .replace("{total}", String(stages.length))}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-y-3">
                {stages.map((stage, i) => {
                  const done = currentIndex > stage.order || order.status === "COMPLETED"
                  const isCurrent = stage.key === order.currentStageKey && isOpen
                  return (
                    <div key={stage.key} className="flex items-center">
                      {i > 0 && (
                        <div
                          className={cn(
                            "h-0.5 w-4 sm:w-8",
                            done || isCurrent ? "bg-primary" : "bg-border"
                          )}
                        />
                      )}
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors",
                            done && "border-primary bg-primary text-primary-foreground",
                            isCurrent &&
                              "border-primary text-primary-text bg-primary/10 ring-primary/20 ring-4",
                            !done && !isCurrent && "border-border bg-background text-muted-foreground"
                          )}
                        >
                          {done ? "✓" : i + 1}
                        </div>
                        <span
                          className={cn(
                            "max-w-20 truncate text-center text-[11px] leading-tight",
                            isCurrent ? "text-primary-text font-semibold" : "text-muted-foreground"
                          )}
                          title={stage.name}
                        >
                          {stage.name}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {currentStage?.description && isOpen && (
                <p className="text-muted-foreground text-sm">{currentStage.description}</p>
              )}

              {/* Validated transitions */}
              {isOpen && (
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  {prevStage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => move(prevStage.key)}
                      disabled={pending}
                    >
                      ← {labels.back} ({prevStage.name})
                    </Button>
                  )}
                  {nextStage && (
                    <Button
                      size="sm"
                      onClick={() => move(nextStage.key)}
                      disabled={pending}
                    >
                      {nextStage.isFinal ? labels.advance + " — " + labels.statusLabels.COMPLETED : labels.advance} →{" "}
                      {nextStage.name}
                    </Button>
                  )}
                  {!nextStage && currentStage?.isFinal === false && (
                    <span className="text-muted-foreground text-sm">{labels.finalStage}</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes + timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.history}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={submitNote} className="flex gap-2">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={labels.notePlaceholder}
                rows={2}
                className="min-h-0 flex-1"
              />
              <Button type="submit" size="sm" disabled={pending || !note.trim()}>
                {labels.addNote}
              </Button>
            </form>

            {order.events.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                {labels.noHistory}
              </p>
            ) : (
              <ol className="space-y-3">
                {[...order.events].reverse().map((ev) => (
                  <li key={ev.id} className="border-border/60 flex gap-3 border-l pl-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">
                          {ev.type === "STAGE_CHANGED" && (ev.message ?? labels.stage)}
                          {ev.type === "CREATED" && (ev.message ?? labels.created)}
                          {ev.type === "NOTE" && (ev.message ?? "")}
                          {ev.type === "STATUS_CHANGED" && (ev.message ?? "")}
                        </span>
                        {ev.fromStageKey && ev.toStageKey && (
                          <span className="text-muted-foreground text-xs">
                            {stages.find((s) => s.key === ev.fromStageKey)?.name ?? ev.fromStageKey}
                            {" → "}
                            {stages.find((s) => s.key === ev.toStageKey)?.name ?? ev.toStageKey}
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        {formatDistanceToNow(new Date(ev.createdAt), {
                          addSuffix: true,
                        })}
                        {ev.actorEmail ? ` · ${ev.actorEmail}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Side column */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.customer}</CardTitle>
          </CardHeader>
          <CardContent>
            {order.customer ? (
              <div className="space-y-1 text-sm">
                <div className="font-medium">{order.customer.name}</div>
                {order.customer.email && (
                  <a
                    href={`mailto:${order.customer.email}`}
                    className="text-primary-text hover:underline"
                  >
                    {order.customer.email}
                  </a>
                )}
                {order.customer.phone && (
                  <a
                    href={`tel:${order.customer.phone.replace(/\s+/g, "")}`}
                    className="text-muted-foreground block hover:underline"
                  >
                    {order.customer.phone}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{labels.noCustomer}</p>
            )}
          </CardContent>
        </Card>

        {/* Linked extension record (e.g. the vehicle being serviced) — §13 */}
        {order.linkedRecord && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {order.linkedRecord.entityName}: {order.linkedRecord.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-1.5 text-sm">
                {Object.entries(order.linkedRecord.data)
                  .filter(([k, v]) => {
                    const f = order.linkedRecord?.fields.find((x) => x.key === k)
                    return v !== null && v !== undefined && v !== "" && f
                  })
                  .slice(0, 12)
                  .map(([k, v]) => {
                    const f = order.linkedRecord?.fields.find((x) => x.key === k)
                    return (
                      <div key={k} className="flex justify-between gap-3">
                        <dt className="text-muted-foreground text-xs">
                          {f?.label ?? k}
                          {f?.unit ? ` (${f.unit})` : ""}
                        </dt>
                        <dd className="font-medium">{String(v)}</dd>
                      </div>
                    )
                  })}
              </dl>
              <Link
                href="/dashboard/records"
                className="text-primary-text mt-3 inline-block text-xs hover:underline"
              >
                {recordsLinkLabel}
              </Link>
            </CardContent>
          </Card>
        )}

        {order.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{labels.notes}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">
                {order.notes}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
