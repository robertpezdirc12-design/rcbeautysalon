// ============================================================
// #96 — SPREJEMNI OBRAZCI NA TERMINU (čista jedra)
// Validacija odgovorov proti FormDefinition.fields (ProfileFieldDef).
// Čisto + testabilno: strežnik pokliče PREMER zapisovanja, UI pa lahko
// ista pravila uporabi za odjemalsko validacijo.
// #96 v2 — žeton za povezavo: generacija, izbira storitve z obrazcem
// in pravilo veljavnosti povezave (isti princip na vseh poteh).
// ============================================================

import { randomBytes } from "crypto"

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

  // Neznani ključi se tiho izpustijo (definicija je avtoritativna) —
  // zanka gre po definiciji, odgovori se berejo per ključ.
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

// ============================================================
// #96 v2 — ŽETON ZA POVEZAVO (izpolnjevanje po rezervaciji)
// ============================================================

/**
 * Žeton za javno povezavo /intake/[token] — 48 znakov hex (192 bitov).
 * Povezava je pooblastilo sama po sebi (G2), zato je naključna, ne
 * izpeljana iz id ali časa.
 */
export function generateIntakeToken(): string {
  return randomBytes(24).toString("hex")
}

/** Obramba po globini: sprejemljiva oblika žetona (hex, zadostna dolžina). */
export function isPlausibleIntakeToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{32,128}$/i.test(token)
}

/**
 * Prva storitev termina s sprejemnim obrazcem (isto pravilo kot v
 * booking flow-u in checkoutu — obrazec določa prva storitev z enim).
 */
export function pickIntakeService<
  T extends { service?: { intakeFormDefinitionId?: string | null } | null; intakeFormDefinitionId?: string | null },
>(services: T[]): T | null {
  return (
    services.find(
      (s) => s.service?.intakeFormDefinitionId ?? s.intakeFormDefinitionId
    ) ?? null
  )
}

/** Povezava velja samo za termine, ki niso odpovedani. */
export function intakeLinkAllowed(status: string): boolean {
  return status !== "CANCELLED"
}
