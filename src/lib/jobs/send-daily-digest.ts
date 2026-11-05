// ============================================================
// #99 — DNEVNI DIGEST (cron job)
// Za vsak AKTIVEN najemnik: povzetek dneva (termini danes po salon-
// lokalnem času, nove rezervacije 24 h, odpovedi 24 h, jutri) po
// e-pošti ADMIN uporabnikom. Poštenost: digest gre SAMO, ko se je
// kaj zgodilo (digestWorthSending) — brez vsakodnevnega praznega
// šuma. Statistika je dejansko iz podatkov, ne ocene.
// ============================================================

import { prisma } from "@/lib/prisma"
import { addDays } from "date-fns"
import { isEmailServiceConfigured } from "@/lib/email/config"
import { sendDailyDigestEmail } from "@/lib/email/daily-digest"
import { buildDigestEmail, digestWorthSending, type DigestStats } from "@/lib/push/core"
import { toDateKey, dayBounds, safeTimezone } from "@/lib/booking-time"

export async function sendDailyDigest(now: Date = new Date()): Promise<{
  sent: number
  failed: number
  skippedEmpty: number
}> {
  if (!isEmailServiceConfigured()) {
    return { sent: 0, failed: 0, skippedEmpty: 0 }
  }

  const orgs = await prisma.organization.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
  })

  let sent = 0
  let failed = 0
  let skippedEmpty = 0

  for (const org of orgs) {
    const tzRow = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { timezone: true },
    })
    const tz = safeTimezone(tzRow?.timezone)

    const todayKey = toDateKey(now, tz) ?? now.toISOString().slice(0, 10)
    const todayLabel = todayKey
      .split("-")
      .reverse()
      .join(".")
    const tomorrow = addDays(now, 1)
    const tomorrowKey = toDateKey(tomorrow, tz) ?? ""

    const todayBounds = dayBounds(todayKey, tz)
    const tomorrowBounds = tomorrowKey ? dayBounds(tomorrowKey, tz) : null
    const since24h = new Date(now.getTime() - 24 * 3_600_000)

    const [today, newBookings, cancellations, tomorrowCount, admins] =
      await Promise.all([
        todayBounds
          ? prisma.appointment.findMany({
              where: {
                organizationId: org.id,
                status: { in: ["CONFIRMED", "PENDING"] },
                startTime: { gte: todayBounds.start, lte: todayBounds.end },
              },
              select: {
                startTime: true,
                customer: { select: { name: true } },
                guestName: true,
                services: { select: { service: { select: { name: true } } } },
              },
              orderBy: { startTime: "asc" },
            })
          : Promise.resolve([]),
        prisma.appointment.count({
          where: { organizationId: org.id, createdAt: { gte: since24h } },
        }),
        prisma.appointment.count({
          where: {
            organizationId: org.id,
            status: "CANCELLED",
            updatedAt: { gte: since24h },
          },
        }),
        tomorrowBounds
          ? prisma.appointment.count({
              where: {
                organizationId: org.id,
                status: { in: ["CONFIRMED", "PENDING"] },
                startTime: { gte: tomorrowBounds.start, lte: tomorrowBounds.end },
              },
            })
          : Promise.resolve(0),
        prisma.user.findMany({
          where: { role: "ADMIN", organizationId: org.id },
          select: { email: true },
        }),
      ])

    const todayLines = today.map((a) => {
      const time = a.startTime.toISOString().slice(11, 16)
      const who = a.customer?.name ?? a.guestName ?? "Stranka"
      const what = a.services
        .map((s) => s.service.name)
        .join(", ")
      return `${time} — ${what || "termin"} (${who})`
    })

    const stats: DigestStats = {
      todayLabel,
      todayCount: today.length,
      todayLines,
      newBookings,
      cancellations,
      tomorrowCount,
    }
    if (!digestWorthSending(stats)) {
      skippedEmpty += 1
      continue
    }

    const { subject, body } = buildDigestEmail(stats)
    for (const admin of admins) {
      if (!admin.email) continue
      const result = await sendDailyDigestEmail({
        email: admin.email,
        subject,
        body,
        businessName: org.name,
        todayLabel,
      })
      if (result.success) {
        sent += 1
      } else {
        failed += 1
      }
    }
  }

  return { sent, failed, skippedEmpty }
}
