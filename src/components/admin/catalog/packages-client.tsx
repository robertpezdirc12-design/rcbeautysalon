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
import { sellPrepaid } from "@/app/actions/prepaid"
import { useI18n } from "@/lib/i18n/provider"
import type { CatalogDocsDict } from "@/lib/i18n/dict/catalog-docs"
import { formatCurrency } from "@/lib/utils/format"

// ============================================================
// PACKAGES MANAGER (client) — §11 universal catalog.
// #80: ONE prepaid primitive — kind PAKET SEANS (items → sessions)
// or DARILNI BON (face value, no items); "Prodaj" records an offline
// sale as a PrepaidPurchase (sessionsLeft/balance). Memberships are
// deliberately NOT offered in this PR (they land with the scheduler).
// Oznake: useI18n() (client bundle) — slovar z funkcijami (sellSuccess…)
// NI serijalizabilen čez RSC mejo kot props.
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
  customers?: { id: string; name: string; email: string | null }[]
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
  kind: "PACKAGE" as "PACKAGE" | "GIFT_CARD",
  faceValue: "",
  validityDays: "",
  sessionCount: "",
}

function money(n: number): string {
  // P1 #7 (walkthrough): enoten format valute — "79,02 €", ne "€79.02"
  return formatCurrency(n)
}

