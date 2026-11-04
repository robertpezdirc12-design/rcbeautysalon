/**
 * P1 #76 — opomniki 24 h pred terminom (edini sistemski casovnik v izdelku).
 *
 * Dve pravili pomembnejši od kode:
 *
 * 1. AT-LEAST-ONCE, namenoma: `reminderSentAt` se zapiše PO uspešnem
 *    pošiljanju. Če proces pade med pošiljanjem in zapisom, bo naslednji
 *    tek opomnik poslal ponovno — podvojen opomnik je neškodljiv, izpuščen
 *    pa ne. To je dokumentirana odločitev, ne napaka.
 *
 * 2. NIKOLI za CANCELLED / NO_SHOW: statusni filter spodaj je del
 *    pogodbe, ne optimizacija — odpovedani termin ne dobi opomnika.
 *
 * Idempotentnost: `reminderSentAt = null` je ključ — drugi tek ne pošlje
 * ničesar istemu terminu. Okno 23–25 h pred startTime pomeni, da 15-minutni
 * cron teče 8-krat čez okno; brez idempotentnega zapisa bi to pomenilo
 * 8 opomnikov.
 */

import { prisma } from "@/lib/prisma"
import { isEmailServiceConfigured } from "@/lib/email/config"
import { sendAppointmentReminderEmail } from "@/lib/email/appointment-reminder"
import { formatSalonTime } from "@/lib/booking-time"
import type { Prisma } from "@prisma/client"

const BATCH_SIZE = 100

/** Čisto okno opomnika (23–25 h v prihodnje) — testabilno. */
export function reminderWindow(now: Date = new Date()): {
  horizonStart: Date
  horizonEnd: Date
} {
  return {
    horizonStart: new Date(now.getTime() + 23 * 3_600_000),
    horizonEnd: new Date(now.getTime() + 25 * 3_600_000),
  }
}

export async function sendDueReminders(now: Date = new Date()): Promise<{
  sent: number
  failed: number
  skipped?: string
  detail?: Record<string, unknown>
}> {
  if (!isEmailServiceConfigured()) {
    // Brez Resend ključa job mirno izstopi — brez izjem, brez retry storma.
    return { sent: 0, failed: 0, skipped: "no-email-transport" }
  }

  const { horizonStart, horizonEnd } = reminderWindow(now)

  const due = await prisma.appointment.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      reminderSentAt: null, // ← idempotentnost
      startTime: { gte: horizonStart, lt: horizonEnd },
    },
    take: BATCH_SIZE, // omejena serija na tek
    orderBy: { startTime: "asc" },
    include: {
      customer: { select: { name: true, email: true } },
      staff: { select: { name: true } },
      services: { include: { service: { select: { name: true, duration: true } } } },
      organization: { select: { id: true, name: true } },
    },
  })

  let sent = 0
  let failed = 0

  // Posamezen neuspeh ne ustavi serije (allSettled na nivoju TERMINA).
  await Promise.allSettled(
    due.map(async (appt) => {
      const email = appt.customer?.email || appt.guestEmail
      if (!email) {
        // Brez kanala ne moremo opomniti — zapišemo reminderSentAt, da
        // termin ne blokira serije za vedno (opomnik brez naslova ne obstaja).
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { reminderSentAt: new Date() },
        })
        return
      }

      const serviceName =
        appt.services.map((s) => s.service.name).join(", ") || "Termin"
      const customerName = appt.customer?.name || appt.guestName || ""
      // Pošiljatelj/identiteta vedno iz ORGANIZACIJE termina — najemniško varno.
      const orgName = appt.organization?.name || "Salon"

      const result = await sendAppointmentReminderEmail({
        email,
        customerName,
        serviceName,
        staffName: appt.staff?.name || orgName,
        appointmentDate: appt.startTime,
        appointmentTime: formatSalonTime(appt.startTime, "Europe/Ljubljana"),
        duration:
          appt.services.reduce((sum, s) => sum + (s.service.duration ?? 0), 0) ||
          60,
        reminderType: "24h",
      })

      if (result?.success === false) {
        failed += 1
        return
      }

      // Zapis šele PO uspešnem pošiljanju (at-least-once, glej zgoraj).
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: new Date() },
      })
      sent += 1
    })
  )

  return { sent, failed, detail: { due: due.length, horizonStart, horizonEnd } }
}

/** Prisma where za opomnike — export za teste pogodbe (statusi, okno). */
export function dueReminderWhere(
  now: Date = new Date()
): Prisma.AppointmentWhereInput {
  const { horizonStart, horizonEnd } = reminderWindow(now)
  return {
    status: { in: ["PENDING", "CONFIRMED"] },
    reminderSentAt: null,
    startTime: { gte: horizonStart, lt: horizonEnd },
  }
}
