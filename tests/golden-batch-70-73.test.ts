// ============================================================
// #70–#73 — GOLDEN BATCH (guest order identity, order detail,
// platform neutrality decision, root OG + CRLF hygiene).
//
// W1 (#70): a guest order matched an existing customer by PHONE and
// the dashboard displayed that customer's identity — the owner replied
// to a person who never placed the order (QIGC3TJU).
// W2 (#71): every "Prikaži" on an order linked to a route that did not
// exist (404 in the public shell).
// W3 (#72): bare commerce paths still 308'd to the oldest tenant.
// W4 (#73): platform root had no og:*/canonical; source-guard tests
// broke on CRLF checkouts.
// ============================================================

import { describe, it, expect } from "vitest"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import {
  guestIdentityMatches,
  normalizeName,
} from "@/lib/checkout/guest-identity"
import { srcOf, normalizeSource } from "./helpers/source"

// ------------------------------------------------------------
// #70 — identity resolution (pure logic, unit)
// ------------------------------------------------------------

describe("#70 — guest identity matching", () => {
  it("normalizeName: case/whitespace insensitive", () => {
    expect(normalizeName("  Gost   Test Srna ")).toBe("gost test srna")
    expect(normalizeName("ANA NOVAK")).toBe("ana novak")
  })

  it("case 1: e-mail branch is handled by the e-mail-first lookup (source guard below); the phone-branch helper is strict about the NAME", () => {
    // same e-mail but a different name is NOT a phone-identity match —
    // a shared household mailbox must not merge two people either
    expect(
      guestIdentityMatches(
        { name: "Maja Novak", email: "skupni@domena.si" },
        { name: "Mojca Novak", email: "skupni@domena.si" }
      )
    ).toBe(false)
  })

  it("case 2: same phone, DIFFERENT identity → NOT linked (W1)", () => {
    // The QIGC3TJU defect: shared/recycled phone adopted a stranger's
    // identity. Same phone + different name + different e-mail → no.
    expect(
      guestIdentityMatches(
        { name: "Gost Test Srna", email: "gost.srna@example.com" },
        { name: "QA Gost 690165", email: "qa.gost@example.com" }
      )
    ).toBe(false)
  })

  it("case 3: same phone, same name, customer has no e-mail → linked", () => {
    expect(
      guestIdentityMatches(
        { name: "Peter Kos", email: null },
        { name: "peter  kos", email: "peter.kos@example.com" }
      )
    ).toBe(true)
  })

  it("case 3b: same phone, same name, different e-mail → NOT linked", () => {
    expect(
      guestIdentityMatches(
        { name: "Peter Kos", email: "peter@domena.si" },
        { name: "Peter Kos", email: "peter@druga.si" }
      )
    ).toBe(false)
  })

  it("source guard: checkout matches e-mail FIRST, phone never adopts alone", () => {
    const src = srcOf("src/app/actions/product-checkout.ts")
    // e-mail branch is the first lookup and is case-insensitive
    expect(src).toContain("resolveGuestCustomerId")
    const fnStart = src.indexOf("async function resolveGuestCustomerId")
    const fnEnd = src.indexOf("export async function createProductCheckoutSession")
    const fn = src.slice(fnStart, fnEnd)
    expect(fn).toContain("email: { equals: email, mode: \"insensitive\" }")
    // the old OR-match (phone OR e-mail, first hit wins) is gone
    expect(fn).not.toContain("OR: orConditions")
    // phone hit must pass the identity check, and the fallback is a pure guest order
    expect(fn).toContain("guestIdentityMatches(byPhone, contact)")
    expect(fn).toContain("return null")
    // no silent writes to an existing customer record from the guest form
    expect(fn).not.toContain("prisma.customer.create")
  })

  it("source guard: the ORDER's contact (guest fields) wins in list, CSV and detail", () => {
    const list = srcOf("src/app/(admin)/dashboard/orders/page.tsx")
    expect(list).toContain("order.guestName || order.customer?.name")
    expect(list).toContain("order.guestEmail || order.customer?.email")
    const csv = srcOf("src/components/dashboard/export-orders-button.tsx")
    expect(csv).toContain("order.guestName || order.customer?.name")
    expect(csv).toContain("order.guestEmail || order.customer?.email")
    const detail = srcOf("src/app/(admin)/dashboard/orders/[id]/page.tsx")
    expect(detail).toContain("order.guestName || order.customer?.name")
    expect(detail).toContain("order.guestEmail || order.customer?.email")
  })
})

// ------------------------------------------------------------
// #71 — order detail route with IDOR guard + dashboard not-found
// ------------------------------------------------------------

describe("#71 — /dashboard/orders/[id]", () => {
  it("detail page exists and renders through the org-scoped action", () => {
    const page = srcOf("src/app/(admin)/dashboard/orders/[id]/page.tsx")
    expect(page).toContain("getOrderById")
    expect(page).toContain("notFound()")
  })

  it("IDOR guard: findFirst scoped by organizationId, never findUnique({ id })", () => {
    const actions = srcOf("src/app/actions/orders.ts")
    const fnStart = actions.indexOf("export async function getOrderById")
    const fnEnd = actions.indexOf("export async function updateOrderStatus")
    const fn = actions.slice(fnStart, fnEnd)
    expect(fn).toContain("findFirst(")
    expect(fn).toContain("organizationId: org.id")
    expect(fn).not.toContain("findUnique(")
  })

  it("dashboard-level not-found exists (never the public shell)", () => {
    const nf = "src/app/(admin)/dashboard/not-found.tsx"
    expect(existsSync(path.resolve(__dirname, "..", nf))).toBe(true)
    const src = srcOf(nf)
    expect(src).toContain("t.common.notFound.title")
  })

  it("list page links to the detail route (no dead action)", () => {
    const list = srcOf("src/app/(admin)/dashboard/orders/page.tsx")
    expect(list).toContain('href={`/dashboard/orders/${order.id}`}')
  })
})

