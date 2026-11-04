import { expect, type Page } from "@playwright/test"

// ============================================================
// E2E HELPERS (EPIC #3 E3-8) — real flows only: every helper
// drives the same UI a real owner uses (issue #3 §16: "real
// application flows and persisted data, not screenshots or
// mock-only components").
// ============================================================

/** Unique-per-run suffix keeps reruns working against a persistent DB. */
export function uniqueId(): string {
  return Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)
}

export interface TenantSpec {
  vertical: string
  verticalLabel: string
  name: string
  slug: string
  ownerName: string
  email: string
  password: string
}

export function makeTenant(vertical: keyof typeof VERTICAL_LABELS, label: string): TenantSpec {
  const id = uniqueId()
  return {
    vertical,
    verticalLabel: VERTICAL_LABELS[vertical],
    name: `${label} E2E ${id}`,
    slug: `e2e-${vertical}-${id}`,
    ownerName: `Lastnik ${label}`,
    email: `e2e-${vertical}-${id}@example.com`,
    password: `E2e-pass-${id}!`,
  }
}

export const VERTICAL_LABELS = {
  beauty: "Lepotni salon",
  "tire-service": "Vulkanizer & avtoservis",
  beekeeping: "Čebelarstvo",
  seamstress: "Šiviljstvo",
} as const

/**
 * Registers a tenant through the REAL onboarding wizard (/start):
 * step 1 vertical → step 2 company → step 3 owner. The wizard
 * auto-signs-in on success and lands on /dashboard?welcome=1.
 */
export async function registerTenant(page: Page, t: TenantSpec): Promise<void> {
  await page.goto("/start")

  // Step 1: pick the vertical card by its display label
  await page.getByRole("button", { name: t.verticalLabel }).first().click()
  await page.getByRole("button", { name: "Naprej" }).click()

  // Step 2: company name + URL slug (slug is prefilled from the name;
  // we force the unique one) + keep the default palette. The slug has a
  // debounced availability check — wait for the "Prosto" indicator
  // before advancing (validation blocks while "checking").
  await waitHydrated(page, "#company-name")
  await page.getByLabel("Ime podjetja").fill(t.name)
  const slug = page.getByLabel("URL naslov")
  await slug.fill(t.slug)
  await page.getByText("Prosto").waitFor({ state: "visible", timeout: 30_000 })
  await page.getByRole("button", { name: "Naprej" }).click()

  // Step 3: owner account
  await waitHydrated(page, "#owner-name")
  await page.getByLabel("Ime in priimek").fill(t.ownerName)
  await page.getByLabel("E-pošta", { exact: false }).first().fill(t.email)
  await page.getByLabel("Geslo", { exact: false }).first().fill(t.password)
  await page.getByLabel("Potrditev gesla").fill(t.password)
  await page.getByRole("button", { name: /Ustvari podjetje/ }).click()

  // Wizard auto-signs-in and redirects to the dashboard.
  await page.waitForURL(/dashboard/, { timeout: 60_000 })
}

/** Logs in through the real /login form. */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login")
  await page.getByLabel(/E-pošta/).first().fill(email)
  await page.getByLabel(/Geslo/).first().fill(password)
  await page.getByRole("button", { name: /Prijava/ }).click()
  await page.waitForURL(/dashboard|\/s\//, { timeout: 30_000 })
}

/**
 * Publishes the site through Settings → "Objavi stran" (real
 * publication action, persisted publishState). Publish validation
 * requires contact email + phone — a fresh tenant fills them first
 * through the real settings form.
 */
export async function publishSite(page: Page): Promise<void> {
  await page.goto("/dashboard/settings")
  await waitHydrated(page, "#email")
  // Contact details required by validatePublishRequirements
  const email = page.getByLabel(/E-pošta/).first()
  if (await email.count()) {
    const hasValue = await email.inputValue().catch(() => "")
    if (!hasValue) await email.fill("info@e2e-test.si")
  }
  const phone = page.getByLabel(/Telefon/).first()
  if (await phone.count()) {
    const hasValue = await phone.inputValue().catch(() => "")
    if (!hasValue) await phone.fill("040123456")
  }
  const save = page.getByRole("button", { name: /Shrani|Shranim/ }).first()
  if (await save.count()) {
    await save.dispatchEvent("click")
    await page.waitForTimeout(1500)
  }
  const btn = page.getByRole("button", { name: /Objavi stran|Objavi spremembe/ }).first()
  await btn.scrollIntoViewIfNeeded()
  await btn.click()
  // Published state shows "Umakni objavo"; if validation blocked the
  // publish, the alert "Stran še ni pripravljena za objavo" renders —
  // surface it for a clear failure message instead of a silent timeout.
  const published = page.getByRole("button", { name: /Umakni objavo/ })
  const blocked = page.getByText(/še ni pripravljena za objavo/)
  await expect
    .poll(
      async () =>
        (await published.count()) > 0 ? "published" : (await blocked.count()) > 0 ? "blocked" : "pending",
      { timeout: 30_000, intervals: [500, 1000] }
    )
    .toBe("published")
}

