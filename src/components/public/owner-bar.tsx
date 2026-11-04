"use client"

// ============================================================
// P2 #67 — OWNER BAR: the missing return path of the two-role model.
// A thin bar above the tenant navbar, rendered ONLY for the owner of
// THIS organisation (server-side conditional render — it never reaches
// the HTML of customers, other tenants' owners or anonymous visitors).
// Shows the publish state (#58's stale-content signal now lives exactly
// where it matters) and links back into the dashboard.
// Dismiss is session-scoped (sessionStorage) so the owner can inspect
// the exact customer view without losing the affordance forever.
// ============================================================

import { useEffect, useState } from "react"
import Link from "next/link"
import { PencilRuler, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const DISMISS_KEY = "owner-bar-dismissed-slug"

interface OwnerBarProps {
  slug: string
  /** Working content is newer than the published snapshot (E3-2). */
  hasUnpublished: boolean
  publishedAt: Date | string | null
}

export function OwnerBar({ slug, hasUnpublished, publishedAt }: OwnerBarProps) {
  // null = session storage not yet consulted (bar visible — only the owner
  // ever receives this component in the HTML at all).
  const [dismissed, setDismissed] = useState(false)

  // Read the session-scoped dismissal once after mount. The microtask keeps
  // the setState OUT of the synchronous effect body (no cascading render).
  useEffect(() => {
    let alive = true
    Promise.resolve().then(() => {
      if (!alive) return
      try {
        setDismissed(sessionStorage.getItem(DISMISS_KEY) === slug)
      } catch {
        setDismissed(false)
      }
    })
    return () => {
      alive = false
    }
  }, [slug])

  if (dismissed) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, slug)
    } catch {
      // private mode — dismissal is best-effort, bar stays visible
    }
    setDismissed(true)
  }

  const publishedLabel = publishedAt
    ? new Date(publishedAt).toLocaleDateString("sl-SI", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null

  return (
    <div
      role="region"
      aria-label="Lastniška orodna vrstica"
      className="bg-foreground text-background relative z-40 w-full"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <PencilRuler className="size-4" aria-hidden="true" />
          Urejate svojo stran
          {hasUnpublished ? (
            <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-xs font-semibold text-amber-950">
              Osnutek je novejši od objavljenega
            </span>
          ) : publishedLabel ? (
            <span className="text-background/70 text-xs">
              Objavljeno {publishedLabel}
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="text-background hover:bg-background/10 hover:text-background min-h-9"
          >
            <Link href="/dashboard/settings">
              <PencilRuler className="mr-1 size-4" aria-hidden="true" />
              Uredi vsebino
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="text-background hover:bg-background/10 hover:text-background min-h-9"
          >
            <Link href="/dashboard">Nadzorna plošča</Link>
          </Button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Skrij lastniško vrstico (za to sejo)"
            className="hover:bg-background/10 rounded p-1 transition-colors"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
