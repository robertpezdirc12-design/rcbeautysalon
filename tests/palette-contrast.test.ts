// ============================================================
// P1 #7 (audit-2026-11) — WCAG AA palette invariants
// Every built-in palette must ship accessible brand colours:
//  - white text on the effective primary fill ≥ 4.5:1 (buttons)
//  - the effective primary on the light page bg ≥ 4.5:1
//    (outline buttons, links, icons)
//  - the 500–900 ladder is strictly monotonic (the old fixed
//    LADDER_DOWN produced "600" LIGHTER than "500" for dark
//    palettes like burgundy/charcoal, so hover:bg-primary-600
//    lightened instead of darkening)
//  - the text-safe tokens (--primary-text / --accent-text) are
//    ≥ 4.5:1 against BOTH the light and the dark page background
// ============================================================

import { describe, it, expect } from "vitest"
import {
  PALETTES,
  paletteCssVars,
  paletteDarkTextVars,
  wcagContrast,
  derivedLadderDown,
  aaSafeLightness,
  type Palette,
} from "../src/lib/verticals"

const WHITE = { h: 0, s: 0, l: 100 }
const LIGHT_BG = { h: 0, s: 0, l: 98 } // cream ≈ #FBF9F9
const DARK_BG = { h: 340, s: 10, l: 8 } // rose-black dark theme bg

function parseTriplet(triplet: string): { h: number; s: number; l: number } {
  const m = triplet.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/)
  if (!m) throw new Error(`Bad HSL triplet: "${triplet}"`)
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) }
}

describe("palette WCAG AA invariants (audit-2026-11 #7)", () => {
  const palettes: Palette[] = Object.values(PALETTES)

  it("white text reaches 4.5:1 on every effective primary-500 fill", () => {
    for (const p of palettes) {
      const vars = paletteCssVars(p)
      const primary = parseTriplet(vars["--primary-500"])
      const fg = parseTriplet(vars["--primary-foreground"])
      expect(
        wcagContrast(WHITE, primary),
        `${p.id}: white on primary-500 (${vars["--primary-500"]}) must be ≥ 4.5`
      ).toBeGreaterThanOrEqual(4.5)
      // whichever foreground the palette picked must itself pass AA
      expect(
        wcagContrast(fg, primary),
        `${p.id}: chosen foreground on primary-500 must be ≥ 4.5`
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("the effective primary passes on the light page background too", () => {
    for (const p of palettes) {
      const vars = paletteCssVars(p)
      const primary = parseTriplet(vars["--primary-500"])
      expect(
        wcagContrast(primary, LIGHT_BG),
        `${p.id}: primary-500 on cream bg must be ≥ 4.5`
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("the 500–900 primary ladder is monotonic and darker than the base", () => {
    for (const p of palettes) {
      const vars = paletteCssVars(p)
      const ls = ["500", "600", "700", "800", "900"].map(
        (shade) => parseTriplet(vars[`--primary-${shade}`]).l
      )
      for (let i = 1; i < ls.length; i++) {
        expect(
          ls[i],
          `${p.id}: primary-${["500", "600", "700", "800", "900"][i]} lightness must never get lighter`
        ).toBeLessThanOrEqual(ls[i - 1])
      }
      // the old fixed LADDER_DOWN bug: "600" LIGHTER than "500"
      expect(ls[1], `${p.id}: 600 must be darker than 500`).toBeLessThan(ls[0])
    }
  })

  it("derivedLadderDown never returns a lightness above its base", () => {
    for (const base of [97, 64, 55, 46, 40, 38, 24, 16]) {
      const ladder = derivedLadderDown(base)
      expect(ladder).toHaveLength(4)
      for (const l of ladder) expect(l).toBeLessThan(base)
      // monotonic (non-increasing once the 8 % floor clamps)
      for (let i = 1; i < ladder.length; i++) expect(ladder[i]).toBeLessThanOrEqual(ladder[i - 1])
    }
    // realistic bases keep a strictly decreasing ladder
    for (const base of [97, 64, 55, 46, 40, 38]) {
      const ladder = derivedLadderDown(base)
      for (let i = 1; i < ladder.length; i++) expect(ladder[i]).toBeLessThan(ladder[i - 1])
    }
  })

  it("--primary-text and --accent-text pass AA on light AND dark backgrounds", () => {
    for (const p of palettes) {
      const vars = paletteCssVars(p)
      const darkVars = paletteDarkTextVars(p)

      const lightPrimary = parseTriplet(vars["--primary-text"])
      const lightAccent = parseTriplet(vars["--accent-text"])
      expect(wcagContrast(lightPrimary, LIGHT_BG), `${p.id}: primary-text on light`).toBeGreaterThanOrEqual(4.5)
      expect(wcagContrast(lightAccent, LIGHT_BG), `${p.id}: accent-text on light`).toBeGreaterThanOrEqual(4.5)

      const darkPrimary = parseTriplet(darkVars["--primary-text"])
      const darkAccent = parseTriplet(darkVars["--accent-text"])
      expect(wcagContrast(darkPrimary, DARK_BG), `${p.id}: primary-text on dark`).toBeGreaterThanOrEqual(4.5)
      expect(wcagContrast(darkAccent, DARK_BG), `${p.id}: accent-text on dark`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("aaSafeLightness keeps passing palettes unchanged (brand fidelity)", () => {
    // rose (L=50) already passes 4.5:1 vs white — must keep L=50 exactly
    expect(aaSafeLightness(340, 45, 50)).toBe(50)
    // charcoal (L=24, near-neutral) passes — unchanged
    expect(aaSafeLightness(220, 12, 24)).toBe(24)
    // coral (L=55) fails 3.75:1 — must walk down to an AA-safe lightness
    const coral = aaSafeLightness(12, 65, 55)
    expect(coral).toBeLessThan(55)
    expect(wcagContrast(WHITE, { h: 12, s: 65, l: coral })).toBeGreaterThanOrEqual(4.5)
  })
})
