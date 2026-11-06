// ============================================================
// #101 — NO-CODE IZDELOVALNIK SPLETNIH STRANI (regresijska varovala)
// Sekcijski model: lastne (custom) sekcije — podatkovni model
// (normalizeSections + sanitizeCustomSections), render vrata
// (renderableSections), merge združljivost (stare vsebine), predlogi
// po dejavnosti, izolacija najemnikov, strežniška sanitizacija akcije.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  MAX_CUSTOM_SECTIONS,
  SECTION_KEYS,
  homeSectionOrder,
  mergeSiteContent,
  normalizeSections,
  renderableSections,
  sanitizeCustomSections,
  suggestedSectionsForVertical,
  type CustomSectionMeta,
} from "../src/lib/site-content"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("#101 normalizeSections — lastne (custom) sekcije", () => {
  it("custom vnos z id-jem prežive na shranjenem mestu, vgrajeni manjkajoči se dopolnijo", () => {
    const out = normalizeSections([
      { key: "hero", visible: true },
      { key: "custom", visible: true, id: "c1", label: "Ponudba meseca" },
      { key: "cta", visible: true },
    ])!
    const custom = out.find((s): s is CustomSectionMeta => s.key === "custom")
    expect(custom).toMatchObject({ key: "custom", visible: true, id: "c1", label: "Ponudba meseca" })
    // lastna sekcija ostane med hero in cta (shranjeni vrstni red)
    const keys = out.map((s) => s.key)
    expect(keys.indexOf("custom")).toBeLessThan(keys.indexOf("cta"))
    for (const k of SECTION_KEYS) expect(keys).toContain(k) // nič ne izgine
  })

  it("custom brez id-ja ali s praznim id-jem izpade (malformiran)", () => {
    const out = normalizeSections([
      { key: "custom", visible: true },
      { key: "custom", visible: true, id: "   " },
      { key: "hero", visible: true },
    ])!
    expect(out.filter((s) => s.key === "custom")).toHaveLength(0)
    expect(out.find((s) => s.key === "hero")).toBeTruthy()
  })

  it("custom dedup po id-ju (prvi zmaguje, vključno z vidnostjo)", () => {
    const out = normalizeSections([
      { key: "custom", visible: false, id: "c1" },
      { key: "custom", visible: true, id: "c1" },
    ])!
    const customs = out.filter((s): s is CustomSectionMeta => s.key === "custom")
    expect(customs).toHaveLength(1)
    expect(customs[0].visible).toBe(false)
  })

  it("zgornja meja MAX_CUSTOM_SECTIONS — presežek izpade", () => {
    const stored = [
      { key: "hero", visible: true },
      ...Array.from({ length: MAX_CUSTOM_SECTIONS + 3 }, (_, i) => ({
        key: "custom",
        visible: true,
        id: `c${i + 1}`,
      })),
    ]
    const out = normalizeSections(stored)!
    expect(out.filter((s) => s.key === "custom")).toHaveLength(MAX_CUSTOM_SECTIONS)
  })

  it("REGRESIJA E3-2: vgrajeni dedup prvi zmaguje, reviews kanonični vstavi ostanejo", () => {
    const out = normalizeSections([
      { key: "about", visible: true },
      { key: "services", visible: true },
      { key: "hero", visible: true },
      { key: "cta", visible: true },
      { key: "features", visible: false },
      { key: "team", visible: true },
      { key: "shop", visible: true },
    ])!
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
  })
})

describe("#101 sanitizeCustomSections — strežniška varovala", () => {
  it("očisti veljaven vnos: trim, dolžinske meje, odstavki", () => {
    const out = sanitizeCustomSections({
      c1: {
        title: "  Galerija del  ",
        paragraphs: ["Prvi odstavek", "", "Drugi odstavek"],
        imageUrl: "https://res.cloudinary.com/demo/image/upload/slika.jpg",
        buttonLabel: "Poglej več",
        buttonHref: "/services",
      },
    })!
    expect(out.c1.title).toBe("Galerija del")
    expect(out.c1.paragraphs).toEqual(["Prvi odstavek", "Drugi odstavek"])
    expect(out.c1.buttonLabel).toBe("Poglej več")
  })

  it("prazni naslov izpade; ne-nizovne vrednosti izpadejo", () => {
    const out = sanitizeCustomSections({
      bad1: { title: "   ", paragraphs: ["x"] },
      bad2: { title: 42, paragraphs: "ne-list" },
      good: { title: "OK", paragraphs: ["y"] },
    })!
    expect(Object.keys(out)).toEqual(["good"])
  })

  it("dolžinske meje: naslov, odstavek, url (slice)", () => {
    const out = sanitizeCustomSections({
      c1: { title: "N".repeat(500), paragraphs: ["D".repeat(5000)] },
    })!
    expect(out.c1.title.length).toBeLessThanOrEqual(140)
    expect(out.c1.paragraphs[0].length).toBeLessThanOrEqual(2000)
  })

  it("max 8 odstavkov; max 6 sekcij (presežek izpade)", () => {
    const many = sanitizeCustomSections({
      c1: { title: "T", paragraphs: Array.from({ length: 12 }, (_, i) => `P${i}`) },
    })!
    expect(many.c1.paragraphs).toHaveLength(8)

    const sections: Record<string, unknown> = {}
    for (let i = 0; i < 9; i++) sections[`k${i}`] = { title: `T${i}` }
    const capped = sanitizeCustomSections(sections)!
    expect(Object.keys(capped)).toHaveLength(6)
  })

  it("gumb je veljaven SAMO z obema poljema (brez mrtvih gumbov)", () => {
    const out = sanitizeCustomSections({
      a: { title: "T", buttonLabel: "Klik" },
      b: { title: "T", buttonHref: "/shop" },
      c: { title: "T", buttonLabel: "Klik", buttonHref: "/shop" },
    })!
    expect(out.a.buttonLabel).toBeUndefined()
    expect(out.b.buttonLabel).toBeUndefined()
    expect(out.c.buttonLabel).toBe("Klik")
    expect(out.c.buttonHref).toBe("/shop")
  })

  it("ne-objektni vnos → undefined; prazen objekt → undefined", () => {
    expect(sanitizeCustomSections(null)).toBeUndefined()
    expect(sanitizeCustomSections("nope")).toBeUndefined()
    expect(sanitizeCustomSections([])).toBeUndefined()
    expect(sanitizeCustomSections({})).toBeUndefined()
    expect(sanitizeCustomSections({ a: { title: "" } })).toBeUndefined()
  })
})

