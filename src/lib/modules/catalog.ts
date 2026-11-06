// ============================================================
// #100 8.C (F2) — KATALOG MODULOV (čista jedra)
// Modul = poslovna funkcija (več kot capability): ima ime, opis,
// capability-je, odvisnosti. Vklop/izklop na ravni podjetja
// NEODVISNO od vertikale — vertikala samo PREDLAGA (F1 SKD).
//
// Pravila (načrt §5):
//  - izklop ≠ izguba podatkov (samo vhodi izginejo);
//  - odvisnosti deklarirane — vklop z neizpolnjeno odvisnostjo dobi
//    jasno sporočilo (ne tiho kaskado); izklop, od katerega je odvisen
//    drug modul, zahteva potrditev;
//  - brez vrstice moduleState = vertikalni privzeti (ni spremembe).
// ============================================================

import type { CapabilityKey } from "@/lib/profiles/types"

export type ModuleState = "ACTIVE" | "DEACTIVATED" | "HIDDEN"

export interface ModuleDef {
  /** Stabilen id — za v1 = capability ključ (1 : 1 katalog). */
  id: CapabilityKey
  nameSl: string
  nameEn: string
  descriptionSl: string
  descriptionEn: string
  /** Capability-ji, ki jih modul poganja (vklop/izklop celotnega sklopa). */
  capabilities: CapabilityKey[]
  /** Moduli, ki morajo biti vklopljeni, da je ta smiseln. */
  dependsOn: CapabilityKey[]
}

export const MODULES: ModuleDef[] = [
  {
    id: "appointments",
    nameSl: "Rezervacije in koledar",
    nameEn: "Bookings & calendar",
    descriptionSl: "Spletna rezervacija terminov, urniki, opomniki, čakalna lista.",
    descriptionEn: "Online bookings, schedules, reminders, waitlist.",
    capabilities: ["appointments"],
    dependsOn: ["services"],
  },
  {
    id: "services",
    nameSl: "Storitve in cenik",
    nameEn: "Services & pricing",
    descriptionSl: "Katalog storitev s cenami, trajanjem in dodatki.",
    descriptionEn: "Service catalog with prices, durations and add-ons.",
    capabilities: ["services"],
    dependsOn: [],
  },
  {
    id: "workOrders",
    nameSl: "Delovna naročila",
    nameEn: "Work orders",
    descriptionSl: "Delovni nalogi s procesi (vulkanizer, serviser, šivilja …).",
    descriptionEn: "Work orders with workflows (workshop, tailoring …).",
    capabilities: ["workOrders"],
    dependsOn: [],
  },
  {
    id: "shop",
    nameSl: "Spletna trgovina",
    nameEn: "Online shop",
    descriptionSl: "Izdelki, košarica, Stripe checkout, naročila strank.",
    descriptionEn: "Products, cart, Stripe checkout, customer orders.",
    capabilities: ["shop"],
    dependsOn: [],
  },
  {
    id: "inventory",
    nameSl: "Zaloge",
    nameEn: "Inventory",
    descriptionSl: "Evidenca zalog, gibi, inventura, opozorila nizke zaloge.",
    descriptionEn: "Stock records, movements, stocktakes, low-stock alerts.",
    capabilities: ["inventory"],
    dependsOn: [],
  },
  {
    id: "customers",
    nameSl: "Stranke",
    nameEn: "Customers",
    descriptionSl: "Baza strank, oznake, zgodovina obiskov in naročil.",
    descriptionEn: "Customer database, tags, visit and order history.",
    capabilities: ["customers"],
    dependsOn: [],
  },
  {
    id: "staff",
    nameSl: "Zaposleni in urniki",
    nameEn: "Staff & schedules",
    descriptionSl: "Osebje, povezava storitev, urniki, portal za osebje.",
    descriptionEn: "Team, service links, schedules, staff portal.",
    capabilities: ["staff"],
    dependsOn: [],
  },
  {
    id: "analytics",
    nameSl: "Statistika in poročila",
    nameEn: "Analytics & reports",
    descriptionSl: "KPI-ji, prihodki, zasedenost, GA4 integracija.",
    descriptionEn: "KPIs, revenue, occupancy, GA4 integration.",
    capabilities: ["analytics"],
    dependsOn: [],
  },
  {
    id: "reviews",
    nameSl: "Ocene strank",
    nameEn: "Customer reviews",
    descriptionSl: "Zbiranje in objava ocen na javni strani.",
    descriptionEn: "Collecting and publishing reviews on the public site.",
    capabilities: ["reviews"],
    dependsOn: [],
  },
  {
    id: "forms",
    nameSl: "Obrazci in povpraševanja",
    nameEn: "Forms & inquiries",
    descriptionSl: "Dinamični obrazci, povpraševanja, sprejemni obrazci terminov.",
    descriptionEn: "Dynamic forms, inquiries, intake forms on bookings.",
    capabilities: ["forms"],
    dependsOn: [],
  },
  {
    id: "workflows",
    nameSl: "Poslovni procesi",
    nameEn: "Business workflows",
    descriptionSl: "Konfigurabilne faze procesov za delovna naročila.",
    descriptionEn: "Configurable process stages for work orders.",
    capabilities: ["workflows"],
    dependsOn: ["workOrders"],
  },
  {
    id: "documents",
    nameSl: "Dokumenti (ponudbe, računi)",
    nameEn: "Documents (quotes, invoices)",
    descriptionSl: "Ponudbe in računi s per-org številčenjem.",
    descriptionEn: "Quotes and invoices with per-org numbering.",
    capabilities: ["documents"],
    dependsOn: [],
  },
  {
    id: "delivery",
    nameSl: "Dostava",
    nameEn: "Delivery",
    descriptionSl: "Dostava naročil (runtime razširitev trgovine).",
    descriptionEn: "Order delivery (shop runtime extension).",
    capabilities: ["delivery"],
    dependsOn: ["shop"],
  },
  {
    id: "walkIn",
    nameSl: "Walk-in vrsta",
    nameEn: "Walk-in queue",
    descriptionSl: "Živa vrsta brez računa — prijava in javni status.",
    descriptionEn: "Live queue without account — join and public status.",
    capabilities: ["walkIn"],
    dependsOn: [],
  },
]

