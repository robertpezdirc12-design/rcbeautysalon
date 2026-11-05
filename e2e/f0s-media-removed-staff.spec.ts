import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { makeTenant, registerTenant } from "./helpers"

// ============================================================
// F0-S — Codex finding "odstranjeni zaposleni ohrani dostop do
// zasebnih medijev" (PR #103 review round 2, security)
//
// deleteStaffMember() demotes the user's role to CLIENTE but KEEPS
// their organizationId; decideMediaAccess() checked ONLY the
// organizationId match — a removed employee could keep reading the
// tenant's DRAFT/SUSPENDED media via /api/media/<id>.
//
// Fix: the owner decision now requires ROLE EVIDENCE — ADMIN, or
// STAFF with an ACTIVE staff row in the owning organization. A
// demoted (removed) employee holds CLIENTE → denied. Active
// members and the platform operator keep access.
//
// Golden path, REAL flows only: removal through the real staff list
// (confirm dialog → onClick server action), logins through the real
// /login form, media served through the real /api/media route.
// (The staff CREATION form is an RHF handleSubmit form — it hangs in
// production builds, a documented pre-existing E2E limitation, see
// docs/EPIC-3/E2E.md — so the staff account itself is arranged via DB,
// bcrypt password included; the vulnerability path under test is the
// REMOVAL outcome + the media access decision, both fully real.)
// ============================================================

const e2eDb = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "" } },
})

test.afterAll(async () => {
  await e2eDb.$disconnect()
})

/** 1x1 PNG — the media payload we gate on. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

test("F0-S removed employee (role CLIENTE) loses private media; members and operator keep it", async ({
  page,
  browser,
}) => {
  // ---- Tenant A stays DRAFT (never published) → ALL of its media is
  // owner-only, exactly the gated class the finding is about ----
  const a = makeTenant("beauty", "F0S-MEDIA-A")
  await registerTenant(page, a)
  const orgA = await e2eDb.organization.findUniqueOrThrow({
    where: { slug: a.slug },
    select: { id: true },
  })

  const media = await e2eDb.media.create({
    data: {
      organizationId: orgA.id,
      filename: "f0s-media-e2e.png",
      mimeType: "image/png",
      size: Buffer.from(PNG_BASE64, "base64").length,
      data: PNG_BASE64,
    },
  })
  const mediaUrl = `/api/media/${media.id}`

  // ---- A staff member (arranged via DB — the creation form is an RHF
  // handleSubmit form that hangs in production builds, see header note).
  // The account shape is EXACTLY what the real dashboard form creates:
  // User(role STAFF, organizationId) + Staff row linked by userId. ----
  const staffName = `Ekipa ${a.slug}`
  const staffEmail = `staff-${a.slug}@example.com`
  const staffUser = await e2eDb.user.create({
    data: {
      name: staffName,
      email: staffEmail,
      role: "STAFF",
      password: bcrypt.hashSync("E2e-staff-pass-1!", 4),
      emailVerified: new Date(),
      organization: { connect: { id: orgA.id } },
    },
  })
  await e2eDb.staff.create({
    data: {
      name: staffName,
      email: staffEmail,
      isActive: true,
      organization: { connect: { id: orgA.id } },
      user: { connect: { id: staffUser.id } },
    },
  })
  expect(staffUser.role).toBe("STAFF")
  expect(staffUser.organizationId).toBe(orgA.id)

  // ---- POSITIVE: an ACTIVE staff member CAN read the draft tenant's media ----
  const staffCtx = await browser.newContext()
  const staffPage = await staffCtx.newPage()
  await staffPage.goto("/login")
  await staffPage.getByLabel(/E-pošta/).first().fill(staffEmail)
  await staffPage.getByLabel(/Geslo/).first().fill("E2e-staff-pass-1!")
  await staffPage.getByRole("button", { name: /Prijava/ }).click()
  await staffPage.waitForURL(/dashboard|staff-portal|my-account/, { timeout: 30_000 })
  const staffRes = await staffPage.request.get(mediaUrl)
  expect(staffRes.status(), "active STAFF keeps media access").toBe(200)
  expect(staffRes.headers()["content-type"]).toBe("image/png")
  await staffCtx.close()

  // ---- The owner REMOVES the staff member through the REAL UI ----
  await page.goto("/dashboard/staff")
  await expect(page.locator("body")).toContainText(staffName)
  page.once("dialog", (dialog) => dialog.accept())
  // The staff list renders CARDS (CardTitle = member name); the delete
  // control is the icon-only button inside the same card's action row.
  const card = page.locator(".rounded-xl", { hasText: staffName }).first()
  await card.getByRole("button").last().click()
  // Removal deactivates the member (the list keeps showing them with the
  // "Neaktiven" badge — history is preserved by design, not deleted):
  await expect(
    card.getByText("Neaktiven", { exact: true })
  ).toBeVisible({ timeout: 30_000 })

  // The vulnerability precondition (documented): role CLIENTE while the
  // organizationId is KEPT — the old check (orgId match alone) granted
  // access exactly here.
  const afterRemove = await e2eDb.user.findUniqueOrThrow({
    where: { id: staffUser.id },
    select: { role: true, organizationId: true },
  })
  expect(afterRemove.role).toBe("CLIENTE")
  expect(afterRemove.organizationId).toBe(orgA.id)
  const staffRowAfter = await e2eDb.staff.findUniqueOrThrow({
    where: { userId: staffUser.id },
    select: { isActive: true },
  })
  expect(staffRowAfter.isActive).toBe(false)

  // ---- NEGATIVE (THE FINDING): the removed employee (role CLIENTE,
  // organizationId kept) must NOT read the tenant's private media ----
  const removedCtx = await browser.newContext()
  const removedPage = await removedCtx.newPage()
  await removedPage.goto("/login")
  await removedPage.getByLabel(/E-pošta/).first().fill(staffEmail)
  await removedPage.getByLabel(/Geslo/).first().fill("E2e-staff-pass-1!")
  await removedPage.getByRole("button", { name: /Prijava/ }).click()
  await removedPage.waitForURL(/dashboard|staff-portal|my-account/, { timeout: 30_000 })
  const removedRes = await removedPage.request.get(mediaUrl)
  expect(removedRes.status(), "removed employee (CLIENTE) is denied private media").toBe(404)
  await removedCtx.close()

  // ---- POSITIVE: the owner (active ADMIN member) keeps access ----
  const ownerRes = await page.request.get(mediaUrl)
  expect(ownerRes.status(), "owner keeps media access").toBe(200)

  // ---- POSITIVE: the platform operator may inspect any tenant's media ----
  const operatorCtx = await browser.newContext()
  const operatorPage = await operatorCtx.newPage()
  await operatorPage.goto("/login")
  await operatorPage.getByLabel(/E-pošta/).first().fill("admin@rcbeautysalon.org")
  await operatorPage.getByLabel(/Geslo/).first().fill("admin123")
  await operatorPage.getByRole("button", { name: /Prijava/ }).click()
  await operatorPage.waitForURL(/platform|dashboard/, { timeout: 30_000 })
  const operatorRes = await operatorPage.request.get(mediaUrl)
  expect(operatorRes.status(), "operator keeps media access").toBe(200)
  await operatorCtx.close()
})
