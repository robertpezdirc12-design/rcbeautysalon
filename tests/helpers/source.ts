// ============================================================
// P3 #73 — shared source-file reader for source-guard tests.
// Line endings are NORMALIZED (CRLF → LF) so guards behave
// identically on Linux checkouts and on Windows with
// core.autocrlf=true: a marker containing a literal \n used to miss
// (indexOf → -1) and slice(start, -1) swallowed the rest of the file,
// turning a green suite red with no product defect behind it.
// Rule: no test may slice source with a marker containing a literal
// newline — prefer structural assertions over raw slices.
// ============================================================

import { readFileSync } from "node:fs"
import path from "node:path"

/** Normalize line endings (and strip a BOM) for source-guard tests. */
export function normalizeSource(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "")
}

export function srcOf(rel: string): string {
  const file = path.resolve(__dirname, "..", "..", rel)
  return normalizeSource(readFileSync(file, "utf8"))
}
