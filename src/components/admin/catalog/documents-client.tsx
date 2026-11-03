"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
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
  PrinterIcon,
} from "@/components/icons"
import {
  createDocument,
  changeDocumentStatus,
  convertQuoteToInvoice,
  getDocumentDetail,
  listDocumentCustomers,
  type DocumentListItem,
  type DocumentDetail,
  type DocumentType,
} from "@/app/actions/documents"
import type { CatalogDocsDict } from "@/lib/i18n/dict/catalog-docs"
import { formatCurrency } from "@/lib/utils/format"

// ============================================================
// DOCUMENTS MANAGER (client) — §13 quotes + invoices.
// Tabs per type, create dialog with free-form line items and a
// detail dialog with validated status transitions and a
// print-friendly layout (window.print with print-scoped CSS).
// ============================================================

type Labels = CatalogDocsDict["documents"]

interface DocumentsClientProps {
  quotes: DocumentListItem[]
  invoices: DocumentListItem[]
  openWorkOrders: { id: string; number: number; title: string }[]
  labels: Labels
}

interface LineDraft {
  description: string
  quantity: number
  unitPrice: number
}

const emptyForm = {
  customerId: "",
  workOrderId: "",
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  notes: "",
  lines: [{ description: "", quantity: 1, unitPrice: 0 }] as LineDraft[],
}

const quoteStatusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-primary/10 text-primary",
  ACCEPTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

const invoiceStatusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ISSUED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  CANCELLED: "bg-muted text-muted-foreground line-through",
}

