#!/usr/bin/env node
/**
 * P1 build-time guard: resolves FAILED Prisma migrations (P3009) for the
 * explicitly listed migrations only, before `prisma migrate deploy` runs.
 *
 * Background: migration 20261105000000_onboarding_answers (single
 * ALTER TABLE ... ADD COLUMN "onboardingAnswers" JSONB) failed on the
 * production database on 2026-11-02 — almost certainly because the
 * column already existed (schema drift from an earlier db push). A
 * failed row in _prisma_migrations makes every subsequent
 * `prisma migrate deploy` (and therefore every Vercel build) exit with
 * P3009, and there is no interactive DB access from build machines.
 *
 * Strategy (converges in both possible worlds):
 *  1. The migration SQL was made idempotent (ADD COLUMN IF NOT EXISTS),
 *     so re-applying is safe whether or not the column already exists.
 *  2. This script probes _prisma_migrations for a FAILED row of the
 *     listed migrations; only then it runs
 *     `prisma migrate resolve --rolled-back <name>` so that
 *     `migrate deploy` retries it. If the migration is healthy
 *     (applied or pending), the script is a no-op.
 *
 * Probe semantics: `prisma db execute --stdin` exits 0 when the DO block
 * completes (no failed row) and exits non-zero printing
 * FAILED_MIGRATION_PRESENT when a failed row exists. Note that NOTICE
 * output is not echoed by db execute — that's why exit code 0 (not
 * NOTICE text) is the healthy signal.
 *
 * Fail-loud policy: unexpected probe errors are rethrown — this guard
 * must never mask a different database problem.
 */
import { execFileSync } from "node:child_process"

// Names of migrations known to have failed mid-apply on production and
// safe to roll back + retry because their SQL is idempotent.
const RESOLVABLE = ["20261105000000_onboarding_answers"]

function runPrisma(args, { input } = {}) {
  return execFileSync("npx", ["prisma", ...args], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    input,
    env: { ...process.env },
  })
}

for (const name of RESOLVABLE) {
  // Probe: abort with a distinctive exception when a FAILED row exists.
  const probeSql = `DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE migration_name = '${name}'
      AND finished_at IS NULL
      AND rolled_back_at IS NULL
  ) THEN
    RAISE EXCEPTION 'FAILED_MIGRATION_PRESENT';
  END IF;
END $$;`

  let probeError = null
  try {
    runPrisma(["db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], { input: probeSql })
  } catch (err) {
    probeError = err
  }

  if (!probeError) {
    // DO block completed → no failed row for this migration.
    console.log(`resolve-guard: ${name} is healthy — nothing to do`)
    continue
  }

  const probeOutput = `${probeError.stdout || ""}${probeError.stderr || ""}`
  if (!probeOutput.includes("FAILED_MIGRATION_PRESENT")) {
    console.error(
      `resolve-guard: probe failed unexpectedly (not a failed-migration signal):\n${probeOutput}`
    )
    process.exit(1)
  }

  console.log(`resolve-guard: ${name} is FAILED — marking rolled back for retry…`)
  runPrisma(["migrate", "resolve", "--rolled-back", name, "--schema", "prisma/schema.prisma"])
  console.log(`resolve-guard: ${name} rolled back; migrate deploy will retry it (idempotent SQL).`)
}
