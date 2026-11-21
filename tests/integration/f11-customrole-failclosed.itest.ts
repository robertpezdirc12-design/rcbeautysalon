// ============================================================
// F11 — CUSTOM ROLE FAIL-CLOSED (P0 #1318, Phase 1.1)
//
// Permissions for a member with a custom role must FAIL CLOSED.
// A member whose custom role is missing / deleted / belongs to
// another org gets NO permissions — never a silent fallback to the
// full ADMIN/STAFF set (which was the original bug: `null` XX killed
// the lookup and fell back to ALL).
//
// Matrix tested (via getEffectivePermissions — real DB, org-scoped):
//   role - A valid custom role in ORGA → that role's keys ONLY.
//   independent valid roles in A and B → each restricted to its own.
//   member in A references a role in B → [] (foreign-org reference).
//   member references a NON-EXISTENT role   → [] (deleted role).
//   member WITHOUT customRole                → legacy ADMIN/STAFF keys.
//   STAFF in A + ADMIN in B cross-org         → correct per-org result.
//   role permission change in A              → does NOT affect B member.
// ============================================================

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { prisma } from "@/lib/prisma"
import { getEffectivePermissions } from "@/lib/permissions/effective"

const ORGA = "f11-org-a"
const ORGB = "f11-org-b"
const ADMA = "f11-admin-a"
const ADMB = "f11-admin-b"

const KEY_A_ONLY = "appointments.manage"
const KEY_B_ONLY = "finances.documents.manage"
const SAFE_KEY = "finances.view"

async function cleanData() {
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.customRole.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.user.deleteMany({ where: { id: { in: [ADMA, ADMB] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [ORGA, ORGB] } } })
}

/** Ustvari ORG samo (pred CustomRole zaradi FK CustomRole_organizationId_fkey). */
async function seedOrgOnly(orgId: string) {
  await prisma.organization.create({ data: { id: orgId, name: orgId, slug: orgId } })
}

/** Ustvari org + člana (idempotentno). */
async function seedMember(
  orgId: string,
  userId: string,
  role: "ADMIN" | "STAFF",
  customRoleId: string | null
) {
  await prisma.organization.upsert({ where: { id: orgId }, update: {}, create: { id: orgId, name: orgId, slug: orgId } })
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: `${userId}@f.test`, name: userId, role, organizationId: orgId },
  })
  await prisma.organizationMember.create({
    data: {
      organizationId: orgId,
      userId,
      role,
      isDefault: true,
      customRoleId,
    },
  })
}

