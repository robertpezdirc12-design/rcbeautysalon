// ============================================================
// F1 #100 — SKD 2025 KATALOG + PRESKOK DEJAVNOSTI (regresijska varovala)
// Čista jedra (katalog, sanitizacija, predlogi) + struktura vrat
// (onboarding preskok → generic, dashboard spoštuje preskok, draft).
// AD-05: izbira je NASVET, ne zaklep — preskok in oznake enakovredni.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  SKD_AREAS,
  SKD_MODULE_LABELS,
  SKD_SECTION_CODES,
  SKD_SECTIONS,
  sanitizeSkdInput,
  suggestModulesForSkd,
} from "../src/lib/skd/catalog"
import {
  isDraftSubstantial,
  parseWizardDraft,
  safeResumeStep,
  serializeWizardDraft,
  type WizardDraftData,
} from "../src/lib/onboarding/wizard-draft"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

const CTX = {
  allowedVerticalIds: ["frizer", "generic"],
  allowedPaletteIds: ["rose"],
  now: 1_700_000_000_000,
}

describe("F1 katalog: integriteta podatkov (vir SURS Klasje SKD_2025 V1)", () => {
  it("natančno 22 sekcij A–V, unikatne šifre, vsi nazivi najmanj 3 znake", () => {
    expect(SKD_SECTIONS.length).toBe(22)
    const codes = SKD_SECTIONS.map((s) => s.code)
    expect(new Set(codes).size).toBe(22)
    expect(codes).toEqual("ABCDEFGHIJKLMNOPQRSTUV".split(""))
    for (const s of SKD_SECTIONS) {
      expect(s.name.length).toBeGreaterThanOrEqual(3)
    }
  })

  it("21 področij z unikatnimi ključi, sekcije so veljavne, predlogi poznani", () => {
    expect(SKD_AREAS.length).toBe(21)
    const keys = SKD_AREAS.map((a) => a.key)
    expect(new Set(keys).size).toBe(21)
    for (const area of SKD_AREAS) {
      expect(area.sections.length).toBeGreaterThan(0)
      for (const s of area.sections) expect(SKD_SECTION_CODES.has(s)).toBe(true)
      expect(area.suggests.length).toBeGreaterThan(0)
      for (const m of area.suggests) expect(SKD_MODULE_LABELS[m]).toBeTruthy()
    }
  })

  it("vsak modul ima tolmač (UI nikoli ne pokaže surovega ključa)", () => {
    const used = new Set(SKD_AREAS.flatMap((a) => a.suggests))
    for (const m of used) expect(SKD_MODULE_LABELS[m]).toBeTruthy()
  })
})

describe("F1 suggestModulesForSkd (predlog, ne zaklep)", () => {
  it("sekcija S (lepota) predlaga rezervacije in storitve", () => {
    const s = suggestModulesForSkd(["S"])
    expect(s).toContain("appointments")
    expect(s).toContain("services")
  })

  it("področje area:vehicles predlaga delovne naloge", () => {
    expect(suggestModulesForSkd(["area:vehicles"])).toContain("workOrders")
  })

  it("več izbir = unija brez duplikatov; neznane šifre se ignorirajo", () => {
    const s = suggestModulesForSkd(["S", "area:retail", "Z9", "area:neobstaja"])
    expect(s).toContain("appointments")
    expect(s).toContain("shop")
    expect(new Set(s).size).toBe(s.length)
  })

  it("prazen vnos → nič (preskok ne sili predlogov); oznake niso del predlogov", () => {
    expect(suggestModulesForSkd([])).toEqual([])
  })
})

describe("F1 sanitizeSkdInput (odpornost na zlorabo javne poti)", () => {
  it("obdrži veljavne, izpusti neznane in deduplicira", () => {
    const r = sanitizeSkdInput(["S", " area:vehicles ", "X99", "S", 42], ["  obrt ", "obrt", ""])
    expect(r.codes).toEqual(["S", "area:vehicles"])
    expect(r.tags).toEqual(["obrt"])
  })

  it("omejitve: največ 20 kod / 10 oznak po 40 znakov, brez duplikatov", () => {
    const many = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? "S" : "area:vehicles"))
    const longTag = "x".repeat(60)
    const r = sanitizeSkdInput(many, [longTag])
    expect(r.codes.length).toBeLessThanOrEqual(20)
    expect(new Set(r.codes).size).toBe(r.codes.length) // dedup
    expect(r.codes).toEqual(["S", "area:vehicles"])
    expect(r.tags).toEqual(["x".repeat(40)])
  })

  it("ne-nizi in ne-tabele so varno zavrnjeni", () => {
    expect(sanitizeSkdInput("S", "obrt")).toEqual({ codes: [], tags: [] })
    expect(sanitizeSkdInput(null, undefined)).toEqual({ codes: [], tags: [] })
  })
})

