import { describe, expect, it, vi, afterEach } from "vitest"
import {
  ORG_PROOF_HEADER,
  ORG_HEADER,
  RESOLVER_PROOF_HEADER,
  proxyResolverOrigin,
  signOrgSlug,
  signResolverQueryForOrigin,
  trustedInternalOrigin,
  resolverExpectedOrigin,
  verifyOrgSlug,
  verifyResolverQueryForOrigin,
} from "@/lib/tenant-proof"

// ============================================================
// F0-S V-1 (issue #102) — tenant header proof primitives.
//
// The proxy signs the org slug it re-creates from the verified
// /s/<slug> URL; the app layer trusts the header ONLY with a valid
// signature bound to the exact slug. These tests pin the crypto
// contract: right slug+proof → trusted; tampered/replayed/mismatched
// → never.
//
// PR #103 review round 2 (Codex — resolver proof origin binding):
// resolver proofs are additionally bound to the TRUSTED origin — a
// proof harvested via an attacker-controlled Host (self-hosted, IP
// access) is unusable against the real app and vice versa.
// ============================================================

const SECRET = "test-only-tenant-proof-secret"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("tenant header proof (V-1, issue #102)", () => {
  it("verifies a proof the proxy produced for the SAME slug", async () => {
    const proof = await signOrgSlug("studio-nika", SECRET)
    expect(await verifyOrgSlug("studio-nika", proof, SECRET)).toBe(true)
  })

  it("rejects a proof bound to a DIFFERENT slug (header/path mismatch)", async () => {
    const proof = await signOrgSlug("studio-nika", SECRET)
    // Attacker swaps the slug but keeps the stolen/mis-bound proof:
    expect(await verifyOrgSlug("nail-studio-luna", proof, SECRET)).toBe(false)
  })

  it("rejects a missing, empty or tampered proof", async () => {
    const proof = await signOrgSlug("studio-nika", SECRET)
    expect(await verifyOrgSlug("studio-nika", null, SECRET)).toBe(false)
    expect(await verifyOrgSlug("studio-nika", undefined, SECRET)).toBe(false)
    expect(await verifyOrgSlug("studio-nika", "", SECRET)).toBe(false)
    const flipped = proof.slice(0, -2) + (proof.endsWith("0a") ? "0b" : "0a")
    expect(await verifyOrgSlug("studio-nika", flipped, SECRET)).toBe(false)
    expect(await verifyOrgSlug("studio-nika", proof.slice(1), SECRET)).toBe(false)
  })

  it("rejects a proof signed with a DIFFERENT secret", async () => {
    const proof = await signOrgSlug("studio-nika", "attacker-secret")
    expect(await verifyOrgSlug("studio-nika", proof, SECRET)).toBe(false)
  })

  it("produces distinct proofs per slug (no cross-slug replay)", async () => {
    const p1 = await signOrgSlug("studio-nika", SECRET)
    const p2 = await signOrgSlug("nail-studio-luna", SECRET)
    expect(p1).not.toBe(p2)
    expect(await verifyOrgSlug("nail-studio-luna", p1, SECRET)).toBe(false)
    expect(await verifyOrgSlug("studio-nika", p2, SECRET)).toBe(false)
  })

  it("resolver query proofs are domain-separated from org slug proofs", async () => {
    const slugProof = await signOrgSlug("studio-nika", SECRET)
    const queryProof = await signResolverQueryForOrigin(
      "https://markec.example",
      "slug=studio-nika",
      SECRET
    )
    expect(slugProof).not.toBe(queryProof)
    // A stolen org-slug proof must not authorize resolver queries:
    expect(
      await verifyResolverQueryForOrigin("https://markec.example", "slug=studio-nika", slugProof, SECRET)
    ).toBe(false)
    expect(await verifyOrgSlug("studio-nika", queryProof, SECRET)).toBe(false)
  })

  it("resolver query proof binds the FULL payload (orgId:type:slug)", async () => {
    const ORIGIN = "https://markec.example"
    const proof = await signResolverQueryForOrigin(ORIGIN, "org1:service:massage", SECRET)
    expect(await verifyResolverQueryForOrigin(ORIGIN, "org1:service:massage", proof, SECRET)).toBe(true)
    expect(await verifyResolverQueryForOrigin(ORIGIN, "org2:service:massage", proof, SECRET)).toBe(false)
    expect(await verifyResolverQueryForOrigin(ORIGIN, "org1:product:massage", proof, SECRET)).toBe(false)
    expect(await verifyResolverQueryForOrigin(ORIGIN, "org1:service:massage:extra", proof, SECRET)).toBe(false)
  })

  it("header names are stable (proxy and server must agree)", () => {
    expect(ORG_HEADER).toBe("x-org-slug")
    expect(ORG_PROOF_HEADER).toBe("x-org-slug-proof")
    expect(RESOLVER_PROOF_HEADER).toBe("x-org-resolver-proof")
  })

  it("falls back to env secret when no explicit secret is passed", async () => {
    const proof = await signOrgSlug("studio-nika")
    // The env-less fallback secret is deterministic — self-consistent:
    expect(await verifyOrgSlug("studio-nika", proof)).toBe(true)
    // ...but distinct from an explicit secret:
    expect(await verifyOrgSlug("studio-nika", proof, SECRET)).toBe(false)
  })

  // --- PR #103 review round 2: fail-closed production ---
  it("NEVER signs with the known dev fallback in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("TENANT_PROXY_SECRET", "")
    vi.stubEnv("AUTH_SECRET", "")
    // No secret configured in production → nothing is signed:
    expect(await signOrgSlug("studio-nika")).toBe("")
    expect(await signResolverQueryForOrigin("https://markec.example", "slug=studio-nika")).toBe("")
    // ...and EVERY proof is rejected (fail-closed verification):
    expect(await verifyOrgSlug("studio-nika", "0".repeat(64))).toBe(false)
    expect(await verifyResolverQueryForOrigin("https://markec.example", "slug=studio-nika", "f".repeat(64))).toBe(false)
  })

  it("rejects a dev-fallback proof inside production (no replay across envs)", async () => {
    // Proof produced OUTSIDE production with the dev fallback:
    const devProof = await signOrgSlug("studio-nika")
    expect(devProof).not.toBe("")
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("TENANT_PROXY_SECRET", "")
    vi.stubEnv("AUTH_SECRET", "")
    expect(await verifyOrgSlug("studio-nika", devProof)).toBe(false)
  })

  it("production WITH a configured secret keeps working", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("TENANT_PROXY_SECRET", "real-prod-secret")
    const proof = await signOrgSlug("studio-nika")
    expect(proof).not.toBe("")
    expect(await verifyOrgSlug("studio-nika", proof)).toBe(true)
    expect(await verifyOrgSlug("studio-nika", proof, "other-secret")).toBe(false)
  })

  it("AUTH_SECRET alone is a valid production secret", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("TENANT_PROXY_SECRET", "")
    vi.stubEnv("AUTH_SECRET", "nextauth-prod-secret")
    const proof = await signOrgSlug("studio-nika")
    expect(proof).not.toBe("")
    expect(await verifyOrgSlug("studio-nika", proof)).toBe(true)
  })
})

