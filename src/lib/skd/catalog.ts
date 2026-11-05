// ============================================================
// F1 #100 — SKD 2025 KATALOG (podatkovna datoteka, AD-05)
//
// Vir: MARKEC-NACRT.md §4 (preverjeno na SURS Klasje 2026-11-05,
// klasifikacija SKD_2025 V1, Uradni list RS št. 27/2024; podlaga
// NACE Rev. 2.1). RAVEN 1: 22 sekcij A–V. Raven 2 (oddelki) se
// dopolni TU v datoteki — brez spremembe logike (katalog je
// razširljiven, ne fiksen seznam v kodi).
//
// PRAVILA (AD-05, odločitev lastnika 2026-11-04):
//  - izbira je NASVET, ne zaklep: predlogi modulov so informativni;
//  - več izbir, lastne oznake (customTags) in PRESKOK so enakovredne poti;
//  - dejavnost ni obvezna (razlika B): preskok = generična osnova.
// ============================================================

/** Tipi capability ključev (registry) — samo tolmač za predloge. */
export type SkdSuggestedModule =
  | "appointments"
  | "services"
  | "shop"
  | "inventory"
  | "customers"
  | "staff"
  | "workOrders"
  | "forms"
  | "workflows"
  | "documents"
  | "delivery"
  | "analytics"
  | "reviews"

export interface SkdSection {
  /** Uradna šifra sekcije (raven 1): ena črka A–V. */
  code: string
  name: string
}

export interface SkdArea {
  /** Stabilen ključ področja (platformni katalog, ne uradna SKD šifra). */
  key: string
  name: string
  /** Sekcije SKD 2025, pod katera področje ponavadi pade (nasvet za iskanje). */
  sections: string[]
  /** Predlagani moduli — SAMO nasvet (vklop/izklop ostane pri lastniku). */
  suggests: SkdSuggestedModule[]
}

/**
 * Sekcije SKD 2025 (raven 1, 22 zapisov A–V).
 * Vir: MARKEC-NACRT.md §4a (SURS Klasje, SKD_2025 V1).
 */
export const SKD_SECTIONS: SkdSection[] = [
  { code: "A", name: "Kmetijstvo in lov, gozdarstvo, ribištvo" },
  { code: "B", name: "Rudarstvo" },
  { code: "C", name: "Predelovalne dejavnosti" },
  { code: "D", name: "Oskrba z električno energijo, plinom, paro in hladnim zrakom" },
  { code: "E", name: "Oskrba z vodo, ravnanje z odplakami in odpadki, saniranje okolja" },
  { code: "F", name: "Gradbeništvo" },
  { code: "G", name: "Trgovina" },
  { code: "H", name: "Prevoz in skladiščenje" },
  { code: "I", name: "Nastanitvene in gostinske dejavnosti" },
  { code: "J", name: "Založništvo, radiodifuzija ter produkcija in distribucija vsebin" },
  { code: "K", name: "Dejavnosti v zvezi s telekomunikacijami, računalniškim programiranjem, svetovanjem, računalniško infrastrukturo in drugimi informacijskimi storitvami" },
  { code: "L", name: "Finančne in zavarovalniške dejavnosti" },
  { code: "M", name: "Poslovanje z nepremičninami" },
  { code: "N", name: "Strokovne, znanstvene in tehnične dejavnosti" },
  { code: "O", name: "Druge raznovrstne poslovne dejavnosti" },
  { code: "P", name: "Dejavnost javne uprave in obrambe, dejavnost obvezne socialne varnosti" },
  { code: "Q", name: "Izobraževanje" },
  { code: "R", name: "Zdravstvo in socialno varstvo" },
  { code: "S", name: "Kulturne, športne in rekreacijske dejavnosti" },
  { code: "T", name: "Druge dejavnosti" },
  { code: "U", name: "Dejavnost gospodinjstev z zaposlenim hišnim osebjem ter proizvodnja za lastno rabo" },
  { code: "V", name: "Dejavnost eksteritorialnih organizacij in teles" },
]

/**
 * Začetni katalog področij platforme (21 skupin iz #100, dopolnitev
 * zapisana v MARKEC-NACRT.md §4b). Panožno skupinanje, ki se v F1
 * mapira na SKD 2025 sekcije; vsako področje PREDLAGA module.
 */
