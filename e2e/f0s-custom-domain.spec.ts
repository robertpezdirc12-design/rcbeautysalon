import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
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
// PR #103 review round 4 (two NEW Codex findings):
//  1. "Začasno onemogočeno podjetje na lastni domeni" — resolve-host
//     answers matched:true, exists:false (NO slug) for a VERIFIED
//     domain of a SUSPENDED org; the old `hostTenant.slug` condition
//     silently skipped the gates and the request continued WITHOUT
//     tenant context — the app fell back to the DEFAULT PUBLISHED
//     company under the dead tenant's domain. Now: REAL HTTP 404.
//  2. "Administrativne pravice na lastni domeni" — the custom-domain
//     branch returned NextResponse.next() for denylist paths
//     (/dashboard, /staff-portal, …) and SKIPPED the standard
//     login/role gates entirely. Now denylist paths fall through to
//     them: STAFF cannot open /dashboard (redirected to their own
//     surface), ADMIN can; anonymous users go to /login.
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

// ============================================================
// PR #103 review round 4 — Codex najdba "začasno onemogočeno
// podjetje na lastni domeni".
//
// resolve-host answers { matched: true, exists: false } (NO slug) for a
// VERIFIED domain whose organization is SUSPENDED. The old proxy
// condition required hostTenant.slug before running the gates, so the
// request CONTINUED without tenant context and the app fell back to
// the default published company — a live competitor's branding served
// under the suspended tenant's own domain.
//
// Fix: a verified host whose org is not live stops with a REAL HTTP
// 404 (the proxy is the only place that can set the status in Next 16
// streaming) — never another company's page, never a soft 200.
// ============================================================
test("F0-S round 4 — suspended org on its VERIFIED domain is a REAL 404, never another company", async ({
  page,
  request,
}) => {
  // ---- Live tenant A (the "wrong company" the old bug leaked) ----
  const a = makeTenant("beauty", "F0S-SUS-A")
  await registerTenant(page, a)
  await publishSite(page)
  const orgA = await e2eDb.organization.findUniqueOrThrow({
    where: { slug: a.slug },
    select: { id: true },
  })

  // ---- Tenant S: really onboarded + published, then SUSPENDED by the
  // platform (E3-5 precondition arranged server-side — the vulnerability
  // under test is the proxy resolution of the dead tenant's domain) ----
  const s = makeTenant("tire-service", "F0S-SUS-S")
  const ctxS = await page.context().browser()!.newContext()
  const pageS = await ctxS.newPage()
  await registerTenant(pageS, s)
  await publishSite(pageS)
  await ctxS.close()
  const orgS = await e2eDb.organization.findUniqueOrThrow({
    where: { slug: s.slug },
    select: { id: true },
  })
  await e2eDb.organization.update({
    where: { id: orgS.id },
    data: {
      status: "SUSPENDED",
      suspendedAt: new Date(),
      suspendedReason: "E2E round 4 — suspended domain scenario",
    },
  })

  // ---- VERIFIED custom domains for both (server-side truth) ----
  const domA = `live-a-${a.slug}.example`
  const domS = `dead-s-${s.slug}.example`
  await e2eDb.customDomain.create({
    data: { domain: domA, organizationId: orgA.id, status: "VERIFIED" },
  })
  await e2eDb.customDomain.create({
    data: { domain: domS, organizationId: orgS.id, status: "VERIFIED" },
  })

  // ---- THE FINDING: every public path on the SUSPENDED tenant's own
  // verified domain is a REAL 404 — never A's (or any fallback
  // company's) content, never a soft 200. ----
  for (const path of ["/", "/services", "/shop", "/staff"]) {
    const res = await request.get(path, { headers: { host: domS }, maxRedirects: 0 })
    expect(
      res.status(),
      `${path} on a suspended org's verified domain must be a real 404`
    ).toBe(404)
    const text = await res.text()
    // THE wrong-company signal the old bug produced:
    expect(text).not.toContain(a.name)
    expect(text).not.toContain(a.slug)
    // The suspended company's site is OFF — no content either:
    expect(text).not.toContain(s.name)
  }

  // ---- Sanity: the LIVE tenant's verified domain keeps working
  // (the 404 is scoped to dead orgs, not to custom domains) ----
  const liveHome = await request.get("/", { headers: { host: domA } })
  expect(liveHome.status()).toBe(200)
  const liveText = await liveHome.text()
  expect(liveText).toContain(a.name)
  expect(liveText).not.toContain(s.name)
})

