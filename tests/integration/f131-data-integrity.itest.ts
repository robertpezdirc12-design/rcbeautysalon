// ============================================================
// F131 — DATA-INTEGRITY AUDIT — READ-ONLY (P0 #131)
//
// Read-only inventura tenant izolacije, orphan zapisov in plačilnih
// relacij (src/lib/data-integrity/audit.ts). Audit funkcija NIKOLI ne
// piše v bazo — ta test ugotovi, da nastali podatki dajo 0 kršitev,
// nato pa v ločene fixture vnese namerne kršitve (direktni prisma
// write) in dokaže, da jih audit zazna. Vsi vbrizgi so omejeni na testno
// bazo markec_e2e_test / markec_f554_test / markec_it.
// ============================================================

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; role: "ADMIN" | "STAFF" | "CLIENTE"; organizationId?: string | null; email?: string | null; name?: string | null }
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
vi.mock("@/lib/tenant-proof", () => ({ ORG_PROOF_HEADER: "x-org-slug-proof", verifyOrgSlug: async () => true }))

import { prisma } from "@/lib/prisma"
import { createDocument, changeDocumentStatus, recordDocumentPayment } from "@/app/actions/documents"
import { auditOrganizationIntegrity } from "@/lib/data-integrity/audit"

const ORGA = "f131-org-a"
const ORGB = "f131-org-b"
const ADMA = "f131-admin-a"
const ADMB = "f131-admin-b"
const CUST = "f131-cust-a"

const line = (desc: string, unitPrice: number, vatRate = 22) => ({ description: desc, quantity: 1, unitPrice, vatRate })

async function seedOrg(orgId: string, adminId: string) {
  await prisma.organization.createMany({ data: [{ id: orgId, name: orgId, slug: orgId }] })
  await prisma.user.createMany({ data: [{ id: adminId, email: `${adminId}@f.test`, name: adminId, role: "ADMIN", organizationId: orgId }] })
  await prisma.organizationMember.createMany({ data: [{ organizationId: orgId, userId: adminId, role: "ADMIN", isDefault: true }] })
}

async function cleanData() {
  const ids = [ORGA, ORGB]
  await prisma.documentEvent.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.documentPayment.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.documentAdvanceAllocation.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.creditNote.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.documentItem.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.document.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.salonConfig.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.customer.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: [ADMA, ADMB] } } })
  await prisma.organization.deleteMany({ where: { id: { in: ids } } })
}

/** Ustvari in izda INVOICE v trenutni org-seji. */
async function mintInvoice(total: number): Promise<string> {
  const c = await createDocument({ type: "INVOICE", customerId: CUST, issueDate: "2026-01-01", dueDate: "2026-02-01", items: [line("S", total, 22)] })
  expect(c.ok).toBe(true)
  const issued = await changeDocumentStatus(c.id!, "ISSUED")
  expect(issued.ok).toBe(true)
  return c.id!
}

beforeAll(async () => {
  const rows = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
  expect(["markec_f554_test", "markec_e2e_test", "markec_it"]).toContain(rows[0].db)
  await cleanData()
  await seedOrg(ORGA, ADMA)
  await seedOrg(ORGB, ADMB)
  await prisma.salonConfig.create({ data: { organizationId: ORGA, name: "Salon A", currency: "EUR", isVatRegistered: true, vatId: "SI111" } })
  await prisma.salonConfig.create({ data: { organizationId: ORGB, name: "Salon B", currency: "EUR", isVatRegistered: false } })
  await prisma.customer.create({ data: { id: CUST, organizationId: ORGA, name: "Ana", email: "ana@x.si" } })
  await prisma.customer.create({ data: { id: "f131-cust-b", organizationId: ORGB, name: "Beta" } })
})

beforeEach(async () => {
  state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
  await prisma.documentEvent.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentPayment.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentAdvanceAllocation.deleteMany({ where: { organizationId: ORGA } })
  await prisma.creditNote.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentItem.deleteMany({ where: { organizationId: ORGA } })
  await prisma.document.deleteMany({ where: { organizationId: ORGA } })
  await prisma.documentSequence.deleteMany({ where: { organizationId: ORGA } })
})

