"use client"

// #100 8.C (F2): katalog modulov v2 — vklop/izklop na ravni podjetja,
// neodvisno od vertikale. Izklop ohrani podatke (javni vhodi 404);
// odvisnosti so deklarirane (opozorilo pred izklopom, jasno sporočilo
// ob vklopu). Nastavitve → Moduli (nad obstoječim konfiguratorjem).

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  getModuleOverview,
  setModuleState,
  type ModuleView,
} from "@/app/actions/modules"
import { useI18n } from "@/lib/i18n/provider"

export function ModulesV2Card() {
  const { locale } = useI18n()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [modules, setModules] = useState<ModuleView[]>([])
  const [warnings, setWarnings] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getModuleOverview()
      .then((res) => {
        setModules(res.modules)
        setWarnings(res.dependentWarnings)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  function toggle(mod: ModuleView, next: boolean) {
    const state = next ? "ACTIVE" : "DEACTIVATED"
    startTransition(async () => {
      const res = await setModuleState(mod.id, state)
      if (!res.success) {
        toast.error(res.error ?? "Sprememba ni uspela.")
        return
      }
      if (res.warnings && res.warnings.length > 0) {
        for (const w of res.warnings) toast.warning(w)
      } else {
        toast.success(
          next ? `Modul »${sl(mod)}« vklopljen.` : `Modul »${sl(mod)}« izklopljen — podatki ostanejo.`
        )
      }
      router.refresh()
      getModuleOverview()
        .then((r) => setModules(r.modules))
        .catch(() => undefined)
    })
  }

  function sl(m: ModuleView) {
    return locale === "en" ? m.nameEn : m.nameSl
  }

  function de(m: ModuleView) {
    return locale === "en" ? m.descriptionEn : m.descriptionSl
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Moduli (v2 — neodvisno od dejavnosti)</CardTitle>
        <CardDescription>
          Vklopi ali izklopi celoten modul — neodvisno od dejavnosti. Izklop ne
          izgubi podatkov: rezervacije, naročila in zgodovina ostanejo; javni
          vhodi izklopljenega modula se zaprejo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <p className="text-muted-foreground text-sm">Nalagam modulni katalog …</p>
        )}
        {modules.map((m) => {
          const moduleWarnings = warnings[m.id] ?? []
          return (
            <div
              key={m.id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{sl(m)}</p>
                  {m.state === "DEACTIVATED" && (
                    <Badge variant="secondary" className="text-[10px]">
                      izklopljen — podatki ohranjeni
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">{de(m)}</p>
                {moduleWarnings.length > 0 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Odvisni moduli: {moduleWarnings.join(", ")}
                  </p>
                )}
              </div>
              <Switch
                checked={m.state === "ACTIVE"}
                onCheckedChange={(v) => toggle(m, v)}
                disabled={pending || loading}
                aria-label={`Modul ${sl(m)}`}
              />
            </div>
          )
        })}
        <p className="text-muted-foreground text-xs">
          Odvisnosti so upoštevane: modul z izklopljeno odvisnostjo javi, kaj
          najprej vklopiti. Izklop modula, od katerega so odvisni drugi, pokaže
          opozorilo — nič se ne spremeni tiho.
        </p>
      </CardContent>
    </Card>
  )
}
