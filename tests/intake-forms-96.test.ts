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

// ============================================================
// #96 v2 — ŽETON ZA POVEZAVO (izpolnjevanje po rezervaciji)
// ============================================================

import {
  generateIntakeToken,
  isPlausibleIntakeToken,
  pickIntakeService,
  intakeLinkAllowed,
} from "../src/lib/forms/intake"

describe("#96 v2 generateIntakeToken", () => {
  it("48 znakov hex (192 bitov entropije)", () => {
    const t = generateIntakeToken()
    expect(t).toMatch(/^[a-f0-9]{48}$/)
  })

  it("dva klica = dva različna žetona", () => {
    expect(generateIntakeToken()).not.toBe(generateIntakeToken())
  })
})

describe("#96 v2 isPlausibleIntakeToken (obramba po globini)", () => {
  it("veljaven hex sprejet, cuid/kratki/tuj znaki zavrnjeni", () => {
    expect(isPlausibleIntakeToken(generateIntakeToken())).toBe(true)
    expect(isPlausibleIntakeToken("cmiqtjp330037sd1cdnslxebo")).toBe(false) // cuid oblika
    expect(isPlausibleIntakeToken("abc")).toBe(false)
    expect(isPlausibleIntakeToken("g".repeat(48))).toBe(false)
    expect(isPlausibleIntakeToken(null)).toBe(false)
    expect(isPlausibleIntakeToken(42)).toBe(false)
  })
})

describe("#96 v2 pickIntakeService (isto pravilo na vseh poteh)", () => {
  it("vrne prvo storitev z obrazcem (direkten vpis z AppointmentService)", () => {
    const services = [
      { service: { intakeFormDefinitionId: null } },
      { service: { intakeFormDefinitionId: "def_1" } },
      { service: { intakeFormDefinitionId: "def_2" } },
    ]
    expect(pickIntakeService(services)?.service.intakeFormDefinitionId).toBe("def_1")
  })

  it("vrne null, ko nobena storitev nima obrazca", () => {
    expect(
      pickIntakeService([{ service: { intakeFormDefinitionId: null } }])
    ).toBeNull()
    expect(pickIntakeService([])).toBeNull()
  })

  it("deluje tudi na Service vrsticah (createAppointment scope)", () => {
    const rows = [
      { intakeFormDefinitionId: null },
      { intakeFormDefinitionId: "def_9" },
    ]
    expect(pickIntakeService(rows)?.intakeFormDefinitionId).toBe("def_9")
  })
})

describe("#96 v2 intakeLinkAllowed", () => {
  it("odpovedan termin brez povezave, ostali statusi veljavni", () => {
    expect(intakeLinkAllowed("CANCELLED")).toBe(false)
    expect(intakeLinkAllowed("PENDING")).toBe(true)
    expect(intakeLinkAllowed("CONFIRMED")).toBe(true)
    expect(intakeLinkAllowed("COMPLETED")).toBe(true)
    expect(intakeLinkAllowed("NO_SHOW")).toBe(true)
  })
})

describe("#96 v2 struktura: žeton na vseh treh kreacijah + javni tok", () => {
  it("neposredna rezervacija nastavi intakeToken (samo ko storitev ima obrazec)", () => {
    const src = read("src/app/actions/appointments.ts")
    const txPart = src.slice(src.indexOf("prisma.$transaction"), src.indexOf("export async function getUserAppointments"))
    expect(txPart).toContain("intakeToken:")
    expect(txPart).toContain("generateIntakeToken()")
  })

  it("verify + webhook nastavita intakeToken (obstojeci termini prek ensureIntakeLink)", () => {
    const stripe = read("src/app/actions/stripe.ts")
    expect(stripe).toContain("intakeToken:")
    const webhook = read("src/app/api/webhooks/stripe/route.ts")
    expect(webhook).toContain("intakeToken:")
    expect(src_appointments()).toContain("ensureIntakeLink")
  })

  it("javna pot /intake/[token] preverja org + status + oddajo (G2)", () => {
    const actions = src_appointments()
    expect(actions).toContain("getIntakeFormByToken")
    expect(actions).toContain("submitIntakeByToken")
    expect(actions).toContain('organization.status !== "ACTIVE"')
    expect(actions).toContain("intakeLinkAllowed(appointment.status)")
    expect(actions).toContain('code: "ALREADY_SUBMITTED"')
  })

  it("uspešna stran + admin detajl povezujeta gostu/administratorju", () => {
    const success = read("src/app/(public)/booking/success/page.tsx")
    expect(success).toContain("/intake/${result.intakeToken}")
    expect(success).toContain("/intake/${appointment.intakeToken}")
    const detail = read("src/app/(admin)/dashboard/appointments/[id]/page.tsx")
    expect(detail).toContain("AppointmentIntakeLink")
  })
})

function src_appointments(): string {
  return read("src/app/actions/appointments.ts")
}
