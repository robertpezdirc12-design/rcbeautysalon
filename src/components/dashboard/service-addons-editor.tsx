"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusIcon, TrashIcon } from "@/components/icons"
import { upsertServiceAddons, type ServiceAddonInput } from "@/app/actions/services"

// #92 — urejevalnik dodatkov storitve (edit stran storitve).
// Replace-all shranjevanje: vrstice (ime, cena, trajanje) → seznam.
// Termin_snapshoti ostanejo nedotaknjeni (zgodovina ne sledi katalogu).
export function ServiceAddonsEditor({
  serviceId,
  initialAddons,
}: {
  serviceId: string
  initialAddons: { id: string; name: string; price: number; durationMin: number }[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState<ServiceAddonInput[]>(
    initialAddons.map(({ name, price, durationMin }) => ({ name, price, durationMin }))
  )
  const [pending, startTransition] = useTransition()

  function updateRow(i: number, patch: Partial<ServiceAddonInput>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function save() {
    startTransition(async () => {
      const res = await upsertServiceAddons(serviceId, rows)
      if (res.success) {
        toast.success("Dodatki shranjeni.")
        router.refresh()
      } else {
        toast.error(res.error ?? "Shranjevanje dodatkov ni uspelo.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dodatki storitve (neobvezno)</CardTitle>
        <CardDescription>
          Izbirna doplačila, ki jih stranka izbere pri rezervaciji — cena in trajanje se
          samodejno prištejeta. Shranjujejo se ločeno od storitve.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ni dodatkov — dodajte prvega.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <div className="min-w-40 flex-1 space-y-1">
                  <Label htmlFor={`addon-name-${i}`} className="text-xs">
                    Ime
                  </Label>
                  <Input
                    id={`addon-name-${i}`}
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                    placeholder="npr. Ulje za gume"
                    maxLength={60}
                    disabled={pending}
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label htmlFor={`addon-price-${i}`} className="text-xs">
                    Cena (€)
                  </Label>
                  <Input
                    id={`addon-price-${i}`}
                    type="number"
                    min={0}
                    step={0.01}
                    value={row.price}
                    onChange={(e) => updateRow(i, { price: Number(e.target.value) })}
                    disabled={pending}
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label htmlFor={`addon-duration-${i}`} className="text-xs">
                    Trajanje (min)
                  </Label>
                  <Input
                    id={`addon-duration-${i}`}
                    type="number"
                    min={0}
                    step={5}
                    value={row.durationMin}
                    onChange={(e) => updateRow(i, { durationMin: Number(e.target.value) })}
                    disabled={pending}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={pending}
                  aria-label={`Odstrani ${row.name || "dodatek"}`}
                >
                  <TrashIcon size={16} />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setRows((prev) => [...prev, { name: "", price: 0, durationMin: 0 }])}
            disabled={pending}
          >
            <PlusIcon size={16} className="mr-1.5" />
            Dodaj dodatek
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Shranjujem …" : "Shrani dodatke"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
