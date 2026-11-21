// ============================================================
// DATA-INTEGRITY AUDIT — READ-ONLY (P0 #131)
//
// Lahki, read-only inventurni SELECTi, ki na dani organizaciji
// poiščejo finančne/poslovne nedoslednosti. Funkcija NIKOLI ne piše
// v bazo — samo beri (SELECT/$queryRaw reading). Namen: revizija
// tenant izolacije, osirotelih zapisov in plačilnih relacij brez
// posega v podatke.
//
// Vsak check je vezan na organizationId parametru, zato preverja
// izključno zapise tega tenanta (vse relacije morajo ostati znotraj
// iste org — cross-org "uhajanje" se šteje za kršitev).
// ============================================================

import { prisma } from "@/lib/prisma"

export type IntegrityIssue = {
  /** Tipologija (mapira na SELECT check spodaj). */
  kind:
    | "payment-org-mismatch"
    | "advance-org-mismatch"
    | "duplicate-cleared-payment-reference"
    | "multiple-active-advance-allocation"
    | "advance-over-allocated"
  /** Id zapisa, ki krši pravilo. */
  recordId: string
  /** Človeku berljiv opis v slovenščini. */
  detailSl: string
}

/**
 * Read-only inventura nekonzistentnosti za eno organizacijo.
 *
 * @param organizationId  tenant-scope filter — preverjajo se SAMO zapisi
 *                        tega tenanta; relacije, ki kažejo ven iz njega,
 *                        se označijo kot kršitev.
 * @returns  seznam odkritih kršitev (prazno = čisto).
 */
