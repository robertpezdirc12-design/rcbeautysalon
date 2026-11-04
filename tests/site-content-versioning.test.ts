import { describe, it, expect } from "vitest"
import {
  SECTION_KEYS,
  homeSectionOrder,
  mergeSiteContent,
  normalizeSections,
  type SectionMeta,
} from "../src/lib/site-content"
import {
  computeRevert,
  hasUnpublishedChanges,
} from "../src/lib/publication"

// ============================================================
// E3-2 — preview + editor refinement: section ORDER, content
// versioning, revert-to-published semantics.
// ============================================================

describe("normalizeSections", () => {
  it("keeps the stored owner-defined order (the core of section reordering)", () => {
    const stored = [
      { key: "about", visible: true },
      { key: "services", visible: true },
      { key: "hero", visible: true },
      { key: "cta", visible: true },
      { key: "features", visible: false },
      { key: "team", visible: true },
      { key: "shop", visible: true },
    ]
    const out = normalizeSections(stored)!
    // P2 #75: platforma je dodala sekcijo "reviews" (kanonično za "team").
    // Shranjen lastniški vrstni red ostaja; NOVI ključ se vstavi na svojo
    // kanonično pozicijo (prej: na konec, pod končni CTA).
    expect(out.map((s) => s.key)).toEqual([
      "about",
      "services",
      "hero",
      "cta",
      "features",
      "team",
      "reviews",
      "shop",
    ])
    expect(out.find((s) => s.key === "features")?.visible).toBe(false)
  })

  it("appends missing keys at the end, visible (nothing disappears)", () => {
    const out = normalizeSections([{ key: "cta", visible: true }])!
    const keys = out.map((s) => s.key)
    // P2 #75: NOVA sekcija "reviews" se vstavi kanonično (za najbližjega
    // predhodnika; brez njega na konec) — ključna pogodba: vsi ključi
    // prisotni, vsi vidni, brez duplikatov.
    expect(keys[0]).toBe("cta")
    for (const k of SECTION_KEYS) expect(keys).toContain(k)
    expect(keys.filter((k) => k === "reviews")).toHaveLength(1)
    expect(out.every((s) => s.visible)).toBe(true)
  })

  it("drops unknown keys and deduplicates (first wins)", () => {
    const out = normalizeSections([
      { key: "services", visible: true },
      { key: "hacky" } as unknown as SectionMeta,
      { key: "services", visible: false },
      { key: "hero", visible: true },
    ])!
    expect(out.map((s) => s.key)).toContain("services")
    expect(out.map((s) => s.key)).toContain("hero")
    expect(out.filter((s) => s.key === "services")).toHaveLength(1)
    expect(out.find((s) => s.key === "services")?.visible).toBe(true)
  })

  it("returns null for corrupt/empty input (caller keeps defaults)", () => {
    expect(normalizeSections(null)).toBeNull()
    expect(normalizeSections("nope")).toBeNull()
    expect(normalizeSections([{ nope: true }])).toBeNull()
    expect(normalizeSections([])).toBeNull()
  })

  it("mergeSiteContent stays backward compatible: canonical order in → canonical order out", () => {
    const stored = { sections: SECTION_KEYS.map((key) => ({ key, visible: key !== "shop" })) }
    const merged = mergeSiteContent(stored, "beauty")
    expect(merged.sections.map((s) => s.key)).toEqual(SECTION_KEYS)
    expect(merged.sections.find((s) => s.key === "shop")?.visible).toBe(false)
  })

  it("mergeSiteContent preserves a custom section order from stored JSON", () => {
    const stored = {
      sections: [
        { key: "hero", visible: true },
        { key: "team", visible: true },
        { key: "hero", visible: true },
        { key: "about", visible: true },
      ],
    }
    const merged = mergeSiteContent(stored, "beauty")
    const keys = merged.sections.map((s) => s.key)
    // P2 #75: shranjeni vrstni red (hero, team, about) se ohranja, NOVI
    // ključ "reviews" pa se vstavi kanonično za "team" — ne na konec.
    expect(keys.slice(0, 3)).toEqual(["hero", "team", "reviews"])
    expect(keys.indexOf("about")).toBe(keys.indexOf("reviews") + 1)
    // missing keys appended visible
    expect(merged.sections.every((s) => s.visible)).toBe(true)
  })
})

describe("homeSectionOrder", () => {
  it("hero is pinned first when visible, rest follows stored order", () => {
    const sections: SectionMeta[] = [
      { key: "hero", visible: true },
      { key: "about", visible: true },
      { key: "features", visible: true },
      { key: "services", visible: true },
      { key: "team", visible: true },
      { key: "shop", visible: true },
      { key: "cta", visible: true },
    ]
    expect(homeSectionOrder(sections)).toEqual([
      "hero",
      "about",
      "features",
      "services",
      "team",
      "shop",
      "cta",
    ])
  })

  it("even a weird stored order cannot unpin the hero", () => {
    const sections: SectionMeta[] = [
      { key: "cta", visible: true },
      { key: "hero", visible: true },
      { key: "about", visible: true },
    ]
    expect(homeSectionOrder(sections)[0]).toBe("hero")
    expect(homeSectionOrder(sections)).toEqual(["hero", "cta", "about"])
  })

  it("hidden sections never render; hero hidden means no hero", () => {
    const sections: SectionMeta[] = [
      { key: "hero", visible: false },
      { key: "about", visible: true },
      { key: "team", visible: false },
      { key: "cta", visible: true },
    ]
    expect(homeSectionOrder(sections)).toEqual(["about", "cta"])
  })
})

describe("hasUnpublishedChanges", () => {
  it("pre-E3-2 tenants (no snapshot version) never show unpublished changes", () => {
    expect(hasUnpublishedChanges(7, null)).toBe(false)
    expect(hasUnpublishedChanges(null, 3)).toBe(false)
    expect(hasUnpublishedChanges(null, null)).toBe(false)
  })

  it("equal versions are in sync; different versions mean unpublished draft", () => {
    expect(hasUnpublishedChanges(5, 5)).toBe(false)
    expect(hasUnpublishedChanges(6, 5)).toBe(true)
    expect(hasUnpublishedChanges(4, 5)).toBe(true)
  })
})

describe("computeRevert", () => {
  const snapshot = { hero: { title: "Objavljena verzija" } }

  it("restores the published JSON and re-aligns the version (no phantom drift)", () => {
    const r = computeRevert({
      contentVersion: 12,
      publishedSiteContent: snapshot,
      publishedContentVersion: 9,
    })
    expect(r).toEqual({
      ok: true,
      siteContent: snapshot,
      contentVersion: 9,
    })
  })

  it("refuses when the tenant has no published snapshot", () => {
    expect(
      computeRevert({ contentVersion: 3, publishedSiteContent: null, publishedContentVersion: null })
    ).toEqual({ ok: false, reason: "no-published-version" })
  })
})
