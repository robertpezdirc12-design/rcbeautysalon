#!/usr/bin/env node
/**
 * P1 #18 (audit-2026-11) regression guard.
 *
 * Fails when the third-party Cloudinary account name appears ANYWHERE
 * in the repo. The default asset set is now self-hosted under
 * /public/img/media (src/lib/default-assets.ts), so there is no
 * allow-list: zero occurrences is the only passing state.
 *
 * Run: bun run check:assets
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()
const MARKER = "caballer" + "orandy" // split so this file never matches itself

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
])

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = full.slice(ROOT.length + 1).replaceAll("\\", "/")
    const st = statSync(full)
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue
      walk(full, files)
    } else if (/\.(ts|tsx|js|jsx|mjs|md|prisma|sql|json)$/.test(entry)) {
      files.push(rel)
    }
  }
  return files
}

const offenders = []
for (const rel of walk(ROOT)) {
  const content = readFileSync(join(ROOT, rel), "utf8")
  if (content.includes(MARKER)) offenders.push(rel)
}

if (offenders.length > 0) {
  console.error(
    `\n✖ Third-party Cloudinary account "${MARKER}" referenced in:\n` +
      offenders.map((f) => `  - ${f}`).join("\n") +
      `\n\nDefault media is self-hosted under public/img/media — replace the\n` +
      `reference with a local path from src/lib/default-assets.ts (see P1 #18).\n`
  )
  process.exit(1)
}

console.log(`✓ Zero references to the third-party Cloudinary account`)