export function PackagesClient({ packages, catalog, customers = [] }: PackagesClientProps) {
  const router = useRouter()
  // Oznake iz client bundle-a (funkcije v slovarju niso props-serijalizabilne).
  const labels: Labels = useI18n().t.catalogDocs.packages
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState(emptyForm)
  // #80: prodaja v salonu
  const [selling, setSelling] = useState<PackageInfo | null>(null)
  const [sellCustomerId, setSellCustomerId] = useState("none")
  const [sellGuestEmail, setSellGuestEmail] = useState("")
  const [sellNote, setSellNote] = useState("")

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
      kind: p.kind === "GIFT_CARD" ? "GIFT_CARD" : "PACKAGE",
      faceValue: p.faceValue !== null ? String(p.faceValue) : "",
      validityDays: p.validityDays !== null ? String(p.validityDays) : "",
      sessionCount: p.sessionCount !== null ? String(p.sessionCount) : "",
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
    // #80: darilni bon NE potrebuje postavk.
    const items: PackageLineInput[] =
      form.kind === "GIFT_CARD"
        ? []
        : form.lines
            .filter((l) => l.refId)
            .map((l) => ({
              itemType: l.itemType,
              refId: l.refId,
              quantity: Math.max(1, Math.round(Number(l.quantity) || 1)),
            }))
    if (items.length === 0 && form.kind === "PACKAGE") {
      toast.error(labels.errors.NO_ITEMS)
      return
    }
    const faceValue = form.faceValue !== "" ? Number(form.faceValue) : null
    if (form.kind === "GIFT_CARD" && faceValue !== null && faceValue < price) {
      toast.error(labels.errors.INVALID_FACE_VALUE)
      return
    }

    const payload = {
      name: form.name,
      description: form.description || null,
      price,
      compareAtPrice: form.compareAtPrice !== "" ? Number(form.compareAtPrice) : null,
      items,
      // #80: prepaid value
      kind: form.kind,
      faceValue,
      validityDays: form.validityDays !== "" ? Number(form.validityDays) : null,
      sessionCount:
        form.kind === "PACKAGE" && form.sessionCount !== ""
          ? Number(form.sessionCount)
          : null,
      serviceIds: form.kind === "PACKAGE"
        ? items.filter((it) => it.itemType === "service").map((it) => it.refId)
        : [],
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
      INVALID_FACE_VALUE: labels.errors.INVALID_FACE_VALUE,
      BUYER_REQUIRED: labels.sellFailed,
      MEMBERSHIP_NOT_AVAILABLE: labels.errors.GENERIC,
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

  const handleSell = () => {
    if (!selling) return
    if (sellCustomerId === "none" && !sellGuestEmail.trim()) {
      toast.error(labels.sellFailed)
      return
    }
    startTransition(async () => {
      const result = await sellPrepaid({
        prepaidProductId: selling.id,
        customerId: sellCustomerId === "none" ? null : sellCustomerId,
        guestEmail: sellCustomerId === "none" ? sellGuestEmail.trim() : null,
        note: sellNote.trim() || undefined,
      })
      if (result.ok && result.code) {
        toast.success(labels.sellSuccess(result.code))
        setSelling(null)
        setSellCustomerId("none")
        setSellGuestEmail("")
        setSellNote("")
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

              {/* #80: vrsta vnaprej plačane vrednosti. */}
              <div className="space-y-1.5">
                <Label htmlFor="pkg-kind">{labels.kindLabel}</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      kind: v === "GIFT_CARD" ? "GIFT_CARD" : "PACKAGE",
                    }))
                  }
                  disabled={pending || !!editingId}
                >
                  <SelectTrigger id="pkg-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PACKAGE">{labels.kindPackage}</SelectItem>
                    <SelectItem value="GIFT_CARD">{labels.kindGiftCard}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  {form.kind === "GIFT_CARD" ? labels.kindGiftCardHint : labels.kindPackageHint}
                </p>
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

              {/* #80: darilni bon — vrednost (faceValue) mora biti ≥ cena. */}
              {form.kind === "GIFT_CARD" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pkg-face">{labels.faceValue}</Label>
                  <Input
                    id="pkg-face"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.faceValue}
                    onChange={(e) => setForm((f) => ({ ...f, faceValue: e.target.value }))}
                    placeholder={form.price || "50.00"}
                  />
                  <p className="text-muted-foreground text-xs">{labels.faceValueHint}</p>
                </div>
              )}

              {/* #80: veljavnost (obe vrsti). */}
              <div className="space-y-1.5">
                <Label htmlFor="pkg-validity">{labels.validityDays}</Label>
                <Input
                  id="pkg-validity"
                  type="number"
                  min="1"
                  value={form.validityDays}
                  onChange={(e) => setForm((f) => ({ ...f, validityDays: e.target.value }))}
                  placeholder="365"
                />
              </div>

              {/* #80: število seans (paket) — privzeto iz vsote količin. */}
              {form.kind === "PACKAGE" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pkg-sessions">{labels.sessionCountLabel}</Label>
                  <Input
                    id="pkg-sessions"
                    type="number"
                    min="1"
                    value={form.sessionCount}
                    onChange={(e) => setForm((f) => ({ ...f, sessionCount: e.target.value }))}
                    placeholder={String(form.lines.reduce((s, l) => s + (Number(l.quantity) || 1), 0) || "5")}
                  />
                </div>
              )}

              {/* Items — samo PAKET (darilni bon je čisti denar). */}
              {form.kind === "PACKAGE" && (
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
              )}

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

        {/* #80: Prodaja v salonu — dialog nad kartico. */}
        <Dialog open={!!selling} onOpenChange={(o) => !o && setSelling(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {labels.sellTitle}
                {selling ? `: ${selling.name}` : ""}
              </DialogTitle>
              <DialogDescription>{labels.sellDesc}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {customers.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="sell-customer">{labels.sellCustomer}</Label>
                  <Select value={sellCustomerId} onValueChange={setSellCustomerId}>
                    <SelectTrigger id="sell-customer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.email ? ` (${c.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {sellCustomerId === "none" && (
                <div className="space-y-1.5">
                  <Label htmlFor="sell-email">{labels.sellGuestEmail}</Label>
                  <Input
                    id="sell-email"
                    type="email"
                    value={sellGuestEmail}
                    onChange={(e) => setSellGuestEmail(e.target.value)}
                    placeholder="kunde@example.com"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="sell-note">{labels.sellNote}</Label>
                <Input
                  id="sell-note"
                  value={sellNote}
                  onChange={(e) => setSellNote(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelling(null)} disabled={pending}>
                Prekliči
              </Button>
              <Button onClick={handleSell} disabled={pending}>
                {labels.sellSubmit}
              </Button>
            </DialogFooter>
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
                      {/* #80: vrsta vnaprej plačane vrednosti. */}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.kind === "GIFT_CARD"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400"
                        }`}
                      >
                        {p.kind === "GIFT_CARD" ? labels.badgeGiftCard : labels.badgePackage}
                      </span>
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

                {p.kind === "GIFT_CARD" ? (
                  <div className="text-muted-foreground mt-3 text-sm">
                    {labels.faceValue}: <span className="text-foreground font-semibold">{money(p.faceValue ?? p.price)}</span>
                  </div>
                ) : (
                  <>
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
                  </>
                )}

                <div className="mt-3 flex items-center gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    <PencilIcon size={14} className="mr-1" />
                    {labels.edit}
                  </Button>
                  {/* #80: Prodaj — zabeleži offline prodajo (PrepaidPurchase). */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelling(p)
                      setSellCustomerId("none")
                      setSellGuestEmail("")
                      setSellNote("")
                    }}
                    disabled={!p.isActive}
                  >
                    {labels.sell}
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
