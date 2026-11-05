"use client"

// #96 v2: javna oddaja sprejemnega obrazca prek žetona. Ista čista
// validacija kot booking flow (validateIntakeAnswers), strežnik pa
// pravila vedno ponovno preveri (submitIntakeByToken).

import { useState, useTransition } from "react"

import { submitIntakeByToken } from "@/app/actions/appointments"
import { validateIntakeAnswers } from "@/lib/forms/intake"
import type { ProfileFieldDef } from "@/lib/profiles/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

type IntakeField = {
  key: string
  label: string
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox"
  required: boolean
  options?: string[]
  placeholder?: string
}

export interface IntakeLinkFormProps {
  token: string
  formName: string
  formDescription: string | null
  fields: IntakeField[]
}

export function IntakeLinkForm({
  token,
  formName,
  formDescription,
  fields,
}: IntakeLinkFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  function setAnswer(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    setServerError(null)

    // Odjemalska validacija — isti motor kot strežnik.
    const check = validateIntakeAnswers(fields as unknown as ProfileFieldDef[], answers)
    setErrors(check.errors)
    if (!check.ok) return

    startTransition(async () => {
      const result = await submitIntakeByToken(token, check.data)
      if (result.ok) {
        setDone(true)
        return
      }
      if (result.code === "ALREADY_SUBMITTED") {
        setServerError("Ta obrazec je že bil oddan.")
        return
      }
      if (result.code === "INVALID" && result.errors) {
        setErrors(result.errors)
        setServerError("Preverite označena polja.")
        return
      }
      setServerError("Povezava ni več veljavna. Kontaktirajte ponudnika.")
    })
  }

  if (done) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-lg font-semibold">Hvala! Obrazec je oddan.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Ponudnik bo vaše odgovore videl ob terminu.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{formName}</CardTitle>
        {formDescription && (
          <p className="text-muted-foreground text-xs">{formDescription}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field) => {
          const id = `intake-link-${field.key}`
          const value = answers[field.key] ?? ""
          const error = errors[field.key]
          return (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={id} className="text-xs font-medium">
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              {field.type === "textarea" ? (
                <textarea
                  id={id}
                  value={value}
                  onChange={(e) => setAnswer(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                />
              ) : field.type === "select" ? (
                <select
                  id={id}
                  value={value}
                  onChange={(e) => setAnswer(field.key, e.target.value)}
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                >
                  <option value="">—</option>
                  {(field.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : field.type === "checkbox" ? (
                <label htmlFor={id} className="flex items-center gap-2 text-sm">
                  <input
                    id={id}
                    type="checkbox"
                    checked={value === "true"}
                    onChange={(e) =>
                      setAnswer(field.key, e.target.checked ? "true" : "false")
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                  Da
                </label>
              ) : (
                <input
                  id={id}
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  value={value}
                  onChange={(e) => setAnswer(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                />
              )}
              {error && <p className="text-destructive text-xs">{error}</p>}
            </div>
          )
        })}

        {serverError && (
          <p className="text-destructive text-sm" role="alert">
            {serverError}
          </p>
        )}

        <Button onClick={handleSubmit} disabled={pending} className="w-full">
          {pending ? "Pošiljanje …" : "Oddaj obrazec"}
        </Button>
      </CardContent>
    </Card>
  )
}
