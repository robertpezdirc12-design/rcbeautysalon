// ============================================================
// #100 8.A (M1/M2) — ČLANSTVA (dvojno branje, brez brisanja)
// Avtoritativni vir = OrganizationMember vrstice; legacy
// User.organizationId/role ostane napovednik (M2 dual-read), dokler
// backfill ne pokrije vseh. Čisto jedro (normalizacija) je testabilno
// brez baze; pristopki DB so tanke ovojnice.
// ============================================================

import { prisma } from "@/lib/prisma"

export interface MembershipRef {
  organizationId: string
  role: string
  isDefault: boolean
}

/**
 * Normalizacija seznama članstev v aktivni org (čisto, testabilno):
 *  - če je trenutni (iz seje) med članstvi → ostane;
 *  - sicer prvo isDefault, sicer prvo po createdAt vrstnem redu podanega
 *    seznama (klicatelj poda ustrezno urejen seznam).
 *  - prazen seznam → null (klicatelj pade na legacy pot).
 */
export function normalizeActiveMembership(
  memberships: MembershipRef[],
  currentOrganizationId: string | null
): MembershipRef | null {
  if (memberships.length === 0) return null
  if (
    currentOrganizationId &&
    memberships.some((m) => m.organizationId === currentOrganizationId)
  ) {
    return (
      memberships.find((m) => m.organizationId === currentOrganizationId) ??
      null
    )
  }
  return memberships.find((m) => m.isDefault) ?? memberships[0]
}

/** Vsa članstva uporabnika (iz baze, sveže — pravice ne grejo če JWT). */
export async function getMembershipsForUser(
  userId: string
): Promise<MembershipRef[]> {
  const rows = await prisma.organizationMember.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { organizationId: true, role: true, isDefault: true },
  })
  return rows
}

/**
 * M2 dvojno branje: če uporabnik IMA članstva, je aktivni org iz njih
 * (zaščita proti starim JWT-jem: session org, ki ni med članstvi, se
 * zamenja s privzetim). Brez članstev → legacy session org (stari računi
 * pred backfillom delujejo nespremenjeno).
 */
export async function resolveActiveOrganizationId(
  userId: string,
  sessionOrganizationId: string | null
): Promise<string | null> {
  const memberships = await getMembershipsForUser(userId)
  const active = normalizeActiveMembership(memberships, sessionOrganizationId)
  if (memberships.length > 0) return active?.organizationId ?? null
  return sessionOrganizationId
}
