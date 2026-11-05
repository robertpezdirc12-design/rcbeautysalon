// ============================================================
// #95 — MARKETING AVTOMATIKA (regresijska varovala)
// Čista eligibilnost + vstavitve + privzeta besedila; struktura
// joba/akcij na vir-nivoju (org-scope, dedup na uspeh, cron žica).
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  pickReactivationTargets,
  pickNoShowTargets,
  pickBirthdayTargets,
  interpolate,
  defaultCampaignCopy,
  CAMPAIGN_KINDS,
  PLACEHOLDERS,
  type VisitRef,
} from "../src/lib/marketing/campaigns"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

const TODAY = new Date("2026-11-04T12:00:00Z")
const daysAgo = (n: number) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const OPTS = { thresholdDays: 60, today: TODAY, business: "Salon Luna", bookingLink: "https://x/s/l/booking" }

describe("#95 pickReactivationTargets (čista logika)", () => {
  const visit = (id: string, email: string, completedOn: string): VisitRef => ({
    id,
    email,
    name: "Ana",
    completedOn,
  })

  it("zadnji obisk točno na prag → cilj s triggerKey = id obiska", () => {
    const t = pickReactivationTargets([visit("v1", "ana@x.si", daysAgo(60))], OPTS)
    expect(t).toHaveLength(1)
    expect(t[0].triggerKey).toBe("v1")
    expect(t[0].email).toBe("ana@x.si")
  })

  it("obisk prej/pozneje od praga → nič (točna enakost = brez duplikatov)", () => {
    expect(pickReactivationTargets([visit("v1", "ana@x.si", daysAgo(59))], OPTS)).toHaveLength(0)
    expect(pickReactivationTargets([visit("v1", "ana@x.si", daysAgo(61))], OPTS)).toHaveLength(0)
  })

  it("stranka s prihodnjim obiskom je IZKLJUČENA (aktivna)", () => {
    const t = pickReactivationTargets(
      [visit("v1", "ana@x.si", daysAgo(60)), visit("v2", "ana@x.si", "9999-12-31")],
      OPTS
    )
    expect(t).toHaveLength(0)
  })

  it("novejši obisk zmaga kot zadnji (starejši obiski ne sprožijo)", () => {
    const t = pickReactivationTargets(
      [visit("v1", "ana@x.si", daysAgo(200)), visit("v2", "ana@x.si", daysAgo(10))],
      OPTS
    )
    expect(t).toHaveLength(0)
  })
})

describe("#95 pickNoShowTargets + interpolate (čista logika)", () => {
  it("samo včerajšnji ne-prihodi so cilji", () => {
    const t = pickNoShowTargets(
      [
        { id: "n1", email: "a@x.si", name: "A", missedOn: daysAgo(1) },
        { id: "n2", email: "b@x.si", name: "B", missedOn: daysAgo(5) },
      ],
      { today: TODAY, business: "Luna", bookingLink: "https://x" }
    )
    expect(t).toHaveLength(1)
    expect(t[0].triggerKey).toBe("n1")
  })

  it("vstavitve zapolnijo {name}/{business}/{days}/{date}/{bookingLink}", () => {
    const out = interpolate("Pozdravljeni {name}, {days} dni v {business}. {date} → {bookingLink}", {
      name: "Ana",
      business: "Luna",
      days: 60,
      date: "3. 11. 2026",
      bookingLink: "https://b",
    })
    expect(out).toBe("Pozdravljeni Ana, 60 dni v Luna. 3. 11. 2026 → https://b")
  })

  it("privzeta besedila NE obljubljajo odjave 'z odgovorom' — noga nosi povezavo (AD-03)", () => {
    for (const kind of ["REACTIVATION", "NO_SHOW"] as const) {
      const copy = defaultCampaignCopy(kind, "Luna")
      expect(copy.body).not.toContain("ne želite več prejemati")
      expect(copy.body).not.toContain("odgovorite na to e-pošto")
      expect(PLACEHOLDERS.length).toBeGreaterThan(0)
    }
  })
})