describe("#101 renderableSections — render vrata (hero prva, skrite ne izrisejo)", () => {
  it("hero je vedno prva, ko je vidna; skrite sekcije izpadejo", () => {
    const stored = [
      { key: "about", visible: true },
      { key: "hero", visible: true },
      { key: "cta", visible: false },
      { key: "features", visible: true },
      // manjkajoči vgrajeni ključi — normalizacija jih dopolni vidne
      { key: "services", visible: true },
      { key: "team", visible: true },
      { key: "reviews", visible: true },
      { key: "shop", visible: true },
    ]
    const out = normalizeSections(stored)!
    const rendered = renderableSections(out)
    expect(rendered[0].key).toBe("hero")
    expect(rendered.map((s) => s.key)).toEqual([
      "hero",
      "about",
      "features",
      "services",
      "team",
      "reviews",
      "shop",
    ]) // cta (skrita) NI izrisana
  })

  it("custom sekcija ostane na shranjenem mestu; skrita custom izpade", () => {
    const stored = [
      { key: "hero", visible: true },
      { key: "custom", visible: true, id: "c1" },
      { key: "custom", visible: false, id: "c2" },
      { key: "features", visible: true },
      { key: "services", visible: true },
      { key: "about", visible: true },
      { key: "team", visible: true },
      { key: "reviews", visible: true },
      { key: "shop", visible: true },
      { key: "cta", visible: true },
    ]
    const out = normalizeSections(stored)!
    const rendered = renderableSections(out)
    expect(rendered.map((s) => s.key)).toEqual([
      "hero",
      "custom",
      "features",
      "services",
      "about",
      "team",
      "reviews",
      "shop",
      "cta",
    ])
    const customs = rendered.filter((s): s is CustomSectionMeta => s.key === "custom")
    expect(customs).toHaveLength(1)
    expect(customs[0].id).toBe("c1") // c2 je skrita → ni izrisana
  })

  it("REGRESIJA: homeSectionOrder ostane združljiv (vgrajeni vrstni red)", () => {
    const order = homeSectionOrder(
      normalizeSections([
        { key: "cta", visible: true },
        { key: "hero", visible: true },
        { key: "about", visible: true },
      ])!
    )
    expect(order[0]).toBe("hero")
    expect(order).toContain("cta")
  })
})

describe("#101 mergeSiteContent — združljivost + izolacija", () => {
  it("stare vsebine (brez customSections) ostanejo nedotaknjene", () => {
    const old = mergeSiteContent({ hero: { title: "Star naslov" } }, "beauty")
    expect(old.hero.title).toBe("Star naslov")
    expect(old.customSections).toBeUndefined()
    expect(old.sections.every((s) => s.key !== "custom")).toBe(true)
  })

  it("customSections se spoštujejo po sanitizaciji (korupten izpade)", () => {
    const merged = mergeSiteContent(
      {
        sections: [
          { key: "hero", visible: true },
          { key: "custom", visible: true, id: "c1" },
        ],
        customSections: {
          c1: { title: "Naša zgodba", paragraphs: ["Besedilo."] },
          corrupt: { title: 123 },
        },
      },
      "beauty"
    )
    expect(merged.customSections?.c1?.title).toBe("Naša zgodba")
    expect(merged.customSections?.corrupt).toBeUndefined()
  })

  it("IZOLACIJA: sekcije najemnika A ne pridejo k najemniku B", () => {
    const tenantAStored = {
      sections: [
        { key: "hero", visible: true },
        { key: "custom", visible: true, id: "cA" },
      ],
      customSections: { cA: { title: "Sekcija najemnika A", paragraphs: [] } },
    }
    // Najemnik B ima svoj (prazen) SalonConfig — merge vstopa IZKLJUČNO
    // prek svoje shrambe; A-jevih sekcij ni v B-jevem renderiranem pogledu.
    const tenantBView = mergeSiteContent(null, "beauty")
    expect(tenantBView.customSections).toBeUndefined()
    expect(tenantBView.sections.some((s) => s.key === "custom")).toBe(false)
    expect(JSON.stringify(tenantBView)).not.toContain("Sekcija najemnika A")
    expect(JSON.stringify(tenantBView)).not.toContain("cA")

    // In obratno: B-jev merge z lastno vsebino ne vključi A-jevih id-jev.
    const tenantBStored = {
      sections: [{ key: "custom", visible: true, id: "cB" }],
      customSections: { cB: { title: "B-jeva sekcija", paragraphs: [] } },
    }
    const bView = mergeSiteContent(tenantBStored, "beauty")
    expect(Object.keys(bView.customSections ?? {})).toEqual(["cB"])
    expect(JSON.stringify(bView)).not.toContain(tenantAStored.customSections.cA.title)
  })
})

