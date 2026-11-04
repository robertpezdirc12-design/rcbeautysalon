// ============================================================
// CUSTOMER TAGS (#91) — pure sanitization for owner labels.
//
// Oznake so proste lastnikove besede (»VIP«, »rdeča«, »prijatelj«) in
// hkrati SEGMETI za filtriranje Strank (P1 kampanje bodo ciljale segment
// = oznaka). Input prihaja iz brskalnika — zato whitelist sanitizacija:
// samo nizi, trim, brez praznih, dedupe, omejitve velikosti.
// Čista logika, brez DB — testabilna direktno.
// ============================================================

export const MAX_TAGS = 12
export const MAX_TAG_LENGTH = 24

export function sanitizeCustomerTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const cleaned = raw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => t.slice(0, MAX_TAG_LENGTH))
  return Array.from(new Set(cleaned)).slice(0, MAX_TAGS)
}
