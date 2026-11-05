// ============================================================
// #99 — PWA + PUSH + DNEVNI DIGEST (regresijska varovala)
// Čista jedra (payload, konfiguracija, digest) + struktura:
// SW push/click kanali, akcije s sejo, sprožilci na terminih,
// cron žica + dnevni ritem, .env.example dokumentacija.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  buildDigestEmail,
  buildPushPayload,
  digestWorthSending,
  isPushConfigured,
  type DigestStats,
} from "../src/lib/push/core"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

const fullStats = (over?: Partial<DigestStats>): DigestStats => ({
  todayLabel: "5.11.2026",
  todayCount: 2,
  todayLines: ["09:00 — Striženje (Ana)", "11:00 — Barvanje (Bor)"],
  newBookings: 1,
  cancellations: 0,
  tomorrowCount: 3,
  ...over,
})

describe("#99 push payload (enoten oblikovni jezik)", () => {
  it("nov termin: naslov + ime stranke + datum + ruta na termin", () => {
    const p = buildPushPayload("new_appointment", {
      customerName: "Ana Novak",
      date: "09:00",
    })
    expect(p.title).toBe("Nov termin")
    expect(p.body).toContain("Ana Novak")
    expect(p.url).toBe("/dashboard/appointments")
  })

  it("odpoved: brez stranke ostane pošteno splošen tekst", () => {
    const p = buildPushPayload("cancellation", {})
    expect(p.title).toBe("Termin odpovedan")
    expect(p.body).not.toContain("undefined")
  })
})

describe("#99 konfiguracija (poštenost: brez ključev ni push)", () => {
  it("configured samo z obema ključema; prazen/manjkajoč → false", () => {
    expect(isPushConfigured("k", "s")).toBe(true)
    expect(isPushConfigured("", "s")).toBe(false)
    expect(isPushConfigured("k", undefined)).toBe(false)
  })
})

describe("#99 dnevni digest (vsebina iz podatkov, brez šuma)", () => {
  it("termini danes so vidni po urah; števila dejstva", () => {
    const { subject, body } = buildDigestEmail(fullStats())
    expect(subject).toContain("2 terminov")
    expect(body).toContain("09:00 — Striženje (Ana)")
    expect(body).toContain("Nove rezervacije (24 h): 1")
    expect(body).toContain("Termini jutri: 3")
  })

  it("dan brez terminov → pošten naslov, ni lažnih trditev", () => {
    const { subject } = buildDigestEmail(fullStats({ todayCount: 0, todayLines: [] }))
    expect(subject).toContain("brez terminov")
  })

  it("worth sending samo ko se je kaj zgodilo (prazen dan → tišina)", () => {
    expect(digestWorthSending(fullStats())).toBe(true)
    expect(
      digestWorthSending(
        fullStats({
          todayCount: 0,
          todayLines: [],
          newBookings: 0,
          cancellations: 0,
          tomorrowCount: 0,
        })
      )
    ).toBe(false)
  })
})

describe("#99 struktura: SW, akcije, sprožilci, cron", () => {
  it("service worker: push kanal + klik odpri/fokusiraj, brez cache strategij", () => {
    const sw = read("public/sw.js")
    expect(sw).toContain("addEventListener(\"push\"")
    expect(sw).toContain("addEventListener(\"notificationclick\"")
    expect(sw).toContain("showNotification")
    expect(sw).not.toContain("cache.addAll")
    expect(sw).not.toContain("caches.open")
  })

  it("akcije: seja obvezna, endpoint dedup (upsert), lastnik briše svoje", () => {
    const actions = read("src/app/actions/push.ts")
    expect(actions).toContain("session?.user?.id")
    expect(actions).toContain("prisma.pushSubscription.upsert")
    expect(actions).toContain("where: { endpoint, userId: session.user.id }")
    expect(actions).toContain("isPushConfigured(process.env.VAPID_PUBLIC_KEY")
  })

  it("sprožilci: nov termin + odpoved kličeta notifyOrgOwners po commitu", () => {
    const appointments = read("src/app/actions/appointments.ts")
    expect(appointments).toContain('buildPushPayload("new_appointment"')
    expect(appointments).toContain('buildPushPayload("cancellation"')
    expect(appointments).toContain("notifyOrgOwners")
  })

  it("pošiljanje: samo ADMIN člani najemnika, 404/410 pobere zastarele", () => {
    const send = read("src/lib/push/send.ts")
    expect(send).toContain('role: "ADMIN", organizationId')
    expect(send).toContain("status === 404 || status === 410")
    expect(send).toContain("isPushConfigured")
  })

  it("cron: digest je 4. job, ritem usklajen z vercel.json (dnevno)", () => {
    const cron = read("src/app/api/cron/tick/route.ts")
    expect(cron).toContain('"send-daily-digest"')
    expect(cron).not.toContain("15 min")
    const vercel = read("vercel.json")
    expect(vercel).toContain("0 3 * * *")
  })

  it("UI: kartica v nastavitvah je poštena brez ključev; SW registracija tiha", () => {
    const card = read("src/components/dashboard/push-card.tsx")
    expect(card).toContain("Push ni nastavljen na strežniku")
    expect(card).toContain("requestPermission")
    const setup = read("src/components/dashboard/push-setup.tsx")
    expect(setup).toContain('register("/sw.js")')
  })

  it("digest e-pošta NI marketinška (brez odjave) in je dokumentirana v .env.example", () => {
    const tpl = read("src/lib/email/templates/daily-digest-template.tsx")
    expect(tpl).not.toContain("unsubscribe")
    const env = read(".env.example")
    expect(env).toContain("VAPID_PUBLIC_KEY")
    expect(env).toContain("web-push generate-vapid-keys")
  })
})
