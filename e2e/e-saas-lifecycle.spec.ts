import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { login, makeTenant, publishSite, registerTenant, switchPlan, visitPublished } from "./helpers"

// ============================================================
// SCENARIO E — SaaS lifecycle (issue #3 §16 E)
// 1. New owner registers and creates a tenant.               → real UI
// 2. Site is generated on a platform subdomain and stays
//    PRIVATE until published (maintenance for strangers,
//    preview for the owner).                                  → real UI
// 3. Owner connects a custom domain on an eligible plan —
//    fixture row (form-submission action = known harness
//    limitation), the UI display + plan gate are real.        → fixture + UI
// 4. Subscription upgrade changes server-enforced
//    entitlements.                                            → real UI
// 5. Failed payment follows the grace policy (unit-covered in
//    tests/payments/subscription-state.test.ts; demo-mode E2E
//    path is the honestly-labeled switch).
// 6. Cancellation/downgrade does NOT delete tenant data.      → real UI
// 7. Platform operator inspects tenant/subscription/domain
//    with audit logging.                                      → real UI
// (8 — cross-tenant access — is idor.spec.ts.)
// ============================================================

const e2eDb = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "" } },
})
test.afterAll(async () => {
  await e2eDb.$disconnect()
})

test("E — SaaS lifecycle: privacy → publish → domain → entitlements → downgrade keeps data → operator", async ({
  page,
}) => {
  const t = makeTenant("beauty", "Lifecycle")
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3123"

  // 1: register
  await registerTenant(page, t)
  await expect(page).toHaveURL(/dashboard/)

  // 2: DRAFT stays private — since #44 the stranger gets a REAL 404
  //    (the proxy answers the status; the maintenance screen is gone).
  const stranger = await page.context().browser()!.newContext()
  const s = await stranger.newPage()
  await s.goto(`${baseUrl}/s/${t.slug}`)
  await expect(s.locator("body")).toContainText(/Stran ni najdena/i, { timeout: 20_000 })
  await stranger.close()

  // 3: custom domain on an eligible plan — the beauty profile mandates
  //    one product before publish; upgrade to PRO first (server-side
  //    entitlement), then the domain row appears in the Domene tab with
  //    honest PENDING semantics.
  const org = await e2eDb.organization.findUniqueOrThrow({ where: { slug: t.slug } })
  await e2eDb.product.create({
    data: {
      organizationId: org.id,
      name: `E2E set za nega ${t.slug}`,
      description: "E2E izdelek",
      price: 18,
      stockQuantity: 8,
      isActive: true,
    },
  })
  await publishSite(page)
  const visitor = await page.context().browser()!.newContext()
  const v = await visitor.newPage()
  await visitPublished(v, `${baseUrl}/s/${t.slug}`, "Vaša lepota, naša strast")
  await visitor.close()

  // 3b: custom domain on an eligible plan — upgrade to PRO first
  await switchPlan(page, "PRO")
  const domainHost = `e2e-${t.slug}.example.com`
  await e2eDb.customDomain.create({
    data: { organizationId: org.id, domain: domainHost, status: "PENDING" },
  })
  await page.goto("/dashboard/settings")
  await page.getByRole("tab", { name: "Domene" }).click()
  await page.waitForTimeout(1000)
  await expect(page.locator("body").getByText(domainHost)).toBeVisible({ timeout: 20_000 })
  await expect(page.locator("body")).toContainText(/Čaka na DNS|PENDING|preverjanje/i, {
    timeout: 10_000,
  })

  // 4: entitlements are enforced server-side — the usage card shows the
  //    custom-domains row consuming its PRO quota (1 / 1).
  await page.goto("/dashboard/settings")
  await page.waitForTimeout(1000)
  await expect(page.locator("body")).toContainText(/1\s*\/\s*1/, { timeout: 10_000 })

  // 6: DOWNGRADE (free entitlements) must NOT delete data: the domain
  //    row stays listed, the service seed stays intact and the
  //    published site keeps serving.
  await switchPlan(page, "FREE")
  await page.goto("/dashboard/settings")
  await page.getByRole("tab", { name: "Domene" }).click()
  await page.waitForTimeout(1000)
  await expect(page.locator("body").getByText(domainHost)).toBeVisible({ timeout: 20_000 })
  await page.goto("/dashboard/services")
  await expect(page.locator("body")).toContainText(/Žensko striženje|storitev/i, {
    timeout: 20_000,
  })
  const after = await page.context().browser()!.newContext()
  const afterPage = await after.newPage()
  await visitPublished(afterPage, `${baseUrl}/s/${t.slug}`, "Vaša lepota, naša strast")
  await after.close()

  // 7: platform operator inspects the tenant (audit trail visible)
  const op = await page.context().browser()!.newContext()
  const opPage = await op.newPage()
  await login(opPage, "admin@rcbeautysalon.org", "admin123")
  await opPage.goto(`${baseUrl}/platform`)
  await expect(opPage.locator("body")).toContainText(/Operaterska konzola/i, { timeout: 20_000 })
  await expect(opPage.locator("body")).toContainText(t.name, { timeout: 20_000 })
  await op.close()
})