// ============================================================
// PR #103 review round 4 — Codex najdba "administrativne pravice na
// lastni domeni".
//
// The custom-domain branch removed the tenant header for
// CUSTOM_DOMAIN_HEADER_DENYLIST paths and immediately returned
// NextResponse.next() — SKIPPING the standard login/role gates that
// run later in the proxy. On any non-platform host (verified custom
// domains AND preview hosts) the auth/admin surfaces therefore bypassed
// the role matrix.
//
// Fix: denylist paths fall through to the standard gates (tenant
// context stays stripped). Proven outcomes: a STAFF employee cannot
// open /dashboard (redirected to their own surface), an ADMIN can;
// anonymous visitors are sent to /login.
// ============================================================
test("F0-S round 4 — admin paths on a custom domain run the standard role gates (STAFF out, ADMIN in)", async ({
  page,
  request,
  browser,
}) => {
  // ---- Tenant A (published) with a VERIFIED custom domain ----
  const a = makeTenant("beauty", "F0S-GATE-A")
  await registerTenant(page, a)
  await publishSite(page)
  const orgA = await e2eDb.organization.findUniqueOrThrow({
    where: { slug: a.slug },
    select: { id: true },
  })
  const domA = `gate-a-${a.slug}.example`
  await e2eDb.customDomain.create({
    data: { domain: domA, organizationId: orgA.id, status: "VERIFIED" },
  })
  const hostA = { host: domA }

  // ---- A STAFF member of org A (account arranged via DB — the creation
  // form is an RHF handleSubmit form that hangs in production builds, a
  // documented pre-existing E2E limitation, see
  // e2e/f0s-media-removed-staff.spec.ts; login + access paths under test
  // are fully real) ----
  const staffName = `Ekipa ${a.slug}`
  const staffEmail = `staff-${a.slug}@example.com`
  await e2eDb.user.create({
    data: {
      name: staffName,
      email: staffEmail,
      role: "STAFF",
      password: bcrypt.hashSync("E2e-staff-pass-1!", 4),
      emailVerified: new Date(),
      organization: { connect: { id: orgA.id } },
    },
  })

  const staffCtx = await browser.newContext()
  const staffPage = await staffCtx.newPage()
  await staffPage.goto("/login")
  await staffPage.getByLabel(/E-pošta/).first().fill(staffEmail)
  await staffPage.getByLabel(/Geslo/).first().fill("E2e-staff-pass-1!")
  await staffPage.getByRole("button", { name: /Prijava/ }).click()
  await staffPage.waitForURL(/staff-portal|dashboard/, { timeout: 30_000 })

  // ---- THE FINDING: STAFF cannot open /dashboard on the custom domain —
  // the standard proxy gate runs (redirect to their own surface), the
  // admin shell never renders ----
  const staffDash = await staffPage.request.get("/dashboard", {
    headers: hostA,
    maxRedirects: 0,
  })
  expect(staffDash.status(), "STAFF must be redirected away from /dashboard").toBe(307)
  expect(staffDash.headers()["location"]).toContain("/staff-portal")
  const staffDashText = await staffDash.text()
  expect(staffDashText).not.toContain("Dashboard")

  // STAFF is equally gated on the other admin surfaces:
  const staffAccount = await staffPage.request.get("/my-account", {
    headers: hostA,
    maxRedirects: 0,
  })
  expect(staffAccount.status(), "STAFF must be redirected away from /my-account").toBe(307)
  expect(staffAccount.headers()["location"]).toContain("/staff-portal")

  const staffPlatform = await staffPage.request.get("/platform", {
    headers: hostA,
    maxRedirects: 0,
  })
  expect(staffPlatform.status(), "STAFF must be redirected away from /platform").toBe(307)
  expect(staffPlatform.headers()["location"]).toContain("/staff-portal")
  await staffCtx.close()

  // ---- Anonymous visitor on an admin path → standard /login redirect
  // (previously the branch returned next() before the gates ran) ----
  const anonDash = await request.get("/dashboard", { headers: hostA, maxRedirects: 0 })
  expect(anonDash.status(), "anonymous must be redirected to /login").toBe(307)
  expect(anonDash.headers()["location"]).toContain("/login")

  // ---- POSITIVE: the ADMIN (owner) CAN open /dashboard on the custom
  // domain — the fix must not lock administrators out ----
  const adminDash = await page.request.get("/dashboard", { headers: hostA })
  expect(adminDash.status(), "ADMIN keeps access to /dashboard").toBe(200)
  const adminDashText = await adminDash.text()
  expect(adminDashText).not.toContain("Prijava")

  // ---- Sanity: the tenant PUBLIC surface on the same domain still
  // serves A's branding (the denylist fall-through changed nothing
  // there) ----
  const publicHome = await request.get("/", { headers: hostA })
  expect(publicHome.status()).toBe(200)
  expect(await publicHome.text()).toContain(a.name)
})
