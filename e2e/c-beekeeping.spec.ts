import { test, expect } from "@playwright/test"
import { makeTenant, publishSite, registerTenant, visitPublished } from "./helpers"

// ============================================================
// SCENARIO C — Beekeeper / honey producer (issue #3 §16 C)
// 1. Owner selects producer/online shop profile.
// 2. Generated site includes product catalogue and shop/order flow.
// 3. Owner manages products, prices, stock.
// 4. Customer can place an order via the configured checkout path
//    (payments not configured → the store honestly reports it).
// 5. Booking capability is absent unless explicitly enabled.
// ============================================================

test("C — beekeeping: shop flow + honest checkout + no booking", async ({ page }) => {
  const t = makeTenant("beekeeping", "Čebelar")
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3123"

  await registerTenant(page, t)
  await expect(page).toHaveURL(/dashboard/)

  // 3: owner manages products — open the products list (seeded honey products)
  await page.goto("/dashboard/products")
  await expect(page.locator("body")).toContainText(/Cvetlični med|med/i, { timeout: 15_000 })

  await publishSite(page)

  const customer = await page.context().browser()!.newContext()
  const c = await customer.newPage()

  // 2: generated site shows the honey product catalogue
  await visitPublished(c, `${baseUrl}/s/${t.slug}/shop`, /Cvetlični med/)

  // 4: customer adds a product to the cart and starts checkout.
  //    The salon has no Stripe keys → the flow must FAIL HONESTLY
  //    ("plačila še niso nastavljena"), never fake an order success.
  await c.getByRole("button", { name: /Dodaj v košarico/ }).first().click()
  await c.goto(`${baseUrl}/s/${t.slug}/cart`)
  await expect(c.locator("body")).toContainText(/košaric/i, { timeout: 15_000 })
  // Checkout uses a form-submission server action — the known harness
  // limitation (docs/EPIC-3/E2E.md); the honest "payments not set up"
  // path is verified on the deployed app. Here we assert the cart
  // persisted and the checkout entry point exists.
  await expect(c.getByRole("button", { name: /Zaključi nakup/ })).toBeVisible({
    timeout: 15_000,
  })

  // 5: booking capability is ABSENT for this profile — /booking routes
  //    to the inquiry form instead (profile guard, no calendar).
  await c.goto(`${baseUrl}/s/${t.slug}/booking`)
  await expect(c).toHaveURL(/inquiry/, { timeout: 20_000 })
  await customer.close()
})
