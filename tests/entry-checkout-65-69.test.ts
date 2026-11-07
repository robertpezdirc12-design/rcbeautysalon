// ============================================================
// #65–#69 — ENTRY & CHECKOUT BATCH
//  #65 guest checkout + offline fallback (P1)
//  #66 platform landing on "/" + wizard deep-link (P1)
//  #67 owner bar on own site (P2)
//  #68 login branding via ?org= + neutral copy (P2)
//  #69 forms/workflows re-materialization on switch (P1)
// ============================================================

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { listProfileOptions } from "@/lib/profiles/registry"
import { PLANS } from "@/lib/plans/registry"
import { landingSl } from "@/lib/i18n/dict/landing"

const read = (p: string) => readFileSync(__dirname + "/../" + p, "utf8")

// ------------------------------------------------------------
// #69 — forms/workflows follow the activity
// ------------------------------------------------------------

describe("#69 — provenance + re-materialization on activity switch", () => {
  const materialize = read("src/lib/profiles/materialize.ts")

  it("source guard: created definitions carry sourceProfile provenance", () => {
    expect(materialize.match(/sourceProfile: profile\.id/g)?.length).toBe(2)
  })

  it("source guard: deactivation touches only foreign PROFILE-owned rows", () => {
    // owner rows (sourceProfile = null) are never deactivated
    expect(materialize).toContain("sourceProfile: { not: null, notIn: keep }")
    // never delete — only isActive: false
    expect(materialize).toContain("data: { isActive: false }")
    expect(materialize).not.toContain("formDefinition.delete")
    expect(materialize).not.toContain("workflowDefinition.delete")
  })

  it("source guard: the switch re-materializes + deactivates with primary+secondary", () => {
    const action = read("src/app/actions/site-content.ts")
    expect(action).toContain("materializeProfileAssets(org.id, preset.id)")
    expect(action).toContain("deactivateForeignProfileAssets(org.id, [")
    expect(action).toContain("org.secondaryVertical ?? \"\"")
  })

  it("source guard: the switch dialog previews asset changes", () => {
    const action = read("src/app/actions/site-content.ts")
    expect(action).toContain("export async function previewVerticalSwitch")
    const editor = read("src/components/dashboard/branding-editor.tsx")
    expect(editor).toContain("previewVerticalSwitch")
    expect(editor).toContain("assetsReplaced")
  })

  it("migration: sourceProfile backfill pairs + offline paymentMethod", () => {
    const sql = read(
      "prisma/migrations/20261127000000_p69_p65_asset_provenance_offline_orders/migration.sql"
    )
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "sourceProfile" TEXT')
    expect(sql).toContain('"paymentMethod" TEXT NOT NULL DEFAULT \'online\'')
    // conservative name-scoped backfill for every profile that ships assets
    for (const pair of [
      "('cosmetica', 'consultation')",
      "('seamstress', 'order-details')",
      "('seamstress', 'measurements')",
      "('seamstress', 'production-order')",
      "('tire-service', 'vehicle-intake')",
      "('tire-service', 'work-order')",
      "('beekeeping', 'harvest-record')",
    ]) {
      expect(sql).toContain(pair)
    }
  })

  it("schema: public form selection is deterministic via isActive after deactivation", () => {
    const forms = read("src/app/actions/forms.ts")
    expect(forms).toContain("where: { organizationId: org.id, isActive: true }")
  })
})

// ------------------------------------------------------------
// #66 — "/" is the product, not the oldest tenant
// ------------------------------------------------------------