afterAll(async () => {
  await cleanData()
  await prisma.$disconnect()
})

describe("F131 read-only data-integrity audit", () => {
  it("čista org → 0 kršitev (B-zapisi so izključeni iz A audita)", async () => {
    // ORG B ima svoje finance zapise — tečen v A, da dokažemo org-scope.
    const invA = await mintInvoice(150)
    await recordDocumentPayment(invA, { amount: 150, method: "card", reference: "F131-REF-A" })
    // ORG B: drug dokument in plačilo — preklopimo sejo na B, da je ustvarjanje
    // v B verodostojno (B-zapisi ostanejo zunaj A audita).
    state.session = { user: { id: ADMB, role: "ADMIN", organizationId: ORGB, email: "b@f.test" } }
    const cB = await createDocument({ type: "INVOICE", customerId: "f131-cust-b", issueDate: "2026-01-02", dueDate: "2026-02-02", items: [line("S", 40, 22)] })
    expect(cB.ok).toBe(true)
    const invB = await changeDocumentStatus(cB.id!, "ISSUED")
    expect(invB.ok).toBe(true)
    await prisma.documentPayment.create({
      data: { organizationId: ORGB, documentId: cB.id!, amount: 40, method: "card", reference: "F131-REF-B" },
    })

    state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }
    const issues = await auditOrganizationIntegrity(ORGA)
    expect(issues).toEqual([])
  })

  it("payment dokumenta iz tuje org → plačilo-org neskladje zaznano", async () => {
    // Namerna cross-tenant napaka (injektat v fixture): plačilo z organizationId=ORGB,
    // a vezano na dokument org A. Runtime action tega ne dovoli; tu ga vstavimo
    // neposredno, da dokažemo da audit zread-only zazna inconsistency.
    const invA = await mintInvoice(80)
    await prisma.documentPayment.create({
      data: { organizationId: ORGB, documentId: invA, amount: 80, method: "card", reference: "F131-XORG" },
    })

    const issues = await auditOrganizationIntegrity(ORGA)
    const mismatch = issues.filter((i) => i.kind === "payment-org-mismatch")
    expect(mismatch.length).toBeGreaterThan(0)
  })

  it("delni unikat v DB prepreči dvojno CLEARED plačilo z isto reference (F5.5.4.4.1)", async () => {
    // DocumentPayment ima namentno zgrajen delni unikatni indeks
    // (org, documentId, reference) WHERE reference IS NOT NULL
    // (migracija 20261209000000_f5542) — isto reference v isti org+doc
    // torej na bazi sploh ni mogoče zapisati dvakrat. Tu potrjujemo to
    // garancijo sheme: prvo plačilo gre, drugo z isto reference pade.
    const invA = await mintInvoice(100)
    await prisma.documentPayment.create({
      data: { organizationId: ORGA, documentId: invA, amount: 60, method: "card", reference: "F131-DUP", kind: "PAYMENT", status: "CLEARED" },
    })
    await expect(
      prisma.documentPayment.create({
        data: { organizationId: ORGA, documentId: invA, amount: 40, method: "card", reference: "F131-DUP", kind: "PAYMENT", status: "CLEARED" },
      })
    ).rejects.toThrow()

    // Čist račun po tem preizkusu → audit ne poroča ničesar.
    const issues = await auditOrganizationIntegrity(ORGA)
    expect(issues.filter((i) => i.kind === "duplicate-cleared-payment-reference")).toEqual([])
  })

  it("delni unikat in DB preprečita 2 ACTIVE alokaciji istega predujma (F5.5.4.5.2)", async () => {
    // Shema namerno (20261112000000_f55452) sam izvede DELNI unikat
    // (org, advanceId) WHERE status='ACTIVE' — zato DVE ACTIVE alokaciji
    // istega predujma na bazi ni mogoče zapisati, kar audit nikoli ne bi
    // videl v realnem nastanku. Tu potrjujemo, da (a) prva ACTIVE alokacija
    // gre, (b) druga ACTIVE je zavrnjena, (c) po REVOKED se avans SPLOH
    // lahko ponovno uporabi (namen delnega unikata — ne polnega unique).
    const invA = await mintInvoice(90)
    const advA = await createDocument({ type: "ADVANCE", customerId: CUST, issueDate: "2026-01-03", dueDate: "2026-02-03", items: [line("P", 90, 22)] })
    expect(advA.ok).toBe(true)
    const advIssued = await changeDocumentStatus(advA.id!, "ISSUED")
    expect(advIssued.ok).toBe(true)

    await prisma.documentAdvanceAllocation.create({
      data: { organizationId: ORGA, advanceId: advA.id!, appliedToInvoice: invA, amount: 90, taxBase: 0, taxTotal: 0 },
    })
    // (b) druga ACTIVE alokacija → zavrnjena s strani delnega unikata.
    await expect(
      prisma.documentAdvanceAllocation.create({
        data: { organizationId: ORGA, advanceId: advA.id!, appliedToInvoice: invA, amount: 90, taxBase: 0, taxTotal: 0 },
      })
    ).rejects.toThrow()

    // (c) po REVOKED se avans lahko ponovno uporabi na nov račun.
    const invA2 = await mintInvoice(90)
    await prisma.documentAdvanceAllocation.updateMany({
      where: { organizationId: ORGA, advanceId: advA.id!, status: "ACTIVE" },
      data: { status: "REVOKED" },
    })
    await expect(
      prisma.documentAdvanceAllocation.create({
        data: { organizationId: ORGA, advanceId: advA.id!, appliedToInvoice: invA2, amount: 90, taxBase: 0, taxTotal: 0 },
      })
    ).resolves.toBeTruthy()

    // Read-only audit na čisti prevleki po stornu → brez kršitev.
    const issues = await auditOrganizationIntegrity(ORGA)
    expect(issues.filter((i) => i.kind === "multiple-active-advance-allocation")).toEqual([])
  })

  it("alokacija A na dokument B → org-neskladje zaznano (cross-tenant)", async () => {
    // Alokacija v org A se ne sme sklicevati na predujem org B (cross-org).
    const invA = await mintInvoice(60)
    state.session = { user: { id: ADMB, role: "ADMIN", organizationId: ORGB, email: "b@f.test" } }
    const advB = await createDocument({ type: "ADVANCE", customerId: "f131-cust-b", issueDate: "2026-01-05", dueDate: "2026-02-05", items: [line("P", 60, 22)] })
    expect(advB.ok).toBe(true)
    await changeDocumentStatus(advB.id!, "ISSUED")
    state.session = { user: { id: ADMA, role: "ADMIN", organizationId: ORGA, email: "a@f.test" } }

    // Alokacija v org A, ki se sklicuje na predujem org B (cross-org napaka).
    await prisma.documentAdvanceAllocation.create({
      data: { organizationId: ORGA, advanceId: advB.id!, appliedToInvoice: invA, amount: 60, taxBase: 0, taxTotal: 0 },
    })

    const issues = await auditOrganizationIntegrity(ORGA)
    const mism = issues.filter((i) => i.kind === "advance-org-mismatch")
    expect(mism.length).toBeGreaterThan(0)
  })

  it("FK prepreči alokacijo na neobstoječ predujem → vnos zavrnjen (missing parent)", async () => {
    const invA = await mintInvoice(50)
    // Oracle: DocumentAdvanceAllocation.advanceId → Document.id je FK
    // (onDelete: Restrict). Alokacija na neobstoječ dokument (manjkajoči
    // predujem) torej na bazi FIZIČNO ni možna — prikažemo, da DB to zavrne.
    // Audit še vedno defenzivno preveri `LEFT JOIN adv IS NULL` za primer,
    // da bi relacija kdaj koli odpovedala / bilo starejših podatkov.
    const ghostId = "doc-ghost-nonexistent"
    await expect(
      prisma.documentAdvanceAllocation.create({
        data: { organizationId: ORGA, advanceId: ghostId, appliedToInvoice: invA, amount: 50, taxBase: 0, taxTotal: 0 },
      })
    ).rejects.toThrow()
  })
})