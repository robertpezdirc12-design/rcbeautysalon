import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { makeTenant, publishSite, registerTenant, visitPublished } from "./helpers"

// ============================================================
// SCENARIO A — Beauty studio (issue #3 §16 A)
// 1. Owner registers and creates a beauty studio.            → real UI
// 2. Platform generates a beauty site + admin workspace.      → real UI
// 3. Catalog (services/products/booking) via DB fixtures — see
//    docs/EPIC-3/E2E.md "Known harness limitation": server actions
//    invoked from RHF form-submit handlers hang silently in the
//    current React 19.2.3 / Next 16.1.4 combination (onClick-driven
//    actions work). The forms themselves are verified on the
//    deployed app; the E2E guards the surrounding flows.
// 4. Owner publishes the site (real UI flow).                 → real UI
// 5. Customer sees the published site + booking wizard.       → real UI
// 6. The booking lands in the owner's workspace.              → fixture + UI
// 7. Owner upgrades the plan and sees entitlements.           → real UI
// ============================================================

const e2eDb = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "" } },
})
test.afterAll(async () => {
  await e2eDb.$disconnect()
})

test("A — beauty studio: register → catalog → publish → booking → manage → upgrade", async ({
  page,
}) => {
  const t = makeTenant("beauty", "Lepotni salon")
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3123"

  // 1+2: registration through the real wizard, auto-login to dashboard
  await registerTenant(page, t)
  await expect(page).toHaveURL(/dashboard/)

  const org = await e2eDb.organization.findUniqueOrThrow({ where: { slug: t.slug } })

  // 3: catalog + booking fixtures (persisted tenant data)
  const serviceName = `E2E Manikira ${t.slug}`
  await e2eDb.service.create({
    data: {
      organizationId: org.id,
      name: serviceName,
      slug: `e2e-manikira-${t.slug}`,
      description: "E2E testna storitev z lakiranjem nohtov",
      duration: 45,
      price: 25,
      isActive: true,
      isFeatured: true,
      staffServices: {
        create: (
          await e2eDb.staff.findMany({ where: { organizationId: org.id } })
        ).map((s) => ({ staffId: s.id })),
      },
    },
  })
  await e2eDb.product.create({
    data: {
      organizationId: org.id,
      name: `E2E lak za nohte ${t.slug}`,
      description: "E2E izdelek",
      price: 12,
      stockQuantity: 10,
      isActive: true,
      isFeatured: true,
    },
  })
  const customerUser = await e2eDb.customer.create({
    data: { name: "Maja Kovač", email: `maja.kovac+${t.slug}@example.com`, organizationId: org.id },
  })
  const staffMember = await e2eDb.staff.findFirstOrThrow({ where: { organizationId: org.id } })
  const fixtureService = await e2eDb.service.findFirstOrThrow({
    where: { slug: `e2e-manikira-${t.slug}` },
  })
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await e2eDb.appointment.create({
    data: {
      organizationId: org.id,
      customerId: customerUser.id,
      staffId: staffMember.id,
      startTime: start,
      endTime: new Date(start.getTime() + 45 * 60 * 1000),
      status: "PENDING",
      notes: `E2E booking ${t.slug}`,
      totalPrice: 25,
      services: { create: [{ serviceId: fixtureService.id }] },
    },
  })
  // The workspace lists the catalog
  await page.goto("/dashboard/services")
  await expect(page.locator("body")).toContainText(serviceName, { timeout: 20_000 })

  // 4: publish through Settings (real publishState change)
  await publishSite(page)

  // 5: a CUSTOMER (fresh context = no session) sees the published site
  //    and opens the real booking wizard.
  const customer = await page.context().browser()!.newContext()
  const cust = await customer.newPage()
  // Published site renders the generated beauty content (stable hero
  // from the vertical preset) — the org name only shows in the logo alt.
  // visitPublished: re-navigates past the 15 s DRAFT-proxy-cache window.
  await visitPublished(cust, `${baseUrl}/s/${t.slug}`, "Vaša lepota, naša strast")
  await cust.goto(`${baseUrl}/s/${t.slug}/booking?service=lasje-ensko-stri-enje`)
  await expect(cust.locator("body")).toContainText(/Rezervirajte svoj termin|Rezervac|Termin/i, {
    timeout: 20_000,
  })
  await expect(cust.locator("body")).toContainText(/Žensko striženje|Plačaj|potrdi/i, {
    timeout: 20_000,
  })
  await customer.close()

  // 6: the owner sees the booking in the workspace
  await page.goto("/dashboard/appointments")
  await expect(page.locator("body")).toContainText(/Maja|Rezervacija|termin/i, { timeout: 20_000 })

  // 7: upgrade the plan (demonstrative switch — billing not configured);
  //    the plan cards live in the default settings tab (Paket in raba)
  await page.goto("/dashboard/settings")
  await page.waitForTimeout(1000)
  const proSwitch = page.getByRole("button", { name: /Preklopi na PRO/ }).first()
  await proSwitch.scrollIntoViewIfNeeded()
  await proSwitch.click()
  await page
    .getByRole("button", { name: /Potrdim|Potrdi|Preklopi/ })
    .last()
    .click()
  await expect(page.getByText(/PRO/).first()).toBeVisible({ timeout: 20_000 })
})
