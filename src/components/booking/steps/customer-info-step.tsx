import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useI18n } from "@/lib/i18n/provider"

// F1 (E3-8 follow-up): the booking form submits through the React 19
// `action={}` pathway, which resets UNCONTROLLED inputs after every
// action submission — so all customer fields are controlled here and
// immune to that reset (React re-renders the state value back).

interface CustomerInfoStepProps {
  values: {
    firstName: string
    lastName: string
    email: string
    phone: string
    notes: string
  }
  onChange: (field: keyof CustomerInfoStepProps["values"], value: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any
  isAuthenticated: boolean
  /** P1 #9 (audit-2026-11): validate a single field on blur (RHF trigger). */
  onBlurField?: (field: "firstName" | "lastName" | "email" | "phone") => void
  // #96: sprejemni obrazec storitve (neobvezen — samo ko storitev ga ima)
  intakeForm?: {
    name: string
    description: string | null
    fields: {
      key: string
      label: string
      type: "text" | "textarea" | "number" | "date" | "select" | "checkbox"
      required: boolean
      options?: string[]
      placeholder?: string
      unit?: string
    }[]
  } | null
  intakeAnswers?: Record<string, string>
  onIntakeChange?: (key: string, value: string) => void
}

export function CustomerInfoStep({
  values,
  onChange,
  errors,
  isAuthenticated,
  onBlurField,
  intakeForm = null,
  intakeAnswers = {},
  onIntakeChange,
}: CustomerInfoStepProps) {
  const { t } = useI18n()

  // P1 #9: inline error slots get stable ids wired via aria-describedby, so
  // screen readers announce the message next to the field.
  const describedBy = (field: string) =>
    errors[field] ? `${field}-error` : undefined

  const errorText = (field: string) =>
    errors[field] ? (
      <p id={`${field}-error`} className="text-sm text-destructive">
        {errors[field].message}
      </p>
    ) : null

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
            4
          </div>
          <CardTitle>{t.booking.yourDetails}</CardTitle>
        </div>
        <CardDescription>
          {isAuthenticated
            ? t.booking.confirmDetailsDesc
            : t.booking.enterDetailsDesc}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">
              {t.booking.firstName} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="firstName"
              name="firstName"
              required
              aria-required
              autoComplete="given-name"
              placeholder={t.booking.firstNamePlaceholder}
              className="placeholder:text-muted-foreground/60"
              disabled={isAuthenticated}
              aria-invalid={!!errors.firstName || undefined}
              aria-describedby={describedBy("firstName")}
              value={values.firstName}
              onChange={(e) => onChange("firstName", e.target.value)}
              onBlur={() => onBlurField?.("firstName")}
            />
            {errorText("firstName")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">
              {t.booking.lastName} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lastName"
              name="lastName"
              required
              aria-required
              autoComplete="family-name"
              placeholder={t.booking.lastNamePlaceholder}
              className="placeholder:text-muted-foreground/60"
              disabled={isAuthenticated}
              aria-invalid={!!errors.lastName || undefined}
              aria-describedby={describedBy("lastName")}
              value={values.lastName}
              onChange={(e) => onChange("lastName", e.target.value)}
              onBlur={() => onBlurField?.("lastName")}
            />
            {errorText("lastName")}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">
            {t.booking.email} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            aria-required
            autoComplete="email"
            inputMode="email"
            placeholder={t.booking.emailPlaceholder}
            className="placeholder:text-muted-foreground/60"
            disabled={isAuthenticated}
            aria-invalid={!!errors.email || undefined}
            aria-describedby={describedBy("email")}
            value={values.email}
            onChange={(e) => onChange("email", e.target.value)}
            onBlur={() => onBlurField?.("email")}
          />
          {errorText("email")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">
            {t.booking.phone} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            aria-required
            autoComplete="tel"
            inputMode="tel"
            placeholder={t.booking.phonePlaceholder}
            className="placeholder:text-muted-foreground/60"
            aria-invalid={!!errors.phone || undefined}
            aria-describedby={describedBy("phone")}
            value={values.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            onBlur={() => onBlurField?.("phone")}
          />
          {errorText("phone")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">{t.booking.specialRequests}</Label>
          <Textarea
            id="notes"
            name="notes"
            placeholder={t.booking.notesPlaceholder}
            rows={3}
            value={values.notes}
            onChange={(e) => onChange("notes", e.target.value)}
          />
          {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
        </div>

        {/* #96: sprejemni obrazec storitve — gost izpolni ob rezervaciji;
            odgovori grejo kot FormSubmission (contextType appointment). */}
        {intakeForm && intakeForm.fields.length > 0 && onIntakeChange && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-semibold">{intakeForm.name}</p>
            {intakeForm.description && (
              <p className="text-muted-foreground mt-1 text-xs">{intakeForm.description}</p>
            )}
            <div className="mt-3 space-y-3">
              {intakeForm.fields.map((field) => {
                const id = `intake-${field.key}`
                const value = intakeAnswers[field.key] ?? ""
                return (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={id} className="text-xs font-medium">
                      {field.label}
                      {field.required ? " *" : ""}
                      {field.unit ? ` (${field.unit})` : ""}
                    </Label>
                    {field.type === "textarea" ? (
                      <textarea
                        id={id}
                        value={value}
                        onChange={(e) => onIntakeChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                      />
                    ) : field.type === "select" ? (
                      <select
                        id={id}
                        value={value}
                        onChange={(e) => onIntakeChange(field.key, e.target.value)}
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
                            onIntakeChange(field.key, e.target.checked ? "true" : "false")
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        {field.placeholder ?? "Da"}
                      </label>
                    ) : (
                      <Input
                        id={id}
                        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                        value={value}
                        onChange={(e) => onIntakeChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
