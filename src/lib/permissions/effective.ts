import { prisma } from "@/lib/prisma"
import {
  effectivePermissionKeys,
  hasPermission,
  type PermissionKey,
} from "@/lib/permissions/roles"

/**
 * Server-side effective permissions for a member (G8).
 *
 * Reads the user/role FRESH from the DB on every call — JWT sessions are
 * long-lived, but permission/role changes must apply immediately (revoking
 * a role takes effect on the next request, not after re-login).
 *
 * Org-scoping (F0): when `organizationId` is provided, the role comes from
 * the user's `OrganizationMember` row IN THAT ORGANIZATION (role + custom
 * role are per-org). This closes the cross-org leak where a user who is
 * ADMIN in workspace A and STAFF in workspace B would otherwise hold the
 * same (global `User.role`-derived) permissions everywhere.
 *
 * Membership is EVIDENCE-BASED, the same rule `media-access.ts` already
 * uses: an `OrganizationMember` row is authoritative; legacy members who
 * never received one (staff created before the M1 backfill, or owners
 * whose membership was seeded only at onboarding) fall back to the global
 * `User.role` ONLY when they demonstrably belong to the org (active Staff
 * row scoped to it, or legacy `User.organizationId === organizationId`).
 * Anyone who neither holds a member row nor a scoped staff row / matching
 * legacy org gets NO permissions (fail-closed) — never a silent fallback
 * to another tenant's rights.
 *
 * When `organizationId` is omitted the legacy behaviour is preserved
 * byte-for-byte (global `User.role`) for existing call sites that do not
 * operate in an org context.
 */
export async function getEffectivePermissions(
  userId: string,
  organizationId?: string | null
): Promise<PermissionKey[]> {
  // Org-scoped path: authoritative role + custom role from the member row.
  if (organizationId) {
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      select: {
        role: true,
        customRoleId: true,
      },
    })
    if (member) {
      // OrganizationMember.customRoleId is a stored FK without a Prisma
      // relation — read the org-scoped custom role by that id (source of
      // truth for a member's effective permission set in this workspace).
      // #1318 (P0 security, FAIL-CLOSED): tri eksplicitna stanja —
      //  1) član BREZ customRoleId → obdrži osnovno politiko svoje vloge;
      //  2) član z NAVELJOVNIM customRoleId v ISTI org → zgolj ta vloga;
      //  3) član z NEVELJAVNIM customRoleId (izbrisana vloga, reference na
      //     drugo org ali okvarjena vrednost) → NI NOBENIH dovoljenj.
      // Prej je stanje 3 padlo skozi v `effectivePermissionKeys(null)` in
      // ADMIN/STAFF-u dodelilo VSA dovoljenja (FAIL-OPEN). Strogo vračam []
      // na neveljavno referenco — prehod na osnovno politiko ima SAMO član
      // brez customRoleId.
      if (member.customRoleId) {
        const customRole = await prisma.customRole.findFirst({
          where: { id: member.customRoleId, organizationId },
          select: { permissions: true },
        })
        if (!customRole) return [] // #130: izbrisana / tuja vloga → fail-closed.
        return effectivePermissionKeys({
          role: member.role as "ADMIN" | "STAFF" | "CLIENTE",
          customRolePermissions: customRole.permissions,
        })
      }
      return effectivePermissionKeys({
        role: member.role as "ADMIN" | "STAFF" | "CLIENTE",
        customRolePermissions: null,
      })
    }
    // No member row — legacy member. Verify genuine org belonging before
    // granting the global role's rights (fail-closed otherwise).
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        customRole: { select: { permissions: true, organizationId: true } },
        organizationId: true,
        staffs: { select: { organizationId: true, isActive: true } },
      },
    })
    if (!user) return []
    // F2.3.1: a user may be staff in MULTIPLE orgs → prove belonging by ANY
    // of their active Staff rows matching this organization (same semantics
    // as the previous single `staff` relation, cross-org safe).
    const belongsToOrg =
      user.organizationId === organizationId ||
      user.staffs.some(
        (s) => s.organizationId === organizationId && s.isActive
      )
    if (!belongsToOrg) return []
    // #1318 (P0): legacy fallback uporablja `User.customRole` SAMO, če vloga
    // pripada PREVERJANI organizaciji. Referenca na CustomRole iz druge org
    // ali izbrisana vloga → brez dovoljenj (fail-closed), nikoli skok na
    // polna pravicam osnovne vloge.
    if (!user.customRole || user.customRole.organizationId !== organizationId) {
      return effectivePermissionKeys({
        role: user.role,
        customRolePermissions: null,
      })
    }
    return effectivePermissionKeys({
      role: user.role,
      customRolePermissions: user.customRole.permissions,
    })
  }

  // Legacy path (no org context): unchanged behaviour.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      customRole: { select: { permissions: true } },
    },
  })
  if (!user) return []
  return effectivePermissionKeys({
    role: user.role,
    customRolePermissions: user.customRole?.permissions ?? null,
  })
}

/** Single server-side decision point for permission checks. */
export async function userHasPermission(
  userId: string,
  key: PermissionKey,
  organizationId?: string | null
): Promise<boolean> {
  return hasPermission(
    await getEffectivePermissions(userId, organizationId),
    key
  )
}
