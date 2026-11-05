"use client"

// #98: živa vrsta — WAITING po položaju, SERVING aktiven, dejanja
// (pokliči naslednjega / zaključi / odšel) + samodejna osvežitev 15 s.

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  callNextWalkIn,
  getWalkInQueue,
  transitionWalkIn,
} from "@/app/actions/walk-in"

interface WaitingEntry {
  id: string
  name: string
  ticketCode: string
  position: number
  service?: string | null
  createdAt: string
}
interface ServingEntry {
  id: string
  name: string
  ticketCode: string
  service?: string | null
}

export function WalkInClient() {
  const [pending, startTransition] = useTransition()
  const [waiting, setWaiting] = useState<WaitingEntry[]>([])
  const [serving, setServing] = useState<ServingEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  function refresh() {
    startTransition(async () => {
      const res = await getWalkInQueue()
      if (res.success) {
        setWaiting(res.waiting ?? [])
        setServing(res.serving ?? [])
      }
      setLoaded(true)
    })
  }

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 15_000) // živa vrsta — 15 s srček
    return () => clearInterval(timer)
  }, [])

  function act(fn: () => Promise<{ success: boolean; error?: string; name?: string }>) {
    startTransition(async () => {
      const res = await fn()
      if (res.success) {
        if (res.name) toast.success(`Poklican: ${res.name}`)
      } else {
        toast.error(res.error ?? "Dejanje ni uspelo.")
      }
      refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => act(callNextWalkIn)} disabled={pending || (loaded && waiting.length === 0)}>
          Pokliči naslednjega
        </Button>
        <Button variant="outline" onClick={refresh} disabled={pending}>
          {pending ? "Osvežujem …" : "Osveži"}
        </Button>
      </div>

      {serving.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Na potezi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {serving.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {s.name}{" "}
                    <span className="text-muted-foreground font-mono text-xs">
                      #{s.ticketCode}
                    </span>
                  </p>
                  {s.service && (
                    <p className="text-muted-foreground text-sm">{s.service}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => act(() => transitionWalkIn(s.id, "SERVED"))}
                  >
                    Zaključeno
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => act(() => transitionWalkIn(s.id, "LEFT"))}
                  >
                    Odšel
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            V vrsti <Badge variant="secondary">{waiting.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loaded && waiting.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Vrsta je prazna. Prijave gostov pridejo sem samodejno.
            </p>
          )}
          {waiting.map((w) => (
            <div
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="bg-primary/10 text-primary-text flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  aria-label={`Položaj ${w.position}`}
                >
                  {w.position}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {w.name}{" "}
                    <span className="text-muted-foreground font-mono text-xs">
                      #{w.ticketCode}
                    </span>
                  </p>
                  {w.service && (
                    <p className="text-muted-foreground text-sm">{w.service}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => act(() => transitionWalkIn(w.id, "SERVING"))}
                >
                  Pokliči zdaj
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => act(() => transitionWalkIn(w.id, "LEFT"))}
                >
                  Odšel
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
