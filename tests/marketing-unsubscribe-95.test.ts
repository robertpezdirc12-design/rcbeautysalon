// ============================================================
// #95 (AD-03) — FUNKCIONALNA ODAVA (regresijska varovala)
// HMAC žetoni (round-trip, tamper, tajna), sanitizacija vira pošiljanja,
// struktura: job filtrira odjavljene, predloga nosi povezavo, akcija
// upserta MarketingUnsubscribe. Poštenost: brez tajne ni povezave.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  signUnsubscribeToken,
  unsubscribePath,
  verifyUnsubscribeToken,
} from "../src/lib/marketing/unsubscribe"
import { defaultCampaignCopy } from "../src/lib/marketing/campaigns"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

const SECRET = "test-secret-at-least-16-chars"
const ORG = "org_123"
const EMAIL = "Ana@Example.COM"

describe("#95 AD-03 žetoni (HMAC, brez stanja)", () => {
  it("round-trip: podpiše in preveri z normalizirano e-pošto", () => {
    const token = signUnsubscribeToken(ORG, EMAIL, SECRET)
    expect(token).toMatch(/^v1\./)
    const verified = verifyUnsubscribeToken(token!, SECRET)
    expect(verified).toEqual({ organizationId: ORG, email: "ana@example.com" })
  })

  it("isti naslov v drugi velikosti = isti žeton (en kanal, ena odjava)", () => {
    expect(signUnsubscribeToken(ORG, "ana@example.com", SECRET)).toBe(
      signUnsubscribeToken(ORG, EMAIL, SECRET)
    )
  })

  it("tamperiran žeton / napačna tajna / napačen format → null", () => {
    const token = signUnsubscribeToken(ORG, EMAIL, SECRET)!
    expect(verifyUnsubscribeToken(token.slice(0, -2) + "ff", SECRET)).toBeNull()
    expect(verifyUnsubscribeToken(token, "druga-tajna-vsaj-16-znakov!")).toBeNull()
    expect(verifyUnsubscribeToken("garbage", SECRET)).toBeNull()
    expect(verifyUnsubscribeToken("v1.a.b", SECRET)).toBeNull()
    expect(verifyUnsubscribeToken(token.replace("v1.", "v2."), SECRET)).toBeNull()
    // zamena e-pošte med deloma veljavnimi žetoni
    const other = signUnsubscribeToken(ORG, "druga@example.com", SECRET)!
    const parts = token.split(".")
    const otherParts = other.split(".")
    expect(
      verifyUnsubscribeToken([parts[0], parts[1], otherParts[2], parts[3]].join("."), SECRET)
    ).toBeNull()
  })

  it("brez tajne se NE izda povezava (nikoli lažnih obljub)", () => {
    expect(signUnsubscribeToken(ORG, EMAIL, null)).toBeNull()
    expect(unsubscribePath(ORG, EMAIL, null)).toBeNull()
    expect(signUnsubscribeToken(ORG, EMAIL, "kratka")).toBeNull()
  })

  it("prazen org ali e-pošta → null", () => {
    expect(signUnsubscribeToken("", EMAIL, SECRET)).toBeNull()
    expect(signUnsubscribeToken(ORG, "   ", SECRET)).toBeNull()
  })
})

describe("#95 AD-03 privzeto besedilo (poštenost)", () => {
  it("ne obljublja več odjave 'z odgovorom' (noga nosi povezavo)", () => {
    for (const kind of ["REACTIVATION", "NO_SHOW"] as const) {
      const copy = defaultCampaignCopy(kind, "Salon")
      expect(copy.body).not.toContain("odgovorite na to e-pošto")
    }
  })
})

describe("#95 AD-03 struktura: job, predloga, akcija, pregled", () => {
  it("job filtrira odjavljene PRED pošiljanjem in vodi števec", () => {
    const job = read("src/lib/jobs/send-marketing-emails.ts")
    expect(job).toContain("marketingUnsubscribe.findMany")
    expect(job).toContain("skippedUnsubscribed")
    expect(job).toContain("unsubscribePath(org.id, target.email)")
  })

  it("e-poštna predloga nosi odjavno povezavo (in ne obljublja brez nje)", () => {
    const tpl = read("src/lib/email/templates/marketing-campaign-template.tsx")
    expect(tpl).toContain("unsubscribeUrl")
    expect(tpl).toContain("<Link href={unsubscribeUrl}")
    expect(tpl).not.toContain("odgovorite na to e-pošto")
  })

  it("akcija upserta MarketingUnsubscribe (idempotentno) in preverja žeton ob kliku", () => {
    const action = read("src/app/actions/unsubscribe.ts")
    expect(action).toContain("verifyUnsubscribeToken(token)")
    expect(action).toContain("marketingUnsubscribe.upsert")
  })

  it("pregled: zgodovina zadnjih pošiljk + števec odjav", () => {
    const overview = read("src/app/actions/marketing.ts")
    expect(overview).toContain("recentSends")
    expect(overview).toContain("marketingUnsubscribe.count")
    // Števec odjav je viden v glavi strežniške strani (prej odvečni prop v
    // client komponenti, ki ga ta nikoli ni prikazala — dead prop odstranjen).
    const page = read("src/app/(admin)/dashboard/marketing/page.tsx")
    expect(page).toContain("unsubscribedCount")
    const client = read("src/components/dashboard/marketing-client.tsx")
    expect(client).toContain("Zadnja pošiljanja")
  })

  it("shema: MarketingUnsubscribe je org-scoped z unikatnim parom", () => {
    const schema = read("prisma/schema.prisma")
    expect(schema).toContain("model MarketingUnsubscribe")
    expect(schema).toContain("@@unique([organizationId, email])")
  })
})
