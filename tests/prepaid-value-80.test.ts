// ============================================================
// #80 — PREPAID VALUE: gift cards, session packages, liability.
//
// Layers:
//   1. SOURCE — schema (one primitive, zero-loss migration via
//      @@map), tenant-scoped sale/redeem paths, idempotent
//      activation, DB-level double-redemption guards.
//   2. SOURCE — the public flows: gift card sale (Stripe + offline),
//      checkout redemption (full + partial), package session
//      consumption, liability card, separate analytics lines.
// ============================================================

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8")
const schema = read("prisma/schema.prisma")

// ------------------------------------------------------------
// 1. SCHEMA — one primitive, zero-loss migration
// ------------------------------------------------------------

describe("#80 schema — one prepaid primitive", () => {
  it("PrepaidKind has GIFT_CARD, PACKAGE and MEMBERSHIP", () => {
    expect(schema).toMatch(
      /enum PrepaidKind \{[\s\S]*?GIFT_CARD[\s\S]*?PACKAGE[\s\S]*?MEMBERSHIP/
    )
  })

  it("PrepaidProduct carries kind, faceValue, sessionCount, validityDays", () => {
    expect(schema).toMatch(/model PrepaidProduct \{[\s\S]*?kind\s+PrepaidKind @default\(PACKAGE\)/)
    expect(schema).toMatch(/model PrepaidProduct \{[\s\S]*?faceValue\s+Decimal\?/)
    expect(schema).toMatch(/model PrepaidProduct \{[\s\S]*?sessionCount\s+Int\?/)
    expect(schema).toMatch(/model PrepaidProduct \{[\s\S]*?validityDays\s+Int\?/)
  })

  it("PrepaidProduct maps to the Package table — ids survive with zero data migration", () => {
    expect(schema).toMatch(/@@map\("Package"\)/)
  })

  it("PrepaidPurchase: globally unique code, balance, sessionsLeft, status", () => {
    expect(schema).toMatch(/model PrepaidPurchase \{[\s\S]*?code\s+String\s+@unique/)
    expect(schema).toMatch(/model PrepaidPurchase \{[\s\S]*?balance\s+Decimal\s+@default\(0\)/)
    expect(schema).toMatch(/model PrepaidPurchase \{[\s\S]*?sessionsLeft\s+Int\?/)
    expect(schema).toMatch(
      /model PrepaidPurchase \{[\s\S]*?status\s+String\s+@default\("PENDING"\)/
    )
  })

  it("PrepaidRedemption: DB-level guards against double redemption", () => {
    expect(schema).toMatch(/@@unique\(\[prepaidPurchaseId, orderId\]\)/)
    expect(schema).toMatch(/@@unique\(\[prepaidPurchaseId, appointmentId\]\)/)
  })

  it("memberships are reserved but NOT shipped (enum exists, UI forbids)", () => {
    const catalog = read("src/app/actions/catalog.ts")
    expect(catalog).toMatch(/kind === "MEMBERSHIP"\) return \{ ok: false, error: "MEMBERSHIP_NOT_AVAILABLE" \}/)
  })
})

// ------------------------------------------------------------
// 2. SALE — org-scoped, idempotent activation
// ------------------------------------------------------------

describe("#80 sale — the gift card can be bought", () => {
  const prepaid = read("src/app/actions/prepaid.ts")

  it("the public sale resolves the tenant and only active GIFT_CARD products", () => {
    expect(prepaid).toMatch(
      /createGiftCardCheckoutSession[\s\S]*?organizationId: org\.id,\s*\n\s*kind: "GIFT_CARD",\s*\n\s*isActive: true/
    )
  })

  it("online sale creates PENDING and activates IDEMPOTENTLY on payment", () => {
    expect(prepaid).toMatch(/status: "PENDING"/)
    const activation = prepaid.slice(prepaid.indexOf("export async function activatePrepaidPurchase"))
    expect(activation).toContain('where: { id: pending.id, status: "PENDING" }')
  })

  it("offline sale (salon without Stripe) creates the purchase ACTIVE with a code", () => {
    expect(prepaid).toMatch(/status: "ACTIVE",\s*\n\s*purchasedAt: new Date\(\)/)
    expect(prepaid).toContain("generateGiftCardCode()")
  })

  it("the code email carries the code + face value", () => {
    const email = read("src/lib/email/gift-card.ts")
    expect(email).toContain("sendGiftCardEmail")
    expect(email).toMatch(/code,\s*\n\s*faceValue/)
  })

  it("the webhook handles metadata.type prepaid_purchase", () => {
    const webhook = read("src/app/api/webhooks/stripe/route.ts")
    expect(webhook).toMatch(/metadata\.type === "prepaid_purchase"/)
    expect(webhook).toContain("activatePrepaidPurchase(session.id)")
  })

  it("the success page re-activates (fallback) and shows the code", () => {
    const page = read("src/app/(customer)/shop/gift/success/page.tsx")
    expect(page).toContain("activatePrepaidPurchase(sessionId)")
    expect(page).toContain("purchase.code")
  })
})

// ------------------------------------------------------------
// 3. REDEMPTION — org-scoped, never double
// ------------------------------------------------------------

describe("#80 redemption — the code reduces a later order", () => {
  const checkout = read("src/app/actions/product-checkout.ts")
  const prepaid = read("src/app/actions/prepaid.ts")

  it("checkout validates the code org-scoped; a foreign tenant's code is REJECTED", () => {
    expect(checkout).toMatch(/purchase\.organizationId !== org\.id/)
    expect(checkout).toContain("Ta darilni bon ni iz te trgovine")
  })

  it("exhausted, expired, pending and refunded cards are rejected with human messages", () => {
    for (const status of ["PENDING", "EXHAUSTED", "REFUNDED"]) {
      expect(checkout).toMatch(new RegExp(`status === "${status}"`))
    }
    expect(checkout).toContain("je potekel")
  })

  it("full coverage pays the order WITHOUT Stripe (PAID + redemption + stock, one transaction)", () => {
    expect(checkout).toContain('paymentMethod: "giftcard"')
    const body = checkout.slice(checkout.indexOf("if (giftCard?.fullCoverage)"))
    expect(body).toContain("prisma.$transaction")
    expect(body).toMatch(/status: "PAID"/)
    expect(body).toMatch(/prepaidRedemption\.create/)
    expect(body).toMatch(/source: "ORDER"/)
  })

  it("partial coverage charges the REMAINDER via Stripe and redeems on payment", () => {
    expect(checkout).toMatch(/unit_amount: Math\.round\(\(total - giftCard\.applied\) \* 100\)/)
    expect(checkout).toMatch(/giftCardCode: giftCard\.code/)
  })

  it("webhook + verify share ONE idempotent redeem helper", () => {
    expect(prepaid).toContain("export async function redeemGiftCardForOrder")
    const webhook = read("src/app/api/webhooks/stripe/route.ts")
    expect(webhook).toContain("redeemGiftCardForOrder(")
    expect(checkout).toContain("redeemGiftCardForOrder(")
    // the helper checks the per-order redemption BEFORE touching the balance
    const helper = prepaid.slice(prepaid.indexOf("export async function redeemGiftCardForOrder"))
    expect(helper).toMatch(/redemptions\.length > 0/)
  })

  it("balance reaching zero flips the purchase to EXHAUSTED", () => {
    const helper = prepaid.slice(prepaid.indexOf("export async function redeemGiftCardForOrder"))
    expect(helper).toMatch(/nextBalance <= 0 \? \{ status: "EXHAUSTED" \}/)
  })
})

// ------------------------------------------------------------
// 4. PACKAGES — sessions consumed exactly once
// ------------------------------------------------------------

describe("#80 packages — booking consumes a session", () => {
  const appts = read("src/app/actions/appointments.ts")

  it("createAppointment finds the buyer's active package (customer OR guest email)", () => {
    expect(appts).toMatch(/prepaidProduct: \{ kind: "PACKAGE" \}/)
    expect(appts).toMatch(/guestEmail: data\.guestEmail\.toLowerCase\(\)/)
  })

  it("the decrement is ATOMIC (updateMany with sessionsLeft > 0) — double submit cannot consume two", () => {
    expect(appts).toMatch(
      /where: \{\s*\n\s*id: matching\.id,\s*\n\s*status: "ACTIVE",\s*\n\s*sessionsLeft: \{ gt: 0 \}/
    )
    expect(appts).toMatch(/sessionsLeft: \{ decrement: 1 \}/)
  })

  it("a covered booking needs NO deposit and lands CONFIRMED", () => {
    expect(appts).toMatch(/depositAmount = 0\s*\n\s*depositPaid = true\s*\n\s*appointmentStatus = "CONFIRMED"/)
  })

  it("the redemption row is unique per appointment (DB guard)", () => {
    expect(appts).toMatch(/prepaidRedemption\s*\n?\s*\.create\(\{[\s\S]*?appointmentId: appointment\.id/)
  })

  it("reaching zero sessions marks the purchase EXHAUSTED", () => {
    expect(appts).toMatch(/updated\?\.sessionsLeft === 0/)
  })

  it("dashboard sale records sessionsLeft from sessionCount (sellPrepaid)", () => {
    const prepaid = read("src/app/actions/prepaid.ts")
    expect(prepaid).toMatch(
      /sessionsLeft:\s*\n?\s*product\.kind === "PACKAGE" \? \(product\.sessionCount \?\? 0\) : null/
    )
  })
})

// ------------------------------------------------------------
// 5. LIABILITY + ANALYTICS — prepaid is honest
// ------------------------------------------------------------

describe("#80 liability + analytics — money received up front is not profit", () => {
  it("getPrepaidLiability sums ACTIVE gift card balances and package sessions", () => {
    const prepaid = read("src/app/actions/prepaid.ts")
    const fn = prepaid.slice(prepaid.indexOf("export async function getPrepaidLiability"))
    expect(fn).toMatch(/kind: "GIFT_CARD"/)
    expect(fn).toMatch(/sessionsLeft/)
    expect(fn).toContain("estimatedSessionValue")
  })

  it("the dashboard shows the liability card", () => {
    const page = read("src/app/(admin)/dashboard/packages/page.tsx")
    expect(page).toContain("getPrepaidLiability()")
    expect(page).toContain("liabilityTitle")
  })

  it("revenue chart has prepaid as its own series; redemptions are separate, not revenue", () => {
    const analytics = read("src/app/actions/analytics.ts")
    expect(analytics).toMatch(/prepaidPurchase\.findMany/)
    expect(analytics).toMatch(/prepaidRedemption\.findMany/)
    const type = read("src/lib/interfaces/analytics.ts")
    expect(type).toMatch(/prepaid: number[\s\S]*?redemptions: number/)
    const chart = read("src/components/analytics/revenue-chart.tsx")
    expect(chart).toMatch(/categories=\{\["appointments", "products", "prepaid"\]\}/)
  })
})

// ------------------------------------------------------------
// 6. UI — the shop exposes gift cards; the cart accepts codes
// ------------------------------------------------------------

describe("#80 UI — the flows are reachable", () => {
  it("the public shop has a gift card section", () => {
    const page = read("src/app/(customer)/shop/page.tsx")
    expect(page).toContain("GiftCardSection")
    expect(page).toContain("getPublicGiftCards()")
  })

  it("the cart has a gift card code field with per-rejection messages", () => {
    const cart = read("src/components/shop/cart-content.tsx")
    expect(cart).toContain('id="gift-card-code"')
    expect(cart).toContain("validateGiftCard")
    expect(cart).toContain("Ta darilni bon ni iz te trgovine")
  })

  it("the packages client offers kind + sell (offline sale dialog)", () => {
    const client = read("src/components/admin/catalog/packages-client.tsx")
    expect(client).toMatch(/id="pkg-kind"/)
    expect(client).toContain("sellPrepaid(")
  })

  it("the sold instances table shows codes and remaining balance/sessions", () => {
    const page = read("src/app/(admin)/dashboard/packages/page.tsx")
    expect(page).toContain("purchasesTitle")
    expect(page).toMatch(/pu\.code/)
  })
})
