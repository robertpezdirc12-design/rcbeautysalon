"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { format } from "date-fns"

import { useI18n } from "@/lib/i18n/provider"
import {
  deleteWaitlistEntry,
  markWaitlistBooked,
  notifyWaitlistEntry,
} from "@/app/actions/waitlist"
import type { WaitlistStatus } from "@prisma/client"

// #90 — admin pogled čakalne liste. Pozitivno stanje opisuje podatki:
// vnos je "Čaka" dokler lastnik ne pošlje obvestila (NOTIFIED), gost
// pa si termin rezervira SAM (lastnik to potrdi z "Rezervirano").
export interface WaitlistEntryView {
  id: string
  name: string
  email: string
  phone: string | null
  status: WaitlistStatus
  notes: string | null
  notifiedAt: Date | null
  createdAt: Date
  preferredDate: Date | null
  service: { name: string; slug: string } | null
}

export function WaitlistClient({ entries }: { entries: WaitlistEntryView[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [filter, setFilter] = useState<"ALL" | WaitlistStatus>("WAITING")
  // Etikete iz slovarja (plain objekt — RSC-varno, brez funkcij).
  const labels = useI18n().t.appointments.waitlist

  const visible = useMemo(
    () => (filter === "ALL" ? entries : entries.filter((e) => e.status === filter)),
    [entries, filter]
  )

  const counts = useMemo(() => {
    const by = { ALL: entries.length } as Record<string, number>
    for (const e of entries) by[e.status] = (by[e.status] ?? 0) + 1
    return by
  }, [entries])

  function runAction(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const res = await fn()
      if (res.success) {
        toast.success(ok)
        router.refresh()
      } else {
        toast.error(res.error ?? ok)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Filtri stanj — z zgoraj navedenimi števci, kot piše na kartici */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["ALL", labels.filterAll],
            ["WAITING", labels.statusWaiting],
            ["NOTIFIED", labels.statusNotified],
            ["BOOKED", labels.statusBooked],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              filter === value
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "hover:border-primary/40"
            }`}
          >
            {label}
            <span className="text-muted-foreground ml-1.5 text-xs">{counts[value] ?? 0}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {labels.empty}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{entry.name}</p>
                    <StatusBadge status={entry.status} labels={labels} />
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {entry.email}
                    {entry.phone ? ` · ${entry.phone}` : ""}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {labels.colService}:{" "}
                    <span className="text-foreground">{entry.service?.name ?? "—"}</span> ·{" "}
                    {labels.colDate}:{" "}
                    <span className="text-foreground">
                      {entry.preferredDate
                        ? format(new Date(entry.preferredDate), "d. MM. yyyy")
                        : labels.preferredDateAny}
                    </span>{" "}
                    · {labels.colJoined}: {format(new Date(entry.createdAt), "d. MM. yyyy")}
                  </p>
                  {entry.notes && (
                    <p className="text-muted-foreground mt-1 text-sm italic">„{entry.notes}“</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {entry.status === "WAITING" && (
                    <Button
                      size="sm"
                      disabled={pending}
                      title={labels.notifyHint}
                      onClick={() =>
                        runAction(() => notifyWaitlistEntry(entry.id), labels.notifySuccess)
                      }
                    >
                      {labels.notify}
                    </Button>
                  )}
                  {entry.status !== "BOOKED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        runAction(() => markWaitlistBooked(entry.id), labels.notifySuccess)
                      }
                    >
                      {labels.booked}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(labels.deleteConfirm)) return
                      runAction(() => deleteWaitlistEntry(entry.id), labels.delete)
                    }}
                  >
                    {labels.delete}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({
  status,
  labels,
}: {
  status: WaitlistStatus
  labels: { statusWaiting: string; statusNotified: string; statusBooked: string; statusExpired: string }
}) {
  const map = {
    WAITING: labels.statusWaiting,
    NOTIFIED: labels.statusNotified,
    BOOKED: labels.statusBooked,
    EXPIRED: labels.statusExpired,
  } as const
  const style =
    status === "WAITING"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      : status === "NOTIFIED"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
        : status === "BOOKED"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {map[status]}
    </span>
  )
}
