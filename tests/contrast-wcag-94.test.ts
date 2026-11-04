// ============================================================
// #94 — WCAG 2.2 AA KONTRASTNA ZAŠČITA V CI (razširitev #7)
// Izračun kontrastnih razmerij iz ISTIH vrednosti, ki jih rendra
// aplikacija:
//  - 8 vgrajenih palet (svetli način na kremastem ozadju + temni
//    besedilni odtenki na rose-črnem ozadju),
//  - platformska tema (#94, svetla + temna).
// Regression gate: kdorkoli spreminja paleto/tokene, mora AA
// izpolniti — sicer test pade. Meje: 4.5:1 za normalno besedilo,
// 3:1 za veliko besedilo/UI mejnike (WCAG 1.4.3/1.4.11).
// ============================================================

import { describe, expect, it } from "vitest"

import { PALETTES, paletteCssVars, paletteDarkTextVars } from "@/lib/verticals"
import { PLATFORM_DARK_VARS, PLATFORM_LIGHT_VARS } from "@/lib/platform-theme"

// ---- WCAG 2.x relativna luminanca + kontrast (čisti izračuni) ----

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100
  const lig = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) =>
    lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

function relLuminance(hslTriplet: string): number {
  // Vrednosti so oblike "222 13% 14%" — procenti se odstranijo.
  const [h, s, l] = hslTriplet
    .trim()
    .replace(/%/g, "")
    .split(/\s+/)
    .map(Number)
  const [r, g, b] = hslToRgb(h, s, l).map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const la = relLuminance(a)
  const lb = relLuminance(b)
  const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  return Math.round(ratio * 100) / 100
}

/** Ozadji, na katerih rendra aplikacija (globals.css :root / .dark). */
const TENANT_LIGHT_BG = "20 25% 98%" // kremasto (globals :root)
const TENANT_DARK_BG = "340 10% 6%" // rose-črno (globals .dark)

describe("#94 platformska tema — WCAG AA (svetla)", () => {
  it("besedilo na ozadju ≥ 4.5", () => {
    expect(
      contrast(PLATFORM_LIGHT_VARS["--foreground"], PLATFORM_LIGHT_VARS["--background"])
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrast(
        PLATFORM_LIGHT_VARS["--muted-foreground"],
        PLATFORM_LIGHT_VARS["--background"]
      )
    ).toBeGreaterThanOrEqual(4.5)
  })

  it("gumb: belo na poglobljeni rose ≥ 4.5", () => {
    expect(
      contrast(PLATFORM_LIGHT_VARS["--primary-foreground"], PLATFORM_LIGHT_VARS["--primary"])
    ).toBeGreaterThanOrEqual(4.5)
  })

  it("primary-text in accent-text na ozadju ≥ 4.5", () => {
    expect(
      contrast(PLATFORM_LIGHT_VARS["--primary-text"], PLATFORM_LIGHT_VARS["--background"])
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrast(PLATFORM_LIGHT_VARS["--accent-text"], PLATFORM_LIGHT_VARS["--background"])
    ).toBeGreaterThanOrEqual(4.5)
  })

  it("focus ring (UI indikator) ≥ 3:1 proti ozadju (WCAG 1.4.11)", () => {
    // 1.4.11 velja za mejnike/indikatorje, ki so EDINI vizualni dokaz
    // stanja: focus ring je tak indikator (karte imajo senčke+ozadja,
    // zato dekorativni border ni AA vezan — dokumentirano v #94).
    expect(
      contrast(PLATFORM_LIGHT_VARS["--ring"], PLATFORM_LIGHT_VARS["--background"])
    ).toBeGreaterThanOrEqual(3)
  })
})

describe("#94 platformska tema — WCAG AA (temna)", () => {
  it("besedilo na temnem ozadju ≥ 4.5", () => {
    expect(
      contrast(PLATFORM_DARK_VARS["--foreground"], PLATFORM_DARK_VARS["--background"])
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrast(
        PLATFORM_DARK_VARS["--muted-foreground"],
        PLATFORM_DARK_VARS["--background"]
      )
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrast(PLATFORM_DARK_VARS["--primary-text"], PLATFORM_DARK_VARS["--background"])
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrast(PLATFORM_DARK_VARS["--accent-text"], PLATFORM_DARK_VARS["--background"])
    ).toBeGreaterThanOrEqual(4.5)
  })
})

describe("#94 vgrajene palete — WCAG AA (razširitev #7)", () => {
  const paletteIds = Object.keys(PALETTES)

  it("vseh 8 palet je prisotnih (ni po nesreči izpuščenih)", () => {
    expect(paletteIds.sort()).toEqual([
      "amber",
      "burgundy",
      "charcoal",
      "coral",
      "emerald",
      "rose",
      "teal",
      "violet",
    ])
  })

  for (const [id, palette] of Object.entries(PALETTES)) {
    it(`${id}: belo na primarni gumb ≥ 4.5 (svetli način)`, () => {
      const vars = paletteCssVars(palette)
      const pf = vars["--primary-foreground"]?.trim() ?? ""
      expect(contrast(pf, vars["--primary"])).toBeGreaterThanOrEqual(4.5)
    })

    it(`${id}: primary-text na ozadju ≥ 4.5 (svetli + temni način)`, () => {
      const vars = paletteCssVars(palette)
      const dark = paletteDarkTextVars(palette)
      expect(contrast(vars["--primary-text"], TENANT_LIGHT_BG)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(dark["--primary-text"], TENANT_DARK_BG)).toBeGreaterThanOrEqual(4.5)
    })

    it(`${id}: accent-text na ozadju ≥ 4.5 (svetli + temni način)`, () => {
      const vars = paletteCssVars(palette)
      const dark = paletteDarkTextVars(palette)
      expect(contrast(vars["--accent-text"], TENANT_LIGHT_BG)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(dark["--accent-text"], TENANT_DARK_BG)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
