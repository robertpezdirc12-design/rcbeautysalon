// ============================================================
// PLATFORM HOSTS FROM ENV (issue #102 — F0-S V-1)
//
// Client-safe extraction of the platform host list: the PROXY
// (edge runtime) needs the same host decision as tenant.ts —
// "is this request host a custom domain candidate or the platform
// root?" — to enforce host-based tenant binding (the header must
// never override the host). provider.ts keeps the server-only
// wrapper and delegates here, so the rule can never drift between
// the proxy and the server.
// ============================================================

/**
 * The platform's own hosts (from env). Never throws: blank env simply
 * yields fewer hosts. Hostname only (no port) — matches the
 * hostFromHostHeader output shape.
 */
export function getPlatformHostsFromEnv(): string[] {
  const hosts: string[] = []
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL,
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      // hostname (not host): no port — matches hostFromHostHeader output
      const host = new URL(candidate).hostname.toLowerCase()
      if (host) hosts.push(host)
    } catch {
      // Not a URL (e.g. VERCEL_URL is a bare host) — treat as a host.
      const bare = candidate.trim().toLowerCase().replace(/:\d+$/, "")
      if (bare) hosts.push(bare)
    }
  }
  return hosts
}
