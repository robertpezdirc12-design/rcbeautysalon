// ============================================================
// EXTENSION CONTRACT (EPIC #1 §13) — standardized way to add
// industry-specialized entities/processes WITHOUT duplicating
// or modifying the universal core (customers, orders, forms,
// workflows, payments). Extensions are declarative: they define
// capabilities, entities and form needs; the universal core
// materializes and renders them (Phase 4+ UI).
// Client-safe: NO server-only imports.
// ============================================================

import { z } from "zod"
import type { CapabilityKey, ProfileFieldDef } from "./types"

export interface ExtensionEntity {
  key: string // stable entity key, e.g. "vehicle"
  name: string
  description: string
  /** Declarative fields rendered by the universal entity UI (Phase 4+). */
  fields: ProfileFieldDef[]
}

export interface ExtensionDefinition {
  id: string
  name: string
  description: string
  version: number
  /** Which universal capabilities this extension builds upon. */
  capabilities: string[]
  /** Specialized entities contributed by this extension. */
  entities: ExtensionEntity[]
}

// ------------------------------------------------------------
// Validation schema — every extension is validated at load.
// ------------------------------------------------------------
const fieldDefSchema = z.object({
  key: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "date", "select", "checkbox"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  unit: z.string().optional(),
  placeholder: z.string().optional(),
})

// ------------------------------------------------------------
// Typed capability dependencies (E2-1): an extension's
// `capabilities` array may only reference REAL universal
// capability keys — enforced by this tuple (compile-time via
// `satisfies`, runtime via zod at module load).
// ------------------------------------------------------------
export const CAPABILITY_KEYS = [
  "appointments",
  "workOrders",
  "shop",
  "services",
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
] as const satisfies readonly CapabilityKey[]

const extensionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.number().int().positive(),
  capabilities: z.array(z.enum(CAPABILITY_KEYS)),
  entities: z.array(
    z.object({
      key: z.string().regex(/^[a-z][a-z0-9_]*$/),
      name: z.string().min(1),
      description: z.string().min(1),
      fields: z.array(fieldDefSchema),
    })
  ),
})

// ------------------------------------------------------------
// First-generation extensions
// ------------------------------------------------------------

