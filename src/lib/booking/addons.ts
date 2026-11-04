// ============================================================
// BOOKING ADD-ONS (#92) — pure resolution + totals.
//
// Dodatek storitve = izbirno doplačilo z lastnim trajanjem. Pravila:
//  - izbira prihaja iz brskalnika kot ID-ji — razrešitev je ZDAJ
//    strežniška (org-scoped poizvedba v akciji), cene iz klienta se
//    nikoli ne upoštevajo;
//  - količine: dodatek je enkraten (checkbox, ne količina);
//  - snapshot izbranih dodatkov se zapiše na termin (addons Json?),
//    tako da kasnejša sprememba kataloga ne prepiše zgodovine
//    (isti princip kot commissionAmount).
// Čista logika, brez DB — testabilna direktno.
// ============================================================

export interface AddonLike {
  id: string
  name: string
  price: number
  durationMin: number
}

/**
 * Razreši izbiro: vrne dodatke v VRSTNEM REDU kataloga (ne v vrstnem
 * redu klikov), samo znane ID-je, brez duplikatov. Neznani ID-ji tiho
 * izpadejo — akcija je prej validirala org-scope in aktiven status.
 */
export function resolveAddonSelection<T extends AddonLike>(
  all: T[],
  selectedIds: string[]
): T[] {
  const ids = new Set(selectedIds)
  return all.filter((a) => ids.has(a.id))
}

/**
 * Vsota dodatkov (cena + trajanje) z 2-decimalnim zaokroževanjem cene.
 */
export function computeAddonTotals(selected: AddonLike[]): {
  addonPrice: number
  addonDurationMin: number
} {
  const raw = selected.reduce(
    (acc, a) => ({
      addonPrice: acc.addonPrice + a.price,
      addonDurationMin: acc.addonDurationMin + a.durationMin,
    }),
    { addonPrice: 0, addonDurationMin: 0 }
  )
  return {
    addonPrice: Math.round(raw.addonPrice * 100) / 100,
    addonDurationMin: raw.addonDurationMin,
  }
}
