// ============================================================
// BOOKING WRITE GUARD (#93) — cross-instance concurrency boundary
//
// Problem: vsi zapisni poti termina so check-then-act (preveri proste
// terme → zapiši). Dva vzporedna zahtevka (ali webhook + verify pot
// za ISTO plačilo) lahko oba vidita slot prost in oba commitata.
// In-memory mutex NE zadošča (več instanc / serverless).
//
// Strategija: PostgreSQL **advisory transaction lock**
// (pg_advisory_xact_lock) znotraj prisma.$transaction — ključavnica
// živi do konca transakcije, deluje čez vse instance (je na nivoju
// DB), brez migracije in brez tveganja za obstoječo data.
// Konflikt-check in zapis sta tako v ISTEM varovalnem območju:
// zmagovalna transakcija commita, izgubnik vidi zaseden slot in
// dobi lokalizirano napako (ne DB izjeme).
//
// Ključi: hash niza "(orgId):(staffId)" — temu primerno se
// ključavajo SAMO rezervacije istega osebja v istem najemniku (različni
// staff/tenanti ostanejo neodvisni, sosledni termini so napačnost
// intervalne logike, ne ključavnice). Ko je izbran EXKLUZIVEN vir
// (prostor), se ključava še njegov ključ — v UREJENEM vrstnem redu
// (sorted), sicer dve nasprotni pridobitvi lahko deadlockata.
//
// Exclusion constraint (btree_gist + tstzrange &&) je dokumentiran
// kot opcionalen nadaljnji hardening: zahteva čisto obstoječo data
// (duplikati preklicanih/statusov) — advisory lock pokrije vse pisalne
// poti aplikacije brez tveganja.
// ============================================================

/** Prva ključavnica: (najemnik, osebje) — rezervacije istega osebja se sekvenčno. */
export function staffLockKey(organizationId: string, staffId: string): string {
  return `booking:${organizationId}:${staffId}`
}

/** Druga ključavnica (neobvezna): ekskluziven vir/prostor znotraj najemnika. */
export function resourceLockKey(organizationId: string, resourceRecordId: string): string {
  return `resource:${organizationId}:${resourceRecordId}`
}

/**
 * Urejen seznam ključev za pridobitev (sorted → brez deadlockov).
 */
export function bookingLockKeys(
  organizationId: string,
  staffId: string,
  resourceRecordId?: string | null
): string[] {
  const keys = [staffLockKey(organizationId, staffId)]
  if (resourceRecordId) keys.push(resourceLockKey(organizationId, resourceRecordId))
  return keys.sort()
}

/**
 * Prevzame advisory xact ključavnice znotraj TEKOČE transakcije
 * (dobijo se kot tx iz prisma.$transaction). Ključavnice se sprostijo
 * same ob commit/rollback — ni ročnega sproščanja.
 *
 * NB: $executeRaw, NE $queryRaw — pg_advisory_xact_lock vrača void,
 * ki ga $queryRaw ne zna deserijalizirati ("Failed to deserialize
 * column of type 'void'").
 */
export async function acquireBookingLocks(
  tx: { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number> },
  keys: string[]
): Promise<void> {
  for (const key of keys) {
    // hashtext → int4; pg_advisory_xact_lock(bigint) sprejme tudi int4.
    // Ena po ena (urejen vrstni red) — kratek wait, ker so zapisne
    // transakcije kratke (preverjanje + INSERT).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key})::bigint)`
  }
}
