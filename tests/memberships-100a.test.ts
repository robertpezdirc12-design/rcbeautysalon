// ============================================================
// #100 8.A (M1–M3) — ČLANSTVA: več dejavnosti v enem računu
// Čista jedra (normalizacija aktivnega org), shema, vrata (dvojno
// branje v guards/tenant), preklop (akcija), onboarding (dodatno
// podjetje), backfill skript (idempotentno, brez brisanja).
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  normalizeActiveMembership,
  type MembershipRef,
} from "../src/lib/auth/memberships"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

const m = (
  organizationId: string,
  role: string,
  isDefault = false
): MembershipRef => ({ organizationId, role, isDefault })

describe("#100 8.A normalizacija aktivnega podjetja (čisto jedro)", () => {
  const orgs = [m("org_b", "ADMIN", true), m("org_a", "ADMIN")]

  it("trenutni org iz seje ostane, če je med članstvi", () => {
    expect(normalizeActiveMembership(orgs, "org_a")?.organizationId).toBe("org_a")
    expect(normalizeActiveMembership(orgs, "org_b")?.organizationId).toBe("org_b")
  })

  it("tuj/stari org iz seje → privzeto članstvo (zaščita proti starim JWT)", () => {
    expect(normalizeActiveMembership(orgs, "org_tuj")?.organizationId).toBe("org_b")
    expect(normalizeActiveMembership(orgs, null)?.organizationId).toBe("org_b")
  })

  it("brez isDefault → prvo članstvo; prazen seznam → null (legacy pot)", () => {
    expect(normalizeActiveMembership([m("org_a", "ADMIN")], null)?.organizationId).toBe("org_a")
    expect(normalizeActiveMembership([], "org_a")).toBeNull()
  })
})

describe("#100 8.A shema + vrata (M1/M2)", () => {
  it("OrganizationMember: vloga per org, unique par, index na userId", () => {
    const schema = read("prisma/schema.prisma")
    const block = schema.slice(
      schema.indexOf("model OrganizationMember"),
      schema.indexOf("}", schema.indexOf("model OrganizationMember"))
    )
    expect(block).toContain("role           String")
    expect(block).toContain("@@unique([organizationId, userId])")
    expect(block).toContain("@@index([userId])")
  })

  it("guards + tenant: dvojno branje (članstva imajo prednost, legacy ostane)", () => {
    const guards = read("src/lib/auth/guards.ts")
    expect(guards).toContain("resolveActiveOrganizationId(")
    expect(guards).toContain("if (session.user.id)")
    const tenant = read("src/lib/tenant.ts")
    expect(tenant).toContain("resolveActiveOrganizationId(")
  })

  it("preklop: članstvo obvezno, legacy kazalec + seja usklajena", () => {
    const action = read("src/app/actions/organization-switch.ts")
    expect(action).toContain("getMembershipsForUser(session.user.id)")
    expect(action).toContain("organizationId: organizationId")
    expect(action).toContain('revalidatePath("/", "layout")')
  })

  it("onboarding: dodatno podjetje istega računa je dovoljeno (članstvo, brez staff vrstice)", () => {
    const onboarding = read("src/app/actions/onboarding.ts")
    expect(onboarding).toContain("additionalOrg = Boolean(me.organizationId)")
    expect(onboarding).toContain("role: \"ADMIN\",")
    expect(onboarding).toContain("isDefault: !additionalOrg,")
    expect(onboarding).toContain("staffEnabled && !additionalOrg")
  })

  it("backfill: idempotenten, samo createMany skipDuplicates (nič ne briše)", () => {
    const script = read("scripts/backfill-organization-members.ts")
    expect(script).toContain("skipDuplicates: true")
    expect(script).not.toContain("deleteMany")
    expect(script).not.toContain(".delete(")
  })

  it("sidebar: preklop viden samo pri več podjetjih", () => {
    const sidebar = read("src/components/admin/sidebar.tsx")
    expect(sidebar).toContain("organizations.length > 1")
    expect(sidebar).toContain("OrgSwitcher")
    expect(sidebar).toContain("switchActiveOrganization")
  })
})
