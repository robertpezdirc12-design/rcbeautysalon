"use client"

// #96 v2: povezava do sprejemnega obrazca v admin detajlu termina.
// Za stare termine (brez žetona) ga ustvari on-demand (ensureIntakeLink);
// URL je relativna javna pot /intake/[token] — kopiraj pošlje gostu.

import { useState, useTransition } from "react"

import { ensureIntakeLink } from "@/app/actions/appointments"
import { Button } from "@/components/ui/button"

export function AppointmentIntakeLink({
  appointmentId,
  initialToken,
}: {
  appointmentId: string
  initialToken: string | null
}) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // F2b: window.location.origin is client-only. Show the relative path (safe
  // to server-render) and build the absolute URL only inside the copy handler.
  const url = token ? `/intake/${token}` : null

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const result = await ensureIntakeLink(appointmentId)
      if (result.success) {
        setToken(result.token)
      } else {
        setError(result.error)
      }
    })
  }

  async function handleCopy() {
    if (!url) return
    const absolute = `${window.location.origin}${url}`
    try {
      await navigator.clipboard.writeText(absolute)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Kopiranje ni uspelo — povezavo označite in kopirajte ročno.")
    }
  }

  return (
    <div className="space-y-2">
      {url ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="bg-muted flex-1 overflow-x-auto rounded px-2 py-1 text-xs">
            {url}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {copied ? "Kopirano!" : "Kopiraj povezavo"}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCreate}
          disabled={pending}
        >
          {pending ? "Ustvarjanje …" : "Ustvari povezavo do obrazca"}
        </Button>
      )}
      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
