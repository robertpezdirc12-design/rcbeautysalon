// ============================================================
// #92 — DODATKI STORITVE (add-ons, Square pattern)
// Čista razrešitev + vsote; strežniški izračun (cene iz DB, ne
// klienta); snapshot na terminu; sloti upoštevajo podaljšano
// trajanje; dodatki potujejo prek checkout metadata kot ID-ji.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  resolveAddonSelection,
  computeAddonTotals,
} from "../src/lib/booking/addons"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

const CATALOG = [
  { id: "a1", name: "Ulje za gume", price: 5, durationMin: 10 },
  { id: "a2", name: "Balans", price: 12.5, durationMin: 20 },
  { id: "a3", name: "Pranje", price: 8, durationMin: 0 },
]

describe("#92 resolveAddonSelection (čista logika)", () => {
  it("vrne dodatke v VRSTNEM REDU kataloga, ne v vrstnem redu klikov", () => {
    const picked = resolveAddonSelection(CATALOG, ["a2", "a1"])
    expect(picked.map((a) => a.id)).toEqual(["a1", "a2"])
  })

  it("neznani in podvojeni ID-ji izpadejo (fail-closed)", () => {
    const picked = resolveAddonSelection(CATALOG, ["a1", "a1", "nosec"])
    expect(picked.map((a) => a.id)).toEqual(["a1"])
  })
})

describe("#92 computeAddonTotals (čista logika)", () => {
  it("vsota cene in trajanja z 2-decimalnim zaokroženjem", () => {
    const t = computeAddonTotals([CATALOG[0], CATALOG[1], CATALOG[2]])
    expect(t.addonPrice).toBe(25.5)
    expect(t.addonDurationMin).toBe(30)
  })

  it("prazna izbira → nič", () => {
    expect(computeAddonTotals([])).toEqual({ addonPrice: 0, addonDurationMin: 0 })
  })
})

describe("#92 strežniški izračun (akcije)", () => {
  const appointments = read("src/app/actions/appointments.ts")

  it("dodatki se razrešijo iz DB (id + aktiven + storitev najemnika) — cene iz klienta se ne upoštevajo", () => {
    expect(appointments).toContain("id: { in: data.addonIds },")
    expect(appointments).toContain("isActive: true,")
    expect(appointments).toContain("service: { organizationId: org.id },")
  })

  it("snapshot dodatkov gre na termin (zgodovina ne sledi katalogu)", () => {
    expect(appointments).toContain("addons:")
    expect(appointments).toContain("durationMin: a.durationMin,")
  })

  it("trajanje termina + slot preverba upoštevata podaljšanje", () => {
    expect(appointments).toContain("const effectiveTotalDuration = totalDuration + addonDurationMin")
    expect(appointments).toContain("data.bookingDate ?? startInstant,\n      effectiveTotalDuration")
  })

  it("sloti razrešijo dodatke org-scoped tudi pri javnem ogledu", () => {
    expect(appointments).toContain("service: { organizationId: org.id },")
  })
})

describe("#92 checkout: dodatki potujejo kot ID-ji, polog ostane na storitvi", () => {
  const stripe = read("src/app/actions/stripe.ts")
  const webhook = read("src/app/api/webhooks/stripe/route.ts")

  it("metadata nosi addonIds (JSON)", () => {
    expect(stripe).toContain("addonIds: JSON.stringify(data.addonIds ?? []),")
  })

  it("webhook ponovno razreši dodatke org-scoped in zapiše snapshot", () => {
    expect(webhook).toContain("service: { organizationId: org.id },")
    expect(webhook).toContain("addons: selectedAddons.length > 0 ? selectedAddons : undefined,")
    expect(webhook).toContain("totalPrice: totalPrice + addonPrice,")
  })
})

describe("#92 admin: replace-all urejevalnik je org-scoped", () => {
  const services = read("src/app/actions/services.ts")

  it("upsert preveri storitev prek org filtra in sanitizira vrstice", () => {
    expect(services).toContain("where: { id: serviceId, organizationId: org.id },")
    expect(services).toContain("prisma.serviceAddon.deleteMany({ where: { serviceId: service.id } })")
  })
})
