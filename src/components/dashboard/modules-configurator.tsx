"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/provider"
import {
  ALL_DASHBOARD_WIDGETS,
  DASHBOARD_WIDGET_LABELS,
} from "@/lib/profiles/overrides"
import {
  getOrgProfileOverview,
  resetOrgOverrides,
  updateOrgOverrides,
  type OrgProfileOverview,
} from "@/app/actions/profile"

// ============================================================
// MODULES CONFIGURATOR (EPIC #1 §5/§12 — Phase 5, owner customization)
// Central place where the business owner adapts the platform to
// their business WITHOUT programming:
//   • modules on/off — only OPTIONAL capabilities may be toggled
//     (required ones are protected, disabled ones stay off);
//   • dashboard widgets — which widgets the home screen shows.
// Changes are stored as versioned org-level overrides and never
// mutate the shared profile. The nav, dashboard and public site
// react immediately.
// ============================================================

const CAPABILITY_LABELS: Record<string, { sl: string; en: string }> = {
  appointments: { sl: "Termini in rezervacije", en: "Appointments & bookings" },
  workOrders: { sl: "Delovna naročila", en: "Work orders" },
  shop: { sl: "Spletna trgovina", en: "Online shop" },
  services: { sl: "Katalog storitev", en: "Service catalog" },
  inventory: { sl: "Zaloge", en: "Inventory" },
  customers: { sl: "Stranke", en: "Customers" },
  staff: { sl: "Zaposleni", en: "Staff" },
  analytics: { sl: "Analitika", en: "Analytics" },
  reviews: { sl: "Ocene", en: "Reviews" },
  forms: { sl: "Dinamični obrazci", en: "Dynamic forms" },
  workflows: { sl: "Poslovni procesi", en: "Workflows" },
  documents: { sl: "Dokumenti (ponudbe, računi)", en: "Documents (quotes, invoices)" },
  delivery: { sl: "Dostava", en: "Delivery" },
  walkIn: { sl: "Walk-in vrsta (brez računa)", en: "Walk-in queue (no account)" },
}

export function ModulesConfigurator() {
  const { locale, t } = useI18n()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [data, setData] = useState<OrgProfileOverview | { error: string } | null>(null)
  const [loading, setLoading] = useState(true)

  // Draft state — applied on "save".
  const [capDraft, setCapDraft] = useState<Record<string, boolean>>({})
  const [widgetDraft, setWidgetDraft] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    getOrgProfileOverview()
      .then((res) => {
        if (cancelled) return
        setData(res)
        if (!("error" in res)) {
          const draft: Record<string, boolean> = {}
          for (const key of res.adjustableCapabilities) {
            const cap = res.capabilities.find((c) => c.key === key)
            draft[key] = cap ? cap.state !== "disabled" : true
          }
          setCapDraft(draft)
          setWidgetDraft(res.dashboardWidgets)
        }
      })
      .catch(() => {
        if (!cancelled) setData({ error: "Napaka pri nalaganju." })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const capLabel = (key: string) =>
    locale === "en" ? CAPABILITY_LABELS[key]?.en ?? key : CAPABILITY_LABELS[key]?.sl ?? key
  const widgetLabel = (key: string) =>
    locale === "en"
      ? DASHBOARD_WIDGET_LABELS[key as keyof typeof DASHBOARD_WIDGET_LABELS]?.en ?? key
      : DASHBOARD_WIDGET_LABELS[key as keyof typeof DASHBOARD_WIDGET_LABELS]?.sl ?? key

  const toggleCap = (key: string, value: boolean) => {
    setCapDraft((d) => ({ ...d, [key]: value }))
    setDirty(true)
  }

  const toggleWidget = (key: string) => {
    setWidgetDraft((ws) =>
      ws.includes(key) ? ws.filter((w) => w !== key) : [...ws, key]
    )
    setDirty(true)
  }

  const save = () => {
    startTransition(async () => {
      const capabilityStates: Record<string, "optional" | "disabled"> = {}
      for (const [key, enabled] of Object.entries(capDraft)) {
        capabilityStates[key] = enabled ? "optional" : "disabled"
      }
      const result = await updateOrgOverrides({
        capabilityStates,
        dashboardWidgets: widgetDraft,
      })
      if (result.ok) {
        toast.success(t.settings.modules.saved)
        setDirty(false)
        router.refresh()
      } else {
        const errorMap: Record<string, string> = {
          CAPABILITY_NOT_OPTIONAL: t.settings.modules.notOptional,
          INVALID_WIDGET: t.settings.modules.invalidWidget,
        }
        toast.error(errorMap[result.error ?? ""] ?? t.settings.modules.error)
      }
    })
  }

  const reset = () => {
    startTransition(async () => {
      const result = await resetOrgOverrides()
      if (result.ok) {
        toast.success(t.settings.modules.resetDone)
        setDirty(false)
        router.refresh()
      } else {
        toast.error(t.settings.modules.error)
      }
    })
  }

  const adjustedCount = useMemo(
    () => (data && !("error" in data) ? data.adjustableCapabilities.length : 0),
    [data]
  )

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </CardContent>
      </Card>
    )
  }

  if (!data || "error" in data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.modules.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {data && "error" in data ? data.error : t.settings.profile.loadError}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Modules on/off (optional capabilities) */}
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.modules.title}</CardTitle>
          <CardDescription>{t.settings.modules.description}</CardDescription>
          {data.isOverridden && (
            <Badge variant="secondary" className="mt-1 w-fit">
              {t.settings.modules.customized}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {data.adjustableCapabilities.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <Label
                  htmlFor={`mod-${key}`}
                  className="cursor-pointer text-sm font-normal"
                >
                  {capLabel(key)}
                </Label>
                <Switch
                  id={`mod-${key}`}
                  checked={capDraft[key] ?? true}
                  onCheckedChange={(v) => toggleCap(key, v)}
                  aria-label={capLabel(key)}
                />
              </div>
            ))}
          </div>
          {adjustedCount === 0 && (
            <p className="text-muted-foreground text-sm">{t.settings.modules.noAdjustable}</p>
          )}
        </CardContent>
      </Card>

      {/* Dashboard widgets */}
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.modules.widgetsTitle}</CardTitle>
          <CardDescription>{t.settings.modules.widgetsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_DASHBOARD_WIDGETS.map((key) => (
              <label
                key={key}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition-colors",
                  widgetDraft.includes(key)
                    ? "border-primary/50 bg-primary/5"
                    : "hover:bg-accent/50"
                )}
              >
                <Checkbox
                  checked={widgetDraft.includes(key)}
                  onCheckedChange={() => toggleWidget(key)}
                  aria-label={widgetLabel(key)}
                />
                {widgetLabel(key)}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending || !dirty}>
          {t.settings.modules.save}
        </Button>
        <Button variant="outline" onClick={reset} disabled={pending}>
          {t.settings.modules.reset}
        </Button>
        <p className="text-muted-foreground text-xs">{t.settings.modules.hint}</p>
      </div>
    </div>
  )
}
