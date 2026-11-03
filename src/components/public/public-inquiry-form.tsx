"use client"

import { useState, useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircleIcon, SpinnerGapIcon } from "@/components/icons"
import { submitPublicForm, type PublicFormDefinition } from "@/app/actions/forms"

// ============================================================
// PUBLIC DYNAMIC FORM (EPIC #1 §8 — Phase 4)
// Renders any FormDefinition's fields (text, textarea, number,
// date, select, checkbox) with contact details and submits via
// the server action, which re-validates every value against the
// stored definition before persisting.
// ============================================================

interface PublicInquiryFormProps {
  form: PublicFormDefinition
}

type Values = Record<string, string | boolean>

export function PublicInquiryForm({ form }: PublicInquiryFormProps) {
  const [values, setValues] = useState<Values>({})
  const [contact, setContact] = useState({ name: "", email: "", phone: "" })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // F1 (E3-8 follow-up): submission runs through the React 19 `action={}`
  // pathway instead of a manual onSubmit handler. All fields are controlled,
  // so the framework's automatic post-action form reset cannot lose input.
  const [, formAction, pending] = useActionState(async () => {
    setFormError(null)
    setFieldErrors({})
    const result = await submitPublicForm(form.key, values, contact)
    if (result.ok) {
      setSubmitted(true)
      return null
    }
    if (result.error === "VALIDATION" && result.fieldErrors) {
      setFieldErrors(result.fieldErrors)
      setFormError("Prosimo, preverite označena polja.")
      return null
    }
    setFormError("Oddaja ni uspela. Poskusite znova ali nas pokličite.")
    return null
  }, null)

  const setValue = (key: string, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  if (submitted) {
    return (
      <div className="bg-card border-primary/20 rounded-2xl border p-10 text-center shadow-sm">
        <CheckCircleIcon size={48} className="text-primary-text mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Hvala za vaše povpraševanje!</h2>
        <p className="text-muted-foreground mt-2">
          Obrazec «{form.name}» je oddan. Odgovorimo vam v najkrajšem možnem
          času{contact.email ? ` na ${contact.email}` : ""}.
        </p>
      </div>
    )
  }

  const errorText = (key: string) => {
    const err = fieldErrors[key]
    if (!err) return null
    const map: Record<string, string> = {
      required: "To polje je obvezno.",
      number: "Vnesite veljavno število.",
      date: "Vnesite veljaven datum.",
      option: "Izberite eno od ponujenih možnosti.",
    }
    return map[err] ?? "Neveljavna vrednost."
  }

  return (
    <form
      action={formAction}
      className="bg-card space-y-6 rounded-2xl border p-6 shadow-sm sm:p-8"
      aria-label={form.name}
    >
      <div>
        <h2 className="text-lg font-semibold">{form.name}</h2>
        {form.description && (
          <p className="text-muted-foreground mt-1 text-sm">{form.description}</p>
        )}
      </div>

      {/* Contact details (guest submission) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${form.id}-name`}>Ime in priimek</Label>
          <Input
            id={`${form.id}-name`}
            value={contact.name}
            onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
            placeholder="Ana Novak"
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${form.id}-email`}>E-pošta</Label>
          <Input
            id={`${form.id}-email`}
            type="email"
            value={contact.email}
            onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
            placeholder="ana@primer.si"
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${form.id}-phone`}>Telefon</Label>
          <Input
            id={`${form.id}-phone`}
            type="tel"
            value={contact.phone}
            onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
            placeholder="040 123 456"
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="bg-border/40 h-px" />

      {/* Dynamic fields from the tenant's form definition */}
      <div className="space-y-5">
        {form.fields.map((field) => {
          const id = `${form.id}-${field.key}`
          const err = errorText(field.key)
          return (
            <div key={field.key} className="space-y-1.5">
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
                  rows={4}
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
                  <option value="">Izberite …</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.type === "checkbox" ? (
                <div className="flex items-center gap-2">
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

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <SpinnerGapIcon size={18} className="mr-2 animate-spin" />
            Oddajanje …
          </>
        ) : (
          "Oddaj povpraševanje"
        )}
      </Button>
    </form>
  )
}