describe("#101 suggestedSectionsForVertical — predlogi (ne zaklep)", () => {
  it("neznana panoga: vse vgrajene sekcije vidne (obnašanje kot prej)", () => {
    const out = suggestedSectionsForVertical("unknown-trade")
    expect(out.map((s) => s.key)).toEqual(SECTION_KEYS)
    expect(out.every((s) => s.visible)).toBe(true)
  })

  it("čebelarstvo (product-only): storitve in ekipa predlagane kot skrite", () => {
    const out = suggestedSectionsForVertical("beekeeping")
    const byKey = Object.fromEntries(out.map((s) => [s.key, s.visible]))
    expect(byKey.shop).toBe(true)
    expect(byKey.services).toBe(false)
    expect(byKey.team).toBe(false)
    expect(byKey.hero).toBe(true)
  })

  it("generic (MARKEC): brez ekipe in trgovine — predstavitev platforme", () => {
    const out = suggestedSectionsForVertical("generic")
    const byKey = Object.fromEntries(out.map((s) => [s.key, s.visible]))
    expect(byKey.team).toBe(false)
    expect(byKey.shop).toBe(false)
    expect(byKey.features).toBe(true)
  })

  it("predlog VEDNO vsebuje vse vgrajene ključe (vidnost se razlikuje, ne obstoj)", () => {
    for (const vertical of ["generic", "beekeeping", "seamstress", "tire-service", "beauty"]) {
      const keys = suggestedSectionsForVertical(vertical).map((s) => s.key)
      for (const k of SECTION_KEYS) expect(keys).toContain(k)
    }
  })
})

describe("#101 vir — strežniška sanitizacija in žice (source guards)", () => {
  it("akcija updateSiteContent sanitizira custom sekcije + normalizira sections", () => {
    const action = read("src/app/actions/site-content.ts")
    expect(action).toContain("sanitizeCustomSections(clean.customSections)")
    expect(action).toContain("normalizeSections(clean.sections)")
  })

  it("renderer izrise custom sekcije prek renderableSections + vrata brez vsebine", () => {
    const renderer = read("src/components/landing/home-content.tsx")
    expect(renderer).toContain("renderableSections(content.sections)")
    expect(renderer).toContain("renderCustomSection")
    // vrata: prazna vsebina se ne izrise
    expect(renderer).toMatch(/if \(!custom\?\.title\) return null/)
  })

  it("urejevalnik ima dodajanje, predlog in odstranjevanje lastnih sekcij", () => {
    const editor = read("src/components/dashboard/branding-editor.tsx")
    expect(editor).toContain("addCustomSection")
    expect(editor).toContain("applySuggestion")
    expect(editor).toContain("removeCustomSection")
    expect(editor).toContain("suggestedSectionsForVertical")
    // strežniški payload gre skozi isto sanitizacijo
    expect(editor).toContain("customSections: sanitizeCustomSections(content.customSections)")
  })

  it("nalaganje slik lastnih sekcij: tip 'content' v upload API (isti varnostni pogoji)", () => {
    const upload = read("src/app/api/upload/route.ts")
    expect(upload).toContain('"content"')
    // ADMIN/STAFF vrata se nanašajo na vse ne-avatar tipe (vključno content)
    expect(upload).toMatch(/type !== "avatar"/)
  })

  it("i18n: obe slovarski jezikovni različici imata iste nove ključe", () => {
    const dict = read("src/lib/i18n/dict/settings.ts")
    for (const key of [
      "addSection",
      "addSectionLimit",
      "applySuggestion",
      "suggestionApplied",
      "customSectionDefaultLabel",
      "customSectionEditSummary",
      "customSectionRemoveTitle",
      "customSectionRemoveDesc",
    ]) {
      const matches = dict.split(key).length - 1
      expect(matches, `ključ ${key} v obeh slovarjih (sl+en)`).toBeGreaterThanOrEqual(2)
    }
  })
})
