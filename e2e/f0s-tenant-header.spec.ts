import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { makeTenant, publishSite, registerTenant, visitPublished } from "./helpers"

// ============================================================
// F0-S V-1 (issue #102) — FORGED x-org-slug CANNOT PICK A TENANT
//
// The tenant context of every public surface (platform root, bare
// content paths, booking/cart/inquiry/shop flows and the public
// resolver APIs) must be chosen ONLY by trusted sources:
//   - the verified /s/<slug> URL path (header re-created by the
//     proxy from the URL), or
//   - a VERIFIED custom domain (resolved from the request host).
// A visitor-supplied x-org-slug header must be stripped/ignored
// everywhere else. Before the fix a forged header impersonated a
// foreign tenant on the platform domain and opened its public
// flows (booking wizard, shop, cart) — documented in
// docs/MARKEC-ARCHITECTURE.md §V-1 (reproduced live, 2026-11).
//
// Tenant-context detector: the rendered response (title, navbar
// and footer flight) always carries the resolved organization's
// unique-per-run NAME — so "response contains A's name and never
// B's name" is a precise isolation assertion. NOTE (known Next.js
// 16 quirk, pre-existing): a /s/<slug> request REWRITTEN to the
// bare "/" home page ships an empty page segment to non-JS clients
// (browser hydrates via RSC refetch) — tenant markers still render
// in nav/footer flight; /s/<slug>/services ships full SSR.
//
// Three tenants with DISTINCT verticals (real isolation, not just
// missing data): A = beauty (published), B = tire-service
// (published), C = seamstress (DRAFT, never published).
// ============================================================

const e2eDb = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "" } },
})

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3123"

/** The platform landing hero — never rendered in a tenant context. */
const PLATFORM_LANDING_MARKER = "vaše podjetje"

/**
 * The proxy caches the resolver answer for ~15 s, so an unauthenticated
 * visit right after publishing can still draw the poisoned DRAFT window
 * (owner-browser passes via its session; strangers see the stale 404).
 * Poll until the public (cookie-less) request sees the live state —
 * the poll window outlives the TTL.
 */
async function expectTenantOk(
  request: import("@playwright/test").APIRequestContext,
  path: string,
  headers?: Record<string, string>
): Promise<string> {
  await expect
    .poll(async () => (await request.get(path, { headers })).status(), {
      timeout: 45_000,
      intervals: [1_000, 2_000, 3_000],
    })
    .toBe(200)
  return await (await request.get(path, { headers })).text()
}

test.afterAll(async () => {
  await e2eDb.$disconnect()
})

/** Service names seeded by the onboarding catalog for an org. */
async function serviceNames(orgSlug: string): Promise<string[]> {
  const org = await e2eDb.organization.findUniqueOrThrow({
    where: { slug: orgSlug },
    select: { id: true },
  })
  const services = await e2eDb.service.findMany({
    where: { organizationId: org.id, isActive: true },
    select: { name: true },
    take: 5,
  })
  return services.map((s) => s.name)
}

