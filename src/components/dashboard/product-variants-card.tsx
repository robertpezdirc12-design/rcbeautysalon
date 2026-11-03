"use client"

import { useEffect, useState, useTransition } from "react"
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
import { Switch } from "@/components/ui/switch"
import { PlusIcon, PencilIcon, TrashIcon } from "@/components/icons"
import {
  getProductVariants,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  type VariantItem,
} from "@/app/actions/catalog"
import type { CatalogDocsDict } from "@/lib/i18n/dict/catalog-docs"
import { formatCurrency } from "@/lib/utils/format"

// ============================================================
// PRODUCT VARIANTS CARD (client) — §11 universal catalog.
// Size/colour/material variants with optional own price (falls
// back to the product price) and own stock, managed on the
// product edit page.
// ============================================================

type Labels = CatalogDocsDict["variants"]

interface ProductVariantsCardProps {
  productId: string
  productPrice: number
  labels: Labels
}

const emptyForm = {
  name: "",
  sku: "",
  price: "",
  trackInventory: true,
  stockQuantity: 0,
  isActive: true,
}

export function ProductVariantsCard({
  productId,
  productPrice,
  labels,
}: ProductVariantsCardProps) {
  const router = useRouter()
  const [variants, setVariants] = useState<VariantItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState(emptyForm)

  const load = async () => {
    try {
      setVariants(await getProductVariants(productId))
    } catch {
      // card stays empty; non-fatal
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (v: VariantItem) => {
    setEditingId(v.id)
    setForm({
      name: v.name,
      sku: v.sku ?? "",
      price: v.price !== null ? String(v.price) : "",
      trackInventory: v.trackInventory,
      stockQuantity: v.stockQuantity,
      isActive: v.isActive,
    })
    setOpen(true)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(labels.errors.MISSING_NAME)
      return
    }
    const payload = {
      name: form.name,
      sku: form.sku || null,
      price: form.price !== "" ? Number(form.price) : null,
      trackInventory: form.trackInventory,
      stockQuantity: Number(form.stockQuantity) || 0,
    }
    startTransition(async () => {
      const result = editingId
        ? await updateProductVariant({ id: editingId, ...payload })
        : await createProductVariant({ productId, ...payload })
      if (result.ok) {
        toast.success(editingId ? labels.updated : labels.created)
        setOpen(false)
        setForm(emptyForm)
        setEditingId(null)
        load()
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const remove = (v: VariantItem) => {
    if (!window.confirm(labels.deleteConfirm)) return
    startTransition(async () => {
      const result = await deleteProductVariant(v.id)
      if (result.ok) {
        toast.success(labels.deleted)
        load()
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const errorText = (code?: string) => {
    const map: Record<string, string> = {
      MISSING_NAME: labels.errors.MISSING_NAME,
      SKU_TAKEN: labels.errors.SKU_TAKEN,
      NOT_FOUND: labels.errors.NOT_FOUND,
    }
    return (code && map[code]) || labels.errors.GENERIC
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.subtitle}</CardDescription>
        </div>
        <Button onClick={openCreate} size="sm">
          <PlusIcon size={14} className="mr-1" />
          {labels.add}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground py-4 text-center text-sm">…</p>
        ) : variants.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium">{labels.empty}</p>
            <p className="text-muted-foreground mt-1 text-sm">{labels.emptyHint}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {variants.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{v.name}</span>
                    {!v.isActive && (
                      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                        {labels.inactive}
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {v.price !== null ? formatCurrency(v.price) : labels.priceInherits}
                    {v.trackInventory && (
                      <>
                        {" · "}
                        {labels.stock}: {v.stockQuantity}
                      </>
                    )}
                    {v.sku && <> · SKU {v.sku}</>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(v)}>
                    <PencilIcon size={14} />
                    <span className="sr-only">{labels.edit}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-8 w-8"
                    onClick={() => remove(v)}
                  >
                    <TrashIcon size={14} />
                    <span className="sr-only">{labels.deleteConfirm}</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={submit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{editingId ? labels.edit : labels.add}</DialogTitle>
                <DialogDescription>{labels.subtitle}</DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5">
                <Label htmlFor="var-name">{labels.name} *</Label>
                <Input
                  id="var-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={labels.namePlaceholder}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="var-sku">{labels.sku}</Label>
                  <Input
                    id="var-sku"
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="var-price">{labels.price}</Label>
                  <Input
                    id="var-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder={productPrice.toFixed(2)}
                  />
                  <p className="text-muted-foreground text-xs">{labels.priceInherits}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="var-stock">{labels.stock}</Label>
                  <Input
                    id="var-stock"
                    type="number"
                    min="0"
                    value={form.stockQuantity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, stockQuantity: Number(e.target.value) || 0 }))
                    }
                    disabled={!form.trackInventory}
                  />
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <Switch
                    id="var-track"
                    checked={form.trackInventory}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, trackInventory: checked }))
                    }
                  />
                  <Label htmlFor="var-track">{labels.trackInventory}</Label>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Prekliči
                </Button>
                <Button type="submit" disabled={pending}>
                  {labels.save}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
