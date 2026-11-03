/**
 * P1 #18 (audit-2026-11) — one-time DB migration (local/dev entrypoint).
 *
 * The shared logic lives in src/lib/default-media-migration.ts (also
 * used by the one-time production endpoint POST /api/admin/migrate-default-media).
 *
 * Run:  bun scripts/migrate-default-media.ts --dry   (report only)
 *       bun scripts/migrate-default-media.ts         (apply)
 */
import { PrismaClient } from "@prisma/client"
import { migrateDefaultMedia } from "../src/lib/default-media-migration"

const DRY = process.argv.includes("--dry")
const prisma = new PrismaClient()

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

async function main() {
  console.log(`P1 #18 — migracija default medijev na lastno gostovanje ${DRY ? "(DRY RUN)" : "(APPLY)"}\n`)
  const result = await migrateDefaultMedia(prisma, DRY)
  for (const c of result.changes) {
    console.log(`  ${c.table}/${c.id} · ${c.field}`)
    console.log(`    - ${c.from}`)
    console.log(`    + ${c.to}`)
  }
  console.log(`\n${DRY ? "PRICESKANO" : "POTOBLJENO"}: ${result.total} vrednosti ${DRY ? "za migracijo" : "migriranih"}.`)
  if (DRY && result.total > 0) console.log("Zaženi brez --dry za uporabo.")
}
