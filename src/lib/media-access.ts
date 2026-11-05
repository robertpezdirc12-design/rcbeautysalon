// ============================================================
// MEDIA ACCESS DECISION (issue #102 — F0-S V-3)
//
// /api/media/<id> must never hand out a PRIVATE file on the basis
// of its ID alone. Public images of PUBLIC sites stay reachable
// (published tenant sites, platform media); media of tenants that
// are not live (DRAFT / SUSPENDED) is visible only to that
// tenant's own members and the platform operator.
//
// Pure decision point (same pattern as analyticsScriptIdFor): the
// route wires the request context in, tests pin the matrix.
//
// PR #103 review round 2 (Codex — odstranjeni zaposleni): matching
// organizationId ALONE is NOT membership. deleteStaffMember()
// demotes the user's role to CLIENTE while KEEPING their
// organizationId — a removed employee could still read the
// tenant's DRAFT/SUSPENDED media. The owner decision now requires
// ROLE EVIDENCE:
//   - ADMIN (the tenant's owner) — role alone suffices, or
//   - STAFF with an ACTIVE staff row in the owning organization
//     (a deactivated-but-not-yet-demoted account is equally out).
// ============================================================

/** Roles that may hold tenant membership for media access. */
const MEMBER_ROLES = new Set(["ADMIN", "STAFF"])

export interface MediaAccessContext {
  /** Owner org of the media row (null = platform-owned media). */
  organizationId: string | null
  /** Owning org's status: "ACTIVE" | "SUSPENDED" | null. */
  orgStatus?: string | null
  /** Owning org's publish state: "PUBLISHED" | "DRAFT" | … | null. */
  orgPublishState?: string | null
  /** Signed-in requester's organizationId (null = anonymous). */
  requesterOrganizationId?: string | null
  /** Signed-in requester's role ("ADMIN" | "STAFF" | "CLIENTE" | …). */
  requesterRole?: string | null
  /**
   * Requester has an ACTIVE staff row in the OWNING organization
   * (computed by the route for role STAFF; ADMIN needs no row).
   */
  requesterIsOrgStaffActive?: boolean
  /** Signed-in requester is a platform operator (env allowlist). */
  requesterIsPlatformAdmin?: boolean
}

export type MediaAccessDecision = "public" | "owner" | "denied"

export function decideMediaAccess(ctx: MediaAccessContext): MediaAccessDecision {
  // Platform-owned media (site defaults, seed assets) is public.
  if (!ctx.organizationId) return "public"
  // Images of a LIVE public site are public — the published site
  // references them from public HTML (hero, gallery, products).
  if (ctx.orgStatus === "ACTIVE" && ctx.orgPublishState === "PUBLISHED") {
    return "public"
  }
  // Operator console may inspect any tenant's media.
  if (ctx.requesterIsPlatformAdmin) return "owner"
  // Draft/suspended tenant media: ACTIVE members only. Both pieces of
  // evidence must hold — organizationId match AND an authorized role
  // (STAFF additionally requires an active staff row). A demoted
  // (removed) employee keeps their organizationId but holds CLIENTE —
  // no membership, no access.
  const isMember =
    !!ctx.requesterOrganizationId &&
    ctx.requesterOrganizationId === ctx.organizationId &&
    MEMBER_ROLES.has(ctx.requesterRole ?? "") &&
    (ctx.requesterRole === "ADMIN" || ctx.requesterIsOrgStaffActive === true)
  if (isMember) return "owner"
  return "denied"
}