/** Opens Settings and switches to the given tab (by its visible name). */
export async function openSettingsTab(page: Page, tabName: RegExp): Promise<void> {
  await page.goto("/dashboard/settings")
  await page.getByRole("tab", { name: tabName }).click()
  await page.waitForTimeout(600)
}

/**
 * Waits until React has attached to the given element (hydration
 * complete). Filling controlled/uncontrolled inputs BEFORE hydration
 * loses values (React resets to server defaults) and form submit
 * handlers are not yet wired — the #1 source of flaky E2E.
 */
export async function waitHydrated(page: Page, selector: string): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel)
      return !!el && Object.keys(el).some((k) => k.startsWith("__reactFiber"))
    },
    selector,
    { timeout: 30_000 }
  )
}

/**
 * Submits a react-hook-form driven form by dispatching a click on its
 * submit button. RHF forms under some local production-build setups
 * bypass the React submit handler for trusted pointer submissions
 * (synthetic click → RHF handleSubmit → validation → server action
 * works deterministically). The full real form flow (validation,
 * server action, redirect) still executes — only the raw pointer
 * path differs.
 */
export async function submitReactForm(page: Page, button: ReturnType<Page["getByRole"]>): Promise<void> {
  await button.dispatchEvent("click")
}

/**
 * Creates a product through the real admin form. Needed before
 * publishing on profiles with a MANDATORY shop capability ("Trgovina
 * je obvezna za to dejavnost — dodajte vsaj en izdelek"). Waits for
 * the redirect OUT of the /new route and asserts the product shows
 * in the list — HTML5 validation failures must fail loudly.
 */
export async function createProduct(page: Page, name: string): Promise<void> {
  await page.goto("/dashboard/products/new")
  await waitHydrated(page, "#name")
  // Fill the name LAST: the category combobox loads async and remounts
  // the form once, wiping earlier uncontrolled input values.
  const desc = page.locator("#description")
  if (await desc.count()) await desc.fill("E2E izdelek")
  await page.locator("#price").fill("12")
  const stock = page.locator("#stockQuantity")
  if (await stock.count()) await stock.fill("10")
  await expect(page.locator("#price")).toHaveValue("12")
  await page.waitForTimeout(1500) // let the async category load settle
  const nameInput = page.locator("#name")
  await nameInput.fill(name)
  await expect(nameInput).toHaveValue(name)
  await submitReactForm(page, page.getByRole("button", { name: /Ustvari izdelek/ }).first())
  // Success = left the /new route (form pushes to the list)
  await page.waitForURL(/dashboard\/products\/?$/, { timeout: 60_000 })
  await expect(page.locator("body")).toContainText(name, { timeout: 20_000 })
}

/**
 * Demonstrative plan switch (billing not configured): confirm dialog
 * included — the switch is real (Organization.plan is persisted).
 * The plan cards live on the DEFAULT settings tab (Paket in raba).
 */
export async function switchPlan(page: Page, planLabel: string): Promise<void> {
  await page.goto("/dashboard/settings")
  await page.waitForTimeout(1000)
  await page.getByRole("button", { name: new RegExp(`Preklopi na ${planLabel}`) }).first().click()
  const confirm = page.getByRole("button", { name: /Potrdim|Potrdi|Preklopi/ }).last()
  await confirm.click()
  // Deterministic verification: the plan badge in the usage card flips
  // to the new plan (the switch is persisted server-side).
  await expect(
    page.getByText(new RegExp(`${planLabel}\\s*·\\s*vaš paket`)).first()
  ).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1000)
}

/**
 * #44/#66/#72-era tenant visits: the dashboard header PREFETCHES
 * /s/<slug> while the tenant is still DRAFT — the proxy caches the
 * resolver answer for 15 s, so a visit right after publishing can
 * draw the poisoned window (a real HTTP 404, not a soft one). This
 * helper re-navigates until the expected content renders (the poll
 * window outlives the 15 s TTL), instead of asserting on a single
 * navigation that happened to land inside the window.
 */
export async function visitPublished(
  page: Page,
  url: string,
  expected: RegExp | string
): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.goto(url).catch(() => "nav-failed")
        const text = await page.locator("body").innerText().catch(() => "")
        if (typeof expected === "string") return text.includes(expected) ? "ok" : "waiting"
        return expected.test(text) ? "ok" : "waiting"
      },
      { timeout: 45_000, intervals: [1_000, 2_000, 3_000] }
    )
    .toBe("ok")
}
