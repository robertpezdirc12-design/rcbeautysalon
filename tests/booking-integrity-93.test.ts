// ============================================================
// #93 — TRANSAKCIJSKA VARNOST REZERVACIJ (regresijski varovali)
// Struktura pisalnih poti je tu zaklenjena na vir-nivoju (repo
// vzorec): vsaka mora imeti advisory ključavnico + transakcijo z
// avtoritativnim conflict checkom; prepaid mora biti v ISTI
// transakciji (rollback povrne seanso); duplikat plačila drži unique
// constraint. Čista logika ključev je testabilna direktno.
// Živi dokazi (duplikat plačila, serializacija, UI tok) so zabeleženi
// v issue #93 komentarju — ta datoteka drži strukturo proti regresiji.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { bookingLockKeys, staffLockKey, resourceLockKey } from "../src/lib/booking/locking"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("#93 ključi ključavnic (čista logika)", () => {
  it("različni najemniki in različno osebje → različne ključavnice (neodvisni)", () => {
    expect(staffLockKey("orgA", "s1")).not.toBe(staffLockKey("orgA", "s2"))
    expect(staffLockKey("orgA", "s1")).not.toBe(staffLockKey("orgB", "s1"))
  })

  it("istega osebja → ISTA ključavnica (to je varovala proti dirki)", () => {
    expect(staffLockKey("orgA", "s1")).toBe(staffLockKey("orgA", "s1"))
  })

  it("vir se ključa ločeno od osebja", () => {
    expect(resourceLockKey("orgA", "r1")).not.toBe(staffLockKey("orgA", "r1"))
  })

  it("ključi so UREJENI (sorted) — pridobitev v istem vrstnem redu = brez deadlockov", () => {
    const keys = bookingLockKeys("org", "zzz-staff", "aaa-resource")
    // Pomenljiva invarianta: dobljeni vrstni red JE sortiran (ne pozicija).
    expect(keys).toEqual([...keys].sort())
    expect(keys.some((k) => k.includes("zzz-staff"))).toBe(true)
    expect(keys.some((k) => k.includes("aaa-resource"))).toBe(true)
  })
})

describe("#93 createAppointment: kritična sekcija", () => {
  const src = read("src/app/actions/appointments.ts")

  it("createAppointment uporablja $transaction + advisory ključavnico", () => {
    const createBlock = src.slice(src.indexOf("export async function createAppointment"))
    expect(createBlock).toContain("await acquireBookingLocks(")
    expect(createBlock).toContain("prisma.$transaction")
    expect(createBlock).toContain("bookingLockKeys(org.id, data.staffId, resourceRecordId)")
  })

  it("avtoritativni staff konflikt check je ZNOTRAJ transakcije (count + strogi mejniki)", () => {
    const createBlock = src.slice(src.indexOf("export async function createAppointment"))
    const txPart = createBlock.slice(createBlock.indexOf("prisma.$transaction"))
    expect(txPart).toContain("tx.appointment.count")
    expect(txPart).toContain("startTime: { lt: endTime }")
    expect(txPart).toContain("endTime: { gt: startInstant }")
  })

  it("vir ima svoj konflikt check znotraj transakcije", () => {
    const createBlock = src.slice(src.indexOf("export async function createAppointment"))
    const txPart = createBlock.slice(createBlock.indexOf("prisma.$transaction"))
    expect(txPart).toContain("resourceBusy > 0")
    expect(txPart).toContain("Izbrani prostor/vir je v tem času že zaseden")
  })

  it("prepaid dekrement + create + redemption + EXHAUSTED so v ISTI transakciji", () => {
    const createBlock = src.slice(src.indexOf("export async function createAppointment"))
    const txPart = createBlock.slice(createBlock.indexOf("prisma.$transaction"))
    expect(txPart).toContain("tx.prepaidPurchase.updateMany")
    expect(txPart).toContain("tx.appointment.create")
    expect(txPart).toContain("tx.prepaidRedemption.create")
    expect(txPart).toContain('data: { status: "EXHAUSTED" }')
  })

  it("swallowana redemption napaka je ODSTRANJENA (padec = rollback)", () => {
    expect(src).not.toContain("[prepaid] redemption create failed:")
  })

  it("izgubljena dirka → lokalizirano sporočilo, ne DB izjema", () => {
    const createBlock = src.slice(src.indexOf("export async function createAppointment"))
    expect(createBlock).toContain("BookingConflictError")
    expect(createBlock).toContain('"Izbrani termin ni več prost. Izberite drugi termin."')
  })
})

describe("#93 reschedule: izključi sam sebe + ključavnica", () => {
  it("conflict check izključi premikanani termin (stari čas lažno ovira)", () => {
    const reschedule = read("src/app/actions/appointments.ts").slice(
      read("src/app/actions/appointments.ts").indexOf("export async function rescheduleAppointment")
    )
    expect(reschedule).toContain("id: { not: appointmentId }")
    expect(reschedule).toContain("await acquireBookingLocks(")
  })
})

describe("#93 webhook + verify: ista varovala + idempotenca plačila", () => {
  it("webhook create je pod ključavnico s P2002 idempotenco", () => {
    const webhook = read("src/app/api/webhooks/stripe/route.ts")
    expect(webhook).toContain("await acquireBookingLocks(")
    expect(webhook).toContain('error.code === "P2002"')
  })

  it("verify path (stripe.ts) ima enako varovalo", () => {
    const stripe = read("src/app/actions/stripe.ts")
    expect(stripe).toContain("await acquireBookingLocks(")
    expect(stripe).toContain('error.code === "P2002"')
  })

  it("shema: stripePaymentId je UNIKATEN (eno plačilo = največ en termin)", () => {
    const schema = read("prisma/schema.prisma")
    expect(schema).toContain("stripePaymentId String? @unique")
  })
})
