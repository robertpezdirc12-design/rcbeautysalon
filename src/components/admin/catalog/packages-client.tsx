"use client"

import { useState, useTransition } from "react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PlusIcon,
  MinusIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/icons"
import {
  createPackage,
  updatePackage,
  togglePackage,
  deletePackage,
  type PackageInfo,
  type PackageLineInput,
} from "@/app/actions/catalog"
import type { CatalogDocsDict } from "@/lib/i18n/dict/catalog-docs"
import { formatCurrency } from "@/lib/utils/format"

// ============================================================
// PACKAGES MANAGER (client) — §11 universal catalog.
// Create/edit bundles of services and products at one price;
// the list value shows the implied discount of the package.
// ============================================================

type Labels = CatalogDocsDict["packages"]

interface CatalogEntry {
  id: string
  name: string
  price: number
}

interface PackagesClientProps {
  packages: PackageInfo[]
  catalog: {
    services: CatalogEntry[]
    products: CatalogEntry[]
  }
  labels: Labels
}

interface LineDraft {
  itemType: "service" | "product"
  refId: string
  quantity: number
}

const emptyForm = {
  name: "",
  description: "",
  price: "",
  compareAtPrice: "",
  lines: [] as LineDraft[],
}

function money(n: number): string {
  // P1 #7 (walkthrough): enoten format valute — "79,02 €", ne "€79.02"
  return formatCurrency(n)
}

