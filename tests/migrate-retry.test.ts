import { describe, it, expect, vi } from "vitest"
import {
  ensureDatabaseUrl,
  runMigrationsWithRetry,
} from "../scripts/migrate-with-retry.mjs"

// ============================================================
// P2-C (lastnik, 7. 11. 2026): prehoden izpad serverless Postgresa
// (Neon pool timeout / TCP reset) ne sme odnesti CELOTNEGA Vercel
// deploya (so 7. 11. zgodilo: dc2495b docs-only commit, Vercel failure).
// Celoten migracijski korak je zavitek v ponovitve z odmiki — trajne
// napake padejo na vseh poskusih (deploy ustavljen z jasnim dnevnikom),
// prehodne se absorbirajo.
// ============================================================

describe("ensureDatabaseUrl", () => {
  it("fail-fast brez DATABASE_URL (ponovitve ne rešijo konfiguracije)", () => {
    const log = { error: vi.fn(), log: vi.fn() }
    expect(ensureDatabaseUrl({}, log)).toBe(false)
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("DATABASE_URL"))
  })

  it("preide z nastavljenim DATABASE_URL", () => {
    expect(ensureDatabaseUrl({ DATABASE_URL: "postgres://x" }, console)).toBe(true)
  })
})

describe("runMigrationsWithRetry", () => {
  const quietLog = { log: vi.fn(), error: vi.fn() }
  const instantSleep = vi.fn().mockResolvedValue(undefined)

  it("uspe na prvem poskusu — brez čakanja", async () => {
    const runner = vi.fn().mockResolvedValue(undefined)
    const out = await runMigrationsWithRetry({
      runner,
      attempts: 4,
      backoffMs: 100,
      sleep: instantSleep,
      log: quietLog,
    })
    expect(out.ok).toBe(true)
    expect(out.attempts).toBe(1)
    expect(runner).toHaveBeenCalledTimes(1)
    expect(instantSleep).not.toHaveBeenCalled()
  })

  it("prehodna napaka: pade 2×, uspe na 3. poskusu", async () => {
    const runner = vi
      .fn()
      .mockRejectedValueOnce(new Error("P1001: can't reach database"))
      .mockRejectedValueOnce(new Error("Connection terminated unexpectedly"))
      .mockResolvedValueOnce(undefined)
    const out = await runMigrationsWithRetry({
      runner,
      attempts: 4,
      backoffMs: 100,
      sleep: instantSleep,
      log: quietLog,
    })
    expect(out.ok).toBe(true)
    expect(out.attempts).toBe(3)
    expect(instantSleep).toHaveBeenCalledTimes(2)
  })

  it("odmiki rastejo z poskusom (backoff × poskus)", async () => {
    const runner = vi.fn().mockRejectedValue(new Error("down"))
    const sleeps: number[] = []
    const out = await runMigrationsWithRetry({
      runner,
      attempts: 4,
      backoffMs: 15_000,
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      log: quietLog,
    })
    expect(out.ok).toBe(false)
    expect(out.attempts).toBe(4)
    expect(sleeps).toEqual([15_000, 30_000, 45_000])
  })

  it("trajna napaka: vsi poskusi padejo, deploy se ustavi z ok:false", async () => {
    const runner = vi.fn().mockRejectedValue(new Error("P3006: migration failed"))
    const out = await runMigrationsWithRetry({
      runner,
      attempts: 3,
      backoffMs: 10,
      sleep: instantSleep,
      log: quietLog,
    })
    expect(out.ok).toBe(false)
    expect(runner).toHaveBeenCalledTimes(3)
    expect(out.output).toContain("P3006")
  })
})
