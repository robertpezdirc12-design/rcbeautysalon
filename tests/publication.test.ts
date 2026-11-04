import { describe, it, expect } from "vitest"
import {
  validatePublishRequirements,
  parsePublishState,
  PUBLISH_STATES,
} from "../src/lib/publication"

const baseInput = {
  orgName: "Krojna Atelje Vera",
  contactEmail: "info@example.si",
  contactPhone: null,
  serviceCount: 3,
  productCount: 2,
  capabilities: { services: "required", shop: "optional" } as const,
}

describe("validatePublishRequirements", () => {
  it("passes for a complete, catalog-ready tenant", () => {
    const r = validatePublishRequirements(baseInput)
    expect(r.ok).toBe(true)
    expect(r.errors).toHaveLength(0)
  })

  it("blocks publication when the org name is missing", () => {
    const r = validatePublishRequirements({ ...baseInput, orgName: "   " })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes("Ime podjetja"))).toBe(true)
  })

  it("blocks publication without any contact channel", () => {
    const r = validatePublishRequirements({
      ...baseInput,
      contactEmail: null,
      contactPhone: null,
    })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes("kontaktni"))).toBe(true)
  })

  it("accepts phone-only contact", () => {
    const r = validatePublishRequirements({
      ...baseInput,
      contactEmail: null,
      contactPhone: "+386 40 123 456",
    })
    expect(r.ok).toBe(true)
  })

  it("requires a service only when the services capability is REQUIRED", () => {
    const r = validatePublishRequirements({
      ...baseInput,
      serviceCount: 0,
      capabilities: { services: "required", shop: "disabled" },
    })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes("storitev"))).toBe(true)
  })

  it("does NOT block on OPTIONAL capabilities the owner does not use (seamstress shop)", () => {
    const r = validatePublishRequirements({
      ...baseInput,
      serviceCount: 7,
      productCount: 0,
      capabilities: { services: "required", shop: "optional" },
    })
    expect(r.ok).toBe(true)
  })

  it("beekeeping (services disabled) is not blocked by missing services; empty shop is a WARNING (#82)", () => {
    // products present → only the shop requirement matters, and it is satisfied
    const ok = validatePublishRequirements({
      ...baseInput,
      serviceCount: 0,
      productCount: 5,
      capabilities: { services: "disabled", shop: "required" },
    })
    expect(ok.ok).toBe(true)

    // P2 #82: products absent → the site still publishes; the empty shop is
    // a warning (the public site hides an empty shop section), never a blocker.
    const blocked = validatePublishRequirements({
      ...baseInput,
      serviceCount: 0,
      productCount: 0,
      capabilities: { services: "disabled", shop: "required" },
    })
    expect(blocked.ok).toBe(true)
    expect(blocked.errors.some((e) => e.includes("izdelek"))).toBe(false)
    expect(blocked.warnings.some((w) => w.toLowerCase().includes("trgovina"))).toBe(true)
  })

  it("empty shop on a REQUIRED shop capability warns instead of blocking (#82)", () => {
    const r = validatePublishRequirements({
      ...baseInput,
      productCount: 0,
      capabilities: { services: "disabled", shop: "required" },
    })
    expect(r.ok).toBe(true)
    expect(r.errors.some((e) => e.includes("izdelek"))).toBe(false)
    expect(r.warnings.some((w) => w.includes("prazna"))).toBe(true)
  })

  it("blocks on multiple requirements at once and lists all reasons (shop moved to warnings, #82)", () => {
    const r = validatePublishRequirements({
      orgName: "",
      contactEmail: null,
      contactPhone: null,
      serviceCount: 0,
      productCount: 0,
      capabilities: { services: "required", shop: "required" } as const,
    })
    expect(r.ok).toBe(false)
    // orgName + contact + empty services catalog = 3 blockers; the empty
    // shop is now a warning (#82), not a fourth blocker.
    expect(r.errors).toHaveLength(3)
    expect(r.warnings.some((w) => w.toLowerCase().includes("trgovina"))).toBe(true)
  })

  it("skips catalog checks when neither services nor shop is enabled", () => {
    const r = validatePublishRequirements({
      ...baseInput,
      serviceCount: 0,
      productCount: 0,
      capabilities: { services: "disabled", shop: "disabled" },
    })
    expect(r.ok).toBe(true)
  })
})

describe("parsePublishState", () => {
  it("parses all known states", () => {
    for (const s of PUBLISH_STATES) expect(parsePublishState(s)).toBe(s)
  })

  it("falls back to PUBLISHED for unknown/null values (pre-E3-1 data is safe)", () => {
    expect(parsePublishState(null)).toBe("PUBLISHED")
    expect(parsePublishState(undefined)).toBe("PUBLISHED")
    expect(parsePublishState("garbage")).toBe("PUBLISHED")
  })
})
