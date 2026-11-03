#!/usr/bin/env node
/**
 * P1 #18 (audit-2026-11) regression guard.
 *
 * Fails when the third-party Cloudinary account name appears anywhere
 * outside the single centralized module (src/lib/default-assets.ts).
 * Re-uploading the default asset set to the project's own cloud then
 * requires touching exactly one file — after which the allow-list entry
 * can be deleted entirely.
 *
 * Run: bun run check:assets
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()
const MARKER = "caballer" + "orandy" // split so this file never matches itself
const ALLOWED = new Set([
  "src/lib/default-assets.ts", // the single source of truth (pending re-upload)
])

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
  if (ALLOWED.has(rel)) continue
  const content = readFileSync(join(ROOT, rel), "utf8")
  if (content.includes(MARKER)) offenders.push(rel)
}

if (offenders.length > 0) {
  console.error(
    `\n✖ Third-party Cloudinary account "${MARKER}" referenced outside src/lib/default-assets.ts:\n` +
      offenders.map((f) => `  - ${f}`).join("\n") +
      `\n\nCentralize the URL in src/lib/default-assets.ts (see P1 #18).\n`
  )
  process.exit(1)
}

console.log(`✓ No third-party Cloudinary references outside src/lib/default-assets.ts`)
