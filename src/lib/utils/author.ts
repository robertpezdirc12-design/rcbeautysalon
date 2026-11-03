// P1 #39-4 (re-audit 2026-11) — ENOTEN FORMAT PRIKAZA AVTORJA MRENJA
//
// Prej je domača stran prikazovala "John D." (kratico), stran storitve pa
// polno ime "John Doe" — dva različna formata za isti vir podatkov.
// Ta util je edini vir resnice za javno pripisovanje mnenj:
// "Maja Novak" → "Maja N." (zasebnost-prijazno, enotno povsod).

/** "Maja Novak" → "Maja N." — privacy-friendly public attribution. */
export function displayAuthor(name: string | null, fallback: string): string {
  if (!name?.trim()) return fallback
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`
}
