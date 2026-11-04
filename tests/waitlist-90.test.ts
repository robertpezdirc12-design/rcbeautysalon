// ============================================================
// #90 — ČAKALNA LISTA (honest waitlist v1)
// Zlati set regresij: org-scoped povsod (javni vnos + admin),
// brez auto-book (obvestilo ne rezervira), duplikati zavrnjeni,
// pošten neuspeh pošte (ni tihega "obveščeno"), navigacija pod
// isto zmožnostjo/dovoljenjem kot termini.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("#90 shema: WaitlistEntry je najemniško zaprt", () => {
  const schema = read("prisma/schema.prisma")

  it("org filter + status sta indeksirana skupaj (vsak seznam je org-scoped pošteden)", () => {
    const block = schema.slice(
      schema.indexOf("model WaitlistEntry"),
      schema.indexOf("model Appointment {")
    )
    expect(block).toContain("@@index([organizationId, status])")
    expect(block).toContain('organization   Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)')
  })

  it("storitev je neobvezna in izgine (SetNull) — vnos ne sledi izbrisani storitvi", () => {
    const block = schema.slice(
      schema.indexOf("model WaitlistEntry"),
      schema.indexOf("model Appointment {")
    )
    expect(block).toContain("service       Service?   @relation(fields: [serviceId], references: [id], onDelete: SetNull)")
  })
})

describe("#90 akcije: fail-closed in poštene", () => {
  const actions = read("src/app/actions/waitlist.ts")

  it("javni vnos išče storitev Z org filtrom (tuja storitev ne more noter)", () => {
    expect(actions).toContain(
      'where: { id: input.serviceId, organizationId: org.id },'
    )
  })

  it("podvojen vnos (isti email + WAITING) je zavrnjen s poštnim sporočilom", () => {
    expect(actions).toContain("status: \"WAITING\",")
    expect(actions).toContain("Na čakalni listi ste že vpisani")
  })

  it("admin klici uporabljajo requirePermissionOrg (appointments.view/manage)", () => {
    expect(actions).toContain('requirePermissionOrg("appointments.view")')
    expect(actions).toContain('requirePermissionOrg("appointments.manage")')
  })

  it("obvestilo NIKOLI ne ustvari termina (brez auto-book)", () => {
    expect(actions).not.toContain("prisma.appointment.create")
    expect(actions).toContain("bookingUrl")
  })

  it("neuspeh pošte NI tih — status ostane WAITING in akcija vrne napako", () => {
    const notifyBlock = actions.slice(
      actions.indexOf("if (!result.success)"),
      actions.indexOf("await prisma.waitlistEntry.update")
    )
    expect(notifyBlock).toContain("E-pošta ni poslana")
  })

  it("status NOTIFIED se zapiše šele PO uspešnem pošiljanju", () => {
    const sendIdx = actions.indexOf("sendWaitlistNotifyEmail")
    const updateIdx = actions.indexOf('data: { status: "NOTIFIED", notifiedAt: new Date() }')
    expect(sendIdx).toBeGreaterThan(-1)
    expect(updateIdx).toBeGreaterThan(sendIdx)
  })
})

describe("#90 email: povezava v rezervacijo, ne lažno potrdilo", () => {
  const template = read("src/lib/email/templates/waitlist-notify-template.tsx")

  it("gumb vodi na bookingUrl (gost izbere termin sam)", () => {
    expect(template).toContain("href={bookingUrl}")
    expect(template).toContain("A slot just opened up")
  })

  it("prijavni vnos je dostopen prek #waitlist iz polnega koledarja", () => {
    const step = read("src/components/booking/steps/date-time-step.tsx")
    expect(step).toContain('href="#waitlist"')
    expect(step).toContain("t.booking.waitlistHint")
  })
})

describe("#90 navigacija: pod isto zmožnostjo kot termini", () => {
  it("sidebar item ima capability appointments + permission appointments.view", () => {
    const sidebar = read("src/components/admin/sidebar.tsx")
    expect(sidebar).toContain(
      '{ nameKey: "waitlist", href: "/dashboard/waitlist", icon: ClockIcon, capability: "appointments", permission: "appointments.view" },'
    )
  })

  it("admin stran varuje requirePagePermission(appointments.view)", () => {
    const page = read("src/app/(admin)/dashboard/waitlist/page.tsx")
    expect(page).toContain('requirePagePermission("appointments.view")')
  })
})
