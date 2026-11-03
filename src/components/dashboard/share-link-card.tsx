"use client"

// ============================================================
// SHARE LINK CARD — dashboard helper for the OWNER (settings.manage
// permission gate on the server). Shows the tenant's public URL
// with a one-click copy and the two proven free discovery channels
// from the competitor research (NaročiSe/MyPlanly growth playbook):
//   1. Instagram bio link  — #1 new-customer channel for salons
//   2. Google Business Profile — main free "near me" discovery surface
// Research grounding: 97 % of customers search online first, 76 %
// visit within 24 h — the link must be one click away.
// ============================================================

import { useState } from "react"
import { toast } from "sonner"
import { AtSign, Check, Copy, ExternalLink, Link2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DashboardDict } from "@/lib/i18n/dict/dashboard"

interface ShareLinkCardProps {
  publicUrl: string
  copy: DashboardDict["shareLink"]
}

export function ShareLinkCard({ publicUrl, copy }: ShareLinkCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      toast.success(copy.copied)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can be unavailable (http:// context, older browser) —
      // the input stays selectable so the owner can copy manually.
      toast.error(copy.copyFailed)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 size={18} className="text-primary-text" aria-hidden="true" />
          {copy.title}
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            readOnly
            value={publicUrl}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={copy.title}
            className="font-mono text-sm"
          />
          <Button
            type="button"
            onClick={handleCopy}
            className="shrink-0"
            aria-label={copy.copy}
          >
            {copied ? (
              <Check size={16} className="mr-2" aria-hidden="true" />
            ) : (
              <Copy size={16} className="mr-2" aria-hidden="true" />
            )}
            {copy.copy}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-muted/50 rounded-lg border p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <AtSign size={16} className="text-primary-text" aria-hidden="true" />
              {copy.instagramTitle}
            </h3>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {copy.instagramTip}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg border p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MapPin size={16} className="text-primary-text" aria-hidden="true" />
              {copy.googleTitle}
            </h3>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {copy.googleTip}
            </p>
            <a
              href="https://business.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-text hover:text-primary-text/80 mt-2 inline-flex items-center gap-1 text-sm font-medium transition-colors"
            >
              {copy.openGoogle}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
