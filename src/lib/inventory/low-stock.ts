// ============================================================
// LOW-STOCK RULES (#78) — EN VIRO RESNICE za opozorila zaloge.
//
// Prej je bil prag 10 unit trdo kodiran na DVEH mestih
// (getProductStats + barva tabele) — najemnik, ki naroča pri 3
// enotah in najemnik, ki naroča pri 40, sta dobila isto opozorilo.
// Številka je najemnikova, ne naša:
//   prag = product.reorderPoint ?? salonConfig.defaultReorderPoint
//
// Ta modul je čist (brez Prismy/Reacta), da ga uporablja stats
// akcija, tabela, dashboard widget in morebiti digest mail —
// ena izračunska pot, nikoli dve.
// ============================================================

/** Privzeti prag, če nič ne defined (varovalka, nikoli nič v DB). */
export const FALLBACK_REORDER_POINT = 10

/**
 * Razreši prag nizke zaloge za izdelek.
 * Izdelek s svojim reorderPointom zmaguje; sicer velja org privzeto;
 * če je tudi to neveljavno, velja varovalka.
 */
export function resolveReorderPoint(
  productReorderPoint: number | null | undefined,
  orgDefault: number | null | undefined
): number {
  if (
    typeof productReorderPoint === "number" &&
    Number.isFinite(productReorderPoint) &&
    productReorderPoint >= 0
  ) {
    return Math.floor(productReorderPoint)
  }
  if (
    typeof orgDefault === "number" &&
    Number.isFinite(orgDefault) &&
    orgDefault >= 0
  ) {
    return Math.floor(orgDefault)
  }
  return FALLBACK_REORDER_POINT
}

export type StockTone = "out" | "low" | "ok"

/**
 * Barva/ton stanja zaloge — ENA definicija "nizko" za stats kartico
 * in tabelo (prej dve kopiji `<= 10`).
 *   out → 0 enot; low → 1 … reorderPoint; ok → nad pragom.
 */
export function stockTone(stockQuantity: number, reorderPoint: number): StockTone {
  if (stockQuantity <= 0) return "out"
  if (stockQuantity <= reorderPoint) return "low"
  return "ok"
}

/**
 * Ali je izdelek "nizko na zalogi"? Zgodi se da stats kartica in
 * filtrirni čip potrebujeta samo logični odgovor.
 */
export function isLowStock(stockQuantity: number, reorderPoint: number): boolean {
  return stockTone(stockQuantity, reorderPoint) === "low"
}
