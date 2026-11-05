import { describe, expect, it } from "vitest"
import { decideMediaAccess } from "@/lib/media-access"

// ============================================================
// V-3 (issue #102 — F0-S): media ownership/publish access matrix.
// /api/media/<id> must not serve a private file on the basis of
// its ID alone; public images of public sites stay reachable.
//
// PR #103 review round 2 (Codex — odstranjeni zaposleni):
// organizationId alone is NOT membership. Owner access requires
// ROLE EVIDENCE — an ADMIN, or a STAFF with an ACTIVE staff row.
// A removed employee (role demoted to CLIENTE, organizationId
// kept) and a deactivated staff account must be denied.
// ============================================================

const ORG = "org-1"
const OTHER = "org-2"

/** A signed-in member of ORG (the route wires role + staff evidence in). */
const MEMBER = {
  requesterOrganizationId: ORG,
  requesterRole: "STAFF",
  requesterIsOrgStaffActive: true,
} as const

describe("decideMediaAccess (V-3, issue #102)", () => {
  it("platform-owned media is public", () => {
    expect(
      decideMediaAccess({ organizationId: null })
    ).toBe("public")
    expect(
      decideMediaAccess({ organizationId: null, ...MEMBER })
    ).toBe("public")
  })

  it("media of an ACTIVE + PUBLISHED tenant is public to anonymous visitors", () => {
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: "ACTIVE",
        orgPublishState: "PUBLISHED",
        requesterOrganizationId: null,
      })
    ).toBe("public")
  })

  it("media of a DRAFT tenant is denied to anonymous and foreign users", () => {
    for (const requester of [null, OTHER]) {
      expect(
        decideMediaAccess({
          organizationId: ORG,
          orgStatus: "ACTIVE",
          orgPublishState: "DRAFT",
          requesterOrganizationId: requester,
        })
      ).toBe("denied")
    }
  })

  it("media of a DRAFT tenant is owner-only for its own members", () => {
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: "ACTIVE",
        orgPublishState: "DRAFT",
        ...MEMBER,
      })
    ).toBe("owner")
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: "ACTIVE",
        orgPublishState: "DRAFT",
        requesterOrganizationId: ORG,
        requesterRole: "ADMIN",
      })
    ).toBe("owner")
  })

  it("media of a SUSPENDED tenant is denied to strangers, owner keeps access", () => {
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: "SUSPENDED",
        orgPublishState: "PUBLISHED",
        requesterOrganizationId: null,
      })
    ).toBe("denied")
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: "SUSPENDED",
        orgPublishState: "PUBLISHED",
        ...MEMBER,
      })
    ).toBe("owner")
  })

  it("the platform operator may inspect any tenant's media", () => {
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: "SUSPENDED",
        orgPublishState: "DRAFT",
        requesterOrganizationId: OTHER,
        requesterIsPlatformAdmin: true,
      })
    ).toBe("owner")
  })

  it("unknown org status never widens access (fail-closed)", () => {
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: null,
        orgPublishState: null,
        requesterOrganizationId: null,
      })
    ).toBe("denied")
  })

  // --- PR #103 review round 2: removed employees lose private media ---

  it("a REMOVED employee (role CLIENTE, organizationId kept) is denied DRAFT media", () => {
    // deleteStaffMember() demotes the role but keeps organizationId:
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: "ACTIVE",
        orgPublishState: "DRAFT",
        requesterOrganizationId: ORG,
        requesterRole: "CLIENTE",
        requesterIsOrgStaffActive: false,
      })
    ).toBe("denied")
  })

  it("a removed employee is denied SUSPENDED-tenant media too", () => {
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: "SUSPENDED",
        orgPublishState: "PUBLISHED",
        requesterOrganizationId: ORG,
        requesterRole: "CLIENTE",
      })
    ).toBe("denied")
  })

  it("a deactivated (not yet demoted) STAFF account is denied", () => {
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: "ACTIVE",
        orgPublishState: "DRAFT",
        requesterOrganizationId: ORG,
        requesterRole: "STAFF",
        requesterIsOrgStaffActive: false,
      })
    ).toBe("denied")
  })

  it("role evidence is mandatory — an orgId match without a role is denied", () => {
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: "ACTIVE",
        orgPublishState: "DRAFT",
        requesterOrganizationId: ORG,
      })
    ).toBe("denied")
  })

  it("CLIENTE role can never unlock owner access, even with a staff flag", () => {
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: "ACTIVE",
        orgPublishState: "DRAFT",
        requesterOrganizationId: ORG,
        requesterRole: "CLIENTE",
        requesterIsOrgStaffActive: true,
      })
    ).toBe("denied")
  })

  it("a STAFF member of a DIFFERENT org is denied (staff row must be in the OWNING org)", () => {
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: "ACTIVE",
        orgPublishState: "DRAFT",
        requesterOrganizationId: OTHER,
        requesterRole: "STAFF",
        requesterIsOrgStaffActive: true,
      })
    ).toBe("denied")
  })

  it("an ADMIN of a foreign org is denied (orgId match still required)", () => {
    expect(
      decideMediaAccess({
        organizationId: ORG,
        orgStatus: "ACTIVE",
        orgPublishState: "DRAFT",
        requesterOrganizationId: OTHER,
        requesterRole: "ADMIN",
      })
    ).toBe("denied")
  })
})
