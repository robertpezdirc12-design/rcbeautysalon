import { PrismaClient } from "@prisma/client"
import { reconcileProfileAssets } from "../src/lib/profiles/backfill"

/**
 * EPIC #1 Phase 3 backfill — P0 #23 (re-audit 2026-11): zdaj USKLAJUJE
 * (materializira + deaktivira prišleške profile definicije), ne le
 * pripenja. Idempotentno, lastniške kreacije ostanejo nespremenjene.
 *
 * Uporaba:
 *   DATABASE_URL="postgresql://..." bun scripts/backfill-profile-assets.ts
 */

const prisma = new PrismaClient()

async function main() {
  const result = await reconcileProfileAssets(prisma)

  console.log(`Reconciled ${result.orgs.length} organizations`)
  for (const org of result.orgs) {
    console.log(
      `  ✓ ${org.slug} (${org.vertical} → profile ${org.profileId}): +${org.createdForms} forms, -${org.deactivatedForms.length} stale forms [${org.deactivatedForms.join(", ")}], +${org.createdWorkflows} workflows, -${org.deactivatedWorkflows.length} stale workflows`
    )
  }
  console.log("Totals:", result.totals)
  console.log("Backfill complete.")
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
