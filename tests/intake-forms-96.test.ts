// ============================================================
// #96 — SPREJEMNI OBRAZCI NA TERMINU (regresijska varovala)
// Čisti validator (obvezna polja, tipi, neznani ključi) + struktura
// povezave (tx FormSubmission, checkout relink, org-scope).
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { validateIntakeAnswers } from "../src/lib/forms/intake"
import type { ProfileFieldDef } from "../src/lib/profiles/types"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

const FIELDS: ProfileFieldDef[] = [
  { key: "allergies", label: "Alergije", type: "textarea", required: true },
  { key: "weight", label: "Teža", type: "number", required: false, unit: "kg" },
  { key: "consent", label: "Soglasje", type: "checkbox", required: true },
  { key: "source", label: "Viral", type: "select", required: false, options: ["IG", "Znaj", "Priporočilo"] },
]

describe("#96 validateIntakeAnswers (čista logika)", () => {
  it("obvezno polje brez vrednosti → napaka, ok=false", () => {
    const r = validateIntakeAnswers(FIELDS, { consent: "true" })
    expect(r.ok).toBe(false)
    expect(r.errors.allergies).toBe("Obvezno polje")
  })

  it("številka: ne-številčna vrednost zavrnjena, veljbna sprejeta", () => {
    expect(validateIntakeAnswers(FIELDS, { weight: "abc" }).errors.weight).toBe("Vnesite številko")
    expect(validateIntakeAnswers(FIELDS, { weight: "72" }).data.weight).toBe("72")
  })

  it("select: vrednost izven opcij zavrnjena", () => {
    expect(validateIntakeAnswers(FIELDS, { source: "TikTok" }).errors.source).toBe("Neveljavna izbira")
    expect(validateIntakeAnswers(FIELDS, { source: "IG" }).data.source).toBe("IG")
  })

  it("neznani ključi se tiho izpustijo (definicija je avtoritativna)", () => {
    const r = validateIntakeAnswers(FIELDS, { allergen: "kikiriki", consent: "true", allergies: "brez" })
    expect(r.ok).toBe(true)
    expect(r.data.allergen).toBeUndefined()
  })

  it("checkbox normalizira v true/false niz", () => {
    expect(validateIntakeAnswers(FIELDS, { consent: true }).data.consent).toBe("true")
  })
})

describe("#96 struktura: tx povezava + checkout relink + org-scope", () => {
  it("createAppointment: validacija + FormSubmission znotraj tx (contextType appointment)", () => {
    const src = read("src/app/actions/appointments.ts")
    const txPart = src.slice(src.indexOf("prisma.$transaction"), src.indexOf("export async function getUserAppointments"))
    expect(txPart).toContain("validateIntakeAnswers")
    expect(txPart).toContain('contextType: "appointment"')
    expect(txPart).toContain("tx.formSubmission.create")
  })

  it("checkout: FormSubmission z contextType checkout-session (metadata limit)", () => {
    const stripe = read("src/app/actions/stripe.ts")
    expect(stripe).toContain('contextType: "checkout-session"')
    expect(stripe).toContain("validateIntakeAnswers")
  })

  it("webhook + verify relinkajo submission na termin", () => {
    const webhook = read("src/app/api/webhooks/stripe/route.ts")
    expect(webhook).toContain('"checkout-session"')
    const stripe = read("src/app/actions/stripe.ts")
    expect(stripe).toContain('"checkout-session"')
  })

  it("admin izbira obrazca je org-scoped (definicija mora biti vaša)", () => {
    const services = read("src/app/actions/services.ts")
    expect(services).toContain("export async function setServiceIntakeForm")
    expect(services).toContain("where: { id: formDefinitionId, organizationId: org.id, isActive: true },")
  })
})
