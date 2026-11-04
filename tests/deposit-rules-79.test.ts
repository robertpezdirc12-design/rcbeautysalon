// ============================================================
// #79 — DEPOSIT AS A RULE + TIPS + COMMISSIONS.
//
// Layers:
//   1. PURE — resolveDeposit / resolveDepositForServices /
//      computeCommission (the ONE source of truth shared by the
//      booking action, the client summary, Stripe checkout and
//      the webhook).
//   2. SOURCE — the structural guarantees: all three appointment
//      creation paths use the helper, the deposit travels in
//      Stripe metadata, tips never merge into service revenue,
//      commissions freeze once.
// ============================================================

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  resolveDeposit,
  resolveDepositForServices,
  computeCommission,
  round2,
} from "@/lib/booking/deposit"

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8")
const schema = read("prisma/schema.prisma")

const ORG = { bookingDeposit: 50, bookingDepositType: "FIXED" as const }

// ------------------------------------------------------------
// 1. PURE — the deposit rule
// ------------------------------------------------------------

describe("#79 resolveDeposit — the 15 € manicure case", () => {
  it("INHERIT + org FIXED 50 on a 15 € service asks for 15 €, never 50 €", () => {
    expect(
      resolveDeposit(
        { price: 15, depositType: "INHERIT", depositValue: null },
        ORG
      )
    ).toBe(15)
  })

  it("INHERIT + org FIXED on an expensive service keeps the flat deposit", () => {
    expect(
      resolveDeposit(
        { price: 200, depositType: "INHERIT", depositValue: null },
        ORG
      )
    ).toBe(50)
  })

  it("NONE exempts the service entirely", () => {
    expect(
      resolveDeposit(
        { price: 200, depositType: "NONE", depositValue: null },
        ORG
      )
    ).toBe(0)
  })

  it("FIXED overrides the org number but still caps at the price", () => {
    expect(
      resolveDeposit(
        { price: 100, depositType: "FIXED", depositValue: 30 },
        ORG
      )
    ).toBe(30)
    expect(
      resolveDeposit(
        { price: 20, depositType: "FIXED", depositValue: 30 },
        ORG
      )
    ).toBe(20)
  })

  it("PERCENT takes the service value; INHERIT+PERCENT reads the org number as %", () => {
    expect(
      resolveDeposit(
        { price: 80, depositType: "PERCENT", depositValue: 20 },
        ORG
      )
    ).toBe(16)
    expect(
      resolveDeposit(
        { price: 80, depositType: "INHERIT", depositValue: null },
        { bookingDeposit: 20, bookingDepositType: "PERCENT" }
      )
    ).toBe(16)
  })

  it("PERCENT also caps at the service price (0–100 enforced)", () => {
    expect(
      resolveDeposit(
        { price: 10, depositType: "PERCENT", depositValue: 100 },
        ORG
      )
    ).toBe(10)
  })

  it("invalid or non-positive values resolve to 0, never NaN", () => {
    expect(
      resolveDeposit(
        { price: 50, depositType: "FIXED", depositValue: 0 },
        ORG
      )
    ).toBe(0)
    expect(
      resolveDeposit(
        { price: 50, depositType: "PERCENT", depositValue: null },
        ORG
      )
    ).toBe(0)
  })
})

