import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { makeTenant, publishSite, registerTenant } from "./helpers"

// ============================================================
// F0-S — Codex finding "dokaz resolverja vezan na zaupanja vreden
// izvor" (PR #103 review round 2, security)
//
// The proxy's internal resolver fetch used req.nextUrl.origin as the
// target and the proof was signed for the QUERY alone. On a self-hosted
// deployment reachable under an attacker-controlled or IP `Host`, the
// signed proof was DELIVERED to a foreign server, which could then
// replay it against the real app (tenant/orgId enumeration, V-4).
//
// Fix: proofs are HMAC-bound to the TRUSTED deployment origin
// (NEXT_PUBLIC_APP_URL / NEXTAUTH_URL — never request data), the proxy
// fetches the trusted origin, and every resolver endpoint verifies the
// bound origin. A proof minted for ANY other origin must be rejected —
// harvested proofs become unusable.
//
// This spec pins the endpoint contract from OUTSIDE the process:
// positive (deployment-bound proof → 200) and negative (attacker-bound,
// tampered, missing → 401 without leaking anything).
// ============================================================

const e2eDb = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "" } },
})

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3123"
/** Must match AUTH_SECRET in playwright.config.ts (webServer.env). */
const E2E_AUTH_SECRET = "e2e-only-secret-not-used-in-production"
/** The deployment's trusted origin = normalized NEXT_PUBLIC_APP_URL. */
const TRUSTED_ORIGIN = BASE_URL
const ATTACKER_ORIGIN = "http://attacker.example"

/** Same HMAC contract as src/lib/tenant-proof.ts (domain "resolver", `origin|query`). */
async function resolverProof(origin: string, query: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(E2E_AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`resolver:${origin}|${query}`)
  )
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

test.afterAll(async () => {
  await e2eDb.$disconnect()
})

test("F0-S resolver proof origin binding — deployment-bound proof works, harvested proofs never", async ({
  page,
  request,
}) => {
  // ---- A published tenant gives the positive path something to return ----
  const a = makeTenant("beauty", "F0S-ORIG-A")
  await registerTenant(page, a)
  await publishSite(page)
  const orgA = await e2eDb.organization.findUniqueOrThrow({
    where: { slug: a.slug },
    select: { id: true },
  })
  const svc = await e2eDb.service.findFirst({
    where: { organizationId: orgA.id, isActive: true },
    select: { slug: true },
  })
  expect(svc).toBeTruthy()

  // ---- POSITIVE: proof bound to the TRUSTED deployment origin → 200 ----
  const okRes = await request.get(`/api/public/resolve-tenant?slug=${encodeURIComponent(a.slug)}`, {
    headers: {
      "x-org-resolver-proof": await resolverProof(TRUSTED_ORIGIN, `slug=${a.slug}`),
    },
  })
  expect(okRes.status()).toBe(200)
  const okBody = await okRes.json()
  expect(okBody.exists).toBe(true)
  expect(okBody.orgId).toBe(orgA.id)

  // ---- NEGATIVE (THE FINDING): the SAME query signed for the ATTACKER
  // origin is worthless against the real app — replay of a proof
  // harvested via an attacker-controlled Host is rejected 401. ----
  const harvested = await resolverProof(ATTACKER_ORIGIN, `slug=${a.slug}`)
  const replay = await request.get(`/api/public/resolve-tenant?slug=${encodeURIComponent(a.slug)}`, {
    headers: { "x-org-resolver-proof": harvested },
  })
  expect(replay.status()).toBe(401)
  const replayText = await replay.text()
  expect(replayText).not.toContain("orgId")
  expect(replayText).not.toContain("exists")

  // ---- NEGATIVE: proof bound to the right origin but a DIFFERENT query
  // (payload binding) — swapping the slug keeps the 401 ----
  const wrongPayload = await resolverProof(TRUSTED_ORIGIN, "slug=some-other-tenant")
  const wrongRes = await request.get(`/api/public/resolve-tenant?slug=${encodeURIComponent(a.slug)}`, {
    headers: { "x-org-resolver-proof": wrongPayload },
  })
  expect(wrongRes.status()).toBe(401)

  // ---- NEGATIVE: missing proof (direct visitor call, V-4) → 401 ----
  const direct = await request.get(`/api/public/resolve-tenant?slug=${encodeURIComponent(a.slug)}`)
  expect(direct.status()).toBe(401)

  // ---- entity-exists: same contract ----
  const entityQuery = `${orgA.id}:service:${svc!.slug}`
  const okEntity = await request.get(
    `/api/public/entity-exists?orgId=${encodeURIComponent(orgA.id)}&type=service&slug=${encodeURIComponent(svc!.slug)}`,
    {
      headers: {
        "x-org-resolver-proof": await resolverProof(TRUSTED_ORIGIN, entityQuery),
      },
    }
  )
  expect(okEntity.status()).toBe(200)
  expect((await okEntity.json()).exists).toBe(true)

  const harvestedEntity = await resolverProof(ATTACKER_ORIGIN, entityQuery)
  const replayEntity = await request.get(
    `/api/public/entity-exists?orgId=${encodeURIComponent(orgA.id)}&type=service&slug=${encodeURIComponent(svc!.slug)}`,
    { headers: { "x-org-resolver-proof": harvestedEntity } }
  )
  expect(replayEntity.status()).toBe(401)
  expect(await replayEntity.text()).not.toContain("exists")

  // ---- resolve-host: same contract (400 invalid host / 401 without a
  // deployment-bound proof / matched:false for an unknown verified-proof
  // host) ----
  const badHost = await request.get("/api/public/resolve-host?host=localhost", {
    headers: {
      "x-org-resolver-proof": await resolverProof(TRUSTED_ORIGIN, "host=localhost"),
    },
  })
  expect(badHost.status()).toBe(400)

  const noProofHost = await request.get(
    `/api/public/resolve-host?host=${encodeURIComponent("some-salon.example")}`
  )
  expect(noProofHost.status()).toBe(401)

  const harvestedHost = await resolverProof(ATTACKER_ORIGIN, "host=some-salon.example")
  const replayHost = await request.get(
    `/api/public/resolve-host?host=${encodeURIComponent("some-salon.example")}`,
    { headers: { "x-org-resolver-proof": harvestedHost } }
  )
  expect(replayHost.status()).toBe(401)

  const okHost = await request.get(
    `/api/public/resolve-host?host=${encodeURIComponent("some-salon.example")}`,
    {
      headers: {
        "x-org-resolver-proof": await resolverProof(TRUSTED_ORIGIN, "host=some-salon.example"),
      },
    }
  )
  expect(okHost.status()).toBe(200)
  expect((await okHost.json()).matched).toBe(false)
})