describe("#66 — platform landing + wizard deep-link", () => {
  it("proxy: bare '/' no longer 308-redirects to a tenant", () => {
    const proxy = read("src/proxy.ts")
    const line = proxy
      .split("\n")
      .find((l) => l.startsWith("const BARE_PUBLIC_PATH"))
    expect(line).toBeDefined()
    // The old regex had an explicit bare-root alternative ("^\/$|") —
    // it must be GONE so the platform root reaches the landing page.
    expect(line).not.toContain("^\\/$|")
    // The alternatives still cover the content paths (tenant dedupe).
    // #98: vrsta (walk-in) se pridruži — ista vrata, isti protokol.
    expect(line).toContain("(services|staff|shop|booking|cart|inquiry|vrsta)")
  })

  it("home page: platform branch — landing za VSE, prijavljen dobi Moja plošča (lastnik 7. 11. 2026)", () => {
    const page = read("src/app/(public)/page.tsx")
    expect(page).toContain("PlatformLanding")
    expect(page).toContain("isTenantContext")
    // lastnik: "MARKEC je glavna naša stran na vercelu" — prijavljen
    // lastnik NE sme biti preusmerjen z golih "/" na najemnika (prej:
    // permanentRedirect 308, brskalnik ga zapisal — izložba zanje ni
    // obstajala). Vrstica za prijavo je zdaj "Moja plošča" → /dashboard.
    expect(page).toContain('? "/dashboard"')
    expect(page).toContain("VEDNO pokaže VSTOPNO reklamo")
    expect(page).not.toContain("keeps its existing behavior")
    expect(page).toContain("platform root + logged-in owner")
  })

  it("layout: platform root renders WITHOUT tenant chrome", () => {
    const layout = read("src/app/(public)/layout.tsx")
    expect(layout).toContain("isTenantContext")
    expect(layout).toContain("<PublicI18nProvider org={null}>")
  })

  // Owner decision 7. 11. 2026: "teh 6 so samo primeri univerzalna lahko
  // umaknes". The showcase is now a SAMPLE of 5 real profiles, not the
  // full 12-profile taxonomy; `generic` stays in StartWizard only.
  it("landing shows 5 real sample activities with wizard deep links", () => {
    const landing = read("src/components/landing/platform-landing.tsx")
    expect(landing).toContain("/start?vertical=")
    expect(landing).not.toContain("listProfileOptions()")

    const ids = listProfileOptions().map((v) => v.id)
    // #100-nadaljevanje: 11 → 12 (dodan profil "mehanik" / Avtomehanik).
    expect(ids.length).toBe(12)
    expect(ids).toContain("seamstress")
    expect(ids).toContain("beekeeping")
    expect(ids).toContain("mehanik")

    const examples = landingSl.examples.items
    expect(examples).toHaveLength(5)
    expect(examples.map((e) => e.vertical)).not.toContain("generic")
    for (const example of examples) {
      expect(ids, `${example.vertical} must be a real profile`).toContain(
        example.vertical
      )
      expect(example.alt.trim().length).toBeGreaterThan(0)
    }

    // plans section is registry-driven (no hardcoded pricing)
    expect(landing).toContain("PLANS")
    for (const plan of Object.values(PLANS)) {
      expect(plan.label).toBeTruthy()
    }
  })

  it("wizard deep-link: validated preselect, unknown ids ignored safely", () => {
    const page = read("src/app/(auth)/start/page.tsx")
    // unknown vertical → getVertical falls back to generic → id mismatch → null
    expect(page).toContain("getVertical(vertical).id === vertical")
    expect(page).toContain("initialVertical={initialVertical}")
    const wizard = read("src/components/onboarding/start-wizard.tsx")
    expect(wizard).toContain("useState<string | null>(initialVertical)")
  })

  it("metadata is trade-neutral (no 'salon')", () => {
    const start = read("src/app/(auth)/start/page.tsx")
    expect(start).toContain("Ustvari svoje podjetje")
    expect(start).not.toMatch(/title: ".*salon/i)
  })
})

// ------------------------------------------------------------
// #67 — owner bar on their own public site
// ------------------------------------------------------------

describe("#67 — OwnerBar", () => {
  it("layout resolves the owner server-side and renders conditionally", () => {
    const layout = read("src/app/(public)/layout.tsx")
    expect(layout).toContain("session.user.organizationId === org.id")
    expect(layout).toContain("hasUnpublishedChanges(")
    expect(layout).toContain("{ownerBar}")
    // conditional RENDER only — never a CSS-hidden bar that leaks into HTML
    expect(layout).not.toContain("hidden ownerBar")
  })

  it("bar links back to edit + dashboard and dismisses per session", () => {
    const bar = read("src/components/public/owner-bar.tsx")
    expect(bar).toContain("sessionStorage")
    expect(bar).toContain('"/dashboard/settings"')
    expect(bar).toContain('"/dashboard"')
    expect(bar).toContain("Osnutek je novejši od objavljenega")
  })
})

// ------------------------------------------------------------
// #68 — login branding follows the explicit tenant
// ------------------------------------------------------------

describe("#68 — login carries the tenant, never the oldest one", () => {
  it("footer login link carries ?org=<slug>", () => {
    const footer = read("src/components/layouts/footer.tsx")
    expect(footer).toContain("/login?org=${encodeURIComponent(slug)}")
    // the platform-auth link is exempt from tenant prefixing
    expect(footer).toContain("isPlatformAuthHref")
  })

  it("login page validates the org param against the DB and NEVER uses getPublicOrg", () => {
    const page = read("src/app/(auth)/login/page.tsx")
    expect(page).toContain("searchParams")
    expect(page).toContain("findFirst")
    expect(page).toContain('status: "ACTIVE"')
    // the getPublicOrg fallback must not be CALLED (comments may mention it)
    expect(page).not.toContain("await getPublicOrg")
  })

  it("provider CTA is trade-neutral in BOTH languages", () => {
    const dict = read("src/lib/i18n/dict/auth.ts")
    expect(dict).toContain('ownSalon: "Imate svoje podjetje?"')
    expect(dict).toContain('ownSalon: "Own a business?"')
    expect(dict).not.toContain('ownSalon: "Imate svoj salon?"')
    const form = read("src/components/auth/login-form.tsx")
    expect(form).toContain("Ustvari svoje podjetje")
  })
})

// ------------------------------------------------------------
// #65 — guest checkout + offline fallback
// ------------------------------------------------------------

describe("#65 — the shop can actually sell", () => {
  it("action: guests check out with contact details (account optional)", () => {
    const action = read("src/app/actions/product-checkout.ts")
    expect(action).toContain("export interface CheckoutContact")
    expect(action).toContain("const guest = !session?.user")
    // guests WITH Stripe go through the hosted page too
    expect(action).toContain("contact?.email?.trim() || undefined")
    // org-scoped guest identity: e-mail first; phone alone never adopts
    // an existing customer's identity (#70 — QIGC3TJU regression)
    expect(action).toContain("resolveGuestCustomerId")
    expect(action).toContain('email: { equals: email, mode: "insensitive" }')
    expect(action).not.toContain("OR: orConditions")
  })

  it("action: no Stripe still creates a recorded order (offline)", () => {
    const action = read("src/app/actions/product-checkout.ts")
    expect(action).toContain('paymentMethod: "offline"')
    expect(action).toContain("guestName:")
    expect(action).toContain("guestEmail:")
    expect(action).toContain("guestPhone:")
    expect(action).toContain("contactPhone: shopConfig?.phone ?? null")
    expect(action).toContain("contactEmail: shopConfig?.email ?? null")
  })

  it("schema: Order supports guests and offline payment", () => {
    const schema = read("prisma/schema.prisma")
    expect(schema).toContain("guestName")
    expect(schema).toContain("guestEmail")
    expect(schema).toContain("guestPhone")
    expect(schema).toContain('paymentMethod String @default("online")')
  })

  it("cart: guest form replaces the login wall; confirmation screen with tel:/mailto:", () => {
    const cart = read("src/components/shop/cart-content.tsx")
    expect(cart).toContain('id="guest-name"')
    expect(cart).toContain('id="guest-email"')
    expect(cart).toContain('id="guest-phone"')
    expect(cart).toContain("Račun ni obvezen")
    // confirmation — not a disappearing toast
    expect(cart).toContain("Številka naročila")
    expect(cart).toContain("tel:")
    expect(cart).toContain("mailto:")
  })

  it("dashboard: offline orders carry a 'Po povzetju' badge (both languages)", () => {
    const dict = read("src/lib/i18n/dict/orders.ts")
    expect(dict).toContain('offlineBadge: "Po povzetju"')
    expect(dict).toContain('offlineBadge: "Pay on pickup"')
    const page = read("src/app/(admin)/dashboard/orders/page.tsx")
    expect(page).toContain('paymentMethod === "offline"')
  })
})
