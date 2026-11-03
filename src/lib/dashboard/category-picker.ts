// ============================================================
// CATEGORY PICKER (P3 #52) — pure rules for the dashboard forms.
//
// Svež najemnik ima 0 kategorij: izbirnik "Kategorija" v obrazcu za
// izdelek/storitev je odprl PRAZEN popover brez sporočila in brez poti
// do prve kategorije (prva kategorija sploh ni bila mogoča — ni bilo
// ne upravljanja kategorij ne akcije). Ta modul drži čista pravila:
//  - categoryPickerMode: kdaj izbirnik, kdaj prazno stanje z dejanjem
//  - normalizeCategoryName: validacija imena nove kategorije
// ============================================================

export type CategoryPickerMode = "select" | "empty"

/** 0 kategorij → prazno stanje z akcijo "Ustvari kategorijo". */
export function categoryPickerMode(count: number): CategoryPickerMode {
  return count > 0 ? "select" : "empty"
}

export type CategoryNameValidation =
  | { ok: true; name: string }
  | { ok: false; reason: "too-short" | "too-long" }

const NAME_MIN = 2
const NAME_MAX = 60

/** Obreže in validira ime nove kategorije (isti okvir kot ostala polja). */
export function normalizeCategoryName(raw: string): CategoryNameValidation {
  const name = (raw ?? "").trim().replace(/\s+/g, " ")
  if (name.length < NAME_MIN) return { ok: false, reason: "too-short" }
  if (name.length > NAME_MAX) return { ok: false, reason: "too-long" }
  return { ok: true, name }
}
