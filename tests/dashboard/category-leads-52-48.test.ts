// ============================================================
// P3 #52 + P2 #48 — pure rules: category picker zero-state,
// category name validation and the lead search filter.
// ============================================================

import { describe, it, expect } from "vitest"
import {
  categoryPickerMode,
  normalizeCategoryName,
} from "@/lib/dashboard/category-picker"
import { buildLeadSearchWhere } from "@/lib/customers/leads"

describe("#52 — category picker zero state", () => {
  it("0 categories → empty state (explanation + create action)", () => {
    expect(categoryPickerMode(0)).toBe("empty")
  })
  it("≥1 category → select", () => {
    expect(categoryPickerMode(1)).toBe("select")
    expect(categoryPickerMode(7)).toBe("select")
  })
})

describe("#52 — normalizeCategoryName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeCategoryName("  Medi   z livado  ")).toEqual({
      ok: true,
      name: "Medi z livado",
    })
  })
  it("rejects < 2 chars", () => {
    expect(normalizeCategoryName(" M ")).toEqual({
      ok: false,
      reason: "too-short",
    })
  })
  it("rejects > 60 chars", () => {
    expect(normalizeCategoryName("x".repeat(61))).toEqual({
      ok: false,
      reason: "too-long",
    })
  })
})

describe("#48 — lead search filter (customers without an account)", () => {
  it("no search → org-scoped, user-less only", () => {
    const where = buildLeadSearchWhere("org1")
    expect(where).toEqual({ organizationId: "org1", user: null })
  })
  it("blank search behaves like none", () => {
    expect(buildLeadSearchWhere("org1", "   ")).toEqual({
      organizationId: "org1",
      user: null,
    })
  })
  it("search covers name, email AND phone", () => {
    const where = buildLeadSearchWhere("org1", "medved")
    expect(where.organizationId).toBe("org1")
    expect(where.user).toBeNull()
    const or = where.OR as Array<Record<string, unknown>>
    expect(or).toHaveLength(3)
    expect(JSON.stringify(or)).toContain('"name"')
    expect(JSON.stringify(or)).toContain('"email"')
    expect(JSON.stringify(or)).toContain('"phone"')
  })
})