test("F0-S V-1 — forged x-org-slug cannot impersonate a tenant anywhere", async ({
  page,
  request,
}) => {
  const a = makeTenant("beauty", "F0S-A")
  const b = makeTenant("tire-service", "F0S-B")

  // ---- Real onboarding for two tenants (different verticals) ----
  await registerTenant(page, a)
  await publishSite(page)

  const ctxB = await page.context().browser()!.newContext()
  const pageB = await ctxB.newPage()
  await registerTenant(pageB, b)
  await publishSite(pageB)
  await ctxB.close()

  // Distinctive data markers (onboarding catalog seed per vertical)
  const aServices = await serviceNames(a.slug)
  const bServices = await serviceNames(b.slug)
  expect(aServices.length).toBeGreaterThan(0)
  expect(bServices.length).toBeGreaterThan(0)

  // ---- POSITIVE CONTROL 1: valid /s/<slug> serves the RIGHT tenant ----
  await visitPublished(page, `${BASE_URL}/s/${a.slug}`, aServices[0])
  const aHomeText = await expectTenantOk(request, `/s/${a.slug}`)
  expect(aHomeText).toContain(a.name)
  expect(aHomeText).not.toContain(b.name)

  // …and never B's data, even with a forged header claiming B
  // (host/path binding: the proxy re-creates the header FROM the URL)
  const aForgedText = await expectTenantOk(request, `/s/${a.slug}`, {
    "x-org-slug": b.slug,
  })
  expect(aForgedText).toContain(a.name)
  expect(aForgedText).not.toContain(b.name)
  for (const name of bServices) expect(aForgedText).not.toContain(name)

  // Full-SSR surface of the same tenant: services page keeps serving
  // A's catalog under a forged header claiming B.
  const aServicesForgedText = await expectTenantOk(
    request,
    `/s/${a.slug}/services`,
    { "x-org-slug": b.slug }
  )
  for (const name of aServices) expect(aServicesForgedText).toContain(name)
  expect(aServicesForgedText).not.toContain(b.name)
  for (const name of bServices) expect(aServicesForgedText).not.toContain(name)

  // ---- POSITIVE CONTROL 2: valid /s/<b-slug> serves B, not A ----
  await visitPublished(page, `${BASE_URL}/s/${b.slug}`, bServices[0])
  const bHomeText = await expectTenantOk(request, `/s/${b.slug}`)
  expect(bHomeText).toContain(b.name)
  expect(bHomeText).not.toContain(a.name)

  // ---- V-1 NEGATIVE: forged header on the PLATFORM ROOT ("/") ----
  // Before the fix: rendered the foreign tenant's branded home on the
  // platform domain (audit repro: curl -H "x-org-slug: …" /).
  for (const forged of [a.slug, b.slug]) {
    const res = await request.get("/", {
      headers: { "x-org-slug": forged },
    })
    const text = await res.text()
    expect(res.status()).toBe(200) // platform landing, not an error page
    expect(text).toContain(PLATFORM_LANDING_MARKER)
    // No tenant branding, no tenant data of ANY tenant:
    expect(text).not.toContain(a.name)
    expect(text).not.toContain(b.name)
    for (const name of aServices) expect(text).not.toContain(name)
    for (const name of bServices) expect(text).not.toContain(name)
  }

  // ---- V-1 NEGATIVE: forged header on BARE PUBLIC FLOWS ----
  // Bare content paths on the platform host are NOT tenant surfaces.
  // Before the fix a forged header BYPASSED the bare-path 404 guard
  // and opened the foreign tenant's booking wizard / shop / cart /
  // inquiry / services on the platform domain.
  for (const path of ["/booking", "/cart", "/inquiry", "/shop", "/services"]) {
    const res = await request.get(path, {
      headers: { "x-org-slug": b.slug },
    })
    const text = await res.text()
    expect(res.status(), `${path} with forged header`).toBe(404)
    expect(text).not.toContain(b.name)
    for (const name of bServices) expect(text).not.toContain(name)
    // The same attack with tenant A's slug must not leak A either:
    const resA = await request.get(path, {
      headers: { "x-org-slug": a.slug },
    })
    expect(resA.status(), `${path} with forged A header`).toBe(404)
    const textA = await resA.text()
    expect(textA).not.toContain(a.name)
    for (const name of aServices) expect(textA).not.toContain(name)
  }

  // ---- V-4 NEGATIVE: DRAFT tenants are not enumerable ----
  const c = makeTenant("seamstress", "F0S-C")
  // Register C in its OWN context (the `page` session is still A's owner —
  // the same pattern as idor.spec.ts; /start for a signed-in owner is not
  // a fresh onboarding wizard).
  const ctxC = await page.context().browser()!.newContext()
  const pageC = await ctxC.newPage()
  await registerTenant(pageC, c) // never published — stays DRAFT
  await ctxC.close()

  // Unauthenticated visit to a DRAFT site stays a REAL 404:
  const draftSite = await request.get(`/s/${c.slug}`)
  expect(draftSite.status()).toBe(404)
  const draftText = await draftSite.text()
  expect(draftText).not.toContain(c.name)

  // Forged header on bare paths must not resurrect the draft either:
  const draftForged = await request.get("/", {
    headers: { "x-org-slug": c.slug },
  })
  expect(await draftForged.text()).not.toContain(c.name)

  // The public resolver must not confirm a DRAFT org's existence
  // (before the fix: 200 { exists: true, orgId, publishState: "DRAFT" }).
  const resolver = await request.get(
    `/api/public/resolve-tenant?slug=${encodeURIComponent(c.slug)}`
  )
  expect(resolver.status()).toBe(401)
  const resolverText = await resolver.text()
  expect(resolverText).not.toContain("orgId")
  expect(resolverText).not.toContain(c.name)

  // …and entity-exists must not answer for arbitrary orgIds:
  const orgC = await e2eDb.organization.findUniqueOrThrow({
    where: { slug: c.slug },
    select: { id: true },
  })
  const entity = await request.get(
    `/api/public/entity-exists?orgId=${encodeURIComponent(orgC.id)}&type=service&slug=test`
  )
  expect(entity.status()).toBe(401)
  expect(await entity.text()).not.toContain("exists")

  // For a PUBLISHED tenant the resolver is also proxy-only (proof-gated):
  const resolverPub = await request.get(
    `/api/public/resolve-tenant?slug=${encodeURIComponent(a.slug)}`
  )
  expect(resolverPub.status()).toBe(401)
})
