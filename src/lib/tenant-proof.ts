// ============================================================
// TENANT HEADER PROOF (issue #102 — F0-S V-1)
//
// The proxy re-creates `x-org-slug` ONLY on the verified /s/<slug>
// URL path and signs it; server code trusts the header ONLY when
// the signature matches. A visitor-supplied (unsigned/tampered)
// header can therefore never select a tenant context — neither on
// proxied page paths (the proxy strips it first) nor on paths that
// bypass the proxy (API routes — defense in depth).
//
// Pure and client-safe: NO server-only import, NO next/headers.
// The SAME helpers run in the proxy (edge runtime, Web Crypto)
// to sign and in server components/routes (node runtime, global
// crypto.subtle since Node 18) to verify.
//
// Secret source: TENANT_PROXY_SECRET (explicit) → AUTH_SECRET
// (always present in production, NextAuth requires it) → a dev
// fallback so local sandboxes work without configuration. The
// fallback is safe to ship: the PRIMARY gate is the proxy strip —
// the signature is the second line of defense.
// ============================================================

/** Proxy-set, HMAC-signed org slug header (V-1 trusted tenant header). */
export const ORG_HEADER = "x-org-slug"
/** HMAC-SHA256 proof binding ORG_HEADER to the proxy's signature. */
export const ORG_PROOF_HEADER = "x-org-slug-proof"
/** HMAC proof header the proxy adds to its internal resolver fetches. */
export const RESOLVER_PROOF_HEADER = "x-org-resolver-proof"

/** Signature domain separators (prevent cross-domain proof reuse). */
const DOMAIN_ORG_SLUG = "org-slug"
const DOMAIN_RESOLVER = "resolver"

/**
 * Separator between the bound origin and the query payload inside a
 * resolver proof (`origin|query`). Neither part can contain a raw `|`:
 * origins are scheme://host[:port], queries are slugs / cuids /
 * validated hosts / fixed enums.
 */
const RESOLVER_PAYLOAD_SEPARATOR = "|"

/**
 * PR #103 review round 2 (Codex — resolver proof origin binding):
 * the TRUSTED origin the proxy uses for its internal resolver fetches.
 * Never derived from request data (an attacker-controlled `Host` on a
 * self-hosted deployment must not steer the proof anywhere).
 *
 * Deployment config already carries the canonical URL (NEXT_PUBLIC_APP_URL
 * / NEXTAUTH_URL — the same sources the platform-host list uses), so no
 * NEW env is introduced. Unset in production → null → callers FAIL CLOSED:
 * the resolver rejects every proof, the proxy signs/fetches nothing.
 */
export function trustedInternalOrigin(): string | null {
  const candidates = [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXTAUTH_URL]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const url = new URL(candidate)
      if (url.protocol === "http:" || url.protocol === "https:") return url.origin
    } catch {
      // Not a URL — try the next candidate.
    }
  }
  return null
}

/**
 * The origin a resolver ENDPOINT expects proofs to be bound to. Same
 * rule for every resolver route so the contract cannot drift:
 *   - configured deployment → the trusted env origin,
 *   - no config + NOT production → the request's own origin (local
 *     sandboxes without env keep working; confers no production trust),
 *   - no config + production → null → callers MUST reject every proof
 *     (fail-closed, same stance as the production secret rule).
 */
export function resolverExpectedOrigin(request: { url: string }): string | null {
  const trusted = trustedInternalOrigin()
  if (trusted) return trusted
  if (process.env.NODE_ENV === "production") return null
  try {
    return new URL(request.url).origin
  } catch {
    return null
  }
}

/**
 * Dev-only fallback secret (owner review of PR #103, round 2): the FIXED
 * value must NEVER sign or verify in production — an attacker reaching the
 * app through a path that bypasses the proxy could forge valid proofs with
 * it. Outside production (local sandboxes without AUTH_SECRET) it keeps
 * flows working; it confers no production trust.
 */