describe("F1 wizard draft: SKD polja (E4-4 nadaljevanje)", () => {
  function base(overrides?: Partial<WizardDraftData>): WizardDraftData {
    return {
      step: 2,
      vertical: null,
      secondary: null,
      palette: null,
      name: "",
      contactPhone: "",
      slug: "",
      slugTouched: false,
      ownerName: "",
      email: "",
      teamSize: null,
      onlineBooking: null,
      skdCodes: [],
      customTags: [],
      verticalSkipped: false,
      ...overrides,
    }
  }

  it("round-trip ohrani skdCodes/customTags/verticalSkipped", () => {
    const draft = base({
      verticalSkipped: true,
      skdCodes: ["S", "area:vehicles"],
      customTags: ["vulkanizer"],
    })
    const json = serializeWizardDraft(draft, CTX)
    const res = parseWizardDraft(json, CTX)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.envelope.data.skdCodes).toEqual(["S", "area:vehicles"])
    expect(res.envelope.data.customTags).toEqual(["vulkanizer"])
    expect(res.envelope.data.verticalSkipped).toBe(true)
  })

  it("tamperirane kode padejo na whitelist, preskok brez panoge ostane", () => {
    const raw = JSON.stringify({
      version: 1,
      savedAt: CTX.now,
      data: {
        step: 1,
        vertical: null,
        secondary: null,
        palette: null,
        name: "",
        slug: "",
        slugTouched: false,
        ownerName: "",
        email: "",
        teamSize: null,
        onlineBooking: null,
        skdCodes: ["S", "HACK", "area:nope", 42],
        customTags: ["<script>x</script>"],
        verticalSkipped: true,
      },
    })
    const res = parseWizardDraft(raw, CTX)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.envelope.data.skdCodes).toEqual(["S"])
    expect(res.envelope.data.customTags).toEqual(["<script>x</script>"]) // oznaka je prost tekst — prikaže se samo lastniku
    expect(res.envelope.data.verticalSkipped).toBe(true)
  })

  it("verticalSkipped z izbrano panogo je neveljaven (falsificiran) → false", () => {
    const json = serializeWizardDraft(
      base({ vertical: "frizer", verticalSkipped: true }),
      CTX
    )
    const res = parseWizardDraft(json, CTX)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.envelope.data.verticalSkipped).toBe(false)
  })

  it("preskok je veljaven napredek: resume sme na korak 2, draft je substantial", () => {
    const skipped = base({ verticalSkipped: true })
    expect(isDraftSubstantial(skipped)).toBe(true)
    expect(safeResumeStep(skipped)).toBe(2)
  })

  it("brez panoge IN brez preskoka resume ostane na koraku 1", () => {
    expect(safeResumeStep(base())).toBe(1)
  })
})

describe("F1 struktura: vrata na strežniku in v čarovniku", () => {
  it("onboarding: preskok → generic, SKD sanitizacija, verticalChosenAt samo pri izbiri", () => {
    const src = read("src/app/actions/onboarding.ts")
    expect(src).toContain("GENERIC_PROFILE_ID")
    expect(src).toContain("verticalSkipped = input.verticalSkipped === true && !input.vertical")
    expect(src).toContain("sanitizeSkdInput(input.skdCodes, input.customTags)")
    expect(src).toContain("...(verticalSkipped ? {} : { verticalChosenAt: new Date() })")
  })

  it("dashboard: vodeni vstop in checklist spoštueta preskok (razlika B)", () => {
    const dash = read("src/app/(admin)/dashboard/page.tsx")
    expect(dash).toContain("!shareOrg?.verticalSkipped")
    expect(dash).toContain("verticalChosenAt != null || shareOrg.verticalSkipped")
  })

  it("čarovnik: iskanje, oznake, predlogi in preskok so prisotni; preskok ne blokira koraka 1", () => {
    const wiz = read("src/components/onboarding/start-wizard.tsx")
    expect(wiz).toContain("Preskoči dejavnost")
    expect(wiz).toContain("suggestModulesForSkd(skdCodes)")
    expect(wiz).toContain("!vertical && !skippedVertical")
    expect(wiz).toContain("verticalSkipped: skippedVertical")
  })

  it("shema: Organization ima skdCodes/customTags/verticalSkipped (AD-05)", () => {
    const schema = read("prisma/schema.prisma")
    expect(schema).toContain("skdCodes        String[] @default([])")
    expect(schema).toContain("customTags      String[] @default([])")
    expect(schema).toContain("verticalSkipped Boolean  @default(false)")
  })
})
