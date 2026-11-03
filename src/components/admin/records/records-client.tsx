"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { PencilIcon, PlusIcon, SpinnerGapIcon, TrashIcon } from "@/components/icons"
import { useI18n } from "@/lib/i18n/provider"
import {
  createExtensionRecord,
  deleteExtensionRecord,
  listExtensionRecords,
  listRecordCustomers,
  updateExtensionRecord,
  type ExtensionEntityInfo,
  type ExtensionRecordItem,
} from "@/app/actions/records"
import type { ProfileFieldDef } from "@/lib/profiles/types"

// ============================================================
// EXTENSION RECORDS CLIENT (EPIC #1 §13 — Phase 6)
// Fully data-driven registry UI: entities, field layout, labels
// and columns all come from the extension declaration — this
// component contains ZERO industry-specific logic. A workshop
// gets its vehicle/tire registries, a beekeeper its batch
// records, from the exact same code path.
// ============================================================

type Values = Record<string, string | boolean | number>

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale === "sl" ? "sl-SI" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

export function RecordsClient({ entities }: { entities: ExtensionEntityInfo[] }) {
  const { t, locale } = useI18n()
  const L = t.recordsPage

  const [activeKey, setActiveKey] = useState(entities[0]?.key ?? "")
  const active = useMemo(
    () => entities.find((e) => e.key === activeKey) ?? entities[0],
    [entities, activeKey]
  )

  const [recordState, setRecordState] = useState<{ key: string; rows: ExtensionRecordItem[] } | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [, startTransition] = useTransition()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ExtensionRecordItem | null>(null)
  const [deleting, setDeleting] = useState<ExtensionRecordItem | null>(null)

  // Loading is derived: state belongs to a different entity key while fetching.
  const records =
    recordState && recordState.key === active?.key ? recordState.rows : null

  // Records load asynchronously per active entity — state updates only
  // happen inside promise callbacks (never synchronously in the effect).
  useEffect(() => {
    if (!active) return
    let alive = true
    listExtensionRecords(active.key)
      .then((rows) => {
        if (alive) setRecordState({ key: active.key, rows })
      })
      .catch(() => {
        if (alive) setRecordState({ key: active.key, rows: [] })
      })
    return () => {
      alive = false
    }
  }, [active, refreshTick])

  const columns = useMemo(() => {
    if (!active) return []
    return active.fields
      .filter((f) => f.type !== "textarea" && f.type !== "checkbox")
      .slice(0, 4)
  }, [active])

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (record: ExtensionRecordItem) => {
    setEditing(record)
    setDialogOpen(true)
  }

  const onSaved = () => {
    setDialogOpen(false)
    setRefreshTick((tick) => tick + 1)
    toast.success(L.saved)
  }

  const onDelete = () => {
    if (!deleting) return
    const target = deleting
    startTransition(async () => {
      const res = await deleteExtensionRecord(target.id)
      if (res.ok) {
        setDeleting(null)
        setRefreshTick((tick) => tick + 1)
      }
    })
  }

  if (!active) return null

  return (
    <div className="space-y-6">
      {/* Entity switcher (e.g. vehicle-workshop has vehicle + tire_set) */}
      {entities.length > 1 && (
        <Tabs value={active.key} onValueChange={setActiveKey}>
          <TabsList className="flex-wrap">
            {entities.map((e) => (
              <TabsTrigger key={e.key} value={e.key}>
                {e.name}
                <Badge variant="secondary" className="ml-2">
                  {e.recordCount}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>{active.name}</CardTitle>
            <CardDescription className="max-w-2xl">{active.description}</CardDescription>
          </div>
          <Button onClick={openCreate} className="shrink-0">
            <PlusIcon size={16} className="mr-1.5" />
            {L.addRecord}
          </Button>
        </CardHeader>
        <CardContent>
          {records === null ? (
            <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
              <SpinnerGapIcon size={18} className="animate-spin" />
              …
            </div>
          ) : records.length === 0 ? (
            <div className="text-muted-foreground py-10 text-center text-sm">
              {L.addRecord} — 0 {L.count}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    {columns.map((c) => (
                      <TableHead key={c.key}>{c.label}</TableHead>
                    ))}
                    <TableHead>{L.customerLabel}</TableHead>
                    <TableHead>{L.lastUpdated}</TableHead>
                    <TableHead className="text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      {columns.map((c) => {
                        const v = r.data[c.key]
                        const isTitle = c.key === titleFieldKey(active.fields)
                        return (
                          <TableCell key={c.key} className={isTitle ? "font-medium" : undefined}>
                            {v === undefined || v === null || v === ""
                              ? L.noCustomer
                              : String(v)}
                          </TableCell>
                        )
                      })}
                      <TableCell>{r.customerName ?? L.noCustomer}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(r.updatedAt, locale)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(r)}
                            aria-label={L.editRecord}
                          >
                            <PencilIcon size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive h-8 w-8"
                            onClick={() => setDeleting(r)}
                            aria-label={L.deleteRecord}
                          >
                            <TrashIcon size={15} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog — fields rendered from the declaration */}
      <RecordDialog
        key={`${active.key}-${editing?.id ?? "new"}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entity={active}
        record={editing}
        onSaved={onSaved}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={L.deleteConfirmTitle}
        description={L.deleteConfirmText}
        confirmLabel={L.deleteRecord}
        onConfirm={onDelete}
      />
    </div>
  )
}

/** The field whose value becomes the row title (first required text). */
function titleFieldKey(fields: ProfileFieldDef[]): string {
  const req = fields.find((f) => (f.type === "text" || f.type === "select") && f.required)
  return (req ?? fields.find((f) => f.type === "text" || f.type === "select"))?.key ?? ""
}

interface RecordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entity: ExtensionEntityInfo
  record: ExtensionRecordItem | null
  onSaved: () => void
}

function RecordDialog({ open, onOpenChange, entity, record, onSaved }: RecordDialogProps) {
  const { t, locale } = useI18n()
  const L = t.recordsPage
  const selectPlaceholder = locale === "sl" ? "Izberite …" : "Select …"

  const initial: Values = useMemo(() => {
    const out: Values = {}
    if (record) {
      for (const f of entity.fields) {
        const v = (record.data as Record<string, unknown>)[f.key]
        if (v !== undefined && v !== null) out[f.key] = v as string | boolean | number
      }
    }
    return out
  }, [record, entity])

  const [values, setValues] = useState<Values>(initial)
  const [customerId, setCustomerId] = useState<string>(record?.customerId ?? "none")
  const [customers, setCustomers] = useState<{ id: string; name: string; email: string | null }[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let alive = true
    listRecordCustomers().then((rows) => {
      if (alive) setCustomers(rows)
    })
    return () => {
      alive = false
    }
  }, [open])

  const setValue = (key: string, value: string | boolean | number) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const errorText = (key: string) => {
    const err = fieldErrors[key]
    if (!err) return null
    return L.validation[err as keyof typeof L.validation] ?? L.errorGeneric
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFieldErrors({})
    startTransition(async () => {
      const payload = {
        entityKey: entity.key,
        values: values as Record<string, unknown>,
        customerId: customerId === "none" ? null : customerId,
      }
      const res = record
        ? await updateExtensionRecord(record.id, payload)
        : await createExtensionRecord(payload)
      if (res.ok) {
        onSaved()
        return
      }
      if (res.error === "VALIDATION" && res.fieldErrors) {
        setFieldErrors(res.fieldErrors)
        return
      }
      if (res.error === "INVALID_CUSTOMER") {
        setFormError(L.errorInvalidCustomer)
        return
      }
      setFormError(L.errorGeneric)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{record ? L.editRecord : L.addRecord} — {entity.name}</DialogTitle>
          <DialogDescription>{entity.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5" aria-label={entity.name}>
          {/* Optional customer link (universal primitive) */}
          <div className="space-y-1.5">
            <Label htmlFor="record-customer">{L.customerOptional}</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger id="record-customer">
                <SelectValue placeholder={L.customerAny} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{L.customerAny}</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.email ? ` (${c.email})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-border/40 h-px" />

          {/* Declarative fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            {entity.fields.map((field) => {
              const id = `record-${field.key}`
              const err = errorText(field.key)
              const wide = field.type === "textarea"
              return (
                <div key={field.key} className={wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                  <Label htmlFor={id}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-0.5">*</span>}
                    {field.unit && (
                      <span className="text-muted-foreground ml-1 text-xs">({field.unit})</span>
                    )}
                  </Label>

                  {field.type === "textarea" ? (
                    <Textarea
                      id={id}
                      value={String(values[field.key] ?? "")}
                      onChange={(e) => setValue(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      aria-invalid={!!err}
                      className={err ? "border-destructive" : undefined}
                    />
                  ) : field.type === "select" ? (
                    <select
                      id={id}
                      value={String(values[field.key] ?? "")}
                      onChange={(e) => setValue(field.key, e.target.value)}
                      aria-invalid={!!err}
                      className={`border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                        err ? "border-destructive" : ""
                      }`}
                    >
                      <option value="">{selectPlaceholder}</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "checkbox" ? (
                    <div className="flex h-10 items-center gap-2">
                      <input
                        id={id}
                        type="checkbox"
                        checked={values[field.key] === true}
                        onChange={(e) => setValue(field.key, e.target.checked)}
                        className="text-primary-text focus:ring-primary h-4 w-4 rounded border"
                      />
                      <span className="text-muted-foreground text-sm">
                        {field.placeholder ?? "Da"}
                      </span>
                    </div>
                  ) : (
                    <Input
                      id={id}
                      type={
                        field.type === "number"
                          ? "number"
                          : field.type === "date"
                            ? "date"
                            : "text"
                      }
                      value={String(values[field.key] ?? "")}
                      onChange={(e) => setValue(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      aria-invalid={!!err}
                      className={err ? "border-destructive" : undefined}
                    />
                  )}

                  {err && <p className="text-destructive text-xs">{err}</p>}
                </div>
              )
            })}
          </div>

          {formError && (
            <p className="text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
              {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {L.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <SpinnerGapIcon size={16} className="mr-1.5 animate-spin" />}
              {L.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
