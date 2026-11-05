import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { makeTenant, publishSite, registerTenant, visitPublished } from "./helpers"

// ============================================================
// #105 — DEAKTIVIRAN izdelek NI dosegljiv prek neposrednega URL-ja.
//
// Incident (2026-11): javna detail stran je prikazala deaktiviran
// izdelek (name/description/zaloga/gumb za nakup) — seznam trgovine
// ga je filtriral, detail branje pa ni. Po popravku:
//   - neobiskan deaktiviran izdelek → takoj PRAVI HTTP 404
//     (proxy entity-exists → prepis na rezervirano 404 pot),
//   - obiskan (cacheiran) deaktiviran izdelek → 404 najpozneje po
//     izteku 30 s proxy entitetnega predpomnilnika (expect.poll),
//   - forSale=false (sleden, a ne-prodajni) → prav tako 404.
// ============================================================

const e2eDb = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "" } },
})
test.afterAll(async () => {
  await e2eDb.$disconnect()
})

test("G — deaktiviran izdelek: javni URL vrne pravi 404", async ({ page }) => {
  const t = makeTenant("beauty", "Lepotni salon")
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3123"

  await registerTenant(page, t)
  await expect(page).toHaveURL(/dashboard/)
  const org = await e2eDb.organization.findUniqueOrThrow({ where: { slug: t.slug } })
  await publishSite(page)

  // Aktivni, prodajni izdelek — javno viden.
  const active = await e2eDb.product.create({
    data: {
      organizationId: org.id,
      name: `E2E aktivni serum ${t.slug}`,
      description: "E2E aktiven izdelek",
      price: 15,
      stockQuantity: 5,
      isActive: true,
      forSale: true,
    },
  })

  // Deaktiviran izdelek, ki še NIKOLI ni bil obiskan (brez proxy cache-a).
  const deactivated = await e2eDb.product.create({
    data: {
      organizationId: org.id,
      name: `E2E deaktiviran ${t.slug}`,
      description: "E2E neaktiven izdelek",
      price: 10,
      stockQuantity: 1,
      isActive: false,
      forSale: true,
    },
  })

  // Ne-prodajni izdelek (sleden, ni za prodajo) — prav tako izven ponudbe.
  const notForSale = await e2eDb.product.create({
    data: {
      organizationId: org.id,
      name: `E2E back-bar ${t.slug}`,
      description: "E2E izdelek brez prodaje",
      price: 8,
      stockQuantity: 3,
      isActive: true,
      forSale: false,
    },
  })

  // 1) aktiven izdelek je javno viden (200 + ime na strani)
  await visitPublished(page, `${baseUrl}/s/${t.slug}/shop/${active.id}`, /serum/i)

  // 2) neobiskan deaktiviran izdelek → takoj pravi HTTP 404
  const gone = await page.request.get(`${baseUrl}/s/${t.slug}/shop/${deactivated.id}`)
  expect(gone.status(), "deaktiviran izdelek mora vrniti pravi 404").toBe(404)

  // 3) forSale=false → prav tako pravi 404
  const nfs = await page.request.get(`${baseUrl}/s/${t.slug}/shop/${notForSale.id}`)
  expect(nfs.status(), "ne-prodajni izdelek mora vrniti pravi 404").toBe(404)

  // 4) PRVIČ obiskan, potem deaktiviran → 404 po izteku proxy entitetnega
  //    predpomnilnika (30 s) — expect.poll kot v f0s-custom-domain spec-u.
  await e2eDb.product.update({ where: { id: active.id }, data: { isActive: false } })
  await expect
    .poll(
      async () => (await page.request.get(`${baseUrl}/s/${t.slug}/shop/${active.id}`)).status(),
      { timeout: 45_000, intervals: [2_000, 5_000, 10_000] }
    )
    .toBe(404)
})