// ------------------------------------------------------------
// PR #103 review round 2 (Codex — dokaz resolverja vezan na izvor)
// ------------------------------------------------------------

describe("trusted internal origin (resolver proof origin binding)", () => {
  const APP = "https://markec.example"
  const ATTACKER = "http://attacker.example"

  it("resolver proof binds the ORIGIN — same origin verifies, others never", async () => {
    const proof = await signResolverQueryForOrigin(APP, "slug=studio-nika", SECRET)
    expect(await verifyResolverQueryForOrigin(APP, "slug=studio-nika", proof, SECRET)).toBe(true)
    // Harvested via an attacker-controlled Host (self-hosted/IP) →
    // replay against the real app is useless:
    expect(await verifyResolverQueryForOrigin("https://real-app.example", "slug=studio-nika", proof, SECRET)).toBe(false)
    expect(await verifyResolverQueryForOrigin(ATTACKER, "slug=studio-nika", proof, SECRET)).toBe(false)
  })

  it("proof minted for the ATTACKER origin is rejected by the real app", async () => {
    const stolen = await signResolverQueryForOrigin(ATTACKER, "slug=studio-nika", SECRET)
    expect(await verifyResolverQueryForOrigin(APP, "slug=studio-nika", stolen, SECRET)).toBe(false)
  })

  it("scheme/host/port are part of the binding (no lax comparison)", async () => {
    const proof = await signResolverQueryForOrigin("http://localhost:3000", "host=salon.example", SECRET)
    expect(await verifyResolverQueryForOrigin("https://localhost:3000", "host=salon.example", proof, SECRET)).toBe(false)
    expect(await verifyResolverQueryForOrigin("http://localhost:3001", "host=salon.example", proof, SECRET)).toBe(false)
    expect(await verifyResolverQueryForOrigin("http://localhost", "host=salon.example", proof, SECRET)).toBe(false)
    expect(await verifyResolverQueryForOrigin("http://localhost:3000", "host=salon.example", proof, SECRET)).toBe(true)
  })

  it("trustedInternalOrigin reads NEXT_PUBLIC_APP_URL first (normalized origin)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", `${APP}/with/path/`)
    vi.stubEnv("NEXTAUTH_URL", ATTACKER)
    expect(trustedInternalOrigin()).toBe(APP)
  })

  it("trustedInternalOrigin falls back to NEXTAUTH_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    vi.stubEnv("NEXTAUTH_URL", APP)
    expect(trustedInternalOrigin()).toBe(APP)
  })

  it("trustedInternalOrigin skips invalid values", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "not-a-url")
    vi.stubEnv("NEXTAUTH_URL", "")
    expect(trustedInternalOrigin()).toBe(null)
  })

  it("trustedInternalOrigin is null without any env", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    vi.stubEnv("NEXTAUTH_URL", "")
    expect(trustedInternalOrigin()).toBe(null)
  })

  it("resolverExpectedOrigin: configured deployment ALWAYS uses the env origin (never request data)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP)
    // Even a request arriving under the attacker's Host is verified
    // against the DEPLOYMENT origin — the request never contributes it:
    expect(resolverExpectedOrigin({ url: ATTACKER + "/api/public/resolve-tenant" })).toBe(APP)
  })

  it("resolverExpectedOrigin: dev without env falls back to the request origin", () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    vi.stubEnv("NEXTAUTH_URL", "")
    expect(resolverExpectedOrigin({ url: "http://localhost:3000/api/public/resolve-tenant?slug=x" })).toBe(
      "http://localhost:3000"
    )
  })

  it("resolverExpectedOrigin: production WITHOUT env is null → callers fail closed", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    vi.stubEnv("NEXTAUTH_URL", "")
    expect(resolverExpectedOrigin({ url: "https://markec.example/api/public/resolve-tenant" })).toBe(null)
    // A null expected origin must reject every proof:
    expect(await verifyResolverQueryForOrigin(null as unknown as string, "slug=x", "a".repeat(64))).toBe(false)
  })
})