// ------------------------------------------------------------
// #72 — platform neutrality (Option A) + documented legacy rule
// ------------------------------------------------------------

describe("#72 — bare commerce paths never resolve to a default tenant", () => {
  it("proxy: legacy fallback only behind LEGACY_DEFAULT_SLUG, otherwise 404", () => {
    const proxy = srcOf("src/proxy.ts")
    const blockStart = proxy.indexOf("P2 #72 (Opcija A): gola javna pot")
    const blockEnd = proxy.indexOf("const isLoggedIn")
    const block = proxy.slice(blockStart, blockEnd)
    expect(block).toContain("LEGACY_DEFAULT_SLUG")
    expect(block).toContain("rewriteTo404(req)")
    expect(block).toContain("NextResponse.redirect(url, 308)")
    // no unconditional default-tenant redirect anymore
    expect(proxy).not.toContain("getDefaultTenantSlug")
  })

  it("legacy default-tenant-slug API is removed (no unauthenticated default slug)", () => {
    expect(
      existsSync(
        path.resolve(__dirname, "..", "src/app/api/public/default-tenant-slug")
      )
    ).toBe(false)
  })

  it("page-level redirectBareToTenant is fail-closed, opt-in legacy only", () => {
    const lib = srcOf("src/lib/public-site.ts")
    const fnStart = lib.indexOf("export async function redirectBareToTenant")
    const fn = lib.slice(fnStart, fnStart + 2200)
    expect(fn).toContain("opts: { allowDefaultTenant?: boolean } = {}")
    expect(fn).toContain("notFound()")
    // the fallback is gated behind the explicit opt-in flag
    expect(fn).toContain("opts.allowDefaultTenant")
  })

  it("no caller passes allowDefaultTenant: true today (decision stays neutral)", () => {
    const callers = [
      "src/app/(public)/page.tsx",
      "src/app/(public)/services/page.tsx",
      "src/app/(public)/services/[slug]/page.tsx",
      "src/app/(public)/staff/page.tsx",
      "src/app/(public)/staff/[name]/page.tsx",
      "src/app/(customer)/shop/page.tsx",
      "src/app/(customer)/shop/[slug]/page.tsx",
      "src/app/(customer)/booking/page.tsx",
      "src/app/(customer)/cart/page.tsx",
      "src/app/(customer)/inquiry/page.tsx",
    ]
    for (const c of callers) {
      expect(srcOf(c)).not.toContain("allowDefaultTenant: true")
    }
  })
})

// ------------------------------------------------------------
// #73 — root OG/canonical + CRLF-proof source guards
// ------------------------------------------------------------

describe("#73 — root metadata + hygiene", () => {
  it("platform root ships openGraph + canonical, drafts do not", () => {
    const layout = srcOf("src/app/layout.tsx")
    const branchStart = layout.indexOf("if (barePlatform) {")
    expect(branchStart).toBeGreaterThan(0)
    const branchEnd = layout.indexOf("const [config", branchStart)
    const branch = layout.slice(branchStart, branchEnd)
    expect(branch).toContain("alternates: { canonical: appUrl }")
    expect(branch).toContain('siteName: "MARKEC"')
    expect(branch).toContain('locale: "sl_SI"')
    expect(branch).toContain('type: "website"')
    // exactly ONE openGraph block in the layout — the platform branch;
    // the noindex draft branch ("MARKEC – MY BUSINESS PLATFORM") stays metadata-free
    expect(layout.match(/openGraph:/g)?.length).toBe(1)
    expect(layout).toContain("MARKEC – MY BUSINESS PLATFORM")
  })

  it("normalizeSource: CRLF input behaves like LF", () => {
    const crlf = "const a = 1;\r\nconst b = \"x\\n  y\";\r\nif (a) {\r\n  b();\r\n}\r\n"
    const lf = normalizeSource(crlf)
    expect(lf).not.toContain("\r")
    expect(lf).toBe('const a = 1;\nconst b = "x\\n  y";\nif (a) {\n  b();\n}\n')
    // slice-with-marker pattern that used to fail on CRLF now works
    const start = lf.indexOf("if (a) {")
    const end = lf.indexOf("b();")
    expect(lf.slice(start, end)).toContain("if (a) {")
  })

  it("meta guard: no test slices source with a marker containing a literal newline", () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, f.name)
        if (f.isDirectory()) walk(full)
        else if (f.name.endsWith(".test.ts")) files.push(full)
      }
    }
    walk(__dirname)
    expect(files.length).toBeGreaterThan(10)
    const re = /(?:indexOf|lastIndexOf)\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g
    const offending: string[] = []
    for (const f of files) {
      const raw = normalizeSource(readFileSync(f, "utf8"))
      for (const m of raw.matchAll(re)) {
        const lit = m[1] ?? m[2] ?? ""
        if (lit.includes("\\n") || lit.includes("\\r")) {
          offending.push(`${path.basename(f)}: ${lit.slice(0, 60)}`)
        }
      }
    }
    expect(offending).toEqual([])
  })
})
