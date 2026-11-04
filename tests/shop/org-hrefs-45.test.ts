// ============================================================
// P1 #45 — tenant-aware hrefs in shop/account surfaces
//
// Klient komponente, ki živijo POD najemniško potjo (/s/[slug]/…),
// ne smejo povezovati golih javnih poti ("/shop", "/services", …):
// strežniški proxy golo pot prepiše na PRIVZETEGA najemnika, tako da
// kupec čebelarja po kliku "Nadaljuj z nakupovanjem" pristane v
// trgovini drugega podjetja. Vsaka javna povezava mora iti skozi
// useOrgPrefix() / orgPath() — izjeme so samo platformske poti
// (prijava, registracija, dashboard, /start), ki so namenoma najemniško
// nevtralne.
// ============================================================

import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/** Platform routes that are intentionally org-agnostic (never prefixed). */
const PLATFORM_HREFS = [
  "/login",
  "/register",
  "/dashboard",
  "/staff-portal",
  "/start",
  "/my-account",
  "/api/",
]

/** Tenant-scoped public routes that MUST always carry the org prefix. */
const TENANT_PUBLIC_ROUTES = [
  "shop",
  "cart",
  "services",
  "booking",
  "inquiry",
  "staff",
  "my-orders",
  "my-appointments",
  "my-reviews",
  // #53: legal pages are tenant-scoped (canonical /s/{slug}/privacy) —
  // a bare /privacy renders the DEFAULT tenant as the data controller.
  "privacy",
  "terms",
  "cookies",
]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full)
  }
  return out
}

/**
 * Extracts literal href="/…" values AND template hrefs. Template hrefs
 * like `${orgPrefix}/shop` are fine — a bare template `/shop` (no prefix
 * expression) is a violation.
 */
function bareTenantHrefs(source: string): string[] {
  const violations: string[] = []
  const literal = /href\s*=\s*"(\/[^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = literal.exec(source)) !== null) {
    const href = m[1]
    const isPlatform = PLATFORM_HREFS.some(
      (p) => href === p || href.startsWith(p)
    )
    const isTenantRooted = href.startsWith("/s/")
    if (
      !isPlatform &&
      !isTenantRooted &&
      TENANT_PUBLIC_ROUTES.some(
        (r) =>
          href === `/${r}` ||
          href.startsWith(`/${r}/`) ||
          href.startsWith(`/${r}?`) ||
          href.startsWith(`/${r}#`)
      )
    ) {
      violations.push(href)
    }
  }
  // Template form: href={`/shop/...`} — a template that starts with a
  // public route segment but has NO org prefix expression in front.
  const template = /href\s*=\s*\{`([^`]*)`\}/g
  while ((m = template.exec(source)) !== null) {
    const href = m[1]
    if (href.includes("${orgPrefix}") || href.includes("${orgPath")) continue
    if (
      TENANT_PUBLIC_ROUTES.some(
        (r) => href === `/${r}` || href.startsWith(`/${r}/`)
      )
    ) {
      violations.push(href)
    }
  }
  return violations
}

const ROOTS = [
  join(__dirname, "../../src/components/shop"),
  join(__dirname, "../../src/components/account"),
  // #53: shared layouts (footer/navbar) render on EVERY tenant page —
  // a bare href there leaks the default tenant into every tenant's site.
  join(__dirname, "../../src/components/layouts"),
]

describe("#45 — no bare tenant-public hrefs in shop/account components", () => {
  it("every tenant-public link carries the org prefix", () => {
    const problems: string[] = []
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        for (const href of bareTenantHrefs(readFileSync(file, "utf8"))) {
          problems.push(
            `${file.replace(/.*src\/components\//, "")} → "${href}"`
          )
        }
      }
    }
    expect(
      problems,
      `bare public hrefs would send customers to the DEFAULT tenant:\n${problems.join("\n")}`
    ).toEqual([])
  })

  it("the cart links are template-prefixed (regression lock on the original repro)", () => {
    const cart = readFileSync(
      join(__dirname, "../../src/components/shop/cart-content.tsx"),
      "utf8"
    )
    expect(cart).toContain("href={`${orgPrefix}/shop`}")
    // three occurrences: empty-state "Raziščite izdelke", "Nadaljuj z
    // nakupovanjem" + the offline-confirmation screen (#65)
    expect(cart.match(/href=\{`\$\{orgPrefix\}\/shop`\}/g)?.length).toBe(3)
  })

  it("orders + appointments summaries are prefixed too", () => {
    const orders = readFileSync(
      join(__dirname, "../../src/components/account/orders-summary.tsx"),
      "utf8"
    )
    expect(orders).toContain("href={`${orgPrefix}/shop`}")
    expect(orders).toContain("href={`${orgPrefix}/my-orders`}")
    const appts = readFileSync(
      join(__dirname, "../../src/components/account/appointments-summary.tsx"),
      "utf8"
    )
    expect(appts).toContain("href={`${orgPrefix}/services`}")
    expect(appts).toContain("href={`${orgPrefix}/my-appointments`}")
  })

  // #53 — footer legal links + navbar account links are tenant-scoped
  it("footer legal links go through orgPath, /login stays platform-level", () => {
    const footer = readFileSync(
      join(__dirname, "../../src/components/layouts/footer.tsx"),
      "utf8"
    )
    // rendered href must be wrapped, never the bare constant
    expect(footer).toContain("href={tenantScopedHref(slug, link.href)}")
    expect(footer).not.toMatch(/href="\/(privacy|terms|cookies)"/)
    // the only deliberately unprefixed link is the platform login —
    // which now CARRIES the tenant context (#68: /login?org=<slug>)
    expect(footer).toContain("isPlatformAuthHref(href) ? href : orgPath(slug, href)")
    expect(footer).toContain("/login?org=${encodeURIComponent(slug)}")
  })

  it("navbar account links (my-*) are prefixed on desktop and mobile", () => {
    const nav = readFileSync(
      join(__dirname, "../../src/components/layouts/public-navbar.tsx"),
      "utf8"
    )
    expect(nav).not.toMatch(/href="\/my-(appointments|orders|reviews)"/)
    // 3 desktop dropdown items + 3 mobile rows = 6 prefixed occurrences
    expect(nav.match(/orgPath\(org\.slug, "\/my-/g)?.length).toBe(6)
  })
})
