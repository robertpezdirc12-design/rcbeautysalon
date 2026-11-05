import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/auth"
import { requireAdmin, UnauthorizedError } from "@/lib/auth/guards"
import type { Organization } from "@prisma/client"
import { DEFAULT_SALON_TIMEZONE, safeTimezone } from "@/lib/booking-time"
import { hostFromHostHeader, isPlatformHost } from "@/lib/domains/normalize"
import { getPlatformHosts } from "@/lib/domains/provider"
import { ORG_PROOF_HEADER, verifyOrgSlug } from "@/lib/tenant-proof"

export const ORG_HEADER = "x-org-slug"

export const getOrgBySlug = cache(async (slug: string) => {
  return prisma.organization.findUnique({ where: { slug } })
})

export const getOrgById = cache(async (id: string) => {
  return prisma.organization.findUnique({ where: { id } })
})

/**
 * V-1 (issue #102): the ONLY trusted source of the tenant header is the
 * proxy, which re-creates it from the verified /s/<slug> URL path and
 * SIGNS it (HMAC, x-org-slug-proof). A visitor-supplied header — forged
 * via curl, devtools or a same-origin fetch — is UNSIGNED and therefore
 * IGNORED here even on paths that bypass the proxy (API routes).
 */
export const getTrustedOrgSlug = cache(async (): Promise<string | null> => {
  const h = await headers()
  const slug = h.get(ORG_HEADER)
  if (!slug) return null
  const valid = await verifyOrgSlug(slug, h.get(ORG_PROOF_HEADER))
  return valid ? slug : null
})

/**
 * Unpublished-tenant gate for the trusted header branch (V-1/V-4 hardening):
 * a DRAFT/UNPUBLISHED tenant is visible only to its own signed-in members
 * (owner preview); everyone else gets no org (maintenance screen). This
 * mirrors the proxy gate for callers that bypass the proxy.
 */
async function headerOrgAccessible(org: Organization): Promise<boolean> {
  if (org.status !== "ACTIVE") return false
  if (org.publishState === "PUBLISHED") return true
  const session = await auth()
  return session?.user?.organizationId === org.id
}

/**
 * Custom domain resolution (EPIC #3 E3-6, PR #103 review round 2):
 * the organization served by the CURRENT request's VERIFIED custom
 * domain — null on platform hosts, unverified hosts or gated orgs.
 *
 * Server-side trusted path: the request host is looked up in the
 * CustomDomain table (status VERIFIED) — no visitor-supplied header
 * involved. Same gates as the signed header branch: ACTIVE tenant,
 * PUBLISHED site, member preview for unpublished tenants.
 */
export const getCustomDomainOrg = cache(async (): Promise<Organization | null> => {
  const requestHost = hostFromHostHeader((await headers()).get("host"))
  if (!requestHost || isPlatformHost(requestHost, getPlatformHosts())) return null
  const matched = await prisma.customDomain.findFirst({
    where: { domain: requestHost, status: "VERIFIED" },
    select: { organization: true },
  })
  if (!matched) return null
  const org = matched.organization
  if (org.status !== "ACTIVE") return null
  if (org.publishState === "PUBLISHED") return org
  // Unpublished tenant on its own domain: member preview only.
  const session = await auth()
  return session?.user?.organizationId === org.id ? org : null
})

/**
 * The organization that serves the CURRENT public page:
 * either the tenant from /s/[slug] (x-org-slug header set AND signed by
 * the proxy) or the default (first) organization for bare routes.
 */
export const getPublicOrg = cache(async (): Promise<Organization | null> => {
  const slug = await getTrustedOrgSlug()
  if (slug) {
    const org = await getOrgBySlug(slug)
    if (org) {
      if (await headerOrgAccessible(org)) return org
      // SUSPENDED tenant (EPIC #3 E3-5): its site is OFF — return null so
      // the (public) layout renders the maintenance screen. NEVER fall
      // back to another tenant's content under this URL.
      // UNPUBLISHED tenant: only its own members may preview (above) —
      // strangers get null, never another tenant's content (V-1/V-4).
      return null
    }
    // UNKNOWN slug under /s/* (EPIC #3 E3-8 isolation fix): return null —
    // the (public) layout then renders the neutral maintenance screen.
    // Falling through to the platform-root fallback here would serve the
    // DEFAULT tenant's site under someone else's URL (§16 B.5/E.8 leak).
    return null
  }

  // ---- Custom domain resolution (EPIC #3 E3-6) ----
  // On a custom hostname (a VERIFIED CustomDomain), serve that tenant.
  // The same gates as path URLs apply: ACTIVE tenant, PUBLISHED site;
  // anything else renders the maintenance screen (never another
  // tenant's content). Platform hosts skip the lookup entirely.
  const customOrg = await getCustomDomainOrg()
  if (customOrg) return customOrg

  // Platform-root fallback: only a PUBLISHED tenant may serve the bare domain
  // (a DRAFT tenant's site is private — EPIC #3 E3-1).
  return prisma.organization.findFirst({
    where: { status: "ACTIVE", publishState: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
  })
})

/** Organization of the signed-in admin/staff user (falls back to default org). */
export const getSessionOrg = cache(async (): Promise<Organization | null> => {
  const session = await auth()
  const orgId = session?.user?.organizationId
  if (orgId) {
    const org = await getOrgById(orgId)
    if (org) return org
  }
  // Legacy admin (no organizationId) manages the default organization
  if (session?.user?.role === "ADMIN") {
    return prisma.organization.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    })
  }
  return null
})

