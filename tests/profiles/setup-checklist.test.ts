import { describe, expect, it } from "vitest"
import {
  buildSetupChecklist,
  parseSetupChecklistUi,
  type SetupChecklistInput,
} from "@/lib/profiles/setup-checklist"

// A fully "salon" capable tenant with everything still to do.
const freshSalon: SetupChecklistInput = {
  verticalChosen: true,
  catalogTouched: false,
  catalogCapable: true,
  staffCount: 1,
  staffCapable: true,
  soloMode: false,
  customerCount: 0,
  customersCapable: true,
  appointmentCount: 0,
  orderCount: 0,
  appointmentsCapable: true,
  workOrdersCapable: true,
  published: false,
}

describe("buildSetupChecklist", () => {
  it("fresh salon: only vertical is done, next action is catalog", () => {
    const c = buildSetupChecklist(freshSalon)
    expect(c.total).toBe(6)
    expect(c.doneCount).toBe(1)
    expect(c.allDone).toBe(false)
    expect(c.steps[0]).toMatchObject({ key: "vertical", done: true })
    expect(c.nextKey).toBe("catalog")
  })

  it("untouched guided entry makes the vertical step the next action", () => {
    const c = buildSetupChecklist({ ...freshSalon, verticalChosen: false })
    expect(c.steps[0].done).toBe(false)
    expect(c.nextKey).toBe("vertical")
  })

  it("catalog step completes only when the owner touched services or products", () => {
    const touched = buildSetupChecklist({ ...freshSalon, catalogTouched: true })
    expect(touched.steps.find((s) => s.key === "catalog")?.done).toBe(true)

    const untouched = buildSetupChecklist(freshSalon)
    expect(untouched.steps.find((s) => s.key === "catalog")?.done).toBe(false)
  })

  it("staff step tolerates the wizard-seeded owner (count 1 is not 'added staff')", () => {
    const one = buildSetupChecklist(freshSalon)
    expect(one.steps.find((s) => s.key === "staff")?.done).toBe(false)

    const two = buildSetupChecklist({ ...freshSalon, staffCount: 2 })
    expect(two.steps.find((s) => s.key === "staff")?.done).toBe(true)
  })

  it("first job follows the capability matrix: booking vs work order", () => {
    const booking = buildSetupChecklist({ ...freshSalon, appointmentCount: 3 })
    expect(booking.steps.find((s) => s.key === "firstJob")?.done).toBe(true)
    expect(booking.steps.find((s) => s.key === "firstJob")?.href).toBe(
      "/dashboard/appointments/new",
    )

    // Seamstress-style profile: appointments disabled, work orders drive value.
    const seamstress = buildSetupChecklist({
      ...freshSalon,
      appointmentsCapable: false,
      orderCount: 2,
    })
    expect(seamstress.steps.find((s) => s.key === "firstJob")?.done).toBe(true)
    expect(seamstress.steps.find((s) => s.key === "firstJob")?.href).toBe(
      "/dashboard/work-orders",
    )

    const neitherDone = buildSetupChecklist({
      ...freshSalon,
      appointmentsCapable: false,
      orderCount: 0,
    })
    expect(neitherDone.steps.find((s) => s.key === "firstJob")?.done).toBe(false)
  })

  it("disabled capabilities REMOVE their steps entirely (P3 #63 — no silent 'done' rows)", () => {
    const c = buildSetupChecklist({
      ...freshSalon,
      catalogCapable: false,
      staffCapable: false,
      customersCapable: false,
      appointmentsCapable: false,
      workOrdersCapable: false,
    })
    // #63: a step whose capability the profile disables is absent —
    // never rendered as a pre-ticked obligation.
    const keys = c.steps.map((s) => s.key)
    expect(keys).not.toContain("catalog")
    expect(keys).not.toContain("staff")
    expect(keys).not.toContain("customers")
    expect(keys).not.toContain("firstJob")
    expect(keys).toEqual(["vertical", "publish"])
    // publish stays the only real next action
    expect(c.nextKey).toBe("publish")
  })

  it("all done: nextKey null and allDone true (celebration state)", () => {
    const c = buildSetupChecklist({
      ...freshSalon,
      catalogTouched: true,
      staffCount: 3,
      customerCount: 5,
      appointmentCount: 2,
      published: true,
    })
    expect(c.allDone).toBe(true)
    expect(c.nextKey).toBeNull()
    expect(c.doneCount).toBe(c.total)
  })

  it("firstJob ignores work-order count when appointments are capable", () => {
    // A salon with orders (shop sales) but zero BOOKINGS still needs the
    // first booking — the milestone follows the profile's primary capability.
    const c = buildSetupChecklist({ ...freshSalon, orderCount: 4 })
    expect(c.steps.find((s) => s.key === "staff")?.done).toBe(false)
    expect(c.steps.find((s) => s.key === "firstJob")?.done).toBe(false)
  })
})

describe("buildSetupChecklist — P2 solo mode (second-level wizard answers)", () => {
  it("solo mode REMOVES the staff step from the checklist (prove you listened)", () => {
    const c = buildSetupChecklist({ ...freshSalon, soloMode: true })
    // The step is gone entirely — progress counts 5 steps, not 6.
    expect(c.steps.find((s) => s.key === "staff")).toBeUndefined()
    expect(c.total).toBe(5)
    expect(c.doneCount).toBe(1)
    // next-best-action skips staff and points at catalog.
    expect(c.nextKey).toBe("catalog")
  })

  it("solo mode does not break completion: 4 done → allDone with staff gone", () => {
    const c = buildSetupChecklist({
      ...freshSalon,
      soloMode: true,
      catalogTouched: true,
      customerCount: 2,
      appointmentCount: 1,
      published: true,
    })
    expect(c.allDone).toBe(true)
    expect(c.total).toBe(5)
    expect(c.doneCount).toBe(5)
    expect(c.nextKey).toBeNull()
  })

  it("without solo mode the staff step stays (backward compatible)", () => {
    const c = buildSetupChecklist({ ...freshSalon })
    expect(c.steps.find((s) => s.key === "staff")?.done).toBe(false)
    expect(c.total).toBe(6)
  })
})

describe("parseSetupChecklistUi (owner UI state in Organization.setupChecklist)", () => {
  it("parses dismissedAt and celebratedAt when both are ISO strings", () => {
    const ui = parseSetupChecklistUi({
      dismissedAt: "2026-11-02T10:00:00.000Z",
      celebratedAt: "2026-11-02T09:00:00.000Z",
    })
    expect(ui.dismissedAt).toBe("2026-11-02T10:00:00.000Z")
    expect(ui.celebratedAt).toBe("2026-11-02T09:00:00.000Z")
  })

  it("tolerates junk: null, arrays, wrong types, unknown keys", () => {
    expect(parseSetupChecklistUi(null)).toEqual({})
    expect(parseSetupChecklistUi(undefined)).toEqual({})
    expect(parseSetupChecklistUi([1, 2])).toEqual({})
    expect(parseSetupChecklistUi({ dismissedAt: 42 })).toEqual({})
    expect(parseSetupChecklistUi({ celebratedAt: true })).toEqual({})
    expect(parseSetupChecklistUi({ dismissedAt: "2026-01-01", junk: "x" })).toEqual({
      dismissedAt: "2026-01-01",
    })
  })

  it("celebratedAt missing means the confetti has not fired yet", () => {
    expect(parseSetupChecklistUi({ dismissedAt: "2026-01-01" }).celebratedAt).toBeUndefined()
  })
})
