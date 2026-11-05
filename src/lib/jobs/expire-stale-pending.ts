/**
 * P1 #76 — potekli PENDING termini → CANCELLED (+ e-pošta o preteku).
 *
 * Enaka pravila kot lenobni čiščenje v getAdminAppointments (dashboard),
 * ampak GLOBALNO in ZAŽOGANO: lenobna verzija se sproži šele, ko kdo
 * odpre nadzorno ploščo — najemnik, ki vikend ne odpre dashboarda, je
 * imel zamrznjene PENDING terme tri dni. Ta job je zanesljiva pot,
 * dashboard ostaneta pasovni varovalki.
 *
 * CONFIRMED termini, katerih endTime je minil → NO_SHOW (brez e-pošte,
 * enako kot obstoječe lenobno čiščenje).
 */

import { prisma } from "@/lib/prisma"
import { isEmailServiceConfigured } from "@/lib/email/config"
import { sendAppointmentExpiredEmail } from "@/lib/email/appointment-expired"
import { formatSalonTime } from "@/lib/booking-time"
import { chargeNoShowFee } from "@/lib/booking/no-show-charge"

const BATCH_SIZE = 100

export async function expireStalePending(
  now: Date = new Date()
): Promise<{ sent: number; failed: number; skipped?: string; detail?: Record<string, unknown> }> {
  if (!isEmailServiceConfigured()) {
    // Tudi brez e-pošte mora stanja čistiti — samo pošiljanje se izpusti.
    const quiet = await cancelStale(now, false)
    return { sent: 0, failed: 0, skipped: "no-email-transport", detail: quiet }
  }

  const detail = await cancelStale(now, true)
  return { sent: detail.notified, failed: detail.notifyFailed, detail }
}

async function cancelStale(
  now: Date,
  notify: boolean
): Promise<{
  cancelled: number
  noShow: number
  notified: number
  notifyFailed: number
  charged: number
  chargeFailed: number
}> {
  let cancelled = 0
  let noShow = 0
  let notified = 0
  let notifyFailed = 0
  let charged = 0
  let chargeFailed = 0

  // --- PENDING + endTime v preteklosti → CANCELLED (+ opis o preteku) ---
  const stale = await prisma.appointment.findMany({
    where: { status: "PENDING", endTime: { lt: now } },
    take: BATCH_SIZE,
    orderBy: { startTime: "asc" },
    include: {
      customer: { select: { name: true, email: true } },
      staff: { select: { name: true } },
      services: { include: { service: { select: { name: true } } } },
    },
  })

  await Promise.allSettled(
    stale.map(async (appt) => {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { status: "CANCELLED" },
      })
      cancelled += 1

      const email = appt.customer?.email || appt.guestEmail
      if (notify && email) {
        try {
          const result = await sendAppointmentExpiredEmail({
            email,
            customerName: appt.customer?.name || appt.guestName || "Customer",
            serviceName: appt.services.map((s) => s.service.name).join(", "),
            staffName: appt.staff?.name || "Our Staff",
            appointmentDate: appt.startTime,
            appointmentTime: formatSalonTime(appt.startTime, "Europe/Ljubljana"),
            depositAmount: appt.depositAmount.toNumber(),
          })
          if (result?.success === false) notifyFailed += 1
          else notified += 1
        } catch {
          notifyFailed += 1
        }
      }
    })
  )

  // --- CONFIRMED + endTime v preteklosti → NO_SHOW ---
  const noShowResult = await prisma.appointment.updateMany({
    where: { status: "CONFIRMED", endTime: { lt: now } },
    data: { status: "NO_SHOW" },
  })
  noShow = noShowResult.count

  // --- #97 (AD-07): bremenitev pologa ob no-show (garancija s kartico)
  // Samo kandidati z veljavnimi pogoji (shouldChargeOnNoShow v helperju);
  // vsak poskus neodvisen — neuspeh enega ne ustavi ostalih.
  const chargeCandidates = await prisma.appointment.findMany({
    where: {
      status: "NO_SHOW",
      noShowConsent: true,
      noShowSetupStatus: "SAVED",
      noShowChargeStatus: "NONE",
      depositPaid: false,
      stripeSetupIntentId: { not: null },
      stripeCustomerId: { not: null },
    },
    select: { id: true },
  })
  for (const candidate of chargeCandidates) {
    const result = await chargeNoShowFee(candidate.id)
    if (result.charged) charged += 1
    else if (result.error) chargeFailed += 1
  }

  return { cancelled, noShow, notified, notifyFailed, charged, chargeFailed }
}
