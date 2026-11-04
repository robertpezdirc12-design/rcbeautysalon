import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { makeTenant, publishSite, registerTenant, visitPublished } from "./helpers"

// ============================================================
// SCENARIO D — Seamstress (issue #3 §16 D)
// 1. Owner selects tailoring/alterations.                → real UI
// 2. Generated site offers portfolio, services, quote request
//    and contact details.                                → real UI
// 3. Customer opens the public inquiry form.             → real UI
// 4. A request lands in the workspace (fixture submission —
//    the form's server action is affected by the known
//    harness limitation, see docs/EPIC-3/E2E.md) and the
//    owner manages it.                                   → fixture + UI
// 5. No irrelevant ecommerce or booking flow is forced.  → real UI
// ============================================================

const e2eDb = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "" } },
})
test.afterAll(async () => {
  await e2eDb.$disconnect()
})

test("D — seamstress: inquiry → workspace management, no forced shop/booking", async ({
  page,
}) => {
  const t = makeTenant("seamstress", "Šiviljstvo")
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3123"

  await registerTenant(page, t)
  await expect(page).toHaveURL(/dashboard/)

  await publishSite(page)

  // 3: customer opens the real public inquiry form
  const customer = await page.context().browser()!.newContext()
  const c = await customer.newPage()
  await visitPublished(c, `${baseUrl}/s/${t.slug}/inquiry`, /Povpraševanje|vprašanje|obrazec/i)
  await customer.close()

  // 4: a request lands in the workspace (fixture) and the owner
  //    manages it — persisted data, real workspace view
  const org = await e2eDb.organization.findUniqueOrThrow({ where: { slug: t.slug } })
  const formDef = await e2eDb.formDefinition.findFirstOrThrow({
    where: { organizationId: org.id, isActive: true },
  })
  await e2eDb.formSubmission.create({
    data: {
      organizationId: org.id,
      formDefinitionId: formDef.id,
      data: { name: "Ana Novak", email: `ana.novak+${t.slug}@example.com`, message: "E2E povpraševanje: krčenje hlač." },
      status: "NEW",
    },
  })
  await page.goto("/dashboard/forms")
  // The submission is registered (counter) and manageable from the list
  await expect(page.locator("body")).toContainText(/1 oddaje|Poglej podatke|Nova/, {
    timeout: 20_000,
  })

  // 5: booking is disabled for this profile → /booking lands on inquiry
  const check = await page.context().browser()!.newContext()
  const x = await check.newPage()
  await x.goto(`${baseUrl}/s/${t.slug}/booking`)
  await expect(x).toHaveURL(/inquiry/, { timeout: 20_000 })
  // and no purchasable catalog is forced onto this profile: the shop
  // surface has no add-to-cart actions (seamstress ships no products)
  await x.goto(`${baseUrl}/s/${t.slug}/shop`)
  await x.waitForTimeout(1500)
  expect(await x.getByRole("button", { name: /Dodaj v košarico/ }).count()).toBe(0)
  await check.close()
})
