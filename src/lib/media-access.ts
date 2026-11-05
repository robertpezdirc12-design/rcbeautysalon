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
// ============================================================

export interface MediaAccessContext {
  /** Owner org of the media row (null = platform-owned media). */
  organizationId: string | null
  /** Owning org's status: "ACTIVE" | "SUSPENDED" | null. */
  orgStatus?: string | null
  /** Owning org's publish state: "PUBLISHED" | "DRAFT" | … | null. */
  orgPublishState?: string | null
  /** Signed-in requester's organizationId (null = anonymous). */
  requesterOrganizationId?: string | null
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
  // Draft/suspended tenant media: the tenant's own members only
  // (owner preview must keep working with the signed-in session).
  if (
    ctx.requesterOrganizationId &&
    ctx.requesterOrganizationId === ctx.organizationId
  ) {
    return "owner"
  }
  return "denied"
}
