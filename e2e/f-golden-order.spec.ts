import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import {
  createProduct,
  makeTenant,
  publishSite,
  registerTenant,
  visitPublished,
  waitHydrated,
} from "./helpers"

// ============================================================
// GOLDEN ORDER FLOW (#70 + #71) — the closure condition from the
// issue: create tenant → switch activity → publish → place a GUEST
// order → open the order in the dashboard → assert name, e-mail and
// total.
//
// W1 (#70): a guest order must NEVER adopt the identity of an
//     existing customer matched by phone alone — the dashboard shows
//     the contact the buyer actually entered.
// W2 (#71): "Prikaži" opens a real, org-scoped order detail inside
//     the dashboard chrome — never a 404, never the public shell,
//     never another tenant's order.
// ============================================================

const e2eDb = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "" } },
})
test.afterAll(async () => {
  await e2eDb.$disconnect()
})

test("G — golden order: switch → publish → guest order → owner reads the truth", async ({
  page,
}) => {
  const t = makeTenant("beekeeping", "Zlati")
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3123"

  await registerTenant(page, t)
  await expect(page).toHaveURL(/dashboard/)

  // ---- switch activity (real dialog: beekeeping → beauty) ----
  await page.goto("/dashboard/settings")
  await page.getByRole("tab", { name: "Izgled in vsebina" }).click()
  await page.waitForTimeout(800)
  await page.getByText("Prikaži napredne nastavitve panoge").click()
  await page.waitForTimeout(500)
  const verticalBox = page.getByRole("combobox", { name: "Trenutna panoga" })
  await verticalBox.click()
  await page.getByRole("option", { name: "Lepotni salon" }).click()
  // the new activity REQUIRES services — seed its sample catalog
  // ("dopolni katalog", the #59/#58 flow), otherwise the publish gate
  // honestly blocks ("Katalog je prazen")
  await page.getByRole("checkbox", { name: /Dopolni katalog/ }).check()
  await page.getByRole("button", { name: "Zamenjaj panogo" }).first().click()
  // the confirmation dialog (#58): content decision is required; the
  // untouched default ("naloži vzorec nove panoge") is accepted as-is
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible({ timeout: 15_000 })
  await dialog.getByRole("button", { name: "Zamenjaj panogo" }).click()
  await page.waitForTimeout(3000)
  // persisted: the vertical combobox now shows the new activity
  await page.reload()
  await page.getByRole("tab", { name: "Izgled in vsebina" }).click()
  await page.waitForTimeout(800)
  await page.getByText("Prikaži napredne nastavitve panoge").click()
  await expect(
    page.getByRole("combobox", { name: "Trenutna panoga" })
  ).toContainText("Lepotni salon", { timeout: 15_000 })

  // ---- a product of their own (beauty seeds services only; the
  //      mandatory-shop gate blocks publish on an empty shop) ----
  await createProduct(page, `Zlati serum ${t.slug}`)

  // ---- publish (real publication action) ----
  await publishSite(page)

  // ---- fixture: an EXISTING customer whose phone the next guest will
  //      re-use with a DIFFERENT identity (the W1 trap) ----
  const org = await e2eDb.organization.findUniqueOrThrow({
    where: { slug: t.slug },
  })
  const strangerPhone = `+386 41 555 ${Math.floor(100 + Math.random() * 899)}`
  await e2eDb.customer.create({
    data: {
      organizationId: org.id,
      name: "Tujka Identiteta",
      email: `tujka.identiteta.${t.slug}@example.com`,
      phone: strangerPhone,
    },
  })

  // ---- guest A: shared phone, different identity (W1) ----
  const guestAName = `Zlatka Zlatnik ${Date.now().toString(36)}`
  const guestAEmail = `zlatka.${Date.now().toString(36)}@example.com`
  const ctxA = await page.context().browser()!.newContext()
  const a = await ctxA.newPage()
  await visitPublished(a, `${baseUrl}/s/${t.slug}/shop`, /serum|med/i)
  await a.getByRole("button", { name: /Dodaj v košarico/ }).first().click()
  await a.goto(`${baseUrl}/s/${t.slug}/cart`)
  await waitHydrated(a, "#guest-name")
  await a.locator("#guest-name").fill(guestAName)
  await a.locator("#guest-email").fill(guestAEmail)
  await a.locator("#guest-phone").fill(strangerPhone)
  await a.getByRole("button", { name: /Zaključi nakup/ }).click()
  await expect(a.locator("body")).toContainText("Številka naročila", {
    timeout: 30_000,
  })
  const orderANumber = (await a.locator("body").innerText()).match(
    /Številka naročila\s*\n\s*([A-Z0-9]{6,12})/
  )?.[1]
  expect(orderANumber, "confirmation must show an order number").toBeTruthy()
  await ctxA.close()

  // ---- guest B: unique identity (the clean golden path) ----
  const guestBName = `Miha Miza ${Date.now().toString(36)}`
  const guestBEmail = `miha.miza.${Date.now().toString(36)}@example.com`
  const ctxB = await page.context().browser()!.newContext()
  const b = await ctxB.newPage()
  await b.goto(`${baseUrl}/s/${t.slug}/shop`)
  await b.getByRole("button", { name: /Dodaj v košarico/ }).first().click()
  await b.goto(`${baseUrl}/s/${t.slug}/cart`)
  await waitHydrated(b, "#guest-name")
  await b.locator("#guest-name").fill(guestBName)
  await b.locator("#guest-email").fill(guestBEmail)
  await b.getByRole("button", { name: /Zaključi nakup/ }).click()
  await expect(b.locator("body")).toContainText("Številka naročila", {
    timeout: 30_000,
  })
  await ctxB.close()

  // ---- DB truth: both orders are PURE guest orders (no identity merge,
  //      no duplicate customers created from the guest form) ----
  const orderA = await e2eDb.order.findFirstOrThrow({
    where: { organizationId: org.id, guestName: guestAName },
  })
  const orderB = await e2eDb.order.findFirstOrThrow({
    where: { organizationId: org.id, guestName: guestBName },
  })
  expect(orderA.customerId).toBeNull()
  expect(orderA.guestEmail).toBe(guestAEmail)
  expect(orderA.guestPhone).toBe(strangerPhone)
  expect(orderB.customerId).toBeNull()
  const customers = await e2eDb.customer.findMany({
    where: { organizationId: org.id },
  })
  expect(
    customers.some((c) => c.email === guestAEmail),
    "guest form must not create a customer record"
  ).toBe(false)
  expect(customers.filter((c) => c.phone === strangerPhone).length).toBe(1)

  // ---- owner reads the truth: list shows the ORDER's contact ----
  await page.goto("/dashboard/orders")
  await expect(page.locator("body")).toContainText(guestAName, {
    timeout: 20_000,
  })
  await expect(page.locator("body")).toContainText(guestAEmail)
  await expect(page.locator("body")).not.toContainText("Tujka Identiteta")

  // ---- W2: "Prikaži" opens the detail inside the dashboard ----
  await page.locator(`a[href="/dashboard/orders/${orderA.id}"]`).first().click()
  await page.waitForURL(new RegExp(`/dashboard/orders/${orderA.id}`))
  const orderNumber = orderA.id.slice(-8).toUpperCase()
  await expect(page.locator("body")).toContainText(orderNumber, {
    timeout: 20_000,
  })
  // dashboard chrome intact (never the public 404 shell)
  await expect(page.locator("body")).toContainText("Kontakt naročila")
  await expect(page.locator("body")).toContainText(guestAName)
  await expect(page.locator("body")).toContainText(guestAEmail)
  await expect(page.locator("body")).toContainText("Za plačilo")
  // the stranger identity is only a hint, never the order's contact
  await expect(page.locator("body")).not.toContainText("Tujka Identiteta")
  // items + totals render (the owner product created after the switch)
  await expect(page.locator("body")).toContainText(/serum/i)
  const expectedTotal = new Intl.NumberFormat("sl-SI", {
    style: "currency",
    currency: "EUR",
  }).format(orderA.total.toNumber())
  await expect(page.locator("body")).toContainText(expectedTotal)

  // ---- a foreign order is a 404 INSIDE the dashboard ----
  const foreignOrg = await e2eDb.organization.create({
    data: {
      slug: `foreign-${t.slug}-${Date.now().toString(36)}`,
      name: "Tuj Najemnik",
    },
  })
  const foreignOrder = await e2eDb.order.create({
    data: { organizationId: foreignOrg.id, subtotal: 1, tax: 0, total: 1 },
  })
  await page.goto(`/dashboard/orders/${foreignOrder.id}`)
  await expect(page.locator("body")).toContainText("Stran ni najdena", {
    timeout: 20_000,
  })
  // still the dashboard shell (sidebar present), never the public page
  await expect(page.locator("body")).toContainText("Nadzorna plošča")
  // a missing order is the same dashboard 404
  await page.goto("/dashboard/orders/doesnotexist123")
  await expect(page.locator("body")).toContainText("Stran ni najdena", {
    timeout: 20_000,
  })

  // cleanup fixtures that exist only for this run's isolation
  await e2eDb.order.deleteMany({ where: { id: foreignOrder.id } })
  await e2eDb.organization.delete({ where: { id: foreignOrg.id } })
})