function money(n: number): string {
  // P1 #7 (walkthrough): enoten format valute — "79,02 €", ne "€79.02"
  return formatCurrency(n)
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function docCode(type: DocumentType, n: number): string {
  return `${type === "QUOTE" ? "PON" : "RAC"}-${String(n).padStart(4, "0")}`
}

export function DocumentsClient({
  quotes,
  invoices,
  openWorkOrders,
  labels,
}: DocumentsClientProps) {
  const router = useRouter()
  const [tab, setTab] = useState<DocumentType>("QUOTE")
  const [createOpen, setCreateOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [customers, setCustomers] = useState<
    { id: string; name: string; email: string | null }[]
  >([])
  const [form, setForm] = useState(emptyForm)

  // Detail dialog state
  const [detail, setDetail] = useState<DocumentDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const list = tab === "QUOTE" ? quotes : invoices
  const statusLabels: Record<string, string> =
    tab === "QUOTE" ? labels.quoteStatusLabels : labels.invoiceStatusLabels
  const statusColors = tab === "QUOTE" ? quoteStatusColors : invoiceStatusColors

  const linesTotal = form.lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
    0
  )

  const openCreate = async () => {
    setForm(emptyForm)
    setCreateOpen(true)
    if (customers.length === 0) {
      try {
        setCustomers(await listDocumentCustomers())
      } catch {
        // non-fatal: document can be created without a customer
      }
    }
  }

  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetail(null)
    try {
      const d = await getDocumentDetail(id)
      setDetail(d)
    } catch {
      toast.error(labels.errors.NOT_FOUND)
      setDetailOpen(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const items = form.lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        description: l.description,
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
      }))
    if (items.length === 0) {
      toast.error(labels.errors.NO_ITEMS)
      return
    }
    startTransition(async () => {
      const result = await createDocument({
        type: tab,
        customerId: form.customerId || null,
        workOrderId: form.workOrderId || null,
        issueDate: form.issueDate || null,
        dueDate: form.dueDate || null,
        notes: form.notes || null,
        items,
      })
      if (result.ok) {
        toast.success(labels.create.created)
        setCreateOpen(false)
        setForm(emptyForm)
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const changeStatus = (id: string, status: string) => {
    startTransition(async () => {
      const result = await changeDocumentStatus(id, status)
      if (result.ok) {
        toast.success(labels.detail.statusChanged)
        const fresh = await getDocumentDetail(id)
        setDetail(fresh)
        router.refresh()
      } else {
        toast.error(errorText(result.error))
      }
    })
  }

  const convert = (id: string) => {
    startTransition(async () => {
      const result = await convertQuoteToInvoice(id)
      if (result.ok) {
        toast.success(labels.detail.converted)
        setDetailOpen(false)
        setTab("INVOICE")
        router.refresh()
      } else {
        toast.error(
          result.error === "NOT_ACCEPTED"
            ? labels.detail.notAccepted
            : errorText(result.error)
        )
      }
    })
  }

  const errorText = (code?: string) => {
    const map: Record<string, string> = {
      INVALID_TYPE: labels.errors.INVALID_TYPE,
      NO_ITEMS: labels.errors.NO_ITEMS,
      EMPTY_LINE: labels.errors.EMPTY_LINE,
      INVALID_QUANTITY: labels.errors.INVALID_QUANTITY,
      INVALID_PRICE: labels.errors.INVALID_PRICE,
      NOT_FOUND: labels.errors.NOT_FOUND,
      INVALID_TRANSITION: labels.errors.INVALID_TRANSITION,
      NOT_ACCEPTED: labels.errors.NOT_ACCEPTED,
    }
    return (code && map[code]) || labels.errors.GENERIC
  }

  const quoteActions = useMemo(() => {
    if (!detail) return null
    if (detail.type !== "QUOTE") return null
    const s = detail.status
    return (
      <div className="flex flex-wrap gap-2">
        {s === "DRAFT" && (
          <>
            <Button size="sm" onClick={() => changeStatus(detail.id, "SENT")}>
              {labels.detail.send}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => changeStatus(detail.id, "REJECTED")}
            >
              {labels.detail.reject}
            </Button>
          </>
        )}
        {s === "SENT" && (
          <>
            <Button size="sm" onClick={() => changeStatus(detail.id, "ACCEPTED")}>
              {labels.detail.accept}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => changeStatus(detail.id, "REJECTED")}
            >
              {labels.detail.reject}
            </Button>
          </>
        )}
        {s === "ACCEPTED" && (
          <Button size="sm" onClick={() => convert(detail.id)}>
            {labels.detail.convert}
          </Button>
        )}
      </div>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail])

  const invoiceActions = useMemo(() => {
    if (!detail || detail.type !== "INVOICE") return null
    const s = detail.status
    return (
      <div className="flex flex-wrap gap-2">
        {s === "DRAFT" && (
          <Button size="sm" onClick={() => changeStatus(detail.id, "ISSUED")}>
            {labels.detail.issue}
          </Button>
        )}
        {s === "ISSUED" && (
          <Button size="sm" onClick={() => changeStatus(detail.id, "PAID")}>
            {labels.detail.markPaid}
          </Button>
        )}
        {(s === "DRAFT" || s === "ISSUED") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => changeStatus(detail.id, "CANCELLED")}
          >
            {labels.detail.cancel}
          </Button>
        )}
      </div>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail])

  return (
    <Card className="print:hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["QUOTE", "INVOICE"] as DocumentType[]).map((tt) => (
            <button
              key={tt}
              onClick={() => setTab(tt)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === tt
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tt === "QUOTE" ? labels.tabQuotes : labels.tabInvoices}
              <span className="text-muted-foreground ml-1.5 text-xs">
                {(tt === "QUOTE" ? quotes : invoices).length}
              </span>
            </button>
          ))}
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <PlusIcon size={16} className="mr-2" />
              {tab === "QUOTE" ? labels.newQuote : labels.newInvoice}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <form onSubmit={submit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {tab === "QUOTE" ? labels.create.titleQuote : labels.create.titleInvoice}
                </DialogTitle>
                <DialogDescription>{labels.create.description}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-customer">{labels.create.customerLabel}</Label>
                  <Select
                    value={form.customerId || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, customerId: v === "none" ? "" : v }))
                    }
                  >
                    <SelectTrigger id="doc-customer">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-wo">{labels.create.workOrderLabel}</Label>
                  <Select
                    value={form.workOrderId || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, workOrderId: v === "none" ? "" : v }))
                    }
                  >
                    <SelectTrigger id="doc-wo">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {openWorkOrders.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          #{String(w.number).padStart(3, "0")} · {w.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-issue">{labels.create.issueDateLabel}</Label>
                  <Input
                    id="doc-issue"
                    type="date"
                    value={form.issueDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, issueDate: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-due">{labels.create.dueDateLabel}</Label>
                  <Input
                    id="doc-due"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Line items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{labels.create.linesTitle} *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        lines: [
                          ...f.lines,
                          { description: "", quantity: 1, unitPrice: 0 },
                        ],
                      }))
                    }
                  >
                    <PlusIcon size={14} className="mr-1" />
                    {labels.create.addLine}
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_72px_100px_auto] items-center gap-2">
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, description: e.target.value } : l
                            ),
                          }))
                        }
                        placeholder={labels.create.lineDescriptionPlaceholder}
                        aria-label={labels.create.lineDescription}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, quantity: Number(e.target.value) } : l
                            ),
                          }))
                        }
                        aria-label={labels.create.lineQuantity}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) =>
                              i === idx ? { ...l, unitPrice: Number(e.target.value) } : l
                            ),
                          }))
                        }
                        aria-label={labels.create.lineUnitPrice}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive"
                        disabled={form.lines.length === 1}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        <MinusIcon size={14} />
                        <span className="sr-only">{labels.create.removeLine}</span>
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="text-right text-sm font-medium">
                  {labels.total}: {money(linesTotal)}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="doc-notes">{labels.create.notesLabel}</Label>
                <Textarea
                  id="doc-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Prekliči
                </Button>
                <Button type="submit" disabled={pending}>
                  {labels.create.submit}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-medium">{labels.empty}</p>
            <p className="text-muted-foreground mt-1 text-sm">{labels.emptyHint}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                  <th className="px-2 py-3">{labels.number}</th>
                  <th className="hidden px-2 py-3 md:table-cell">{labels.customer}</th>
                  <th className="hidden px-2 py-3 lg:table-cell">{labels.workOrder}</th>
                  <th className="hidden px-2 py-3 sm:table-cell">{labels.issueDate}</th>
                  <th className="hidden px-2 py-3 sm:table-cell">{labels.dueDate}</th>
                  <th className="px-2 py-3">{labels.total}</th>
                  <th className="px-2 py-3">{labels.status}</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-muted/50 border-b transition-colors last:border-0"
                  >
                    <td className="px-2 py-3 font-mono text-xs">
                      {docCode(d.type, d.number)}
                      {d.overdue && (
                        <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {labels.overdue}
                        </span>
                      )}
                    </td>
                    <td className="hidden max-w-44 truncate px-2 py-3 md:table-cell">
                      {d.customerName ?? (
                        <span className="text-muted-foreground">{labels.noCustomer}</span>
                      )}
                    </td>
                    <td className="hidden max-w-44 truncate px-2 py-3 lg:table-cell">
                      {d.workOrderId ? (
                        <span className="text-muted-foreground text-xs">
                          #{String(d.workOrderNumber).padStart(3, "0")} · {d.workOrderTitle}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="hidden px-2 py-3 text-xs sm:table-cell">
                      {formatDate(d.issueDate)}
                    </td>
                    <td className="hidden px-2 py-3 text-xs sm:table-cell">
                      {formatDate(d.dueDate)}
                    </td>
                    <td className="px-2 py-3 font-medium">{money(d.total)}</td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusColors[d.status] ?? ""
                        }`}
                      >
                        {statusLabels[d.status] ?? d.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(d.id)}>
                        {labels.detail.title}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {detail ? (
            <>
              {/* Printable area */}
              <div className="print-area">
                <DialogHeader className="print:hidden">
                  <DialogTitle className="flex items-center gap-2">
                    {detail.type === "QUOTE" ? labels.detail.quoteLabel : labels.detail.invoiceLabel}{" "}
                    {docCode(detail.type, detail.number)}
                  </DialogTitle>
                  <DialogDescription>{labels.detail.printHint}</DialogDescription>
                </DialogHeader>

                <div className="mt-2 space-y-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <div className="text-muted-foreground text-xs uppercase">
                        {detail.type === "QUOTE" ? labels.detail.validUntil : labels.detail.paymentDue}
                      </div>
                      <div>{formatDate(detail.dueDate)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs uppercase">
                        {labels.detail.billTo}
                      </div>
                      <div className="font-medium">{detail.customer?.name ?? labels.noCustomer}</div>
                      {detail.customer?.email && (
                        <div className="text-muted-foreground text-xs">{detail.customer.email}</div>
                      )}
                    </div>
                  </div>

                  {detail.workOrder && (
                    <div className="bg-muted/50 rounded-lg p-3 text-sm">
                      <span className="text-muted-foreground text-xs uppercase">
                        {labels.detail.linkedOrder}
                      </span>
                      <div className="font-medium">
                        #{String(detail.workOrder.number).padStart(3, "0")} ·{" "}
                        {detail.workOrder.title}
                      </div>
                    </div>
                  )}

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                        <th className="py-2">{labels.create.lineDescription}</th>
                        <th className="py-2 text-right">{labels.create.lineQuantity}</th>
                        <th className="py-2 text-right">{labels.create.lineUnitPrice}</th>
                        <th className="py-2 text-right">{labels.create.lineTotal}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((it) => (
                        <tr key={it.id} className="border-b last:border-0">
                          <td className="py-2">{it.description}</td>
                          <td className="py-2 text-right">{it.quantity}</td>
                          <td className="py-2 text-right">{money(it.unitPrice)}</td>
                          <td className="py-2 text-right font-medium">{money(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="py-2 text-right font-semibold">
                          {labels.detail.subtotalLabel}
                        </td>
                        <td className="py-2 text-right text-base font-bold text-primary">
                          {money(detail.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {detail.notes && (
                    <div className="text-sm">
                      <div className="text-muted-foreground text-xs uppercase">{labels.detail.notes}</div>
                      <div className="whitespace-pre-line">{detail.notes}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions (hidden on print) */}
              <div className="print:hidden mt-2 space-y-3 border-t pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      (detail.type === "QUOTE" ? quoteStatusColors : invoiceStatusColors)[
                        detail.status
                      ] ?? ""
                    }`}
                  >
                    {statusLabels[detail.status] ?? detail.status}
                  </span>
                  {quoteActions}
                  {invoiceActions}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => window.print()}
                  >
                    <PrinterIcon size={14} className="mr-1" />
                    {labels.detail.print}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="print:hidden">
                <DialogTitle>{labels.detail.title}</DialogTitle>
              </DialogHeader>
              <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
                …
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
