"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlusIcon, TrashIcon } from "@/components/icons"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { recordDelivery } from "@/app/actions/inventory"
import { useI18n } from "@/lib/i18n/provider"
import type { ProductsDict } from "@/lib/i18n/dict/products"

// ============================================================
// PREJEM BLAGA (#78) — "prejeli smo dobavo" dialog.
// En submission = EN dogodek: vsaka linija dobi StockMovement z
// virom DELIVERY in skupno referenco (številka dobavnice), zaloga
// pa se poveča v isti transakciji. Dobavitelj je opcijski in samo,
// kadar profil omogoča suppliers extensijo (action varovalka).
// ============================================================

interface DeliveryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: { id: string; name: string; stockQuantity: number }[]
  suppliers: { id: string; title: string }[]
  labels: ProductsDict
}

interface Line {
  productId: string
  quantity: string
}

export function DeliveryDialog({
  open,
  onOpenChange,
  products,
  suppliers,
  labels: t,
}: DeliveryDialogProps) {
  const router = useRouter()
  const { t: tc } = useI18n()
  const [isPending, startTransition] = useTransition()
  const [documentNumber, setDocumentNumber] = useState("")
  const [supplierRecordId, setSupplierRecordId] = useState("none")
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: "1" }])

  const setLine = (index: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const handleSubmit = () => {
    const validLines = lines
      .map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
      }))
      .filter((l) => l.productId && Number.isInteger(l.quantity) && l.quantity > 0)

    if (validLines.length === 0) {
      toast.error(t.deliveryFailed)
      return
    }

    startTransition(async () => {
      const result = await recordDelivery({
        documentNumber: documentNumber.trim() || undefined,
        supplierRecordId: supplierRecordId === "none" ? undefined : supplierRecordId,
        lines: validLines,
      })

      if (result.ok) {
        toast.success(t.deliverySuccess(result.receivedCount ?? validLines.length))
        setDocumentNumber("")
        setSupplierRecordId("none")
        setLines([{ productId: "", quantity: "1" }])
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(t.deliveryFailed)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.deliveryTitle}</DialogTitle>
          <DialogDescription>{t.deliveryDesc}</DialogDescription>
        </DialogHeader>

        {products.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            {t.deliveryNoProducts}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="delivery-document">{t.deliveryDocumentLabel}</Label>
                <Input
                  id="delivery-document"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder={t.deliveryDocumentPlaceholder}
                />
              </div>
              {suppliers.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="delivery-supplier">{t.deliverySupplierLabel}</Label>
                  <Select
                    value={supplierRecordId}
                    onValueChange={setSupplierRecordId}
                  >
                    <SelectTrigger id="delivery-supplier">
                      <SelectValue placeholder={t.deliverySupplierLabel} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs">{t.deliveryProductLabel}</Label>
                    )}
                    <Select
                      value={line.productId || undefined}
                      onValueChange={(v) => setLine(index, { productId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t.deliveryProductLabel} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.stockQuantity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs">{t.deliveryQtyLabel}</Label>
                    )}
                    <Input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => setLine(index, { quantity: e.target.value })}
                    />
                  </div>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t.deliveryRemoveLine}
                      onClick={() =>
                        setLines((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      <TrashIcon size={14} />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, { productId: "", quantity: "1" }])}
              >
                <PlusIcon size={14} className="mr-1" />
                {t.deliveryAddLine}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {tc.common.actions.cancel}
          </Button>
          {products.length > 0 && (
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? (
                <SpinnerIcon size={16} className="animate-spin" />
              ) : (
                <PlusIcon size={16} className="mr-1" />
              )}
              {t.deliverySubmit}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
