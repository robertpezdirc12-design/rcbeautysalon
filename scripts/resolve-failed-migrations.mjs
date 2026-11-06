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
const RESOLVABLE = [
  "20261105000000_onboarding_answers",
  // P2 #59: first attempt used an invalid UPDATE ... FROM (target-table
  // reference inside a FROM-join ON clause) and failed on production.
  // The SQL is now valid + fully idempotent (IF NOT EXISTS everywhere).
  "20261126000000_p59_preset_seed_provenance",
  // #100 8.A/8.C: shipped as models without a migration → production ran
  // on P2021 (public.OrganizationMember missing) until the hand-written
  // migration landed. SQL is fully idempotent (IF NOT EXISTS / pg_constraint
  // probes), so a retry after rollback is always safe.
  "20261129030000_p100_8a_8c_org_members_module_states",
  // #100 F1 (P2022 fix): full schema-sync pair (enums + structure). The
  // production DB was built from db push + partially applied migrations
  // (drift), so schema-only additions (Organization.skdCodes aa6b7e2 and
  // others) were missing → P2022. Both migrations are fully idempotent
  // (IF NOT EXISTS / DO-block probes / nothing is dropped), retry-safe.
  "20261129040000_p100_f1_sync_enum_types",
  "20261129050000_p100_f1_full_schema_sync",
  // #100 demo-front neutralize: plain scoped UPDATEs (flip isActive/forSale/
  // isFeatured to false + demo org vertical/name). Fully idempotent (WHERE
  // predicates on current values), so a retry after rollback is always safe.
  "20261130000000_p100_demo_front_neutralize",
  // #110-sled (ba83849): schema_convergence_f2_f5 je odletela na produkciji
  // (15:52 UTC 2026-11-06) in je bila REVERTIRANA iz repozitorija (3ab8398).
  // Uspela je delno — objekti IF NOT EXISTS so obstali — tabela
  // OrganizationModuleState je živa (modulna vrata delujejo na produkciji
  // pred tem). Failed vrstica v _prisma_migrations je zastavila P3009 za
  // vsak naslednji deploy. Fail CLOSED tukaj pomeni: platforma ne more
  // deployati sploh. Resolve --rolled-back je varen: datoteka migracije
  // ne obstaja več, migrate deploy je ne bo ponovil, objekti ostanejo.
  "20261106090000_schema_convergence_f2_f5",
]

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
  // Fresh-database path (#100 F0 proof, 2026-11-05): when the database has
  // no _prisma_migrations table yet (P1014), there can be no FAILED row —
  // the probe must treat that as healthy instead of failing the build.
  // This happens on brand-new local/dev databases before the first
  // `prisma migrate deploy` creates the table.
  if (/P1014|_prisma_migrations"? (table )?does not exist/i.test(probeOutput)) {
    console.log(
      `resolve-guard: ${name} — _prisma_migrations table not present (fresh DB); no failed migrations possible`
    )
    continue
  }
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

// --- Migration advisory-lock janitor (P1002 recovery) ----------------------
// `prisma migrate deploy` takes pg_advisory_lock(72707369) and gives up
// after 10 s (P1002). Zombie sessions (e.g. a build whose TCP connection
// died without the server noticing — common with serverless Postgres)
// keep holding that session-level lock and block every subsequent build.
//
// Best-effort recovery:
//  1. Terminate IDLE backends holding the migration advisory lock
//     (an idle session cannot be a legitimate concurrent migration).
//  2. Report any REMAINING holders (these are ACTIVE) via a RAISE
//     EXCEPTION — the message lands in the build log, since `db execute`
//     cannot return SELECT results. If one exists, migrate deploy below
//     will fail loudly again — which is correct: a live concurrent
//     migration must not be killed silently.
const advisoryLockSql = `
WITH holders AS (
  SELECT a.pid, a.state, a.query_start, left(a.query, 60) AS query
  FROM pg_locks l
  JOIN pg_stat_activity a ON a.pid = l.pid
  WHERE l.locktype = 'advisory' AND l.classid = 0 AND l.objid = 72707369
    AND a.pid <> pg_backend_pid()
)
SELECT pg_terminate_backend(pid) FROM holders
WHERE state IN ('idle', 'idle in transaction', 'idle in transaction (aborted)');`

try {
  runPrisma(["db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], {
    input: advisoryLockSql,
  })
} catch (err) {
  // Fail-loud only for unexpected errors; best-effort janitor otherwise.
  const out = `${err.stdout || ""}${err.stderr || ""}`
  if (!/does not exist|permission denied/i.test(out)) {
    console.error(`resolve-guard: advisory-lock janitor failed:\n${out}`)
    process.exit(1)
  }
  console.log(`resolve-guard: janitor skipped (${out.slice(0, 120)})`)
}

const lockHolderSql = `DO $$ DECLARE r record;
BEGIN
  FOR r IN
    SELECT a.pid, a.state, now() - a.state_change AS idle_for, left(a.query, 80) AS query
    FROM pg_locks l
    JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE l.locktype = 'advisory' AND l.classid = 0 AND l.objid = 72707369
      AND a.pid <> pg_backend_pid()
  LOOP
    RAISE EXCEPTION 'MIGRATION_LOCK_HOLDER pid=% state=% idle_for=% query=%',
      r.pid, r.state, r.idle_for, r.query;
  END LOOP;
END $$;`

try {
  runPrisma(["db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], {
    input: lockHolderSql,
  })
  console.log("resolve-guard: migration advisory lock is free")
} catch (err) {
  const out = `${err.stdout || ""}${err.stderr || ""}`
  if (out.includes("MIGRATION_LOCK_HOLDER")) {
    console.error(`resolve-guard: ACTIVE migration lock holder still present:\n${out}`)
    // Don't kill active migrations; let migrate deploy fail loudly if the
    // lock is genuinely contested.
  } else {
    console.error(`resolve-guard: lock-holder check failed:\n${out}`)
    process.exit(1)
  }
}