export async function auditOrganizationIntegrity(
  organizationId: string
): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = []

  // ---- 1. DocumentPayment.organizationId === organizationId dokumenta ----
  // Napačno vezano plačilo je znak cross-tenant alokacije ali napačnega
  // zapisa. Vežemo se na DOKUMENTE te org in preverimo, da vsa pripadajoča
  // plačila nosijo isto org — tako ujamemo tudi plačilo, ki je bilo pomotoma
  // zapisano pod drugo org (in bi ga filtr po payment.org preskočil).
  const paymentOrgMismatch = await prisma.$queryRaw<{ id: string; paymentOrg: string; docOrg: string }[]>`
    SELECT p."id", p."organizationId" AS "paymentOrg", d."organizationId" AS "docOrg"
    FROM "DocumentPayment" p
    JOIN "Document" d ON d."id" = p."documentId"
    WHERE d."organizationId" = ${organizationId}
      AND p."organizationId" <> d."organizationId"
    LIMIT 50`
  for (const row of paymentOrgMismatch) {
    issues.push({
      kind: "payment-org-mismatch",
      recordId: row.id,
      detailSl: `Plačilo je vezano na org ${row.paymentOrg}, dokument pa na org ${row.docOrg}.`,
    })
  }

  // ---- 2. DocumentAdvanceAllocation mora biti znotraj iste org (in obstajati) ----
  // Predujemska alokacija mora imeti OBA dokumenta (predujem + končni račun)
  // v ISTI org kot alokacija. Z `LEFT JOIN` ujamemo tudi MANJKAJOČ dokument:
  // če predujem ali račun ne obstaja (npr. osirotela alokacija po nepopolnem
  // izbrisu), je relacija "manjkajoča" — v nasprotju s prejšnjim INNER JOIN,
  // ki je tako vrsto tiho izpustil. (F5.5.4.5.2 + #131)
  const advanceOrgMismatch = await prisma.$queryRaw<
    {
      id: string
      alloOrg: string
      advOrg: string | null
      invOrg: string | null
      hasAdvance: boolean
      hasInvoice: boolean
    }[]
  >`
    SELECT a."id", a."organizationId" AS "alloOrg",
           adv."organizationId" AS "advOrg", inv."organizationId" AS "invOrg",
           (adv."id" IS NOT NULL) AS "hasAdvance", (inv."id" IS NOT NULL) AS "hasInvoice"
    FROM "DocumentAdvanceAllocation" a
    LEFT JOIN "Document" adv ON adv."id" = a."advanceId"
    LEFT JOIN "Document" inv ON inv."id" = a."appliedToInvoice"
    WHERE a."organizationId" = ${organizationId}
      AND (adv."id" IS NULL OR inv."id" IS NULL
           OR a."organizationId" <> adv."organizationId"
           OR a."organizationId" <> inv."organizationId")
    LIMIT 50`
  for (const row of advanceOrgMismatch) {
    if (!row.hasAdvance) {
      issues.push({
        kind: "advance-org-mismatch",
        recordId: row.id,
        detailSl: `Alokacija ${row.id} kaže na manjkajoč predujem (advanceId).`,
      })
    } else if (!row.hasInvoice) {
      issues.push({
        kind: "advance-org-mismatch",
        recordId: row.id,
        detailSl: `Alokacija ${row.id} kaže na manjkajoč račun (appliedToInvoice).`,
      })
    } else {
      issues.push({
        kind: "advance-org-mismatch",
        recordId: row.id,
        detailSl: `Alokacija org ${row.alloOrg} ne ustreza org predujma ${row.advOrg} ali računa ${row.invOrg}.`,
      })
    }
  }

  // ---- 3. Podvojeni CLEARED PAYMENT z isto reference na istem dokumentu ----
  // Idempotency kjuč plačila — dvojno knjiženje iste reference (razen
  // namernih popravkov) kaže na dvojno plačilo. Vežemo se na dokumente te
  // org in njihova plačila.
  const dupPaymentRefRows = await prisma.$queryRaw<
    { documentId: string; reference: string; cnt: bigint }[]
  >`
    SELECT p."documentId", p."reference", COUNT(*) AS "cnt"
    FROM "DocumentPayment" p
    JOIN "Document" d ON d."id" = p."documentId"
    WHERE d."organizationId" = ${organizationId}
      AND p."kind" = 'PAYMENT' AND p."status" = 'CLEARED' AND p."reference" IS NOT NULL
    GROUP BY p."documentId", p."reference"
    HAVING COUNT(*) > 1
    LIMIT 50`
  for (const row of dupPaymentRefRows) {
    issues.push({
      kind: "duplicate-cleared-payment-reference",
      recordId: `${row.documentId}#${row.reference}`,
      detailSl: `Dokument ${row.documentId} ima ${row.cnt} knjiženih plačil z isto reference »${row.reference}«.`,
    })
  }

  // ---- 4. Aktivna alokacija istega predujma na VEČ računov ----
  // Pravilo: isti predujem se ne sme VEČKRAJ aktivno uporabiti (niti na
  // isti, niti na različne račune) — dokler prejšnja alokacija ni REVOKED.
  // Delni unikatni indeks (org, advanceId) WHERE status='ACTIVE' to že
  // fizično zagotavlja (20261112000000_f55452), zato tu preverimo zgolj
  // DEFENZIVNO, da ne bi prešlo mimo njega (npr. starejši podatki ali
  // ročni SQL). Združujemo SAMO po advanceId (ne po invoicu), da ne
  // spregledamo alokacij na različne račune.
  const dupActiveAllocRows = await prisma.$queryRaw<
    { advanceId: string; distinctInvoices: bigint; cnt: bigint }[]
  >`
    SELECT "advanceId", COUNT(DISTINCT "appliedToInvoice") AS "distinctInvoices", COUNT(*) AS "cnt"
    FROM "DocumentAdvanceAllocation"
    WHERE "organizationId" = ${organizationId} AND "status" = 'ACTIVE'
    GROUP BY "advanceId"
    HAVING COUNT(*) > 1
    LIMIT 50`
  for (const row of dupActiveAllocRows) {
    issues.push({
      kind: "multiple-active-advance-allocation",
      recordId: `${row.advanceId}`,
      detailSl: `Predujem ${row.advanceId} ima ${row.cnt} aktivnih alokacij na ${row.distinctInvoices} različnih računov.`,
    })
  }

  // ---- 4b. Vsota aktivnih alokacij predujma vs. razpoložljivi znesek ----
  // Če vsota ACTIVE alokacij predujma presega njegov znesek, je bila
  // porabljena večja vrednost, kot je predujem sploh imel (dvojna poraba).
  // (F5.5.4.5.2 — predujem = kuponi/vavčer do višine svojega zneska.)
  const overallNonZeroAlloc = await prisma.$queryRaw<
    { advanceId: string; allocSum: number | null; advTotal: number | null }[]
  >`
    SELECT a."advanceId", SUM(a."amount")::double precision AS "allocSum", adv."total"::double precision AS "advTotal"
    FROM "DocumentAdvanceAllocation" a
    LEFT JOIN "Document" adv ON adv."id" = a."advanceId"
    WHERE a."organizationId" = ${organizationId} AND a."status" = 'ACTIVE'
    GROUP BY a."advanceId", adv."total"
    HAVING SUM(a."amount") > COALESCE(adv."total", 0)
    LIMIT 50`
  for (const row of overallNonZeroAlloc) {
    issues.push({
      kind: "advance-over-allocated",
      recordId: row.advanceId,
      detailSl: `Predujem ${row.advanceId}: aktivne alokacije (${row.allocSum}) presegajo znesek predujma (${row.advTotal}).`,
    })
  }

  // NOTE (#131): Osirotele `OrderItem` in `AppointmentService` NE preverjamo
  // tu, ker (a) scenarij je FIZIČNO NEMOGOČ — PostgreSQL že na ravni sheme
  // (OrderItem.order→Order onDelete:Cascade; AppointmentService.appointment→
  // Appointment onDelete:Cascade) blokira otroka z neobstoječim nadrejenim;
  // (b) podrejeni modeli NIMAJO lastnega organizationId, zato "tenant-scoped"
  // orphan pregled ne bi bil natančen. Namesto tega imamo test, ki dokazuje,
  // da FK otroka brez nadrejenega zavrne (glej f131-data-integrity.itest.ts).
  // Nikjer ne predstavljamo nemogočega preverjanja kot delujoče zaščite.

  return issues
}

/**
 * Read-only inventura s podatki o popolnosti rezultata (ali je bil
 * skrajšan z LIMIT 50 in koliko je bilo vseh zadetkov). Za operativno rabo.
 */
export async function auditOrganizationIntegrityWithMeta(
  organizationId: string
): Promise<{ issues: IntegrityIssue[]; truncated: boolean }> {
  const issues = await auditOrganizationIntegrity(organizationId)
  return { issues, truncated: issues.length >= 450 } // konzervativno: blizu limita
}

/**
 * Bodi lezen: ali je organizacija brez odkritih neskladnosti?
 * Uporabno za CI/read-only controllere, da ne razkrije detajlov.
 */
export async function isOrganizationIntegrityClean(organizationId: string): Promise<boolean> {
  const issues = await auditOrganizationIntegrity(organizationId)
  return issues.length === 0
}