describe("#79 resolveDepositForServices — multi-service bookings", () => {
  it("sums per-service rules", () => {
    expect(
      resolveDepositForServices(
        [
          { price: 100, depositType: "FIXED", depositValue: 20 },
          { price: 100, depositType: "FIXED", depositValue: 30 },
        ],
        ORG
      )
    ).toBe(50)
  })

  it("never asks for more than the booking total", () => {
    expect(
      resolveDepositForServices(
        [
          { price: 20, depositType: "FIXED", depositValue: 20 },
          { price: 15, depositType: "FIXED", depositValue: 15 },
        ],
        ORG
      )
    ).toBe(35)
  })

  it("an exempt service contributes zero", () => {
    expect(
      resolveDepositForServices(
        [
          { price: 100, depositType: "NONE", depositValue: null },
          { price: 100, depositType: "INHERIT", depositValue: null },
        ],
        ORG
      )
    ).toBe(50)
  })

  it("round2 kills the float dust", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})

// ------------------------------------------------------------
// 2. PURE — commissions
// ------------------------------------------------------------

describe("#79 computeCommission — payroll", () => {
  it("PERCENT of the basis", () => {
    expect(computeCommission({ commissionType: "PERCENT", commissionValue: 10 }, 250)).toBe(25)
  })

  it("FIXED per appointment", () => {
    expect(computeCommission({ commissionType: "FIXED", commissionValue: 2 }, 250)).toBe(2)
  })

  it("NONE is zero", () => {
    expect(computeCommission({ commissionType: "NONE", commissionValue: null }, 250)).toBe(0)
  })

  it("invalid values are zero, never NaN", () => {
    expect(computeCommission({ commissionType: "PERCENT", commissionValue: null }, 250)).toBe(0)
  })
})

// ------------------------------------------------------------
// 3. SCHEMA
// ------------------------------------------------------------

describe("#79 schema — deposit rules, tips, commissions", () => {
  it("DepositType enum exists with INHERIT/NONE/FIXED/PERCENT", () => {
    expect(schema).toMatch(
      /enum DepositType \{[\s\S]*?INHERIT[\s\S]*?NONE[\s\S]*?FIXED[\s\S]*?PERCENT/
    )
  })

  it("Service has the deposit rule fields", () => {
    expect(schema).toMatch(
      /model Service \{[\s\S]*?depositType\s+DepositType @default\(INHERIT\)/
    )
    expect(schema).toMatch(/model Service \{[\s\S]*?depositValue\s+Decimal\?/)
  })

  it("SalonConfig has the org-level deposit TYPE", () => {
    expect(schema).toMatch(/bookingDepositType\s+DepositType @default\(FIXED\)/)
  })

  it("Appointment carries tipAmount/tipMethod and a NULLABLE commissionAmount", () => {
    expect(schema).toMatch(/model Appointment \{[\s\S]*?tipAmount\s+Decimal @default\(0\)/)
    expect(schema).toMatch(/model Appointment \{[\s\S]*?tipMethod\s+String\?/)
    expect(schema).toMatch(/model Appointment \{[\s\S]*?commissionAmount\s+Decimal\?/)
  })

  it("Order carries tipAmount too", () => {
    expect(schema).toMatch(/model Order \{[\s\S]*?tipAmount\s+Decimal @default\(0\)/)
  })

  it("Staff carries the payroll rule", () => {
    expect(schema).toMatch(/model Staff \{[\s\S]*?defaultTipPercent\s+Decimal\?/)
    expect(schema).toMatch(/model Staff \{[\s\S]*?commissionType\s+CommissionType @default\(NONE\)/)
    expect(schema).toMatch(/model Staff \{[\s\S]*?commissionValue\s+Decimal\?/)
  })

  it("CommissionType enum exists", () => {
    expect(schema).toMatch(/enum CommissionType \{[\s\S]*?NONE[\s\S]*?PERCENT[\s\S]*?FIXED/)
  })
})

// ------------------------------------------------------------
// 4. SOURCE — every creation path uses the SAME helper
// ------------------------------------------------------------

describe("#79 — one helper, three creation paths, no drift", () => {
  it("createAppointment resolves the deposit from the rule", () => {
    const src = read("src/app/actions/appointments.ts")
    expect(src).toContain("resolveDepositForServices(services,")
    // the old flat number is gone
    expect(src).not.toContain("depositAmount = isEmployeeBooking ? 0 : config.bookingDeposit")
  })

  it("getServicesForBooking selects the deposit rule fields", () => {
    const src = read("src/app/actions/appointments.ts")
    expect(src).toMatch(/getServicesForBooking[\s\S]*?depositType: true[\s\S]*?depositValue: true/)
  })

  it("Stripe checkout uses the helper and ships the deposit in metadata", () => {
    const src = read("src/app/actions/stripe.ts")
    expect(src).toContain("resolveDepositForServices(services, depositRule)")
    expect(src).toMatch(/depositAmount: depositAmount\.toFixed\(2\)/)
  })

  it("verifyAndCreateAppointment and the webhook READ the metadata deposit", () => {
    const stripe = read("src/app/actions/stripe.ts")
    expect(stripe).toMatch(/metadata\.depositAmount/)
    const webhook = read("src/app/api/webhooks/stripe/route.ts")
    expect(webhook).toMatch(/metadata\.depositAmount/)
  })

  it("the admin-creates-for-guest hole is closed (no employee discount for guest bookings)", () => {
    const src = read("src/app/actions/stripe.ts")
    expect(src).toMatch(/"STAFF", "ADMIN"\]\.includes\(session\.user\.role\) &&\s*\n\s*!data\.guestName/)
  })
})

// ------------------------------------------------------------
// 5. SOURCE — tips never merge into service revenue
// ------------------------------------------------------------

describe("#79 — tips and commissions are SEPARATE lines", () => {
  it("staffPerformance aggregates tips and commission as own columns", () => {
    const src = read("src/app/actions/analytics.ts")
    expect(src).toMatch(/const tips = apt\.tipAmount\?\.toNumber\(\) \?\? 0/)
    expect(src).toMatch(/const commission = apt\.commissionAmount\?\.toNumber\(\) \?\? 0/)
  })

  it("the StaffPerformance type carries them separately", () => {
    const src = read("src/lib/interfaces/analytics.ts")
    expect(src).toMatch(/interface StaffPerformance \{[\s\S]*?tips: number[\s\S]*?commission: number/)
  })

  it("the chart renders them as their own categories", () => {
    const chart = read("src/components/analytics/staff-performance-chart.tsx")
    expect(chart).toMatch(/Tips: staff\.tips/)
    expect(chart).toMatch(/Commission: staff\.commission/)
  })

  it("recording a tip is org-scoped for both appointments and orders", () => {
    const appt = read("src/app/actions/appointments.ts")
    expect(appt).toContain("export async function recordAppointmentTip")
    expect(appt).toMatch(/recordAppointmentTip[\s\S]*?organizationId: org\.id/)
    const orders = read("src/app/actions/orders.ts")
    expect(orders).toContain("export async function recordOrderTip")
    expect(orders).toMatch(/recordOrderTip[\s\S]*?organizationId: org\.id/)
  })
})

// ------------------------------------------------------------
// 6. SOURCE — commission freezes ONCE
// ------------------------------------------------------------

describe("#79 — commissionAmount is written once, never rewritten", () => {
  const src = read("src/app/actions/appointments.ts")

  it("COMPLETED writes commission only when it is still null", () => {
    expect(src).toMatch(
      /status === "COMPLETED" &&\s*\n\s*appointmentDetails\.commissionAmount === null/
    )
    expect(src).toMatch(/commissionAmount: commissionFreeze \?\? 0/)
  })

  it("computes from the staff rule (not from the client)", () => {
    expect(src).toMatch(/prisma\.staff\.findUnique\(\{\s*\n\s*where: \{ id: appointmentDetails\.staffId \}/)
  })
})

// ------------------------------------------------------------
// 7. SOURCE — the owner can SET the rule
// ------------------------------------------------------------

describe("#79 — settings and forms expose the rule", () => {
  it("service form has the deposit type + value fields", () => {
    const form = read("src/components/dashboard/service-form.tsx")
    expect(form).toMatch(/id="depositType"/)
    expect(form).toMatch(/id="depositValue"/)
    expect(form).toMatch(/name="depositType"/)
  })

  it("settings form has the org deposit TYPE selector", () => {
    const form = read("src/components/dashboard/settings-form.tsx")
    expect(form).toMatch(/id="bookingDepositType"/)
  })

  it("staff form exposes the commission rule", () => {
    const form = read("src/components/dashboard/staff-form.tsx")
    expect(form).toMatch(/id="commissionType"/)
    expect(form).toMatch(/id="commissionValue"/)
  })

  it("the client summary computes the deposit with the SAME pure helper", () => {
    const card = read("src/components/booking/booking-summary-card.tsx")
    expect(card).toContain('from "@/lib/booking/deposit"')
    expect(card).toContain("resolveDeposit(")
    expect(card).not.toMatch(/fmt\(salonConfig\.bookingDeposit\)/)
  })

  it("updateSalonSettings persists the deposit type", () => {
    const input = read("src/lib/interfaces.ts")
    expect(input).toMatch(/SalonSettingsInput \{[\s\S]*?bookingDepositType\?/)
    const form = read("src/components/dashboard/settings-form.tsx")
    expect(form).toMatch(/bookingDepositType: initialSettings\.bookingDepositType \?\? "FIXED"/)
  })
})
