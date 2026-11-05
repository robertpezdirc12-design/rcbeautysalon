import { describe, expect, it } from "vitest"
import { decideMediaAccess } from "@/lib/media-access"

// ============================================================
// V-3 (issue #102 — F0-S): media ownership/publish access matrix.
// /api/media/<id> must not serve a private file on the basis of
// its ID alone; public images of public sites stay reachable.
// ============================================================

const ORG = "org-1"
const OTHER = "org-2"

describe("decideMediaAccess (V-3, issue #102)", () => {
  it("platform-owned media is public", () => {
    expect(
      decideMediaAccess({ organizationId: null })
    ).toBe("public")
    expect(
      decideMediaAccess({ organizationId: null, requesterOrganizationId: null })
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
        requesterOrganizationId: ORG,
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
        requesterOrganizationId: ORG,
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
})
