// ============================================================
// #98 (AD-02) — WALK-IN VRSTA (čista jedra)
// Pozicija se IZPELJE iz vrstnega reda prijav (createdAt) — nič
// ne shranjujemo, ničesar ni mogoče "pokvariti" z dirko. Prehodi
// statusov so eksplicitni (WAITING → SERVING → SERVED | LEFT,
// WAITING → LEFT); koda vstopnice je brez dvoumnih znakov.
// ============================================================

export type WalkInStatus = "WAITING" | "SERVING" | "SERVED" | "LEFT"

export interface QueueRef {
  id: string
  status: WalkInStatus
  /** ISO čas prijave — vrstni red vrste. */
  createdAt: string
}

/** Urejena čakajoča vrsta (najstarejši prvi = naslednji na potezi). */
export function waitingQueue<T extends QueueRef>(entries: T[]): T[] {
  return entries
    .filter((e) => e.status === "WAITING")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Pozicija vstopnice v čakajoči vrsti (1-based) ali null. */
export function queuePosition(entries: QueueRef[], entryId: string): number | null {
  const idx = waitingQueue(entries).findIndex((e) => e.id === entryId)
  return idx === -1 ? null : idx + 1
}

/** Naslednji na potezi (najstarejši WAITING) ali null. */
export function pickNextToServe<T extends QueueRef>(entries: T[]): T | null {
  return waitingQueue(entries)[0] ?? null
}

/** Ali je prehod statusa dovoljen (strogo, brez preskokov nazaj). */
export function canTransition(from: WalkInStatus, to: WalkInStatus): boolean {
  const allowed: Record<WalkInStatus, WalkInStatus[]> = {
    WAITING: ["SERVING", "LEFT"],
    SERVING: ["SERVED", "LEFT"],
    SERVED: [],
    LEFT: [],
  }
  return allowed[from].includes(to)
}

/** Koda vstopnice: 6 znakov brez dvoumnih (0/O, 1/I/L, S/5 …). */
const TICKET_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

export function generateTicketCode(random: () => number = Math.random): string {
  let code = ""
  for (let i = 0; i < 6; i += 1) {
    code += TICKET_ALPHABET[Math.floor(random() * TICKET_ALPHABET.length)]
  }
  return code
}

/** Sanitizacija prijave (javna pot — omejitve dolžin, telefon opcionalen). */
export function sanitizeWalkInInput(input: {
  name: unknown
  phone: unknown
}): { name: string; phone: string | null } {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 60) : ""
  const rawPhone = typeof input.phone === "string" ? input.phone.trim().slice(0, 30) : ""
  return {
    name,
    phone: rawPhone.length >= 3 ? rawPhone : null,
  }
}