describe("#95 struktura: org-scope, dedup na uspeh, cron žica", () => {
  it("akcija uporablja requirePermissionOrg customers.manage + org-scoped upsert", () => {
    const actions = read("src/app/actions/marketing.ts")
    expect(actions).toContain('requirePermissionOrg("customers.manage")')
    expect(actions).toContain("organizationId_kind: { organizationId: org.id, kind }")
  })

  it("job zapiše CampaignSend ŠELE ob uspešnem pošiljanju (dedup na uspeh)", () => {
    const job = read("src/lib/jobs/send-marketing-emails.ts")
    const sendIdx = job.indexOf("sendMarketingCampaignEmail({")
    expect(sendIdx).toBeGreaterThan(-1)
    // Zapis dedup vrstice je PO pošiljanju (marker brez nove vrstice —
    // golden meta test prepoveduje \n v markerjih).
    expect(job.slice(sendIdx)).toContain("campaignSend")
    expect(job).toContain("dedup na uspeh")
  })

  it("job je žičan v cron tick poleg opomnikov", () => {
    const tick = read("src/app/api/cron/tick/route.ts")
    expect(tick).toContain('withJobRun("send-marketing-emails", sendMarketingEmails)')
  })

  it("shema: dedup unikaten (campaign, email, triggerKey) + ena kampanja na vrsto per najemnik", () => {
    const schema = read("prisma/schema.prisma")
    expect(schema).toContain("@@unique([campaignId, email, triggerKey])")
    expect(schema).toContain("@@unique([organizationId, kind])")
  })
})

// ============================================================
// #95 v3 — BIRTHDAY kampanja (rojstni dnevi)
// ============================================================

describe("#95 v3 pickBirthdayTargets (rojstni dnevi)", () => {
  const opts = { today: new Date("2026-11-05T03:00:00Z"), business: "Luna", bookingLink: "https://b" }

  it("rojstni dan DANES (salon-lokalno) → cilj s triggerKeyom na leto", () => {
    const targets = pickBirthdayTargets(
      [{ id: "c1", email: "ana@x.si", name: "Ana", birthdayOn: "11-05" }],
      opts
    )
    expect(targets.length).toBe(1)
    expect(targets[0].triggerKey).toBe("bday:c1:2026")
    expect(targets[0].vars.name).toBe("Ana")
  })

  it("včeraj/jutri/neobstojče → nič; enkrat na leto (drugo leto = nov žeton)", () => {
    expect(pickBirthdayTargets([{ id: "c1", email: "a@x", name: "A", birthdayOn: "11-04" }], opts)).toEqual([])
    expect(pickBirthdayTargets([{ id: "c1", email: "a@x", name: "A", birthdayOn: "11-06" }], opts)).toEqual([])
    expect(pickBirthdayTargets([{ id: "c1", email: "a@x", name: "A", birthdayOn: "02-29" }], opts)).toEqual([])
    const nextYear = pickBirthdayTargets(
      [{ id: "c1", email: "a@x", name: "A", birthdayOn: "11-05" }],
      { ...opts, today: new Date("2027-11-05T03:00:00Z") }
    )
    expect(nextYear[0].triggerKey).toBe("bday:c1:2027")
  })

  it("privzeta BIRTHDAY besedila: čestitka brez prodajnega pritiska in brez obljube odjave", () => {
    const copy = defaultCampaignCopy("BIRTHDAY", "Luna")
    expect(copy.subject).toContain("rojstnem dnevu")
    expect(copy.body).toContain("{name}")
    expect(copy.body).not.toContain("odgovorite na to e-pošto")
  })

  it("CAMPAIGN_KINDS vključuje BIRTHDAY (pregled/job/UI izpeljejo iz njega)", () => {
    expect(CAMPAIGN_KINDS).toContain("BIRTHDAY")
  })
})
