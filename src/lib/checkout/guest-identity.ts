// ============================================================
// P2 #70 — identiteta gostovega naročila. E-pošta je edini signal,
// s katerim kupec DOKAZLJIVO upravlja; telefonska številka sama po
// sebi NE povezuje naročila z obstoječo stranko (gospodinjski skupni
// telefon, reciklirana številka, trgovinski fiksni telefon) — sicer
// lastnik odgovori osebi, ki naročila ni oddala.
//
// Čista logika (brez prisma) — enotijsko testirana v
// tests/golden-batch-70-73.test.ts. Prisma dostop ostane v
// src/app/actions/product-checkout.ts ("use server").
// ============================================================

/** Normalizacija imena za primerjavo: male črke, stisnjeni presledki. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

export interface GuestContactInput {
  name: string
  email?: string | null
}

export interface ExistingCustomerRow {
  name: string
  email: string | null
}

/**
 * Ali sme telefonski zadetek prevzeti identiteto obstoječe stranke?
 * LE ČE je tudi ime isto (normalizirano) IN stranka nima e-pošte na
 * zapisu ALI se e-pošti ujemata (neobčutljivo na velike črke).
 * Merjeno na prijavi #70: "sameIdentity() = normalized name matches
 * and (no e-mail on the customer or e-mails match)".
 */
export function guestIdentityMatches(
  existing: ExistingCustomerRow,
  contact: GuestContactInput
): boolean {
  const contactEmail = contact.email?.trim().toLowerCase() || null
  const nameOk =
    normalizeName(existing.name) === normalizeName(contact.name || "")
  if (!nameOk) return false
  // Stranka brez e-pošte na zapisu: ime + telefon zadostujeta.
  if (!existing.email) return true
  return existing.email.trim().toLowerCase() === contactEmail
}
