// ============================================================
// #95 — MARKETING AVTOMATIKA (dnevni job)
// Tek na obstoječem cronu (tick): za vsako OMOGOČENO kampanjo najde
// eligibilne stranke (čista jedra v marketing/campaigns.ts), pošlje
// e-pošto in zapiše CampaignSend (dedup na ravni unikatnega indeksa).
// Poštenost: brez RESEND_API_KEY pošiljanje neuspešno → send se NE
// zapiše → naslednji dan poskus ponovimo (dedup je na USPEH, ne na
// poskus). Vstavitve se izračunajo strežniško iz DB.
// ============================================================

import { prisma } from "@/lib/prisma"
import { addDays } from "date-fns"
import {
  interpolate,
  pickNoShowTargets,
  pickReactivationTargets,
  type CampaignTarget,
} from "@/lib/marketing/campaigns"
import { sendMarketingCampaignEmail } from "@/lib/email/marketing-campaign"
import type { JobRunResult } from "./job-run"
import { toDateKey, dayBounds, safeTimezone } from "@/lib/booking-time"

/** Salon-lokalni datum ključ za Date (prek org timezone). */
function salonDateKey(date: Date, tz: string): string {
  return toDateKey(date, tz) ?? date.toISOString().slice(0, 10)
}

export async function sendMarketingEmails(now: Date = new Date()): Promise<JobRunResult> {
  const campaigns = await prisma.marketingCampaign.findMany({
    where: { enabled: true },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  })

  let sent = 0
  let failed = 0

  for (const campaign of campaigns) {
    const org = campaign.organization
    const tzRow = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { timezone: true },
    })
    const tz = safeTimezone(tzRow?.timezone)
    const bookingLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/s/${org.slug}/booking`
    const business = org.name
    let targets: CampaignTarget[] = []

    if (campaign.kind === "REACTIVATION") {
      // Vsi zaključeni termini najemnika z znano e-pošto (stranka ali gost).
      const completed = await prisma.appointment.findMany({
        where: {
          organizationId: org.id,
          status: "COMPLETED",
        },
        select: {
          id: true,
          startTime: true,
          customerId: true,
          guestEmail: true,
          customer: { select: { email: true, name: true } },
        },
      })
      const visits = completed
        .map((a) => {
          const email = a.customer?.email ?? a.guestEmail
          if (!email) return null
          return {
            id: a.id,
            email,
            name: a.customer?.name ?? "Stranka",
            completedOn: salonDateKey(a.startTime, tz),
          }
        })
        .filter((v): v is NonNullable<typeof v> => v !== null)
      // +"prihajajoči" indikator: prihajajoči PENDING/CONFIRMED termini
      // istih e-pošt izključijo stranko (aktivna je, reaktivacija neprimerna).
      const futureRows = await prisma.appointment.findMany({
        where: {
          organizationId: org.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          startTime: { gt: now },
        },
        select: {
          customer: { select: { email: true } },
          guestEmail: true,
        },
      })
      const visitsWithFutureFlag = [
        ...visits,
        ...futureRows
          .map((f) => {
            const email = f.customer?.email ?? f.guestEmail
            if (!email) return null
            // Fiktivni "prihodnji" vpis v > today — samo za hasFuture flag.
            return { id: "future", email, name: "", completedOn: "9999-12-31" }
          })
          .filter((v): v is NonNullable<typeof v> => v !== null),
      ]
      targets = pickReactivationTargets(visitsWithFutureFlag, {
        thresholdDays: campaign.thresholdDays,
        today: now,
        business,
        bookingLink,
      })
    } else {
      // NO_SHOW: včeraj (salon-lokalno) ne-prisotni termini z e-pošto.
      // #93-vzorec: UTC meje iz salon-lokalnega dnevnega ključa (dayBounds),
      // nikoli Z-konkatenacija.
      const yesterday = salonDateKey(addDays(now, -1), tz)
      const bounds = dayBounds(yesterday, tz)
      if (!bounds) {
        return { sent, failed, detail: { campaigns: campaigns.length, skipped: "bad-timezone" } }
      }
      const noShows = await prisma.appointment.findMany({
        where: {
          organizationId: org.id,
          status: "NO_SHOW",
          startTime: { gte: bounds.start, lte: bounds.end },
        },
        select: {
          id: true,
          startTime: true,
          customerId: true,
          guestEmail: true,
          customer: { select: { email: true, name: true } },
        },
      })
      const rows = noShows
        .map((a) => {
          const email = a.customer?.email ?? a.guestEmail
          if (!email) return null
          return {
            id: a.id,
            email,
            name: a.customer?.name ?? "Stranka",
            missedOn: salonDateKey(a.startTime, tz),
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
      targets = pickNoShowTargets(rows, { today: now, business, bookingLink })
    }

    // Dedup: preveri, kateri triggerKey-i so za to kampanjo že poslani.
    const alreadySent = await prisma.campaignSend.findMany({
      where: { campaignId: campaign.id, email: { in: targets.map((t) => t.email) } },
      select: { email: true, triggerKey: true },
    })
    const sentKeys = new Set(alreadySent.map((s) => `${s.email}:${s.triggerKey}`))
    const pending = targets.filter((t) => !sentKeys.has(`${t.email}:${t.triggerKey}`))

    for (const target of pending) {
      const subject = interpolate(campaign.subject, target.vars)
      const body = interpolate(campaign.body, target.vars)
      const result = await sendMarketingCampaignEmail({
        email: target.email,
        subject,
        body,
        businessName: business,
      })
      if (result.success) {
        // CampaignSend ŠELE ob uspehu — neuspešno pošiljanje se poskusi
        // znova naslednji dan (dedup na uspeh, ne na poskus).
        await prisma.campaignSend
          .create({
            data: {
              campaignId: campaign.id,
              email: target.email,
              triggerKey: target.triggerKey,
            },
          })
          .catch((e) => {
            // P2002 (sočasen dedup) je neškodljiv — e-pošta je že odšla
            // v drugem teku; ne logiramo kot napako pošiljanja.
            console.error("[marketing] CampaignSend write failed:", e)
          })
        sent += 1
      } else {
        failed += 1
      }
    }

    await prisma.marketingCampaign.update({
      where: { id: campaign.id },
      data: { lastRunAt: now },
    })
  }

  return {
    sent,
    failed,
    detail: { campaigns: campaigns.length },
  }
}
