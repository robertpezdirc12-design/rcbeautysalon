// ============================================================
// P2 #54 + P3 #55 + P3 #56 + P3 #57 — capability-gated settings,
// profile-aware growth copy, cart heading order, one lockfile.
//
// #54: the "Nastavitve rezervacij" card is dead UI for tenants whose
//      activity profile disables appointments (beekeeping) — the same
//      capability gate the public site applies to /booking (#46).
// #55: the growth card ("Priporočeni naslednji koraki") must promise a
//      flow that EXISTS on the tenant's own site — an order profile has
//      no /booking, so "Preizkusite rezervacijo" is impossible.
// #56: populated cart — item name was h3 directly under h1 (axe
//      heading-order).
// #57: exactly one package-manager lockfile, pnpm pinned via
//      packageManager, documented install path.
// ============================================================

import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

import { growthTestCopyKey } from "@/lib/profiles/setup-checklist"
import { getProfile, isCapabilityEnabled } from "@/lib/profiles/registry"
import { applyOverrides, parseOverrides } from "@/lib/profiles/overrides"
import { dashboardSl, dashboardEn } from "@/lib/i18n/dict/dashboard"

const ROOT = join(__dirname, "../..")

describe("#55 — growthTestCopyKey follows the CTA mode", () => {
  it("maps all four CTA modes", () => {
    expect(growthTestCopyKey("booking")).toBe("growthTest")
    expect(growthTestCopyKey("order")).toBe("growthTestOrder")
    expect(growthTestCopyKey("inquiry")).toBe("growthTestInquiry")
    expect(growthTestCopyKey("quote")).toBe("growthTestInquiry")
  })

  it("order profile never reads 'rezerv' — SL and EN dicts", () => {
    for (const d of [dashboardSl.setupChecklist, dashboardEn.setupChecklist]) {
      expect(d.growthTestOrderLabel).not.toMatch(/rezerv/i)
      expect(d.growthTestOrderDescription).not.toMatch(/rezerv/i)
      expect(d.growthTestInquiryLabel).not.toMatch(/rezerv/i)
      expect(d.growthTestInquiryDescription).not.toMatch(/rezerv/i)
      // order copy promises an ORDER, inquiry copy an INQUIRY
      expect(d.growthTestOrderLabel.toLowerCase()).toMatch(/naročilo|order/)
      expect(d.growthTestInquiryLabel.toLowerCase()).toMatch(/povpraševanje|inquiry/)
    }
  })

  it("booking profile copy is unchanged", () => {
    expect(dashboardSl.setupChecklist.growthTestLabel).toBe(
      "Preizkusite rezervacijo kot stranka"
    )
    expect(dashboardSl.setupChecklist.growthTestDescription).toContain(
      "rezerviraj termin"
    )
  })

  it("the component selects the dict entry via growthTestCopyKey", () => {
    const src = readFileSync(
      join(ROOT, "src/components/dashboard/setup-checklist.tsx"),
      "utf8"
    )
    expect(src).toContain("growthTestCopyKey(ctaMode)")
    // the growth card no longer renders the unconditional booking copy
    expect(src).not.toContain("{dict.growthTestLabel}")
    expect(src).not.toContain("{dict.growthTestDescription}")
  })
})

describe("#54 — booking settings card is capability-gated", () => {
  it("profiles without appointments are disabled by the capability matrix", () => {
    // beekeeping = order-only trade
    expect(getProfile("beekeeping").capabilities.appointments).toBe("disabled")
    expect(isCapabilityEnabled(getProfile("beekeeping"), "appointments")).toBe(
      false
    )
    // contrast: beauty keeps booking
    expect(isCapabilityEnabled(getProfile("beauty"), "appointments")).toBe(true)
    // owner override can only flip optional, never force a disabled module on
    const overridden = applyOverrides(
      getProfile("beekeeping"),
      parseOverrides({ appointments: "optional" })
    )
    expect(isCapabilityEnabled(overridden, "appointments")).toBe(false)
  })

  it("the settings form renders the card only when appointments are enabled", () => {
    const form = readFileSync(
      join(ROOT, "src/components/dashboard/settings-form.tsx"),
      "utf8"
    )
    // prop exists with an honest default (backward compatible)
    expect(form).toContain("appointmentsEnabled?: boolean")
    expect(form).toContain("appointmentsEnabled = true")
    // the booking card is behind the gate
    expect(form).toMatch(/appointmentsEnabled && \(\s*\n\s*<Card>/)
  })

  it("the settings page resolves the effective profile server-side", () => {
    const page = readFileSync(
      join(ROOT, "src/app/(admin)/dashboard/settings/page.tsx"),
      "utf8"
    )
    expect(page).toContain("getSessionEffectiveProfile")
    expect(page).toContain('isCapabilityEnabled(p, "appointments")')
    expect(page).toContain("appointmentsEnabled={appointmentsEnabled}")
  })
})

describe("#56 — populated cart heading order", () => {
  it("cart item name is an h2 (no h3 directly under the page h1)", () => {
    const src = readFileSync(
      join(ROOT, "src/components/shop/cart-item.tsx"),
      "utf8"
    )
    expect(src).toContain("<h2")
    expect(src).not.toMatch(/<h3[\s>]/)
    // visual size preserved
    expect(src).toMatch(/<h2 className="[^"]*text-base[^"]*"/)
  })

  it("cart content keeps the #51 fixes (no h3 anywhere)", () => {
    const src = readFileSync(
      join(ROOT, "src/components/shop/cart-content.tsx"),
      "utf8"
    )
    expect(src).not.toMatch(/<h3[\s>]/)
  })
})

describe("#57 — one lockfile, pinned package manager", () => {
  it("bun.lock is gone, pnpm-lock.yaml is the single lockfile", () => {
    expect(existsSync(join(ROOT, "bun.lock"))).toBe(false)
    expect(existsSync(join(ROOT, "pnpm-lock.yaml"))).toBe(true)
    // accidental copies committed inside src/ (8be9bb9) are gone too
    expect(existsSync(join(ROOT, "src/pnpm-lock.yaml"))).toBe(false)
    expect(existsSync(join(ROOT, "src/skills-lock.json"))).toBe(false)
  })

  it("packageManager pins pnpm@10.x", () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8")
    ) as { packageManager?: string }
    expect(pkg.packageManager).toMatch(/^pnpm@10\.\d+\.\d+$/)
  })

  it("README documents the pnpm install path and Node version", () => {
    const readme = readFileSync(join(ROOT, "README.md"), "utf8")
    expect(readme).toContain("pnpm install --frozen-lockfile")
    expect(readme).toContain("corepack enable")
    expect(readme).toContain("Node ≥ 20.9")
    expect(readme).not.toContain("bun.lock` je aktualen")
  })
})
