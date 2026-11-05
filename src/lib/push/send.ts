// ============================================================
// #99 — PUSH pošiljanje (web-push / VAPID)
// Pošlje obvestilo VSEM push naročninam ADMIN uporabnikov najemnika.
// Zastarele naročnine (404/410) pobriše — brez kopičenja mrtvih.
// Brez VAPID ključev: pošten no-op (return skipped), nikoli napaka.
// ============================================================

import webpush from "web-push"
import { prisma } from "@/lib/prisma"
import { isPushConfigured, type PushPayload } from "./core"

function vapidSubject(): string {
  return process.env.VAPID_SUBJECT || "mailto:info@markec.si"
}

export async function notifyOrgOwners(
  organizationId: string,
  payload: PushPayload
): Promise<{ sent: number; skipped: boolean }> {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!isPushConfigured(pub, priv)) {
    return { sent: 0, skipped: true }
  }
  webpush.setVapidDetails(vapidSubject(), pub!, priv!)

  // Prejemniki: ADMIN člani najemnika z naročnino (lastnik prvi).
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", organizationId },
    select: { id: true },
  })
  if (admins.length === 0) return { sent: 0, skipped: true }

  const subs = await prisma.pushSubscription.findMany({
    where: { organizationId, userId: { in: admins.map((a) => a.id) } },
  })

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
      sent += 1
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "statusCode" in error
          ? (error as { statusCode?: number }).statusCode
          : undefined
      // 404/410 = naročnina zastarela (odstranjena/ponovno nameščena) — pobriši.
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined)
      }
    }
  }
  return { sent, skipped: false }
}
