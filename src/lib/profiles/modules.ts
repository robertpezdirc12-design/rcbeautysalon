// ============================================================
// VERTICAL MODULES (vodeni vstop) — translates a profile's
// capability matrix into the concrete module list the owner
// gets when they pick that activity in the guided entry.
//
// Client-safe: NO server-only imports. Pure so tests and the
// guided-entry wizard agree with the capability gating that
// drives the sidebar (src/components/admin/sidebar.tsx).
// ============================================================

import { getProfile } from "./registry"
import type { CapabilityKey } from "./types"

export interface VerticalModule {
  key: CapabilityKey
  labelSl: string
  labelEn: string
  /** required = core of this vertical; optional = owner can switch it off later. */
  state: "required" | "optional"
}

const MODULE_LABELS: Record<string, { sl: string; en: string }> = {
  appointments: { sl: "Termini in rezervacije", en: "Appointments & bookings" },
  workOrders: { sl: "Delovna naročila", en: "Work orders" },
  shop: { sl: "Spletna trgovina", en: "Online shop" },
  services: { sl: "Katalog storitev", en: "Service catalog" },
  inventory: { sl: "Zaloge", en: "Inventory" },
  customers: { sl: "Stranke", en: "Customers" },
  staff: { sl: "Zaposleni", en: "Staff" },
  analytics: { sl: "Analitika", en: "Analytics" },
  reviews: { sl: "Ocene strank", en: "Customer reviews" },
  forms: { sl: "Dinamični obrazci", en: "Dynamic forms" },
  workflows: { sl: "Poslovni procesi", en: "Business workflows" },
  documents: { sl: "Dokumenti (ponudbe, računi)", en: "Documents (quotes, invoices)" },
  delivery: { sl: "Dostava", en: "Delivery" },
  walkIn: { sl: "Walk-in vrsta (brez računa)", en: "Walk-in queue (no account)" },
}

/** Fixed order for the wizard's "what you get" list. */
const MODULE_ORDER: CapabilityKey[] = [
  "appointments",
  "workOrders",
  "services",
  "shop",
  "inventory",
  "customers",
  "staff",
  "analytics",
  "reviews",
  "forms",
  "workflows",
  "documents",
  "delivery",
  "walkIn",
]

/**
 * Modules the owner gets for a vertical: every capability that is NOT
 * disabled — exactly the set the sidebar renders for that profile
 * ("kaj je zakupil"). Optional modules are marked so the wizard can
 * honestly say they can be switched off later (Moduli).
 */
export function modulesForVertical(profileId: string): VerticalModule[] {
  const capabilities = getProfile(profileId).capabilities
  return MODULE_ORDER.filter((key) => capabilities[key] !== "disabled").map((key) => ({
    key,
    labelSl: MODULE_LABELS[key]?.sl ?? key,
    labelEn: MODULE_LABELS[key]?.en ?? key,
    state: capabilities[key] === "required" ? "required" : "optional",
  }))
}
