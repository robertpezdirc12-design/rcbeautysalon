import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { makeTenant, publishSite, registerTenant } from "./helpers"

// ============================================================
// F0-S — Codex finding "lastne domene" (PR #103 review round 2)
//
// On a VERIFIED custom domain the tenant context must come from the
// VERIFIED HOST (resolved server-side from the CustomDomain table).
// Before the fix the proxy stripped the tenant header and continued
// WITHOUT any tenant context: an anonymous visitor on a custom domain
// got notFound() on every bare public path (/services, /shop, /booking,
// /cart, /inquiry) and the landing "/" fell back to the OLDEST ACTIVE
// organization — wrong-company branding.
//
// After the fix the proxy resolves the verified host SERVER-SIDE
// (/api/public/resolve-host, proof-gated) and signs the SAME tenant
// header it mints for /s/<slug> — the whole public surface works on
// custom domains, gates included (DRAFT tenants 404 for strangers,
// member preview for the owner).
//
// Two published tenants with distinct verticals (real isolation) plus
// a DRAFT tenant: A = beauty, B = tire-service, C = seamstress (DRAFT).
// ============================================================

const e2eDb = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "" } },
})

test.afterAll(async () => {
  await e2eDb.$disconnect()
})

test("F0-S custom domain — anonymous visitor sees the RIGHT tenant, never a 404 or another company", async ({
  page,
  request,
}) => {
  const a = makeTenant("beauty", "F0S-CD-A")
  const b = makeTenant("tire-service", "F0S-CD-B")

  // ---- Real onboarding for two published tenants ----
  await registerTenant(page, a)
  await publishSite(page)

  const ctxB = await page.context().browser()!.newContext()
  const pageB = await ctxB.newPage()
  await registerTenant(pageB, b)
  await publishSite(pageB)
  await ctxB.close()

  const orgA = await e2eDb.organization.findUniqueOrThrow({
    where: { slug: a.slug },
    select: { id: true },
  })
  const orgB = await e2eDb.organization.findUniqueOrThrow({
    where: { slug: b.slug },
    select: { id: true },
  })

  // ---- VERIFIED custom domains (server-side truth; a visitor can only
  // point DNS at us — the platform resolves the tenant from the DB) ----
  const domA = `salon-a-${a.slug}.example`
  const domB = `salon-b-${b.slug}.example`
  await e2eDb.customDomain.create({
    data: { domain: domA, organizationId: orgA.id, status: "VERIFIED" },
  })
  await e2eDb.customDomain.create({
    data: { domain: domB, organizationId: orgB.id, status: "VERIFIED" },
  })
  const hostA = { host: domA }
  const hostB = { host: domB }

  // ---- POSITIVE: landing on A's custom domain — A's branding, never B's.
  // Before the fix this rendered the OLDEST ACTIVE org (B if registered
  // first — wrong-company branding on someone else's domain). ----
  const aHome = await request.get("/", { headers: hostA })
  expect(aHome.status()).toBe(200)
  const aHomeText = await aHome.text()
  expect(aHomeText).toContain(a.name)
  expect(aHomeText).not.toContain(b.name)

  // ---- POSITIVE: bare public paths that 404'd before the fix ----
  // NOTE: redirects are NOT followed (maxRedirects: 0). A 307 here (e.g.
  // /inquiry on a booking-enabled tenant) is itself tenant-correct behavior
  // — it can ONLY fire when the custom domain resolved the RIGHT tenant —
  // and following it in this harness would drop the overridden Host header
  // (Playwright redirect follow re-targets the absolute Location URL).
  // A platform-neutral 404 or foreign branding still fails the test.
  for (const path of ["/services", "/staff", "/shop", "/booking", "/cart", "/inquiry"]) {
    const res = await request.get(path, { headers: hostA, maxRedirects: 0 })
    const status = res.status()
    expect(
      [200, 307],
      `${path} on A's custom domain must render or tenant-redirect (got ${status})`
    ).toContain(status)
    if (status === 200) {
      const text = await res.text()
      expect(text).toContain(a.name)
      expect(text).not.toContain(b.name)
    }
  }

  // ---- POSITIVE: a REAL service detail page and the entity 404 gate ----
  const svc = await e2eDb.service.findFirst({
    where: { organizationId: orgA.id, isActive: true },
    select: { slug: true, name: true },
  })
  expect(svc).toBeTruthy()
  const svcRes = await request.get(`/services/${svc!.slug}`, { headers: hostA })
  expect(svcRes.status()).toBe(200)
  const svcText = await svcRes.text()
  expect(svcText).toContain(svc!.name)
  // Missing entity on the custom domain → REAL 404 (proxy gate):
  const svc404 = await request.get("/services/does-not-exist-f0s", { headers: hostA })
  expect(svc404.status()).toBe(404)
  expect(await svc404.text()).not.toContain(a.name)

  // ---- POSITIVE: B's domain serves B, never A (host binding is exact) ----
  const bHome = await request.get("/", { headers: hostB })
  expect(bHome.status()).toBe(200)
  const bHomeText = await bHome.text()
  expect(bHomeText).toContain(b.name)
  expect(bHomeText).not.toContain(a.name)
  const bServices = await request.get("/services", { headers: hostB })
  expect(bServices.status()).toBe(200)
  const bServicesText = await bServices.text()
  expect(bServicesText).not.toContain(a.name)
  expect(bServicesText).not.toContain(a.slug)

  // ---- NEGATIVE: /s/<slug> paths are hard-404 on custom domains
  // (a custom domain serves its OWN org on bare paths only) ----
  const slugOnCd = await request.get(`/s/${a.slug}`, { headers: hostA })
  expect(slugOnCd.status()).toBe(404)
  expect(await slugOnCd.text()).not.toContain(a.name)
  // ...and a FOREIGN slug under someone else's domain is equally 404:
  const foreignSlug = await request.get(`/s/${b.slug}`, { headers: hostA })
  expect(foreignSlug.status()).toBe(404)
  expect(await foreignSlug.text()).not.toContain(b.name)

  // ---- Forged tenant header on a custom domain is stripped (V-1) ----
  const forged = await request.get("/services", {
    headers: { ...hostA, "x-org-slug": b.slug },
  })
  expect(forged.status()).toBe(200)
  const forgedText = await forged.text()
  expect(forgedText).toContain(a.name)
  expect(forgedText).not.toContain(b.name)

  // ---- DRAFT tenant on its own custom domain: owner preview vs 404 ----
  const c = makeTenant("seamstress", "F0S-CD-C")
  const ctxC = await page.context().browser()!.newContext()
  const pageC = await ctxC.newPage()
  await registerTenant(pageC, c) // never published — stays DRAFT
  const orgC = await e2eDb.organization.findUniqueOrThrow({
    where: { slug: c.slug },
    select: { id: true },
  })
  const domC = `draft-c-${c.slug}.example`
  await e2eDb.customDomain.create({
    data: { domain: domC, organizationId: orgC.id, status: "VERIFIED" },
  })

  // The owner (signed-in session + their domain) sees the preview:
  const ownerPreview = await pageC.request.get("/", { headers: { host: domC } })
  expect(ownerPreview.status()).toBe(200)
  expect(await ownerPreview.text()).toContain(c.name)
  await ctxC.close()

  // An anonymous visitor on the DRAFT tenant's domain → REAL 404, no C:
  const anonC = await request.get("/", { headers: { host: domC } })
  expect(anonC.status()).toBe(404)
  expect(await anonC.text()).not.toContain(c.name)

  // ---- UNVERIFIED host (previews, dev hosts): pass-through preserved —
  // never 404, never the DRAFT tenant's content ----
  const unverified = await request.get("/", {
    headers: { host: `unverified-${Date.now()}.example` },
  })
  expect(unverified.status()).toBe(200)
  const unverifiedText = await unverified.text()
  expect(unverifiedText).not.toContain(c.name)

  // ---- The resolver endpoint is proxy-only for hosts too (V-4):
  // a direct visitor call is rejected 401 ----
  const directResolver = await request.get(
    `/api/public/resolve-host?host=${encodeURIComponent(domA)}`
  )
  expect(directResolver.status()).toBe(401)
  const directText = await directResolver.text()
  expect(directText).not.toContain("orgId")
  expect(directText).not.toContain(a.slug)
})
