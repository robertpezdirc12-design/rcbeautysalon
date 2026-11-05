// ============================================================
// #96 — SPREJEMNI OBRAZCI NA TERMINU (čista jedra)
// Validacija odgovorov proti FormDefinition.fields (ProfileFieldDef).
// Čisto + testabilno: strežnik pokliče PREMER zapisovanja, UI pa lahko
// ista pravila uporabi za odjemalsko validacijo.
// ============================================================

import type { ProfileFieldDef } from "@/lib/profiles/types"

export interface IntakeAnswerInput {
  key: string
  value: string
}

export interface IntakeValidation {
  ok: boolean
  /** Normalizirani odgovori (samo znani ključi, string vrednosti). */
  data: Record<string, string>
  errors: Record<string, string>
}

export function validateIntakeAnswers(
  fields: ProfileFieldDef[],
  answers: unknown
): IntakeValidation {
  const data: Record<string, string> = {}
  const errors: Record<string, string> = {}

  // Neznani ključi se tiho izpustijo (definicija je avtoritativna).
  const byKey = new Map<string, ProfileFieldDef>(fields.map((f) => [f.key, f]))
  const raw =
    answers && typeof answers === "object" && !Array.isArray(answers)
      ? (answers as Record<string, unknown>)
      : {}

  for (const field of fields) {
    const rawValue = raw[field.key]
    const value =
      typeof rawValue === "string"
        ? rawValue.trim()
        : rawValue === true || rawValue === false
          ? String(rawValue)
          : ""

    if (!value) {
      if (field.required) {
        errors[field.key] = "Obvezno polje"
      }
      continue
    }

    if (field.type === "number") {
      const n = Number(value)
      if (!Number.isFinite(n)) {
        errors[field.key] = "Vnesite številko"
        continue
      }
    }
    if (field.type === "select" && field.options && !field.options.includes(value)) {
      errors[field.key] = "Neveljavna izbira"
      continue
    }
    if (field.type === "checkbox") {
      data[field.key] = value === "true" ? "true" : "false"
      continue
    }
    data[field.key] = value.slice(0, 2000)
  }

  return { ok: Object.keys(errors).length === 0, data, errors }
}

/** Legenda polj za UI (brez oklepajev v markerjih — glej golden meta test). */
export function intakeFieldSummary(fields: ProfileFieldDef[]): string {
  return fields.map((f) => `${f.label}${f.required ? " *" : ""}`).join(", ")
}
