import { describe, expect, it, vi, afterEach } from "vitest"
import {
  ORG_PROOF_HEADER,
  ORG_HEADER,
  RESOLVER_PROOF_HEADER,
  signOrgSlug,
  signResolverQuery,
  verifyOrgSlug,
  verifyResolverQuery,
} from "@/lib/tenant-proof"

// ============================================================
// F0-S V-1 (issue #102) — tenant header proof primitives.
//
// The proxy signs the org slug it re-creates from the verified
// /s/<slug> URL; the app layer trusts the header ONLY with a valid
// signature bound to the exact slug. These tests pin the crypto
// contract: right slug+proof → trusted; tampered/replayed/mismatched
// → never.
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
    const queryProof = await signResolverQuery("studio-nika", SECRET)
    expect(slugProof).not.toBe(queryProof)
    // A stolen org-slug proof must not authorize resolver queries:
    expect(await verifyResolverQuery("studio-nika", slugProof, SECRET)).toBe(false)
    expect(await verifyOrgSlug("studio-nika", queryProof, SECRET)).toBe(false)
  })

  it("resolver query proof binds the FULL payload (orgId:type:slug)", async () => {
    const proof = await signResolverQuery("org1:service:massage", SECRET)
    expect(await verifyResolverQuery("org1:service:massage", proof, SECRET)).toBe(true)
    expect(await verifyResolverQuery("org2:service:massage", proof, SECRET)).toBe(false)
    expect(await verifyResolverQuery("org1:product:massage", proof, SECRET)).toBe(false)
    expect(await verifyResolverQuery("org1:service:massage:extra", proof, SECRET)).toBe(false)
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
    expect(await signResolverQuery("studio-nika")).toBe("")
    // ...and EVERY proof is rejected (fail-closed verification):
    expect(await verifyOrgSlug("studio-nika", "0".repeat(64))).toBe(false)
    expect(await verifyResolverQuery("studio-nika", "f".repeat(64))).toBe(false)
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
