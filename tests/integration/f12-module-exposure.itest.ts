// ============================================================
// F12 — MODULE ACTIONS: SERVER-ACTION EXPOSURE (P0 #1318, Phase 1.2)
//
// `src/app/actions/modules.ts` je "use server" površina za upravljanje
// modulov organizacije. Vse akcije morajo biti FAIL-CLOSED: anonimni
// klic, uporabnik brez članstva, član brez `settings.manage` → vedno
// UnauthorizedError. Nikoli tiho delovanje na tuji organizaciji.
//
// Poleg tega NIKOLI več ne izpostavljamo CELEG seedinga modulov kot
// javne "use server" akcije — začetno seedanje živi v internem
// src/lib/modules/seeding.ts (ne-"use server"), kar preverimo tako, da
// modules.ts ne izvozi `seedNewOrgModuleStates`.
// ============================================================

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; role: "ADMIN" | "STAFF" | "CLIENTE"; organizationId?: string | null; email?: string | null }
  },
}))

vi.mock("@/lib/auth/auth", () => ({
  auth: async () => state.session,
  unstable_update: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({}) }))
vi.mock("@/lib/tenant-proof", () => ({ ORG_PROOF_HEADER: "x-org-slug-proof", verifyOrgSlug: async () => ({ ok: true }) }))

import { prisma } from "@/lib/prisma"
import { UnauthorizedError } from "@/lib/auth/guards"
import { getModuleOverview, setModuleState } from "@/app/actions/modules"
// #1318: seedanje je prestavljeno v interni ne-"use server" modul —
// import ni več iz javnega actions modula.
import { seedNewOrgModuleStates } from "@/lib/modules/seeding"
import * as modulesActionNS from "@/app/actions/modules"

const ORGA = "f12-org-a"
const ORGB = "f12-org-b"
const ADMA = "f12-admin-a"
const ADMB = "f12-admin-b"
const USERN = "f12-no-membership"

async function seedAdmin(orgId: string, adminId: string) {
  await prisma.organization.create({ data: { id: orgId, name: orgId, slug: orgId } })
  await prisma.user.createMany({ data: [{ id: adminId, email: `${adminId}@f.test`, name: adminId, role: "ADMIN", organizationId: orgId }] })
  await prisma.organizationMember.create({ data: { organizationId: orgId, userId: adminId, role: "ADMIN", isDefault: true } })
}

async function clean() {
  await prisma.organizationModuleState.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORGA, ORGB] } } })
  await prisma.user.deleteMany({ where: { id: { in: [ADMA, ADMB, USERN] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [ORGA, ORGB] } } })
}

describe("F12 module-action exposure (fail-closed)", () => {
  beforeAll(async () => {
    await clean()
    await seedAdmin(ORGA, ADMA)
    await seedAdmin(ORGB, ADMB)
  })
  afterAll(async () => {
    await clean()
  })

  it("anonimen klic → UnauthorizedError (ne tiho delovanje)", async () => {
    state.session = null
    await expect(getModuleOverview()).rejects.toThrow(UnauthorizedError)
    await expect(setModuleState("appointments", "ACTIVE")).rejects.toThrow(UnauthorizedError)
  })

  it("prijavljen brez članstva → UnauthorizedError", async () => {
    await prisma.user.createMany({ data: [{ id: USERN, email: `${USERN}@f.test`, name: USERN, role: "STAFF" }] })
    state.session = { user: { id: USERN, role: "STAFF", organizationId: null, email: `${USERN}@f.test` } }
    await expect(getModuleOverview()).rejects.toThrow(UnauthorizedError)
    await expect(setModuleState("appointments", "ACTIVE")).rejects.toThrow(UnauthorizedError)
  })

  it("član S PRILAGOJENO VLOGO brez settings.manage → UnauthorizedError (ne legacy ALL)", async () => {
    // Custom vloga, ki NIMA settings.manage — tudi če je član po 'ADMIN'
    // osnovni vlogi, ga razširitev zoži na zgolj te ključe (fail-closed).
    const restricted = await prisma.customRole.create({
      data: { organizationId: ORGA, name: "A beper", permissions: ["appointments.manage"] },
    })
    await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: ORGA, userId: ADMA } },
      data: { customRoleId: restricted.id },
    })
    state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: `${ADMA}@f.test` } }
    await expect(getModuleOverview()).rejects.toThrow(UnauthorizedError)
    await expect(setModuleState("appointments", "ACTIVE")).rejects.toThrow(UnauthorizedError)

    // Povrnitev: poberi custom vlogo, da ne onesnažimo nadaljnjih testov org A.
    await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: ORGA, userId: ADMA } },
      data: { customRoleId: null },
    })
    await prisma.customRole.delete({ where: { id: restricted.id } })
  })

  it("eksportan `seedNewOrgModuleStates` NIkOLJ več ni iz javnega actions modula", async () => {
    // Compile-time / API garancija: javni površina ne vsebuje te akcije.
    expect("seedNewOrgModuleStates" in modulesActionNS).toBe(false)
    expect(typeof seedNewOrgModuleStates).toBe("function")
  })
})