/** IDs v hitrem nizu (validacija vnosa). */
export const MODULE_IDS: ReadonlySet<string> = new Set(MODULES.map((m) => m.id))

export function getModule(id: string): ModuleDef | null {
  return MODULES.find((m) => m.id === id) ?? null
}

export type ModuleStateMap = Record<string, ModuleState>

/**
 * Efektivna capability matrika (DASHBOARD): vertikalni profil + moduleStates
 * (zadnja beseda — neodvisno od vertikale).
 *  - DEACTIVATED modul izklopi SVOJE capability-je (podatki ostanejo);
 *  - ACTIVE in HIDDEN pustita capability delujočo (HIDDEN = skrito samo
 *    iz JAVNE strani — glej effectivePublicCapabilities);
 *  - ACTIVE/HIDDEN modul ODKLENE capability, ki jo je profil imel
 *    "disabled" (modul = samostojen, ne vezan na dejavnost — jedro 8.C);
 *  - nič vrstic = brez spremembe (obstoječi najemniki).
 */
export function effectiveCapabilities(
  profileCapabilities: Record<string, string>,
  states: ModuleStateMap
): Record<string, string> {
  const out = { ...profileCapabilities }
  for (const mod of MODULES) {
    const state = states[mod.id]
    if (!state) continue
    for (const cap of mod.capabilities) {
      if (state === "DEACTIVATED") {
        out[cap] = "disabled"
      } else if (out[cap] === "disabled") {
        out[cap] = "optional"
      }
    }
  }
  return out
}

/**
 * Efektivna matrika za JAVNO stran: HIDDEN modul je izklopljen (javni
 * vhodi se zaprejo), DEACTIVATED prav tako; ACTIVE odklene disabled.
 * Dashboard uporablja effectiveCapabilities (HIDDEN tam dela).
 */
export function effectivePublicCapabilities(
  profileCapabilities: Record<string, string>,
  states: ModuleStateMap
): Record<string, string> {
  const publicStates: ModuleStateMap = {}
  for (const [id, state] of Object.entries(states)) {
    publicStates[id] = state === "HIDDEN" ? "DEACTIVATED" : state
  }
  return effectiveCapabilities(profileCapabilities, publicStates)
}

/** Odvisni moduli (kdo zahteva ta modul) — za opozorilo pred izklopom. */
export function dependentsOf(moduleId: string): ModuleDef[] {
  return MODULES.filter((m) => m.dependsOn.includes(moduleId as CapabilityKey))
}

/** Manjkajoče odvisnosti za vklop (vklop gre z jasnimi sporočili). */
export function missingDependencies(
  moduleId: string,
  states: ModuleStateMap
): ModuleDef[] {
  const mod = getModule(moduleId)
  if (!mod) return []
  return mod.dependsOn
    .filter((dep) => (states[dep] ?? "ACTIVE") === "DEACTIVATED")
    .map((dep) => getModule(dep))
    .filter((m): m is ModuleDef => m !== null)
}
