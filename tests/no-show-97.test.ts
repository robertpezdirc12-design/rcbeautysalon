// ============================================================
// #97 (AD-07) — NO-SHOW ZAŠČITA / CARD-ON-FILE (regresijska varovala)
// Pravilnik (SLO formulacije, en vir), pravila bremenitve (truth table),
// struktura: setup checkout, webhook vrata, success verify, cron bremenitev,
// wizard privolitev, admin prikaz. Kartice SE NIKOLI ne shranjujejo v app.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  NO_SHOW_CONSENT_LABEL,
  NO_SHOW_POLICY_TEXT,
  GUARANTEE_METADATA_TYPE,
  shouldChargeOnNoShow,
  type NoShowChargeCandidate,
} from "../src/lib/booking/no-show-policy"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

const candidate = (over?: Partial<NoShowChargeCandidate>): NoShowChargeCandidate => ({
  noShowConsent: true,
  noShowSetupStatus: "SAVED",
  noShowChargeStatus: "NONE",
  depositPaid: false,
  depositAmount: 15,
  stripeSetupIntentId: "seti_123",
  stripeCustomerId: "cus_123",
  ...over,
})

describe("#97 pravilnik (SLO, en vir za UI/checkout/e-pošto)", () => {
  it("privolitev omenja: kartica pri Stripe, garancija, zaračunavanje pologa ob ne-prihodu", () => {
    expect(NO_SHOW_CONSENT_LABEL).toContain("kartica")
    expect(NO_SHOW_CONSENT_LABEL).toContain("Stripe")
    expect(NO_SHOW_CONSENT_LABEL).toContain("ne-prihodu")
    expect(NO_SHOW_CONSENT_LABEL).toContain("polog")
  })

  it("pravilnik pove: nič zaračunano ob rezervaciji, pravočasna odpoved ni bremenjena, PCI", () => {
    expect(NO_SHOW_POLICY_TEXT).toContain("ničesar ne zaračunamo")
    expect(NO_SHOW_POLICY_TEXT).toContain("pravočasna odpoved ni bremenjena")
    expect(NO_SHOW_POLICY_TEXT).toContain("PCI")
  })
})

describe("#97 pravila bremenitve ob no-show (truth table)", () => {
  it("zaračuna SAMO: privolitev + SAVED + neobdelano + polog nezaplačen + >0 + SI/Customer", () => {
    expect(shouldChargeOnNoShow(candidate())).toBe(true)
  })

  it("brez privolitve / brez kartice / že bremenjeno / polog plačan / polog 0 → NE", () => {
    expect(shouldChargeOnNoShow(candidate({ noShowConsent: false }))).toBe(false)
    expect(shouldChargeOnNoShow(candidate({ noShowSetupStatus: "PENDING" }))).toBe(false)
    expect(shouldChargeOnNoShow(candidate({ noShowChargeStatus: "CHARGED" }))).toBe(false)
    expect(shouldChargeOnNoShow(candidate({ depositPaid: true }))).toBe(false)
    expect(shouldChargeOnNoShow(candidate({ depositAmount: 0 }))).toBe(false)
    expect(shouldChargeOnNoShow(candidate({ stripeSetupIntentId: null }))).toBe(false)
    expect(shouldChargeOnNoShow(candidate({ stripeCustomerId: null }))).toBe(false)
  })
})

describe("#97 struktura: checkout setup, webhook, success, cron, wizard", () => {
  it("garancijski checkout: createAppointment (PENDING + privolitev) NATO setup seja", () => {
    const stripe = read("src/app/actions/stripe.ts")
    expect(stripe).toContain("mode: \"setup\"")
    expect(stripe).toContain("client_reference_id: appointment.appointmentId")
    expect(stripe).toContain("GUARANTEE_METADATA_TYPE")
    expect(stripe).toContain("noShowGuarantee: true")
  })

  it("createAppointment: garancija → PENDING + noShowConsent + noShowSetupStatus PENDING", () => {
    const actions = read("src/app/actions/appointments.ts")
    expect(actions).toContain("const noShowGuarantee = data.noShowGuarantee === true && !isEmployeeBooking")
    expect(actions).toContain('noShowConsent: true, noShowSetupStatus: "PENDING"')
  })

  it("webhook: setup-mode veja PRED payment_status filtrom, zapiše SAVED → CONFIRMED", () => {
    const webhook = read("src/app/api/webhooks/stripe/route.ts")
    const setupIdx = webhook.indexOf("session.mode === \"setup\"")
    const paidIdx = webhook.indexOf("session.payment_status !== \"paid\"")
    expect(setupIdx).toBeGreaterThan(-1)
    expect(setupIdx).toBeLessThan(paidIdx)
    expect(webhook).toContain('noShowSetupStatus: "SAVED"')
    expect(webhook).toContain("status: \"CONFIRMED\"")
  })

  it("success verify: idempotenten zapis (updateMany PENDING→SAVED) in pošteno sporočilo", () => {
    const page = read("src/app/(public)/booking/success/page.tsx")
    expect(page).toContain('where: { id: params.appointment, noShowSetupStatus: "PENDING" }')
    expect(page).toContain("ničesar nismo zaračunali")
    expect(page).toContain("getStripeForOrg")
  })

  it("cron: bremenitev po prehodu v NO_SHOW — samo kandidati z vsemi pogoji", () => {
    const job = read("src/lib/jobs/expire-stale-pending.ts")
    expect(job).toContain("chargeNoShowFee")
    expect(job).toContain('noShowSetupStatus: "SAVED"')
    expect(job).toContain('noShowChargeStatus: "NONE"')
  })

  it("bremenitev: payment_method iz SetupIntenta; ključ izključno najemnika", () => {
    const charge = read("src/lib/booking/no-show-charge.ts")
    expect(charge).toContain("setupIntents.retrieve")
    expect(charge).toContain("off_session: true")
    expect(charge).toContain("noShowChargeId: intent.id")
    expect(charge).toContain("depositPaid: true")
  })

  it("wizard: izbira načina + EKSPPLICITNA privolitev (brez nje ni garancije)", () => {
    const wizard = read("src/components/booking/booking-form.tsx")
    expect(wizard).toContain("NO_SHOW_CONSENT_LABEL")
    expect(wizard).toContain("NO_SHOW_POLICY_TEXT")
    expect(wizard).toContain("!noShowConsent")
    expect(wizard).toContain("createGuaranteeCheckoutSession")
  })

  it("admin detajl: stanje kartice in bremenitve vidno lastniku", () => {
    const detail = read("src/app/(admin)/dashboard/appointments/[id]/page.tsx")
    expect(detail).toContain("No-show zaščita")
    expect(detail).toContain("noShowChargeStatus")
  })

  it("shema: samo Stripe reference (nikoli podatkov kartice), charge id unikaten", () => {
    const schema = read("prisma/schema.prisma")
    const block = schema.slice(
      schema.indexOf("noShowConsent      Boolean"),
      schema.indexOf("noShowChargeId     String? @unique") + 40
    )
    expect(block).toContain("stripeSetupIntentId")
    expect(block).toContain("stripeCustomerId")
    expect(block).not.toMatch(/cardNumber|card_/i)
  })
})
