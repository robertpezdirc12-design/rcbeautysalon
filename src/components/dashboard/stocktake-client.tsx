"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { submitStockTake } from "@/app/actions/inventory"
import type { ProductsDict } from "@/lib/i18n/dict/products"

// ============================================================
// INVENTURA (#78, client) — prešteto vs. sistem, živa razlika.
// Submit pošlje VSAKA vnesena polje; akcija zapiše SAMO neničelne
// razlike kot STOCKTAKE premike (v eni transakciji).
// ============================================================

interface StocktakeProduct {
  id: string
  name: string
  sku: string | null
  unit: string
  stockQuantity: number
}

interface StocktakeClientProps {
  products: StocktakeProduct[]
  labels: ProductsDict
}

export function StocktakeClient({ products, labels: t }: StocktakeClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [note, setNote] = useState("")
  const [counted, setCounted] = useState<Record<string, string>>({})

  const deltas = useMemo(() => {
    const map: Record<string, number | null> = {}
    for (const p of products) {
      const raw = counted[p.id]
      if (raw === undefined || raw === "") {
        map[p.id] = null
        continue
      }
      const n = Number(raw)
      map[p.id] = Number.isInteger(n) && n >= 0 ? n - p.stockQuantity : null
    }
    return map
  }, [counted, products])

  const filledCount = Object.values(deltas).filter((d) => d !== null).length

  const handleSubmit = () => {
    const lines = products
      .filter((p) => deltas[p.id] !== null)
      .map((p) => ({ productId: p.id, counted: Number(counted[p.id]) }))

    if (lines.length === 0) {
      toast.error(t.stocktakeEmpty)
      return
    }

    startTransition(async () => {
      const result = await submitStockTake({ note: note.trim() || undefined, lines })
      if (result.ok) {
        const adjusted = result.adjusted?.length ?? 0
        if (adjusted === 0) {
          toast.info(t.stocktakeNoDeltas)
        } else {
          toast.success(t.stocktakeSuccess(adjusted))
        }
        setCounted({})
        setNote("")
        router.refresh()
      } else {
        toast.error(t.stocktakeSubmit)
      }
    })
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{t.stocktakeEmpty}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{t.stocktakeTitle}</CardTitle>
          <CardDescription>
            {t.totalProductsCount(products.length)}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="no-print"
          >
            {t.stocktakePrint}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || filledCount === 0}>
            {isPending && <SpinnerIcon size={16} className="mr-2 animate-spin" />}
            {t.stocktakeSubmit}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="stocktake-note" className="no-print">
            {t.stocktakeNoteLabel}
          </Label>
          <Input
            id="stocktake-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="no-print max-w-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">{t.colProduct ?? "Izdelek"}</th>
                <th className="pb-3 font-medium">{t.colSku ?? "SKU"}</th>
                <th className="pb-3 text-right font-medium">{t.stocktakeSystemLabel}</th>
                <th className="no-print pb-3 text-right font-medium">
                  {t.stocktakeCountedLabel}
                </th>
                <th className="no-print pb-3 text-right font-medium">
                  {t.stocktakeDeltaLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const delta = deltas[p.id]
                return (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="text-muted-foreground py-3 font-mono text-sm">
                      {p.sku || "—"}
                    </td>
                    <td className="py-3 text-right font-mono">
                      {p.stockQuantity} {p.unit}
                    </td>
                    <td className="no-print py-3 text-right">
                      <Input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        aria-label={`${t.stocktakeCountedLabel}: ${p.name}`}
                        value={counted[p.id] ?? ""}
                        onChange={(e) =>
                          setCounted((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        className="ml-auto w-24 text-right"
                      />
                    </td>
                    <td
                      className={`no-print py-3 text-right font-mono font-medium ${
                        delta === null || delta === 0
                          ? "text-muted-foreground"
                          : delta > 0
                            ? "text-green-600"
                            : "text-red-600"
                      }`}
                    >
                      {delta === null
                        ? "—"
                        : delta > 0
                          ? `+${delta}`
                          : String(delta)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
