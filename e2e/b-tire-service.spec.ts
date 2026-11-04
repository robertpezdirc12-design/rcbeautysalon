import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { makeTenant, publishSite, registerTenant, visitPublished } from "./helpers"

const e2eDb = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "" } },
})
test.afterAll(async () => {
  await e2eDb.$disconnect()
})

// ============================================================
// SCENARIO B — Tire service / vehicle workshop (issue #3 §16 B)
// 1. Owner registers and selects tire service/workshop.
// 2. Generated site presents relevant services and enquiry options.
// 3. Owner configures vehicle/service information + work orders.
// 4. Owner manages a request without beauty-style settings.
// 5. Tenant data remains isolated.
// ============================================================

test("B — tire service: vertical site + work orders + isolation", async ({ page }) => {
  const t = makeTenant("tire-service", "Vulkanizer")
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3123"

  await registerTenant(page, t)
  await expect(page).toHaveURL(/dashboard/)

  // Generated site presents tire-service content (vertical preset);
  // the vertical mandates a shop — one product fixture unlocks publish.
  const org = await e2eDb.organization.findUniqueOrThrow({ where: { slug: t.slug } })
  await e2eDb.product.create({
    data: {
      organizationId: org.id,
      name: `E2E zimska guma ${t.slug}`,
      description: "E2E izdelek",
      price: 89,
      stockQuantity: 4,
      isActive: true,
    },
  })
  await publishSite(page)
  const visitor = await page.context().browser()!.newContext()
  const v = await visitor.newPage()
  await visitPublished(v, `${baseUrl}/s/${t.slug}`, /gum|servis|vulkani/i)
  // The generated site is NOT beauty-styled: no beauty preset categories
  await expect(v.locator("body")).not.toContainText(/Balayage|Nohti — gel/i)
  await visitor.close()

  // Work orders exist for this vertical (E3-5-era capability, §16 B.3)
  await page.goto("/dashboard/work-orders")
  await expect(page.locator("body")).toContainText(/Delovni nalog|nalog/i, { timeout: 15_000 })

  // B.5 isolation: a random /s/ slug that does not exist gets the
  // neutral maintenance screen, never another tenant's content.
  const stranger = await page.context().browser()!.newContext()
  const s = await stranger.newPage()
  await s.goto(`${baseUrl}/s/this-slug-does-not-exist-e2e`)
  await expect(s.locator("body")).toContainText(/Stran ni najdena/i, {
    timeout: 20_000,
  })
  await s.goto(`${baseUrl}/s/${t.slug}`)
  await expect(s.locator("body")).not.toContainText("Lepotni salon E2E")
  await stranger.close()
})
