"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { updateMarketingCampaign } from "@/app/actions/marketing"
import type { CampaignKind, CampaignTarget } from "@/lib/marketing/campaigns"
import { interpolate } from "@/lib/marketing/campaigns"

// #95 — urejevalnik avtomatskih kampanj. Stikalo + prag + besedilo z
// vstavitvami; živi predogled zapolnjenih vstavitev pod telesom.
export interface MarketingCampaignView {
  kind: CampaignKind
  enabled: boolean
  thresholdDays: number
  subject: string
  body: string
  lastRunAt: string | null
  sentCount: number
}

const KIND_LABELS: Record<CampaignKind, { title: string; desc: string }> = {
  REACTIVATION: {
    title: "Reaktivacija",
    desc: "Strankam, katerih zadnji zaključeni obisk je točno N dni nazaj in nimajo prihodnjega termina.",
  },
  NO_SHOW: {
    title: "Sledenje po ne-prihodu",
    desc: "Dan po zamujenem terminu stranka vljudno povabi k novi rezervaciji.",
  },
}

export function MarketingClient({
  campaigns,
  bookingLink,
}: {
  campaigns: MarketingCampaignView[]
  bookingLink: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [drafts, setDrafts] = useState(campaigns)

  function update(kind: CampaignKind, patch: Partial<MarketingCampaignView>) {
    setDrafts((prev) => prev.map((c) => (c.kind === kind ? { ...c, ...patch } : c)))
  }

  function save(c: MarketingCampaignView) {
    startTransition(async () => {
      const res = await updateMarketingCampaign(c.kind, {
        enabled: c.enabled,
        thresholdDays: c.thresholdDays,
        subject: c.subject,
        body: c.body,
      })
      if (res.success) {
        toast.success("Kampanja shranjena.")
        router.refresh()
      } else {
        toast.error(res.error ?? "Shranjevanje ni uspelo.")
      }
    })
  }

  return (
    <div className="space-y-6">
      {drafts.map((c) => {
        const labels = KIND_LABELS[c.kind]
        const sampleVars: CampaignTarget["vars"] = {
          name: "Ana Novak",
          business: "vaše podjetje",
          days: c.thresholdDays,
          date: "včeraj",
          bookingLink,
        }
        return (
          <Card key={c.kind}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{labels.title}</CardTitle>
                  <CardDescription className="mt-1">{labels.desc}</CardDescription>
                </div>
                <Switch
                  checked={c.enabled}
                  onCheckedChange={(v) => update(c.kind, { enabled: v })}
                  disabled={pending}
                  aria-label={`Omogoči kampanjo ${labels.title}`}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {c.kind === "REACTIVATION" && (
                <div className="space-y-2">
                  <Label htmlFor={`threshold-${c.kind}`} className="text-xs">
                    Dnevi od zadnjega obiska
                  </Label>
                  <Input
                    id={`threshold-${c.kind}`}
                    type="number"
                    min={7}
                    max={365}
                    value={c.thresholdDays}
                    onChange={(e) => update(c.kind, { thresholdDays: Number(e.target.value) })}
                    className="w-32"
                    disabled={pending}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor={`subject-${c.kind}`} className="text-xs">
                  Zadeva
                </Label>
                <Input
                  id={`subject-${c.kind}`}
                  value={c.subject}
                  onChange={(e) => update(c.kind, { subject: e.target.value })}
                  maxLength={120}
                  disabled={pending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`body-${c.kind}`} className="text-xs">
                  Besedilo — vstavitve: {"{name} {business} {days} {date} {bookingLink}"}
                </Label>
                <textarea
                  id={`body-${c.kind}`}
                  value={c.body}
                  onChange={(e) => update(c.kind, { body: e.target.value })}
                  rows={6}
                  maxLength={2000}
                  disabled={pending}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-muted-foreground rounded-md bg-muted/50 p-3 text-xs">
                  <span className="font-medium">Predogled zapolnjenih vstavljanj:</span>
                  <br />
                  <span className="italic">
                    {interpolate(c.subject, sampleVars)}
                  </span>
                  <br />
                  {interpolate(c.body, sampleVars).slice(0, 220)}
                  {interpolate(c.body, sampleVars).length > 220 ? " …" : ""}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-xs">
                  Poslanih: <span className="text-foreground font-medium">{c.sentCount}</span>
                  {c.lastRunAt
                    ? ` · zadnji tek: ${new Date(c.lastRunAt).toLocaleDateString("sl-SI")}`
                    : " · še ni tekov"}
                </p>
                <Button onClick={() => save(c)} disabled={pending}>
                  {pending ? "Shranjujem …" : "Shrani kampanjo"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