// ------------------------------------------------------------
// PR #103 review round 4 (owner): the PROXY must never deliver the
// signed resolver proof to an address derived from the incoming
// request — production without a trusted env origin performs NO
// internal fetch at all; the request-derived fallback exists ONLY
// outside production (local sandboxes).
// ------------------------------------------------------------

describe("proxyResolverOrigin (round 4 — no fetch to request-derived origins in production)", () => {
  const APP = "https://markec.example"
  const ATTACKER = "http://attacker.example"

  it("configured deployment ALWAYS fetches the env origin (never request data)", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP)
    vi.stubEnv("NEXTAUTH_URL", "")
    // Even a request arriving under an attacker-controlled Host —
    // the fetch target is the DEPLOYMENT origin, nothing else:
    expect(proxyResolverOrigin({ nextUrl: new URL(ATTACKER + "/s/salon") })).toBe(APP)
  })

  it("production WITHOUT a trusted env origin → null (NO internal fetch, no proof delivery)", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    vi.stubEnv("NEXTAUTH_URL", "")
    // The old fallback (req.nextUrl.origin) would have delivered the
    // signed proof to the request-derived address — forbidden now:
    expect(proxyResolverOrigin({ nextUrl: new URL(ATTACKER + "/s/salon") })).toBe(null)
  })

  it("outside production the dev fallback keeps local sandboxes working", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    vi.stubEnv("NEXTAUTH_URL", "")
    expect(proxyResolverOrigin({ nextUrl: new URL("http://localhost:3000/s/salon") })).toBe(
      "http://localhost:3000"
    )
    vi.stubEnv("NODE_ENV", "test")
    expect(proxyResolverOrigin({ nextUrl: new URL("http://localhost:3000/s/salon") })).toBe(
      "http://localhost:3000"
    )
  })

  it("NEXTAUTH_URL alone is a valid trusted origin in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    vi.stubEnv("NEXTAUTH_URL", APP)
    expect(proxyResolverOrigin({ nextUrl: new URL(ATTACKER + "/s/salon") })).toBe(APP)
  })
})