export const SKD_AREAS: SkdArea[] = [
  { key: "beauty", name: "Lepota in osebna nega", sections: ["S"], suggests: ["appointments", "services", "customers", "staff", "reviews"] },
  { key: "health", name: "Zdravje in terapevtske storitve", sections: ["Q", "R"], suggests: ["appointments", "services", "forms", "customers"] },
  { key: "vehicles", name: "Avtomobili, motorji in kolesa", sections: ["G", "F"], suggests: ["appointments", "workOrders", "forms", "inventory"] },
  { key: "construction", name: "Gradbeništvo in instalacije", sections: ["F"], suggests: ["workOrders", "documents", "customers", "forms"] },
  { key: "crafts", name: "Obrt, popravila in izdelava", sections: ["C", "T"], suggests: ["workOrders", "documents", "inventory"] },
  { key: "cleaning", name: "Čiščenje in vzdrževanje", sections: ["N", "O"], suggests: ["workOrders", "documents", "customers"] },
  { key: "agriculture", name: "Kmetijstvo in naravne dejavnosti", sections: ["A"], suggests: ["inventory", "documents", "shop"] },
  { key: "hospitality", name: "Gostinstvo in prehrana", sections: ["I"], suggests: ["appointments", "shop", "customers"] },
  { key: "retail", name: "Trgovina in prodaja", sections: ["G"], suggests: ["shop", "inventory", "customers"] },
  { key: "tourism", name: "Turizem in nastanitve", sections: ["I"], suggests: ["shop", "documents", "appointments"] },
  { key: "transport", name: "Prevoz in logistika", sections: ["H"], suggests: ["workOrders", "documents", "customers"] },
  { key: "creative", name: "Kreativne in medijske dejavnosti", sections: ["J", "N"], suggests: ["forms", "documents", "shop"] },
  { key: "digital", name: "Digitalne in tehnološke storitve", sections: ["K", "N"], suggests: ["forms", "documents", "customers"] },
  { key: "education", name: "Izobraževanje in svetovanje", sections: ["P", "Q"], suggests: ["forms", "appointments", "shop"] },
  { key: "sport", name: "Šport in rekreacija", sections: ["R", "S"], suggests: ["appointments", "customers", "shop"] },
  { key: "animals", name: "Živali", sections: ["A", "T"], suggests: ["appointments", "forms", "customers"] },
  { key: "real-estate", name: "Nepremičnine in upravljanje objektov", sections: ["L", "M"], suggests: ["documents", "forms", "customers"] },
  { key: "rental", name: "Najem in izposoja", sections: ["N", "O"], suggests: ["shop", "documents", "customers"] },
  { key: "events", name: "Dogodki in prireditve", sections: ["R", "S"], suggests: ["appointments", "forms", "shop"] },
  { key: "professional", name: "Strokovne in druge storitve", sections: ["M", "N"], suggests: ["documents", "forms", "customers"] },
  { key: "other", name: "Druge in nove dejavnosti", sections: ["T", "U"], suggests: ["documents", "customers"] },
]

/** Tolmač modulov za prikaz predlogov (slovenščina, ne-tehnično). */
export const SKD_MODULE_LABELS: Record<SkdSuggestedModule, string> = {
  appointments: "Rezervacije in koledar",
  services: "Storitve in cenik",
  shop: "Spletna trgovina",
  inventory: "Zaloge",
  customers: "Stranke",
  staff: "Zaposleni in urniki",
  workOrders: "Delovni nalogi",
  forms: "Obrazci in vprašanja",
  workflows: "Delovni postopki",
  documents: "Dokumenti (ponudba/račun)",
  delivery: "Dostava",
  analytics: "Statistika in poročila",
  reviews: "Ocene strank",
}

/** Veljavne sekcije v hitrem nizu (validacija vnosa na strežniku). */
export const SKD_SECTION_CODES: ReadonlySet<string> = new Set(
  SKD_SECTIONS.map((s) => s.code)
)

/** Veljavni ključi področij (validacija vnosa na strežniku). */
export const SKD_AREA_KEYS: ReadonlySet<string> = new Set(
  SKD_AREAS.map((a) => a.key)
)

/**
 * Čist predlog modulov za izbrane SKD šifre.
 * - Sekcija → vsota predlogov vseh področij pod to sekcijo.
 * - Področje (ključ `area:<key>`) → predlogi tega področja.
 * - Lastne oznake namenoma NE vplivajo na predloge (nasvet je podatkovni,
 *   ne AI) — customTags živijo na Organization za lastnikovo evidenco.
 * - Nikoli ne vrnemo zaklenjenih odločitev — samo urejen seznam ključev.
 */
export function suggestModulesForSkd(codes: string[]): SkdSuggestedModule[] {
  const out = new Set<SkdSuggestedModule>()
  for (const code of codes) {
    if (code.startsWith("area:")) {
      const area = SKD_AREAS.find((a) => a.key === code.slice(5))
      area?.suggests.forEach((m) => out.add(m))
      continue
    }
    if (!SKD_SECTION_CODES.has(code)) continue
    for (const area of SKD_AREAS) {
      if (area.sections.includes(code)) {
        area.suggests.forEach((m) => out.add(m))
      }
    }
  }
  return [...out]
}

/**
 * Sanitizacija vnosa iz čarovnika: samo znane sekcije in področja,
 * omejitve dolžine/števila (odpornost na zlorabo javne poti).
 * Neznane vrednosti se tiho izpustijo — katalog je avtoritativen.
 */
export function sanitizeSkdInput(codes: unknown, tags: unknown): { codes: string[]; tags: string[] } {
  const cleanCodes: string[] = []
  if (Array.isArray(codes)) {
    for (const raw of codes.slice(0, 20)) {
      if (typeof raw !== "string") continue
      const value = raw.trim()
      if (!value || cleanCodes.includes(value)) continue
      if (value.startsWith("area:")) {
        if (SKD_AREA_KEYS.has(value.slice(5))) cleanCodes.push(value)
      } else if (SKD_SECTION_CODES.has(value)) {
        cleanCodes.push(value)
      }
    }
  }
  const cleanTags: string[] = []
  if (Array.isArray(tags)) {
    for (const raw of tags.slice(0, 10)) {
      if (typeof raw !== "string") continue
      const value = raw.trim().slice(0, 40)
      if (value && !cleanTags.includes(value)) cleanTags.push(value)
    }
  }
  return { codes: cleanCodes, tags: cleanTags }
}
