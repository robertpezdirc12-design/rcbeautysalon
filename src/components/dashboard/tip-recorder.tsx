"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { recordAppointmentTip } from "@/app/actions/appointments"

// ============================================================
// NAPITNINA (#79) — hitri zapis napitnine na terminu:
// 0 / 5 / 10 % cen storitve ali znesek po meri, gotovina ali kartica.
// Napitnina je ločena vrstica prihodka (NE "prihodek od storitev").
// ============================================================

interface TipRecorderProps {
  appointmentId: string
  totalPrice: number
  currentTip: number
  currentMethod: string | null
  labels: {
    title: string
    hint: string
    amount: string
    method: string
    cash: string
    card: string
    save: string
    saved: string
    failed: string
  }
}

const TIP_PERCENTS = [0, 5, 10]

export function TipRecorder({
  appointmentId,
  totalPrice,
  currentTip,
  currentMethod,
  labels: t,
}: TipRecorderProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [amount, setAmount] = useState<string>(
    currentTip > 0 ? currentTip.toFixed(2) : ""
  )
  const [method, setMethod] = useState<"cash" | "card">(
    currentMethod === "card" ? "card" : "cash"
  )

  const applyPercent = (pct: number) => {
    const value = Math.round(totalPrice * pct) / 100
    setAmount(pct === 0 ? "0" : value.toFixed(2))
  }

  const handleSave = () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 0) {
      toast.error(t.failed)
      return
    }
    startTransition(async () => {
      const result = await recordAppointmentTip(appointmentId, {
        amount: value,
        method: value > 0 ? method : null,
      })
      if (result.success) {
        toast.success(t.saved)
        router.refresh()
      } else {
        toast.error(result.error || t.failed)
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>{t.title}</Label>
          <p className="text-muted-foreground text-xs">{t.hint}</p>
        </div>
        {currentTip > 0 && (
          <span className="text-sm font-medium text-green-600">
            +{currentTip.toFixed(2)} €
          </span>
        )}
      </div>
      <div className="flex gap-1">
        {TIP_PERCENTS.map((pct) => (
          <Button
            key={pct}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPercent(pct)}
            disabled={isPending}
          >
            {pct === 0 ? "0" : `${pct}%`}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="tip-amount" className="text-xs">
            {t.amount}
          </Label>
          <Input
            id="tip-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t.method}</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as "cash" | "card")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">{t.cash}</SelectItem>
              <SelectItem value="card">{t.card}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button size="sm" onClick={handleSave} disabled={isPending}>
        {isPending && <SpinnerIcon size={14} className="mr-2 animate-spin" />}
        {t.save}
      </Button>
    </div>
  )
}
