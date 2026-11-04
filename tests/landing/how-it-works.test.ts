import { describe, it, expect } from "vitest"
import {
  HOW_IT_WORKS_STEPS,
  resolveBusinessTemplate,
} from "../../src/components/landing/how-it-works-section"
import { splitLastWord } from "../../src/components/landing/section-title"

// ============================================================
// "Kako deluje" trust section — the copy must stay truthful to
// the real booking semantics (guest booking = PENDING until the
// business confirms) and renderable (4 steps, unique titles,
// non-empty copy, known icons). P2 #84: the confirming party is
// the tenant's OWN noun via the {business} placeholder.
// ============================================================

describe("HOW_IT_WORKS_STEPS", () => {
  it("has exactly four steps", () => {
    expect(HOW_IT_WORKS_STEPS).toHaveLength(4)
  })

  it("has unique, non-empty titles and descriptions", () => {
    const titles = HOW_IT_WORKS_STEPS.map((s) => s.title)
    expect(new Set(titles).size).toBe(titles.length)
    for (const step of HOW_IT_WORKS_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0)
      expect(step.description.trim().length).toBeGreaterThan(0)
    }
  })

  it("never promises an automatic e-mail/SMS confirmation (delivery depends on tenant config)", () => {
    const copy = HOW_IT_WORKS_STEPS.map((s) => `${s.title} ${s.description}`)
      .join(" ")
      .toLowerCase()
    expect(copy).not.toContain("e-pošto")
    expect(copy).not.toContain("email")
    expect(copy).not.toContain("sms")
  })

  it("P2 #84: no hardcoded 'salon' — the confirming party is the {business} placeholder", () => {
    const confirmStep = HOW_IT_WORKS_STEPS.find((s) => s.title.toLowerCase().includes("potrd"))
    expect(confirmStep).toBeDefined()
    expect(confirmStep!.title.toLowerCase()).not.toContain("salon")
    expect(confirmStep!.title).toContain("{business}")
  })

  it("P2 #84: resolver renders the trade's own noun, capitalized, for beauty and tire-service", () => {
    const confirmTitle = HOW_IT_WORKS_STEPS.find((s) =>
      s.title.includes("potrd")
    )!.title
    expect(resolveBusinessTemplate(confirmTitle, "salon")).toBe("Salon potrdi")
    expect(resolveBusinessTemplate(confirmTitle, "servis")).toBe("Servis potrdi")
    expect(resolveBusinessTemplate(confirmTitle, "čebelarstvo")).toBe(
      "Čebelarstvo potrdi"
    )
  })

  it("every step icon is a renderable component (lucide forwardRef object)", () => {
    for (const step of HOW_IT_WORKS_STEPS) {
      expect(step.icon).toBeTruthy()
    }
  })
})

describe("Kako deluje heading splitting", () => {
  it("splits the last word as accent, same as other landing headings", () => {
    const { lead, accent } = splitLastWord("Kako deluje")
    expect(lead).toBe("Kako")
    expect(accent).toBe("deluje")
  })
})