describe("F11 custom-role fail-closed", () => {
  beforeAll(async () => {})
  afterAll(async () => {
    await cleanData()
  })

  beforeEach(async () => {
    await cleanData()
  })

  it("veljavna vloga v A → zgolj njeni ključi, ni legacy ALL", async () => {
    await seedOrgOnly(ORGA)
    const role = await prisma.customRole.create({
      data: { organizationId: ORGA, name: "Vloga A", permissions: [KEY_A_ONLY] },
    })
    await seedMember(ORGA, ADMA, "ADMIN", role.id)

    const keys = await getEffectivePermissions(ADMA, ORGA)
    expect(keys).toContain(KEY_A_ONLY)
    expect(keys).not.toContain(KEY_B_ONLY) // roles iz B ne smejo pricurljati
  })

  it("vlogi A in B sta neodvisni: B član NE vidi A-perm, A član NE vidi B-perm", async () => {
    await seedOrgOnly(ORGA)
    await seedOrgOnly(ORGB)
    const { roleA, roleB } = await prisma.$transaction(async (tx) => {
      const a = await tx.customRole.create({ data: { organizationId: ORGA, name: "Vloga A", permissions: [KEY_A_ONLY] } })
      const b = await tx.customRole.create({ data: { organizationId: ORGB, name: "Vloga B", permissions: [KEY_B_ONLY] } })
      return { roleA: a.id, roleB: b.id }
    })
    // A member with role A in org A
    await seedMember(ORGA, ADMA, "ADMIN", roleA)
    // B member with role B in org B
    await seedMember(ORGB, ADMB, "ADMIN", roleB)

    const keysA = await getEffectivePermissions(ADMA, ORGA)
    const keysB = await getEffectivePermissions(ADMB, ORGB)
    expect(keysA).toContain(KEY_A_ONLY)
    expect(keysA).not.toContain(KEY_B_ONLY)
    expect(keysB).toContain(KEY_B_ONLY)
    expect(keysB).not.toContain(KEY_A_ONLY)
  })

  it("član A z refenco na vlogo iz B → [] (tuja org, fail-closed)", async () => {
    await seedOrgOnly(ORGB)
    const { roleB } = await prisma.$transaction(async (tx) => {
      const b = await tx.customRole.create({ data: { organizationId: ORGB, name: "Vloga B", permissions: [KEY_B_ONLY] } })
      return { roleB: b.id }
    })
    await seedMember(ORGA, ADMA, "ADMIN", roleB) // reference na B-vlogo znotraj A

    const keys = await getEffectivePermissions(ADMA, ORGA)
    expect(keys).toEqual([])
  })

  it("član z NE-OBSTOJEČO vlogo (izbrisana) → [] (fail-closed)", async () => {
    await seedMember(ORGA, ADMA, "ADMIN", "customrole-ghost-does-not-exist")
    const keys = await getEffectivePermissions(ADMA, ORGA)
    expect(keys).toEqual([])
  })

  it("član BREZ vloge → legacy ADMIN/STAFF ključi (brez regresije)", async () => {
    await seedMember(ORGA, ADMA, "ADMIN", null)
    const keys = await getEffectivePermissions(ADMA, ORGA)
    expect(keys.length).toBeGreaterThan(0)
  })

  it("STAFF v A, ADMIN v B → vsak je omogočen le v SVOJEM org; cross-org fail-closed", async () => {
    await seedMember(ORGA, ADMA, "STAFF", null)
    await seedMember(ORGB, ADMB, "ADMIN", null)

    // V svojem org je uporabnik veljaven (legacy STAFF/ADMIN).
    expect((await getEffectivePermissions(ADMA, ORGA)).length).toBeGreaterThan(0)
    expect((await getEffectivePermissions(ADMB, ORGB)).length).toBeGreaterThan(0)

    // A v B (nima member vrstice, ni staff v B, User.organizationId ni B)
    // → [] brez eskalacije tujih pravic.
    expect(await getEffectivePermissions(ADMA, ORGB)).toEqual([])
    // Prav tako B v A.
    expect(await getEffectivePermissions(ADMB, ORGA)).toEqual([])
  })

  it("sprememba perm v A NEO vpliva na B (stabilnost po org)", async () => {
    await seedOrgOnly(ORGA)
    await seedOrgOnly(ORGB)
    const { roleA, roleB } = await prisma.$transaction(async (tx) => {
      const a = await tx.customRole.create({ data: { organizationId: ORGA, name: "A", permissions: [SAFE_KEY] } })
      const b = await tx.customRole.create({ data: { organizationId: ORGB, name: "B", permissions: [SAFE_KEY] } })
      return { roleA: a.id, roleB: b.id }
    })
    await seedMember(ORGA, ADMA, "ADMIN", roleA)
    await seedMember(ORGB, ADMB, "ADMIN", roleB)

    // Spremeni vlogo A — doda KEY_A_ONLY. B naj ostane na SAFE_KEY.
    await prisma.customRole.update({
      where: { id: roleA },
      data: { permissions: [SAFE_KEY, KEY_A_ONLY] as unknown as string[] },
    })

    const keysA = await getEffectivePermissions(ADMA, ORGA)
    const keysB = await getEffectivePermissions(ADMB, ORGB)
    expect(keysA).toContain(KEY_A_ONLY)
    expect(keysB).not.toContain(KEY_A_ONLY) // B vloge se A-spremembe ne dotika
  })
})