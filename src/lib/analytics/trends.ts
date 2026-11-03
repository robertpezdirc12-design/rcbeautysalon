// ============================================================
// TENANT ANALYTICS HELPERS (EPIC #4 E4-2a)
// Pure display rules for derived tenant metrics. No DB, no
// server-only imports — the same honesty rules as the platform
// analytics (E4-1): an empty denominator is "no data", never a
// fabricated 0 %.
// ============================================================

export type EnquiryChangeDisplay =
  | { kind: "no-data" }
  | { kind: "change"; value: number }

/**
 * Honest display rule for the enquiry KPI change badge:
 *  - no submissions in the current NOR previous period → "no data"
 *    (the existing change helper maps 0/0 → 0, which would read
 *    as "no growth" — a fabricated statistic over empty data)
 *  - change === null (P1 #5: previous period has no data) → "no data"
 *    — never a fabricated +100 %
 *  - anything else → the numeric change (may be 0.0 with real data,
 *    e.g. 10 → 10 submissions period-over-period)
 */
export function enquiryChangeDisplay(
  change: number | null,
  currentTotal: number
): EnquiryChangeDisplay {
  if (change === null) return { kind: "no-data" }
  if (currentTotal === 0 && change === 0) return { kind: "no-data" }
  return { kind: "change", value: change }
}
