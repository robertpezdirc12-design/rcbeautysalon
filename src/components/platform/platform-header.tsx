"use client"

// Platform console header — deliberately separate from the tenant
// admin chrome (distinct surface per EPIC #3 E3-5).

import { signOut } from "next-auth/react"
import { LogOut, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PlatformLabels } from "@/lib/platform/labels"

interface PlatformHeaderProps {
  labels: PlatformLabels
  operatorEmail: string
}

export function PlatformHeader({ labels, operatorEmail }: PlatformHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary-text" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {labels.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {labels.operator}: {operatorEmail}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="shrink-0"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          {labels.signOut}
        </Button>
      </div>
    </header>
  )
}