const DEV_FALLBACK_SECRET = "markec-dev-tenant-proof-do-not-use-in-production"

/**
 * Resolves the HMAC secret. Returns `null` when NOT configured in
 * production — callers must then FAIL CLOSED:
 *   - sign* returns "" (the proxy sets NO trusted header → tenant pages
 *     render the maintenance screen instead of trusting anything),
 *   - verify* returns false (EVERY proof is rejected — nothing is trusted).
 * A production deployment without a secret is already broken elsewhere
 * (NextAuth requires AUTH_SECRET), so fail-closed is the consistent,
 * safe behavior — never a guessable signature.
 */
function tenantProofSecret(explicitSecret?: string): string | null {
  if (explicitSecret) return explicitSecret
  const fromEnv = process.env.TENANT_PROXY_SECRET || process.env.AUTH_SECRET
  if (fromEnv) return fromEnv
  if (process.env.NODE_ENV === "production") return null
  return DEV_FALLBACK_SECRET
}

const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer)
  let hex = ""
  for (const byte of view) hex += byte.toString(16).padStart(2, "0")
  return hex
}

async function hmacHex(
  domain: string,
  value: string,
  explicitSecret?: string
): Promise<string> {
  const secret = tenantProofSecret(explicitSecret)
  // Fail-closed: production without a configured secret signs NOTHING.
  if (!secret) return ""
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${domain}:${value}`)
  )
  return toHex(signature)
}

/** Constant-time string comparison (works in edge + node runtimes). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Sign the org slug on behalf of the proxy (trusted header value). */
export async function signOrgSlug(slug: string, explicitSecret?: string): Promise<string> {
  return hmacHex(DOMAIN_ORG_SLUG, slug, explicitSecret)
}

/**
 * Verify an org slug header pair. True ONLY for a value the proxy
 * itself produced for THIS exact slug.
 */
export async function verifyOrgSlug(
  slug: string,
  proof: string | null | undefined,
  explicitSecret?: string
): Promise<boolean> {
  // Fail-closed: production without a configured secret trusts NOTHING —
  // even a proof signed earlier with the dev fallback is rejected.
  if (!tenantProofSecret(explicitSecret)) return false
  if (!proof) return false
  const expected = await signOrgSlug(slug, explicitSecret)
  return timingSafeEqual(expected, proof)
}

/**
 * Sign a resolver query proof BOUND TO AN ORIGIN (resolve-tenant /
 * entity-exists / resolve-host).
 *
 * PR #103 review round 2 (Codex): a proof signed for the slug alone is a
 * bearer token — in a self-hosted deployment reachable under an attacker-
 * controlled or IP `Host`, the proxy's internal fetch (built from
 * req.nextUrl.origin) would DELIVER that proof to a foreign server, which
 * could then replay it against the real app to enumerate tenants. Binding
 * the HMAC to the trusted origin makes a harvested proof unusable anywhere
 * except the deployment it was minted for.
 */
export async function signResolverQueryForOrigin(
  origin: string,
  query: string,
  explicitSecret?: string
): Promise<string> {
  return hmacHex(
    DOMAIN_RESOLVER,
    `${origin}${RESOLVER_PAYLOAD_SEPARATOR}${query}`,
    explicitSecret
  )
}

/**
 * Verify an origin-bound resolver query proof. True ONLY when the proof
 * was signed for THIS exact origin AND this exact query payload.
 */
export async function verifyResolverQueryForOrigin(
  expectedOrigin: string,
  query: string,
  proof: string | null | undefined,
  explicitSecret?: string
): Promise<boolean> {
  // Fail-closed: production without a configured secret trusts NOTHING.
  if (!tenantProofSecret(explicitSecret)) return false
  if (!proof) return false
  if (!expectedOrigin) return false
  const expected = await signResolverQueryForOrigin(expectedOrigin, query, explicitSecret)
  return timingSafeEqual(expected, proof)
}