export function PackagesClient({ packages, catalog, labels }: PackagesClientProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState(emptyForm)

  const linesValue = form.lines.reduce((sum, l) => {
    const pool = l.itemType === "service" ? catalog.services : catalog.products
    const ref = pool.find((x) => x.id === l.refId)
    return sum + (ref ? ref.price * l.quantity : 0)
  }, 0)
  const packagePrice = Number(form.price) || 0
  const discount =
    linesValue > 0 && packagePrice > 0 && packagePrice < linesValue
      ? linesValue - packagePrice
      : 0

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const openCreate = () => {
    resetForm()
    setOpen(true)
  }

  const openEdit = (p: PackageInfo) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      compareAtPrice: p.compareAtPrice !== null ? String(p.compareAtPrice) : "",
      lines: p.items.map((it) => ({
        itemType: it.itemType === "service" ? "service" : "product",
        refId: it.refId,
        quantity: it.quantity,
      })),
    })
    setOpen(true)
  }

  const addLine = () => {
    const pool = catalog.services.length > 0 ? "service" : "product"
    const refId = pool === "service" ? catalog.services[0]?.id : catalog.products[0]?.id
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { itemType: pool, refId: refId ?? "", quantity: 1 }],
    }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(labels.errors.MISSING_NAME)
      return
    }
    const price = Number(form.price)
    if (!Number.isFinite(price) || form.price === "") {
      toast.error(labels.errors.INVALID_PRICE)
      return
    }
    const items: PackageLineInput[] = form.lines
      .filter((l) => l.refId)
      .map((l) => ({
        itemType: l.itemType,
        refId: l.refId,
        quantity: Math.max(1, Math.round(Number(l.quantity) || 1)),
      }))
    if (items.length === 0) {
      toast.error(labels.errors.NO_ITEMS)
      return
    }

    const payload = {
      name: form.name,
      description: form.description || null,
      price,
      compareAtPrice: form.compareAtPrice !== "" ? Number(form.compareAtPrice) : null,
      items,
    }

    startTransition(async () => {
      const result = editingId
        ? await updatePackage(editingId, payload)
        : await createPackage(payload)
      if (result.ok) {
        toast.success(editingId ? labels.updated : labels.created)
        setOpen(false)
        resetForm()
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const errorText = (code?: string) => {
    const map: Record<string, string> = {
      MISSING_NAME: labels.errors.MISSING_NAME,
      INVALID_PRICE: labels.errors.INVALID_PRICE,
      NO_ITEMS: labels.errors.NO_ITEMS,
      INVALID_QUANTITY: labels.errors.INVALID_QUANTITY,
      NOT_FOUND: labels.errors.NOT_FOUND,
    }
    return (code && map[code]) || labels.errors.GENERIC
  }

  const toggle = (p: PackageInfo) => {
    startTransition(async () => {
      const result = await togglePackage(p.id, !p.isActive)
      if (result.ok) router.refresh()
      else toast.error(errorText(result.error))
    })
  }

  const remove = (p: PackageInfo) => {
    if (!window.confirm(labels.deleteConfirm)) return
    startTransition(async () => {
      const result = await deletePackage(p.id)
      if (result.ok) {
        toast.success(labels.deleted)
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const poolFor = (t: "service" | "product") =>
    t === "service" ? catalog.services : catalog.products

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>
            {packages.length > 0
              ? `${packages.filter((p) => p.isActive).length}/${packages.length} ${labels.active.toLowerCase()}`
              : labels.emptyHint}
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <PlusIcon size={16} className="mr-2" />
              {labels.newPackage}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <form onSubmit={submit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{editingId ? labels.edit : labels.newPackage}</DialogTitle>
                <DialogDescription>{labels.subtitle}</DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5">
                <Label htmlFor="pkg-name">{labels.name} *</Label>
                <Input
                  id="pkg-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={labels.namePlaceholder}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pkg-desc">{labels.description}</Label>
                <Textarea
                  id="pkg-desc"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pkg-price">{labels.price} *</Label>
                  <Input
                    id="pkg-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pkg-compare">{labels.compareAtPrice}</Label>
                  <Input
                    id="pkg-compare"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.compareAtPrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, compareAtPrice: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{labels.items} *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <PlusIcon size={14} className="mr-1" />
                    {labels.addItem}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">{labels.itemsHint}</p>
                {form.lines.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm">
                    <span className="text-muted-foreground">{labels.errors.NO_ITEMS}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {form.lines.map((line, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-lg border p-2"
                      >
                        <Select
                          value={line.itemType}
                          onValueChange={(v) => {
                            const itemType = v as "service" | "product"
                            const first = poolFor(itemType)[0]?.id ?? ""
                            setForm((f) => ({
                              ...f,
                              lines: f.lines.map((l, i) =>
                                i === idx
                                  ? { itemType, refId: first, quantity: l.quantity }
                                  : l
                              ),
                            }))
                          }}
                        >
                          <SelectTrigger className="w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="service">{labels.itemType.service}</SelectItem>
                            <SelectItem value="product">{labels.itemType.product}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={line.refId || undefined}
                          onValueChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              lines: f.lines.map((l, i) =>
                                i === idx ? { ...l, refId: v } : l
                              ),
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {poolFor(line.itemType).map((entry) => (
                              <SelectItem key={entry.id} value={entry.id}>
                                {entry.name} · {money(entry.price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="1"
                          className="w-20"
                          value={line.quantity}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              lines: f.lines.map((l, i) =>
                                i === idx
                                  ? { ...l, quantity: Number(e.target.value) || 1 }
                                  : l
                              ),
                            }))
                          }
                          aria-label={labels.quantity}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              lines: f.lines.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          <MinusIcon size={14} />
                          <span className="sr-only">{labels.addItem}</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {linesValue > 0 && (
                  <div className="text-muted-foreground space-y-0.5 text-right text-xs">
                    <div>
                      {labels.listValue}: <span className="font-medium">{money(linesValue)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="text-emerald-600 dark:text-emerald-400">
                        {labels.discount}: {money(discount)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false)
                    resetForm()
                  }}
                >
                  Prekliči
                </Button>
                <Button type="submit" disabled={pending}>
                  {labels.save}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {packages.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-medium">{labels.empty}</p>
            <p className="text-muted-foreground mt-1 text-sm">{labels.emptyHint}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {packages.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl border p-4 transition-colors ${
                  p.isActive ? "bg-card" : "bg-muted/40 opacity-75"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{p.name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.isActive
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {p.isActive ? labels.active : labels.inactive}
                      </span>
                    </div>
                    {p.description && (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {p.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary-text">{money(p.price)}</div>
                    {p.compareAtPrice !== null && (
                      <div className="text-muted-foreground text-xs line-through">
                        {money(p.compareAtPrice)}
                      </div>
                    )}
                  </div>
                </div>

                <ul className="mt-3 space-y-1">
                  {p.items.map((it) => (
                    <li key={it.id} className="text-muted-foreground flex justify-between text-xs">
                      <span className="truncate">
                        <span className="bg-secondary text-secondary-foreground mr-1.5 rounded px-1 py-0.5 font-medium">
                          {it.itemType === "service"
                            ? labels.itemType.service
                            : labels.itemType.product}
                        </span>
                        {it.quantity}× {it.name}
                      </span>
                      <span>{money(it.unitPrice * it.quantity)}</span>
                    </li>
                  ))}
                </ul>

                {p.listValue > 0 && p.price < p.listValue && (
                  <div className="text-emerald-600 dark:text-emerald-400 mt-2 text-xs font-medium">
                    {labels.discount}: {money(p.listValue - p.price)}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    <PencilIcon size={14} className="mr-1" />
                    {labels.edit}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggle(p)}>
                    <span className="text-xs">{p.isActive ? labels.inactive : labels.active}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-destructive"
                    onClick={() => remove(p)}
                  >
                    <TrashIcon size={14} />
                    <span className="sr-only">{labels.deleteConfirm}</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
