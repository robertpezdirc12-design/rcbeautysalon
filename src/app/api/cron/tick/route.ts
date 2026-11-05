import { NextResponse } from "next/server"
import { sendDueReminders } from "@/lib/jobs/send-due-reminders"
import { expireStalePending } from "@/lib/jobs/expire-stale-pending"
import { sendMarketingEmails } from "@/lib/jobs/send-marketing-emails"
import { sendDailyDigest } from "@/lib/jobs/send-daily-digest"
import { withJobRun } from "@/lib/jobs/job-run"

export const dynamic = "force-dynamic"

/**
 * P1 #76 — edini sistemski časovnik v izdelku (Vercel cron, dnevno 03:00
 * UTC — glej vercel.json; #99: dnevni digest poteče ob istem teku).
 *
 * Varnost: Vercel podpisuje cron zahtevke z `Authorization: Bearer
 * $CRON_SECRET`. Brez ujemanja → 401. Manjkajoč CRON_SECRET v okolju →
 * vedno 401 (route je zaprt, dokler skrivnost ni nastavljena).
 */

/** Čista preverba avtorizacije — testabilna brez HTTP. */
export function isAuthorizedCron(
  authHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret) return false
  return authHeader === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (
    !isAuthorizedCron(req.headers.get("authorization"), process.env.CRON_SECRET)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Vsak job je neodvisen: neuspeh opomnikov ne sme ustaviti čiščenja.
  const [reminders, expiry, marketing, digest] = await Promise.all([
    withJobRun("send-due-reminders", sendDueReminders),
    withJobRun("expire-stale-pending", expireStalePending),
    withJobRun("send-marketing-emails", sendMarketingEmails),
    // #99: dnevni digest lastniku (samo ko se je kaj zgodilo).
    withJobRun("send-daily-digest", sendDailyDigest),
  ])

  return NextResponse.json({
    ok: true,
    results: { reminders, expiry, marketing, digest },
  })
}
