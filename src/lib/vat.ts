// ============================================================
// VAT (DDV) — EN VIRO RESNICE za košarico in checkout (#33)
//
// Slovenske spletne trgovine objavljajo BRUTO cene (z vključenim
// DDV, standardna stopnja 22 %) — /terms tudi izrecno navaja,
// da vse cene vključujejo DDV. Košarica torej NE SME prišteti
// davka k ceni; DDV je samo INFORMATIVNI razpad bruto zneska:
//   ddv = bruto − bruto / (1 + stopnja)
//
// Ta modul je namenoma čist (brez Prisma/React), da ga lahko
// uporabljata tako odjemalec (košarica) kot strežnik (checkout)
// — ista funkcija, enake vrednosti, brez magičnih števil.
// ============================================================

/** Standardna slovenska stopnja DDV (22 %). */
export const SI_VAT_RATE = 0.22

/**
 * Izkazani DDV iz BRUTO cene (cena že vsebuje davek).
 * Primer: 65 € → 11,72 € (65 × 22/122).
 */
export function vatFromGross(gross: number, rate: number = SI_VAT_RATE): number {
  if (!Number.isFinite(gross) || gross <= 0) return 0
  return gross - gross / (1 + rate)
}

/** Človeku berljiva oznaka za povzetek košarice. */
export function vatLabel(rate: number = SI_VAT_RATE): string {
  const pct = new Intl.NumberFormat("sl-SI", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(rate)
  return `DDV ${pct} (vključen v ceno)`
}
