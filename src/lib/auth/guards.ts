import { auth } from "@/lib/auth/auth"
import { UserRole, type Organization } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import type { PermissionKey } from "@/lib/permissions/roles"
import { hasAllPermissions } from "@/lib/permissions/roles"
import { getEffectivePermissions } from "@/lib/permissions/effective"

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message)
    this.name = "UnauthorizedError"
  }
}

/**
 * Returns the current session or throws UnauthorizedError.
 * Use inside every mutating / admin-only server action.
 */
export async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError("You must be signed in to perform this action")
  }
  return session
}

/**
 * Returns the current session or throws if the user's role is not allowed.
 */
export async function requireRole(roles: UserRole[]) {
  const session = await requireSession()
  if (!roles.includes(session.user.role)) {
    throw new UnauthorizedError("You do not have permission to perform this action")
  }
  return session
}

/** Admin-only guard */
export function requireAdmin() {
  return requireRole(["ADMIN"])
}

/** Staff-or-admin guard */
export function requireStaffOrAdmin() {
  return requireRole(["ADMIN", "STAFF"])
}

/**
 * True if the current caller is an authenticated staff/admin user.
 * Used for employee-only pricing — MUST be derived server-side,
 * never trusted from client arguments.
 */
export async function isEmployeeSession(): Promise<boolean> {
  const session = await auth()
  if (!session?.user) return false
  return session.user.role === "STAFF" || session.user.role === "ADMIN"
}

// ============================================================
// Custom roles (EPIC #4 G8)
// ============================================================

/**
 * Action guard: throws when the current member lacks the permission.
 * Effective permissions are read FRESH from the DB — role edits apply
 * on the next request even for long-lived JWT sessions.
 */
export async function requirePermission(key: PermissionKey) {
  const session = await requireSession()
  const perms = await getEffectivePermissions(session.user.id)
  if (!perms.includes(key)) {
    throw new UnauthorizedError(
      "You do not have permission to perform this action"
    )
  }
  return session
}

/**
 * Page guard: same rule as requirePermission but REDIRECTS to the
 * dashboard instead of throwing (for server components).
 */
export async function requirePagePermission(key: PermissionKey) {
  const session = await requireSession()
  const perms = await getEffectivePermissions(session.user.id)
  if (!perms.includes(key)) {
    redirect("/dashboard")
  }
  return session
}

/**
 * Page guard for privilege-escalating administration (E4-6b): the
 * custom-roles editor. Restricted admins are redirected to the
 * dashboard — they may never administer the permission catalog.
 */
export async function requireUnrestrictedPage() {
  const session = await requireSession()
  const perms = await getEffectivePermissions(session.user.id)
  if (!hasAllPermissions(perms)) {
    redirect("/dashboard")
  }
  return session
}

// ============================================================
// Full permission matrix (E4-6b): permission + org in one gate
// ============================================================

/**
 * Resolve the organization the acting ADMIN operates on — same rule as
 * the legacy `requireAdminOrg` (session org → legacy default-org
 * fallback, never another tenant's org).
 *
 * NOTE: intentionally implemented with direct prisma calls (not imported
 * from @/lib/tenant) — tenant.ts already imports this module and a
 * reverse import would create a require cycle.
 */
async function resolveSessionOrg(session: {
  user: { organizationId?: string | null; role: string }
}): Promise<Organization | null> {
  const orgId = session.user.organizationId
  if (orgId) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (org) return org
  }
  if (session.user.role === "ADMIN") {
    return prisma.organization.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    })
  }
  return null
}

/**
 * Action guard for the full permission matrix (E4-6b): throws
 * UnauthorizedError when the caller lacks the permission OR cannot be
 * bound to an organization. Returns the same shape as `requireAdminOrg`,
 * so every migrated call site is a drop-in replacement.
 *
 * Invariants (byte-for-byte legacy behaviour for everyone without a
 * custom role):
 *  - the admin action surface stays ADMIN-only (same as requireAdminOrg;
 *    STAFF keep the staff portal, never admin actions)
 *  - ADMIN/STAFF WITHOUT a custom role hold ALL permission keys
 *  - a custom role RESTRICTS (see `effectivePermissionKeys`) — G8's
 *    "admin brez financ" is enforced here at the ACTION layer
 */
export async function requirePermissionOrg(key: PermissionKey): Promise<{
  session: { user: { id: string; role: string; email?: string | null; name?: string | null } }
  org: Organization
}> {
  const session = await requireRole(["ADMIN"])
  const perms = await getEffectivePermissions(session.user.id)
  if (!perms.includes(key)) {
    throw new UnauthorizedError(
      "You do not have permission to perform this action"
    )
  }
  const org = await resolveSessionOrg(session)
  if (!org) throw new UnauthorizedError("No organization found for this account")
  return {
    session: session as unknown as {
      user: { id: string; role: string; email?: string | null; name?: string | null }
    },
    org,
  }
}

/**
 * P3 #52: varianta requirePermissionOrg za dejavnosti, ki jih delita
 * DVA modula (kategorije pripadajo storitvam IN izdelkom) — zadostuje
 * KATERAKOLI ključ. Prej lovilnicatch-pareti v akcijah; zdaj en vir
 * resnice za "ali smem ta modul z dotično pravico".
 */
export async function requireAnyPermissionOrg(
  keys: PermissionKey[]
): Promise<{
  session: { user: { id: string; role: string; email?: string | null; name?: string | null } }
  org: Organization
}> {
  const session = await requireRole(["ADMIN"])
  const perms = await getEffectivePermissions(session.user.id)
  const allowed = keys.some((k) => perms.includes(k))
  if (!allowed) {
    throw new UnauthorizedError(
      "You do not have permission to perform this action"
    )
  }
  const org = await resolveSessionOrg(session)
  if (!org) throw new UnauthorizedError("No organization found for this account")
  return {
    session: session as unknown as {
      user: { id: string; role: string; email?: string | null; name?: string | null }
    },
    org,
  }
}

/**
 * Guard for privilege-ESCALATING administration (E4-6b): creating ADMIN
 * accounts and administering the custom-roles catalog. Only an admin
 * whose effective permission set covers ALL keys may do this — a
 * restricted admin ("admin brez financ") must never grant what they do
 * not hold.
 */
export async function requireUnrestrictedAdmin(): Promise<{
  session: { user: { id: string; role: string; email?: string | null; name?: string | null } }
  org: Organization
}> {
  const session = await requireRole(["ADMIN"])
  const perms = await getEffectivePermissions(session.user.id)
  if (!hasAllPermissions(perms)) {
    throw new UnauthorizedError(
      "Only an admin without a restricted role can perform this action"
    )
  }
  const org = await resolveSessionOrg(session)
  if (!org) throw new UnauthorizedError("No organization found for this account")
  return {
    session: session as unknown as {
      user: { id: string; role: string; email?: string | null; name?: string | null }
    },
    org,
  }
}