/**
 * Guard + org for admin server actions. Throws UnauthorizedError when not admin.
 * Returns the organization the admin manages.
 */
export async function requireAdminOrg(): Promise<{
  session: { user: { id: string; role: string; email?: string | null; name?: string | null } }
  org: Organization
}> {
  const session = await requireAdmin()
  const orgId = session.user.organizationId
  const org = orgId
    ? await getOrgById(orgId)
    : await prisma.organization.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      })
  if (!org) throw new UnauthorizedError("No organization found for this account")
  return { session: session as unknown as { user: { id: string; role: string; email?: string | null; name?: string | null } }, org }
}

/** Public org for server actions (booking/checkout from a tenant site). */
export async function requirePublicOrg(): Promise<Organization> {
  const org = await getPublicOrg()
  if (!org) throw new Error("No organization available")
  return org
}

/**
 * Org resolution for functions used by BOTH the public site and the dashboard:
 * 1. tenant site (/s/[slug]) — the header tenant ALWAYS wins (prevents a
 *    signed-in admin of another salon from leaking their org into a tenant page)
 * 2. admin/staff session — their own organization (dashboard context)
 * 3. custom domain (public commerce surfaces without a proxy header —
 *    the host tenant wins over the anonymous fallback, never over the
 *    guarded session branch above)
 * 4. default (first ACTIVE) organization (bare public routes)
 */
export async function getResolvedOrg(): Promise<Organization | null> {
  const slug = await getTrustedOrgSlug()
  if (slug) {
    const org = await getOrgBySlug(slug)
    if (org) {
      if (await headerOrgAccessible(org)) return org
      // SUSPENDED tenant (EPIC #3 E3-5): no org context — never leak
      // another tenant's data under this tenant's URL.
      // UNPUBLISHED tenant: members only (V-1/V-4 hardening).
      return null
    }
    // UNKNOWN slug under /s/* (EPIC #3 E3-8 isolation fix): no org —
    // never fall through to the session/default tenant under a URL
    // that names a non-existent tenant.
    return null
  }
  const session = await auth()
  if (
    session?.user &&
    (session.user.role === "ADMIN" || session.user.role === "STAFF")
  ) {
    const sessionOrg = await getSessionOrg()
    if (sessionOrg) return sessionOrg
  }
  // PR #103 review round 2 (Codex — lastne domene): booking/checkout/inquiry
  // resolve the org for PUBLIC actions; on a custom domain without a proxy
  // header (proxy-less deployments) the VERIFIED host must win over the
  // first-ACTIVE fallback — otherwise the action would target the WRONG
  // tenant. Clients (role CLIENTE) and anonymous visitors reach this branch;
  // ADMIN/STAFF returned in branch 2 above (their dashboard context).
  const customOrg = await getCustomDomainOrg()
  if (customOrg) return customOrg
  return prisma.organization.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  })
}

// --- Reserved slugs that collide with real routes ---
const RESERVED = new Set([
  "api", "dashboard", "staff-portal", "my-account", "login", "register",
  "start", "booking", "shop", "services", "staff", "cart", "checkout",
  "my-orders", "my-reviews", "forgot-password", "reset-password",
  "verify-email", "account", "about", "contact", "s", "admin", "preview",
  "sitemap.xml", "robots.txt", "favicon.ico", "manifest.json", "_next", "static", "images",
])

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug.toLowerCase())
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics (č->c, š->s, ž->z)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  if (!slug || isReservedSlug(slug)) return false
  const existing = await prisma.organization.findUnique({ where: { slug } })
  return !existing
}

/** Salon timezone of the signed-in admin/staff session (for correct time display). */
export const getSessionSalonTimezone = cache(async (): Promise<string> => {
  const org = await getSessionOrg()
  if (!org) return DEFAULT_SALON_TIMEZONE
  const config = await prisma.salonConfig.findUnique({
    where: { organizationId: org.id },
    select: { timezone: true },
  })
  return safeTimezone(config?.timezone)
})
