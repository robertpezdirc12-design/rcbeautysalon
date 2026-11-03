// ============================================================
// CUSTOMER LEADS (P2 #48) — pure helpers for the customer list.
//
// Javni obrazci ustvarijo Customer vrstico BREZ pripadajočega User
// računa (findOrCreateCustomer v actions/forms.ts). Prej je /dashboard/
// users seznam gradil iz prisma.user.findMany — lead brez računa NI
// mogel nikoli zadeti filtra in je bil lastniku neviden, četudi je
// platforma sama stranke imenovala "vaša baza strank".
//
// Ta modul drži čista pravila (testabilna brez DB):
//  - buildLeadSearchWhere: iskanje linov po imenu, e-pošti in telefonu
// ============================================================

import type { Prisma } from "@prisma/client"

/**
 * Prisma where za "stranke brez računa" (Customer brez povezanega User)
 * z neobveznim iskanjem po imenu, e-pošti in telefonu.
 * Prazno/odsotno iskanje → samo območje najemnika.
 */
export function buildLeadSearchWhere(
  organizationId: string,
  search?: string
): Prisma.CustomerWhereInput {
  const trimmed = search?.trim()
  if (!trimmed) return { organizationId, user: null }

  return {
    organizationId,
    user: null,
    OR: [
      { name: { contains: trimmed, mode: "insensitive" } },
      { email: { contains: trimmed, mode: "insensitive" } },
      { phone: { contains: trimmed } },
    ],
  }
}