// ============================================================
// PR #103 review round 5 (Codex P2 — "Require HTTPS for production
// resolver origins"): in production a non-loopback `http://` app URL
// would send resolver HMAC proofs in cleartext; an on-path observer
// could capture a proof for a chosen slug and replay it. Production
// accepts https:// always and http:// ONLY on loopback hosts (local
// production-mode verification). Non-production: unchanged.
// ============================================================
describe("trustedInternalOrigin — production rejects non-loopback HTTP (round 5)", () => {
  const stub = (appUrl: string, authUrl: string) => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", appUrl)
    vi.stubEnv("NEXTAUTH_URL", authUrl)
  }

  it("rejects a non-loopback http:// app URL in production (fail-closed)", () => {
    stub("http://markec.example", "")
    expect(trustedInternalOrigin()).toBe(null)
  })

  it("rejects a public IP http:// origin in production", () => {
    stub("http://10.0.0.5:3100", "")
    expect(trustedInternalOrigin()).toBe(null)
  })

  it("rejects a non-loopback http:// NEXTAUTH_URL in production", () => {
    stub("", "http://app.lan:3100")
    expect(trustedInternalOrigin()).toBe(null)
  })

  it("accepts https:// in production (the real deployment shape)", () => {
    stub("https://markec.example", "")
    expect(trustedInternalOrigin()).toBe("https://markec.example")
  })

  it("keeps local production-mode verification working (loopback http)", () => {
    stub("http://localhost:3100", "")
    expect(trustedInternalOrigin()).toBe("http://localhost:3100")
    stub("http://127.0.0.1:3100", "")
    expect(trustedInternalOrigin()).toBe("http://127.0.0.1:3100")
    stub("http://[::1]:3100", "")
    expect(trustedInternalOrigin()).toBe("http://[::1]:3100")
  })

  it("falls back to the NEXT candidate when the first is rejected", () => {
    // NEXT_PUBLIC_APP_URL misconfigured cleartext on a LAN host, but
    // NEXTAUTH_URL is https — the trusted origin survives.
    stub("http://app.lan:3100", "https://markec.example")
    expect(trustedInternalOrigin()).toBe("https://markec.example")
  })

  it("outside production http:// stays accepted (sandbox flexibility)", () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://any-host.example:3100")
    vi.stubEnv("NEXTAUTH_URL", "")
    expect(trustedInternalOrigin()).toBe("http://any-host.example:3100")
  })

  it("downstream fail-closed mirrors the gate (proxy + resolver in production)", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://markec.example")
    vi.stubEnv("NEXTAUTH_URL", "")
    expect(resolverExpectedOrigin({ url: "https://markec.example/x" })).toBe(null)
    expect(proxyResolverOrigin({ nextUrl: new URL("https://markec.example/s/salon") })).toBe(
      null
    )
  })
})
