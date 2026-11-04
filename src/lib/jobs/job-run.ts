import { prisma } from "@/lib/prisma"

/**
 * P1 #76 — dnevnik poganjanja ozadjih opravil.
 *
 * Tihi cron, ki ne dela nič, je slabši kot nobenega. Vsak tek joba
 * zapiše eno vrstico JobRun s števci — "Ali je opomnik odšel?" je
 * odgovorljivo brez branja Vercel logov.
 */

export interface JobRunResult {
  sent: number
  failed: number
  skipped?: string
  detail?: Record<string, unknown>
}

export interface JobRunOutcome extends JobRunResult {
  ok: boolean
}

/** Ovije tek joba v merjeno vrstico JobRun (tudi ob napaki). */
export async function withJobRun(
  job: string,
  fn: () => Promise<JobRunResult>
): Promise<JobRunOutcome> {
  const startedAt = new Date()
  try {
    const result = await fn()
    await prisma.jobRun
      .create({
        data: {
          job,
          startedAt,
          finishedAt: new Date(),
          ok: true,
          sent: result.sent,
          failed: result.failed,
          detail: (result.detail ?? undefined) as never,
        },
      })
      .catch((e: unknown) => console.error(`[${job}] JobRun write failed:`, e))
    return { ...result, ok: true }
  } catch (error) {
    console.error(`[${job}] crashed:`, error)
    await prisma.jobRun
      .create({
        data: {
          job,
          startedAt,
          finishedAt: new Date(),
          ok: false,
          sent: 0,
          failed: 0,
          detail: { error: String(error) } as never,
        },
      })
      .catch(() => undefined)
    return { sent: 0, failed: 0, ok: false }
  }
}