/** Vehicle registry for workshops / tire services (§21 tire service scenario). */
const vehicleWorkshop: ExtensionDefinition = {
  id: "vehicle-workshop",
  name: "Vozila in vulkanizerija",
  description:
    "Evidenca vozil strank z registrskimi podatki in dimenzijami gum; delovni nalogi se vežejo na vozilo.",
  version: 1,
  capabilities: ["customers", "workOrders", "inventory"],
  entities: [
    {
      key: "vehicle",
      name: "Vozilo",
      description: "Vozilo stranke z registrsko oznako in tehničnimi podatki.",
      fields: [
        { key: "license_plate", label: "Registrska oznaka", type: "text", required: true },
        { key: "brand_model", label: "Znamka in model", type: "text", required: true },
        { key: "year", label: "Leto proizvodnje", type: "number", required: false },
        { key: "odometer_km", label: "Kilometri", type: "number", required: false, unit: "km" },
        { key: "vin", label: "VIN številka", type: "text", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "tire_set",
      name: "Komplet gum",
      description: "Dimenzije in stanje gum vozila (sezonska shranjevanje).",
      fields: [
        { key: "width_mm", label: "Širina", type: "number", required: true, unit: "mm" },
        { key: "profile_pct", label: "Profil", type: "number", required: true, unit: "%" },
        { key: "diameter_in", label: "Premer platišča", type: "number", required: true, unit: "palcev" },
        { key: "season", label: "Sezona", type: "select", required: true, options: ["Poletne", "Zimske", "Celoletne"] },
        { key: "tread_mm", label: "Globina tekalne plasti", type: "number", required: false, unit: "mm" },
      ],
    },
  ],
}

/** Body measurements for tailoring/seamstress (§21 seamstress scenario). */
const bodyMeasurements: ExtensionDefinition = {
  id: "body-measurements",
  name: "Mere telesa",
  description:
    "Shranjevanje mer strank za šivanje po meri in spremembe; mere se vežejo na naročilo in zgodovino stranke.",
  version: 1,
  capabilities: ["customers", "workOrders"],
  entities: [
    {
      key: "measurement_set",
      name: "Merilni list",
      description: "Sklop mer za eno stranko (posodabljan ob vsaki meritvi).",
      fields: [
        { key: "chest_cm", label: "Obseg prsi", type: "number", required: false, unit: "cm" },
        { key: "waist_cm", label: "Obseg pasu", type: "number", required: false, unit: "cm" },
        { key: "hips_cm", label: "Obseg bokov", type: "number", required: false, unit: "cm" },
        { key: "shoulder_cm", label: "Širina ramen", type: "number", required: false, unit: "cm" },
        { key: "sleeve_cm", label: "Dolžina rokava", type: "number", required: false, unit: "cm" },
        { key: "inseam_cm", label: "Notranja dolžina hlač", type: "number", required: false, unit: "cm" },
        { key: "height_cm", label: "Višina", type: "number", required: false, unit: "cm" },
      ],
    },
  ],
}

/** Batches/lots and harvest records for producers (§21 beekeeping scenario). */
const batchProduction: ExtensionDefinition = {
  id: "batch-production",
  name: "Serije in žetev",
  description:
    "Evidence žetve/produkcije, serije (loti) in povezava na zaloge izdelkov — brez rezervacij in terminov.",
  version: 1,
  capabilities: ["inventory", "shop"],
  entities: [
    {
      key: "batch",
      name: "Serija / lot",
      description: "Serija proizvodnje z datumom, količino in sledljivostjo.",
      fields: [
        { key: "batch_code", label: "Oznaka serije", type: "text", required: true },
        { key: "production_date", label: "Datum proizvodnje/žetve", type: "date", required: true },
        { key: "quantity_kg", label: "Količina", type: "number", required: true, unit: "kg" },
        { key: "product_type", label: "Vrsta (npr. med)", type: "select", required: true, options: ["Cvetlični med", "Lipov med", "Gozdni med", "Akačijski med", "Drug izdelek"] },
        { key: "apiary", label: "Panjska postaja / panj", type: "text", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

// ------------------------------------------------------------
// Second-generation capability extensions (E2-1) — declared
// WITHOUT runtime behavior; profiles enable them only when a
// phase ships the matching runtime (E2-2 suppliers/inventory,
// E2-3 projects, …). No existing profile references them, so
// every tenant keeps today's experience (default disabled).
// ------------------------------------------------------------

/** Projects and tasks for multi-day jobs (photographer, cleaner, …). */
const projects: ExtensionDefinition = {
  id: "projects",
  name: "Projekti in naloge",
  description:
    "Večdnevski posli in projekti z nalogami, roki in odgovornimi — za fotografije, čistilne servise in druga dela, ki niso enkratni termini.",
  version: 1,
  capabilities: ["workOrders", "customers"],
  entities: [
    {
      key: "project",
      name: "Projekt",
      description: "Projekt/posel z začetkom, rokom, statusom in proračunom.",
      fields: [
        { key: "name", label: "Naziv projekta", type: "text", required: true },
        { key: "start_date", label: "Začetek", type: "date", required: false },
        { key: "deadline", label: "Rok izvedbe", type: "date", required: false },
        { key: "status", label: "Status", type: "select", required: true, options: ["Načrtovanje", "V teku", "Zaključen", "Preklican"] },
        { key: "budget_eur", label: "Proračun", type: "number", required: false, unit: "EUR" },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "project_task",
      name: "Naloga",
      description: "Naloga znotraj projekta z odgovorno osebo in rokom.",
      fields: [
        { key: "title", label: "Naslov naloge", type: "text", required: true },
        { key: "status", label: "Status", type: "select", required: true, options: ["Odprto", "V teku", "Zaključeno"] },
        { key: "due_date", label: "Rok", type: "date", required: false },
        { key: "assignee", label: "Odgovorna oseba", type: "text", required: false },
        { key: "hours_est", label: "Predvidene ure", type: "number", required: false, unit: "h" },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

/** Multiple business locations under one tenant. */
const multiLocation: ExtensionDefinition = {
  id: "multi-location",
  name: "Več lokacij",
  description:
    "Evidenca poslovalnic z naslovi, kontakti in delovnim časom — termini, naročila in stranke se lahko vežejo na lokacijo.",
  version: 1,
  capabilities: ["customers", "appointments"],
  entities: [
    {
      key: "location",
      name: "Lokacija",
      description: "Poslovalnica/delovišče z naslovom in kontaktnimi podatki.",
      fields: [
        { key: "name", label: "Naziv lokacije", type: "text", required: true },
        { key: "address", label: "Naslov", type: "text", required: true },
        { key: "city", label: "Kraj", type: "text", required: true },
        { key: "postal_code", label: "Poštna številka", type: "text", required: false },
        { key: "phone", label: "Telefon", type: "text", required: false },
        { key: "opening_hours", label: "Delovni čas", type: "text", required: false },
        { key: "is_primary", label: "Primarna lokacija", type: "checkbox", required: false },
      ],
    },
  ],
}

/** Customer memberships / recurring revenue plans. */
const memberships: ExtensionDefinition = {
  id: "memberships",
  name: "Članstva in paketi strank",
  description:
    "Ponavljanji prihodki: članski paketi, karte in naročnine strank z veljavnostjo in statusom.",
  version: 1,
  capabilities: ["customers", "shop"],
  entities: [
    {
      key: "membership_plan",
      name: "Paket članstva",
      description: "Definicija paketa: cena, obdobje in ugodnosti.",
      fields: [
        { key: "name", label: "Naziv paketa", type: "text", required: true },
        { key: "price_eur", label: "Cena", type: "number", required: true, unit: "EUR" },
        { key: "interval", label: "Obdobje", type: "select", required: true, options: ["Mesec", "Leto"] },
        { key: "benefits", label: "Ugodnosti", type: "textarea", required: false },
        { key: "is_active", label: "Aktiven za prodajo", type: "checkbox", required: false },
      ],
    },
    {
      key: "membership",
      name: "Članstvo stranke",
      description: "Aktivno članstvo stranke z začetkom, koncem in statusom.",
      fields: [
        { key: "member_name", label: "Stranka", type: "text", required: true },
        { key: "plan_name", label: "Paket", type: "text", required: true },
        { key: "start_date", label: "Začetek", type: "date", required: true },
        { key: "end_date", label: "Konec veljavnosti", type: "date", required: false },
        { key: "status", label: "Status", type: "select", required: true, options: ["Aktivno", "Zaključeno", "Preklicano"] },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

/** Suppliers for goods ordering and delivery tracking. */
const suppliers: ExtensionDefinition = {
  id: "suppliers",
  name: "Dobavitelji",
  description:
    "Evidence dobaviteljev za naročanje blaga in sledenje dobavam; povezava z gibom zaloge pride z inventarnim runtimeom (E2-2).",
  version: 1,
  capabilities: ["inventory"],
  entities: [
    {
      key: "supplier",
      name: "Dobavitelj",
      description: "Dobavitelj blaga s kontaktnimi podatki.",
      fields: [
        { key: "name", label: "Naziv", type: "text", required: true },
        { key: "contact_person", label: "Kontaktna oseba", type: "text", required: false },
        { key: "email", label: "E-pošta", type: "text", required: false },
        { key: "phone", label: "Telefon", type: "text", required: false },
        { key: "address", label: "Naslov", type: "textarea", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

/** Delivery zones and methods giving the `delivery` capability runtime shape. */
const deliveryRuntime: ExtensionDefinition = {
  id: "delivery-runtime",
  name: "Dostava — cone in načini",
  description:
    "Dostavne cone (poštne številke, pristojbina, brezplačno nad zneskom) in načini prevzema/dostave za spletno trgovino.",
  version: 1,
  capabilities: ["shop", "delivery"],
  entities: [
    {
      key: "delivery_zone",
      name: "Dostavna cona",
      description: "Cona po poštnih številkah s pristojbino in pogoji.",
      fields: [
        { key: "name", label: "Naziv cone", type: "text", required: true },
        { key: "postal_codes", label: "Poštne številke", type: "text", required: true, placeholder: "npr. 1000, 1230, 1291" },
        { key: "fee_eur", label: "Pristojbina", type: "number", required: true, unit: "EUR" },
        { key: "free_over_eur", label: "Brezplačno nad", type: "number", required: false, unit: "EUR" },
        { key: "eta_days", label: "Čas dostave", type: "number", required: false, unit: "dni" },
      ],
    },
    {
      key: "delivery_method",
      name: "Način dostave/prevzema",
      description: "Način, ki ga stranka izbere pri naročilu.",
      fields: [
        { key: "name", label: "Naziv", type: "text", required: true },
        { key: "kind", label: "Vrsta", type: "select", required: true, options: ["Pošta/kurir", "Osebni prevzem", "Lastni dostavnik"] },
        { key: "price_eur", label: "Cena", type: "number", required: false, unit: "EUR" },
        { key: "is_active", label: "Aktivno", type: "checkbox", required: false },
      ],
    },
  ],
}

/** Rooms/chairs/bays as bookable resources for appointment businesses. */
const workspaceResources: ExtensionDefinition = {
  id: "workspace-resources",
  name: "Prostori in viri",
  description:
    "Stolčki, sobice in delovne postaje kot viri, na katere se vežejo termini ali delovni nalogi.",
  version: 1,
  capabilities: ["appointments", "workOrders"],
  entities: [
    {
      key: "workspace",
      name: "Delovni vir",
      description: "Fizični vir (stol, soba, plato) s kapaciteto 1 termin naenkrat.",
      fields: [
        { key: "name", label: "Naziv vira", type: "text", required: true },
        { key: "kind", label: "Vrsta", type: "select", required: true, options: ["Stol", "Soba", "Delovna postaja", "Dvigalo", "Drug"] },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

// ------------------------------------------------------------
// Registry — validated at module load (fail fast, not silently).
// ------------------------------------------------------------

const EXTENSION_LIST: ExtensionDefinition[] = [
  vehicleWorkshop,
  bodyMeasurements,
  batchProduction,
  workspaceResources,
  // E2-1 — declared capability extensions (no profile enables them yet):
  projects,
  multiLocation,
  memberships,
  suppliers,
  deliveryRuntime,
]

function validateExtensions(list: ExtensionDefinition[]): Record<string, ExtensionDefinition> {
  const out: Record<string, ExtensionDefinition> = {}
  for (const ext of list) {
    const parsed = extensionSchema.safeParse(ext)
    if (!parsed.success) {
      throw new Error(
        `[profiles] Invalid extension "${ext.id}": ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
      )
    }
    out[ext.id] = ext
  }
  return out
}

export const EXTENSIONS: Record<string, ExtensionDefinition> = validateExtensions(EXTENSION_LIST)

export function getExtension(id: string): ExtensionDefinition | undefined {
  return EXTENSIONS[id]
}
