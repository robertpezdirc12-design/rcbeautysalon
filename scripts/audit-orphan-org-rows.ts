/**
 * ============================================================
 * V-2 (issue #102 — F0-S): READ-ONLY orphan-tenant audit.
 *
 * Counts rows with organizationId IS NULL in payment-relevant
 * tables (and their directly related models). The columns are
 * nullable in the schema (Order, Appointment, Product, …), so a
 * legacy/imported row could exist WITHOUT a tenant — those rows
 * would have no owner, no isolation scope and no billing anchor.
 *
 * SAFETY: this script runs ONLY `SELECT COUNT(*)` queries — no
 * writes, no backfill, no schema changes. It never touches
 * production data: run it against a test database and hand the
 * production check to the owner as a separate, approved step
 * (issue #102 §3: no backfill / NOT NULL migration without
 * confirmed production results and explicit approval).
 *
 * Run: E2E_DATABASE_URL=… bun scripts/audit-orphan-org-rows.ts
 *      (or DATABASE_URL=… for any environment)
 * ============================================================
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "" } },
})

/** Payment-relevant tables + their directly related models. */
const TABLES: { table: string; label: string }[] = [
  { table: "Order", label: "Order (payment anchor)" },
  { table: "OrderItem", label: "OrderItem (order line)" },
  { table: "Appointment", label: "Appointment (payment anchor)" },
  { table: "AppointmentService", label: "AppointmentService (booking line)" },
  { table: "Product", label: "Product (sellable)" },
  { table: "PrepaidPurchase", label: "PrepaidPurchase (paid credit)" },
  { table: "PrepaidRedemption", label: "PrepaidRedemption (credit use)" },
  { table: "StockMovement", label: "StockMovement (inventory)" },
  { table: "Service", label: "Service (bookable)" },
]

async function main(): Promise<void> {
  const dbUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? ""
  const safeUrl = dbUrl.replace(/\/\/[^@]*@/, "//***@")
  console.log(`• V-2 orphan-tenant audit (READ-ONLY) on: ${safeUrl}`)

  // Which of the listed tables actually carry the column? (OrderItem /
  // AppointmentService inherit the tenant scope through their parent row.)
  const withColumn = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'organizationId'
       AND table_name = ANY($1::text[])`,
    TABLES.map((t) => t.table)
  )
  const columnTables = new Set(withColumn.map((r) => r.table_name))

  const problems: string[] = []
  for (const { table, label } of TABLES) {
    // Identifier is quoted; the table list is a fixed constant above —
    // no user input reaches the query.
    if (!columnTables.has(table)) {
      console.log(`  ${label.padEnd(32)} organizationId IS NULL → n/a (no column — scoped via parent)`)
      continue
    }
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "organizationId" IS NULL`
    )
    const count = Number(result[0]?.count ?? 0)
    console.log(`  ${label.padEnd(32)} organizationId IS NULL → ${count}`)
    if (count > 0) problems.push(`${table}: ${count} row(s) without a tenant`)
  }

  // Total row counts for context (so a 0-NULL result cannot be confused
  // with an empty table).
  console.log("• row totals for context:")
  for (const { table } of TABLES.filter((t) => columnTables.has(t.table))) {
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "${table}"`
    )
    console.log(`  ${table.padEnd(24)} total rows → ${Number(result[0]?.count ?? 0)}`)
  }

  if (problems.length > 0) {
    console.error("✗ ORGANIZATION-NULL ROWS FOUND:")
    for (const p of problems) console.error("  -", p)
    process.exitCode = 1
    return
  }
  console.log("✓ no organizationId IS NULL rows in payment-relevant tables")
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
