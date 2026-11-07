#!/usr/bin/env node
/**
 * P2-C hardening (lastnik, 7. 11. 2026): `prisma migrate deploy` je bil
 * dober direkt v build skripti — prehoden izpad serverless Postgresa
 * (Neon pool timeout, TCP reset) je ODNESEL CELOTAN Vercel deploy (so 7. 11.
 * tudi zgodilo: dc2495b docs-only commit, lokalni next build zelen, Vercel
 * failure). Migracije MORAJO teči pred objavo (shema ↔ koda), zato jih ne
 * odstranimo iz builda — ampak celoten korak zavijemo v ponovitve z odmiki:
 *
 *   poskus 1 → fail → 15 s → poskus 2 → fail → 30 s → poskus 3 → fail →
 *   45 s → poskus 4 → fail → DEPLOY Pade (trajne napake morajo ostati
 *   vidne; prehodne se absorbirajo).
 *
 * Vsak poskus teče celoten zaporedje: resolve-failed-migrations.mjs
 * (P3009 varovalka + advisory-lock čistilec, idempotenten) →
 * `prisma migrate deploy`. Iz mišljenih razlogov NE poskušamo ločevati
 * "prehodnih" od "trajnih" napak — trajna napaka pade na vseh poskusih
 * in deploy pade z jasnim dnevnikom, kar je pravilno vedenje.
 *
 * Nastavitve prek env:
 *   MIGRATE_RETRY_ATTEMPTS   (privzeto 4)
 *   MIGRATE_RETRY_BACKOFF_MS (privzeto 15000; poskus n čaka n × backoff)
 */

import { execFileSync } from "node:child_process"

const DEFAULT_ATTEMPTS = 4
const DEFAULT_BACKOFF_MS = 15_000

/** Zadnji del dnižnika za log — celoten izpis bi utopil Vercel build log. */
function tail(text, max = 1_200) {
  const clean = (text || "").trim()
  return clean.length <= max ? clean : "…" + clean.slice(-max)
}

/**
 * Fail-fast, če ni baze — ponovitve ne rešijo manjkajoče konfiguracije.
 * @param {{ DATABASE_URL?: string }} [env]
 * @param {{ log: (...a: unknown[]) => void, error: (...a: unknown[]) => void }} [log]
 */
export function ensureDatabaseUrl(env = process.env, log = console) {
  if (!env.DATABASE_URL) {
    log.error(
      "[migrate-retry] DATABASE_URL ni nastavljen — migracij ne morem pognati. " +
        "Preveri Vercel env / .env."
    )
    return false
  }
  return true
}

/**
 * Čista (vbrizgana) jedra za teste: `runner(attempt)` izvede en poskus in
 * vrže ob napaki; `sleep(ms)` čaka. Vrne { ok, attempts, output }.
 */
/**
 * @param {{ runner: (attempt: number) => Promise<void>, attempts?: number, backoffMs?: number, sleep?: (ms: number) => Promise<void>, log?: { log: (...a: unknown[]) => void, error: (...a: unknown[]) => void } }} opts
 */
export async function runMigrationsWithRetry({
  runner,
  attempts = DEFAULT_ATTEMPTS,
  backoffMs = DEFAULT_BACKOFF_MS,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = console,
}) {
  let lastOutput = ""
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await runner(attempt)
      if (attempt > 1) {
        log.log(`[migrate-retry] uspeh na poskusu ${attempt}/${attempts}`)
      }
      return { ok: true, attempts: attempt, output: "" }
    } catch (err) {
      lastOutput = (err?.stdout || "") + (err?.stderr || "") + (err?.message || "")
      log.error(
        `[migrate-retry] poskus ${attempt}/${attempts} NAPAKA:\n${tail(lastOutput)}`
      )
      if (attempt < attempts) {
        const wait = backoffMs * attempt
        log.log(`[migrate-retry] čakam ${Math.round(wait / 1000)} s pred ponovitvijo…`)
        await sleep(wait)
      }
    }
  }
  return { ok: false, attempts, output: lastOutput }
}

async function main() {
  if (!ensureDatabaseUrl(process.env)) process.exit(1)

  const attempts = Number(process.env.MIGRATE_RETRY_ATTEMPTS || DEFAULT_ATTEMPTS)
  const backoffMs = Number(process.env.MIGRATE_RETRY_BACKOFF_MS || DEFAULT_BACKOFF_MS)
  console.log(
    `[migrate-retry] migracije z retry-jem: ${attempts} poskusov, odmik ${backoffMs} ms × poskus`
  )

  const runner = async () => {
    // 1) P3009 varovalka + advisory-lock čistilec (idempotenten, fail-loud).
    execFileSync(process.execPath, ["scripts/resolve-failed-migrations.mjs"], {
      stdio: "inherit",
      env: { ...process.env },
    })
    // 2) Migracije — pred objavo, zato znotraj builda (glej glavo).
    execFileSync(
      "npx",
      ["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"],
      { stdio: "inherit", env: { ...process.env } }
    )
  }

  const result = await runMigrationsWithRetry({ runner, attempts, backoffMs })
  if (!result.ok) {
    console.error(
      `[migrate-retry] VSA poskusi (${result.attempts}) so padli — deploy USTAVLJEN. ` +
        `Napaka ni prehodna: preveri migracije/bazo.\n${tail(result.output)}`
    )
    process.exit(1)
  }
  console.log("[migrate-retry] shema baze je aktualna — nadaljujem z buildom.")
}

// Izvedi samo, če je to glavni modul (testi importajo helperje).
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())
if (isMain) {
  main().catch((err) => {
    console.error(`[migrate-retry] nepričakovana napaka:\n${tail(err?.stack || String(err))}`)
    process.exit(1)
  })
}
