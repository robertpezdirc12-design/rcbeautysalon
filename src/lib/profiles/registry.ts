// ============================================================
// ACTIVITY PROFILE REGISTRY (EPIC #1 §4–§5, §21)
// Single source of truth for every activity the platform
// supports. Adding a new activity = adding ONE entry here
// (plus an optional catalog preset in src/lib/verticals.ts and
// site copy in src/lib/site-content.ts) — no core changes.
//
// Client-safe (importable from client components): NO prisma.
// Every profile is validated with zod at module load.
// ============================================================

import { z } from "zod"
import { EXTENSIONS } from "./extensions"
import type {
  ActivityProfile,
  CapabilityMatrix,
  CapabilityState,
  CapabilityKey,
  ProfileOption,
  TerminologyEntry,
  TerminologySet,
} from "./types"

// ------------------------------------------------------------
// Zod schemas
// ------------------------------------------------------------
const capabilityState = z.enum(["required", "optional", "disabled"])

const capabilitySchema = z.object({
  appointments: capabilityState,
  workOrders: capabilityState,
  shop: capabilityState,
  services: capabilityState,
  inventory: capabilityState,
  customers: capabilityState,
  staff: capabilityState,
  analytics: capabilityState,
  reviews: capabilityState,
  forms: capabilityState,
  workflows: capabilityState,
  documents: capabilityState,
  delivery: capabilityState,
  // #98 (AD-02): walk-in vrsta — samostojen izbirni modul za VSE
  // dejavnosti (prijava brez računa, živa vrsta, javni status).
  walkIn: capabilityState,
})

const termSchema = z.object({ sl: z.string().min(1), en: z.string().min(1) })

const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "date", "select", "checkbox"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  unit: z.string().optional(),
  placeholder: z.string().optional(),
})

const formSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  fields: z.array(fieldSchema).min(1),
})

const workflowSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  entity: z.string().min(1),
  stages: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9_]*$/),
        name: z.string().min(1),
        description: z.string().optional(),
        slaHours: z.number().int().positive().optional(),
        isFinal: z.boolean().optional(),
      })
    )
    .min(2),
})

const profileSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  version: z.number().int().positive(),
  label: z.string().min(1),
  description: z.string().min(1),
  palette: z.string().min(1),
  // P2 #36: schema.org tip je del definicije profila — nov profil MORA
  // izbrati pravi @type (test to zaklene po vseh vertikalah).
  schemaType: z.string().min(1),
  capabilities: capabilitySchema,
  terminology: z.object({
    appointmentSingular: termSchema,
    appointmentPlural: termSchema,
    orderSingular: termSchema,
    orderPlural: termSchema,
    serviceSingular: termSchema,
    servicePlural: termSchema,
    productSingular: termSchema,
    productPlural: termSchema,
    customerSingular: termSchema,
    customerPlural: termSchema,
    bookingCta: termSchema,
  }),
  forms: z.array(formSchema),
  workflows: z.array(workflowSchema),
  dashboardWidgets: z.array(
    z.enum([
      "todayAppointments",
      "revenue",
      "customers",
      "topServices",
      "recentOrders",
      "lowStock",
      "activeOrders",
      "deadlines",
      "pendingApprovals",
      "readyForDelivery",
      "projects",
    ])
  ),
  website: z.object({
    ctaMode: z.enum(["booking", "inquiry", "order", "quote"]),
  }),
  extensions: z.array(z.string()),
  catalog: z.object({ seedVerticalId: z.string().min(1) }),
})

// ------------------------------------------------------------
// Reusable capability presets
// ------------------------------------------------------------

function salonCapabilities(): CapabilityMatrix {
  // Appointment-centric service business (existing behavior preserved).
  return {
    appointments: "required",
    workOrders: "disabled",
    shop: "required",
    services: "required",
    inventory: "optional",
    customers: "required",
    staff: "required",
    analytics: "required",
    reviews: "optional",
    forms: "optional",
    workflows: "disabled", // appointment lifecycle is native
    documents: "disabled",
    delivery: "disabled",
    walkIn: "optional", // #98: modul je na voljo vsaki dejavnosti (AD-02)
  }
}

function terms(t: {
  appointmentSingular?: string
  appointmentPlural?: string
  orderSingular: string
  orderPlural: string
  serviceSingular?: string
  servicePlural?: string
  productSingular?: string
  productPlural?: string
  customerSingular?: string
  customerPlural?: string
  // P2 #84: samostalnik za podjetje v 3 sklanjah (SL) + EN paket.
  businessSingular?: string
  businessIn?: string
  businessGenitive?: string
  businessEn?: { singular: string; in: string; genitive: string }
  bookingCta: string
  orderEn: { singular: string; plural: string }
  ctaEn: string
}): TerminologySet {
  // Convenience builder — Slovenian + English terminology pairs.
  const e = (sl: string, en: string): TerminologyEntry => ({ sl, en })
  // P2 #84: privzeto nevtralno "podjetje" — vsak profil, ki je govoril
  // o "salonu", to izrecno deklarira spodaj.
  const biz = {
    singular: t.businessSingular ?? "podjetje",
    in: t.businessIn ?? "v podjetju",
    genitive: t.businessGenitive ?? "podjetja",
  }
  const bizEn = t.businessEn ?? {
    singular: "business",
    in: "at the business",
    genitive: "the business's",
  }
  return {
    appointmentSingular: e(t.appointmentSingular ?? "Termin", "Appointment"),
    appointmentPlural: e(t.appointmentPlural ?? "Termini", "Appointments"),
    orderSingular: e(t.orderSingular, t.orderEn.singular),
    orderPlural: e(t.orderPlural, t.orderEn.plural),
    serviceSingular: e(t.serviceSingular ?? "Storitev", "Service"),
    servicePlural: e(t.servicePlural ?? "Storitve", "Services"),
    productSingular: e(t.productSingular ?? "Izdelek", "Product"),
    productPlural: e(t.productPlural ?? "Izdelki", "Products"),
    customerSingular: e(t.customerSingular ?? "Stranka", "Customer"),
    customerPlural: e(t.customerPlural ?? "Stranke", "Customers"),
    businessSingular: e(biz.singular, bizEn.singular),
    businessIn: e(biz.in, bizEn.in),
    businessGenitive: e(biz.genitive, bizEn.genitive),
    bookingCta: e(t.bookingCta, t.ctaEn),
  }
}

// ------------------------------------------------------------
// Profiles
// ------------------------------------------------------------

const PROFILE_LIST: ActivityProfile[] = [
  // --- Appointment-centric service businesses (existing behavior) ---
  {
    id: "beauty",
    version: 1,
    label: "Lepotni salon",
    description: "Kombinacija frizerije, nohtov in kozmetike",
    palette: "rose",
    // P2 #36: schema.org @type — del definicije profila (en vir resnice).
    schemaType: "BeautySalon",
    capabilities: salonCapabilities(),
    terminology: terms({
      businessSingular: "salon",
      businessIn: "v salonu",
      businessGenitive: "salona",
      businessEn: { singular: "salon", in: "at the salon", genitive: "the salon's" },
      orderSingular: "Spletno naročilo",
      orderPlural: "Spletna naročila",
      bookingCta: "Rezerviraj termin",
      orderEn: { singular: "Shop order", plural: "Shop orders" },
      ctaEn: "Book an appointment",
    }),
    forms: [],
    workflows: [],
    dashboardWidgets: ["todayAppointments", "revenue", "customers", "topServices", "recentOrders"],
    website: { ctaMode: "booking" },
    extensions: ["workspace-resources"],
    catalog: { seedVerticalId: "beauty" },
  },
  {
    id: "frizer",
    version: 1,
    label: "Frizerski salon",
    description: "Striženje, barvanje in oblikovanje las",
    palette: "amber",
    // P2 #36: schema.org @type — del definicije profila (en vir resnice).
    schemaType: "HairSalon",
    capabilities: salonCapabilities(),
    terminology: terms({
      businessSingular: "salon",
      businessIn: "v salonu",
      businessGenitive: "salona",
      businessEn: { singular: "salon", in: "at the salon", genitive: "the salon's" },
      orderSingular: "Spletno naročilo",
      orderPlural: "Spletna naročila",
      bookingCta: "Rezerviraj termin",
      orderEn: { singular: "Shop order", plural: "Shop orders" },
      ctaEn: "Book an appointment",
    }),
    forms: [],
    workflows: [],
    dashboardWidgets: ["todayAppointments", "revenue", "customers", "topServices", "recentOrders"],
    website: { ctaMode: "booking" },
    extensions: ["workspace-resources"],
    catalog: { seedVerticalId: "frizer" },
  },
  {
    id: "barber",
    version: 1,
    label: "Barber shop",
    description: "Moško striženje, brada, vroča brisača",
    palette: "charcoal",
    // P2 #36: schema.org @type — del definicije profila (en vir resnice).
    schemaType: "HairSalon",
    capabilities: salonCapabilities(),
    terminology: terms({
      businessSingular: "barber shop",
      businessIn: "v barber shopu",
      businessGenitive: "barber shopa",
      businessEn: { singular: "barber shop", in: "at the barber shop", genitive: "the barber shop's" },
      orderSingular: "Naročilo",
      orderPlural: "Naročila",
      bookingCta: "Rezerviraj termin",
      orderEn: { singular: "Order", plural: "Orders" },
      ctaEn: "Book an appointment",
    }),
    forms: [],
    workflows: [],
    dashboardWidgets: ["todayAppointments", "revenue", "customers", "topServices", "recentOrders"],
    website: { ctaMode: "booking" },
    extensions: ["workspace-resources"],
    catalog: { seedVerticalId: "barber" },
  },
  {
    id: "nails",
    version: 1,
    label: "Nail studio",
    description: "Manikira, pedikura in nail art",
    palette: "violet",
    // P2 #36: schema.org @type — del definicije profila (en vir resnice).
    schemaType: "NailSalon",
    capabilities: salonCapabilities(),
    terminology: terms({
      businessSingular: "salon",
      businessIn: "v salonu",
      businessGenitive: "salona",
      businessEn: { singular: "salon", in: "at the salon", genitive: "the salon's" },
      orderSingular: "Spletno naročilo",
      orderPlural: "Spletna naročila",
      bookingCta: "Rezerviraj termin",
      orderEn: { singular: "Shop order", plural: "Shop orders" },
      ctaEn: "Book an appointment",
    }),
    forms: [],
    workflows: [],
    dashboardWidgets: ["todayAppointments", "revenue", "customers", "topServices", "recentOrders"],
    website: { ctaMode: "booking" },
    extensions: ["workspace-resources"],
    catalog: { seedVerticalId: "nails" },
  },
  {
    id: "cosmetica",
    version: 1,
    label: "Kozmetični salon",
    description: "Tretmaji obraza, nega kože, make-up",
    palette: "burgundy",
    // P2 #36: schema.org @type — del definicije profila (en vir resnice).
    schemaType: "BeautySalon",
    capabilities: salonCapabilities(),
    terminology: terms({
      businessSingular: "salon",
      businessIn: "v salonu",
      businessGenitive: "salona",
      businessEn: { singular: "salon", in: "at the salon", genitive: "the salon's" },
      orderSingular: "Spletno naročilo",
      orderPlural: "Spletna naročila",
      bookingCta: "Rezerviraj termin",
      orderEn: { singular: "Shop order", plural: "Shop orders" },
      ctaEn: "Book an appointment",
    }),
    forms: [
      {
        key: "consultation",
        name: "Konzultacijski obrazec",
        description: "Vprašanja pred tretmajem: tip kože, alergije, cilji nege.",
        fields: [
          { key: "skin_type", label: "Tip kože", type: "select", required: true, options: ["Normalna", "Suha", "Mastna", "Kombinirana", "Občutljiva"] },
          { key: "allergies", label: "Alergije / občutljivosti", type: "textarea", required: false },
          { key: "goals", label: "Cilji nege", type: "textarea", required: false },
        ],
      },
    ],
    workflows: [],
    dashboardWidgets: ["todayAppointments", "revenue", "customers", "topServices", "recentOrders"],
    website: { ctaMode: "booking" },
    extensions: ["workspace-resources"],
    catalog: { seedVerticalId: "cosmetica" },
  },
  {
    id: "massage",
    version: 1,
    label: "Masaža & wellness",
    description: "Relax, športne in terapevtske masaže",
    palette: "emerald",
    // P2 #36: schema.org @type — del definicije profila (en vir resnice).
    schemaType: "DaySpa",
    capabilities: salonCapabilities(),
    terminology: terms({
      businessSingular: "salon",
      businessIn: "v salonu",
      businessGenitive: "salona",
      businessEn: { singular: "salon", in: "at the salon", genitive: "the salon's" },
      orderSingular: "Spletno naročilo",
      orderPlural: "Spletna naročila",
      bookingCta: "Rezerviraj termin",
      orderEn: { singular: "Shop order", plural: "Shop orders" },
      ctaEn: "Book an appointment",
    }),
    forms: [
      {
        key: "health-screening",
        name: "Zdravstveno vprašanje",
        description: "Kratka preiskava pred maso: poškodbe, bolečine, kontraindikacije.",
        fields: [
          { key: "injuries", label: "Poškodbe ali kronične težave", type: "textarea", required: false },
          { key: "pain_areas", label: "Območja bolečin", type: "text", required: false },
          { key: "intensity", label: "Željena intenzivnost", type: "select", required: true, options: ["Blaga", "Srednja", "Močna"] },
        ],
      },
    ],
    workflows: [],
    dashboardWidgets: ["todayAppointments", "revenue", "customers", "topServices", "recentOrders"],
    website: { ctaMode: "booking" },
    extensions: ["workspace-resources"],
    catalog: { seedVerticalId: "massage" },
  },
  {
    id: "epilation",
    version: 1,
    label: "Epilacija & laser",
    description: "Laser epilacija, voščanje",
    palette: "teal",
    // P2 #36: schema.org @type — del definicije profila (en vir resnice).
    schemaType: "BeautySalon",
    capabilities: salonCapabilities(),
    terminology: terms({
      businessSingular: "salon",
      businessIn: "v salonu",
      businessGenitive: "salona",
      businessEn: { singular: "salon", in: "at the salon", genitive: "the salon's" },
      orderSingular: "Spletno naročilo",
      orderPlural: "Spletna naročila",
      bookingCta: "Rezerviraj termin",
      orderEn: { singular: "Shop order", plural: "Shop orders" },
      ctaEn: "Book an appointment",
    }),
    forms: [],
    workflows: [],
    dashboardWidgets: ["todayAppointments", "revenue", "customers", "topServices", "recentOrders"],
    website: { ctaMode: "booking" },
    extensions: ["workspace-resources"],
    catalog: { seedVerticalId: "epilation" },
  },
  {
    id: "generic",
    version: 1,
    label: "Univerzalno",
    description: "Za podjetja z lastnim katalogom — vse zmogljivosti so izbirne",
    palette: "coral",
    // P2 #36: schema.org @type — del definicije profila (en vir resnice).
    schemaType: "LocalBusiness",
    capabilities: {
      appointments: "optional",
      workOrders: "optional",
      shop: "optional",
      services: "optional",
      inventory: "optional",
      customers: "required",
      staff: "optional",
      analytics: "required",
      reviews: "optional",
      forms: "optional",
      workflows: "optional",
      documents: "disabled",
      delivery: "optional",
    walkIn: "optional", // #98: modul je na voljo vsaki dejavnosti (AD-02)
    },
    terminology: terms({
      orderSingular: "Naročilo",
      orderPlural: "Naročila",
      bookingCta: "Kontaktiraj nas",
      orderEn: { singular: "Order", plural: "Orders" },
      ctaEn: "Contact us",
    }),
    forms: [],
    workflows: [],
    dashboardWidgets: ["revenue", "customers", "recentOrders", "topServices", "projects"],
    website: { ctaMode: "inquiry" },
    // E2-3: generic is THE template for multi-day-job businesses
    // (photographer, cleaner, consultant…) — the projects runtime
    // ships with this phase, so the extension is enabled here.
    extensions: ["projects"],
    catalog: { seedVerticalId: "generic" },
  },

  // --- §21 acceptance scenarios: genuinely different business models ---

  // SEAMSTRESS — production pipeline, no appointments (§21 decisive test).
  {
    id: "seamstress",
    version: 1,
    label: "Šiviljstvo",
    description: "Spremembe, popravila in šivanje po meri z merilnimi listi",
    palette: "teal",
    // P2 #36: schema.org @type — del definicije profila (en vir resnice).
    schemaType: "ProfessionalService",
    capabilities: {
      appointments: "disabled",
      workOrders: "required",
      shop: "optional",
      services: "required",
      inventory: "optional",
      customers: "required",
      staff: "required",
      analytics: "required",
      reviews: "disabled",
      forms: "required",
      workflows: "required",
      documents: "optional",
      delivery: "optional",
    walkIn: "optional", // #98: modul je na voljo vsaki dejavnosti (AD-02)
    },
    terminology: terms({
      businessSingular: "atelje",
      businessIn: "v ateljeju",
      businessGenitive: "ateljeja",
      businessEn: { singular: "studio", in: "at the studio", genitive: "the studio's" },
      appointmentSingular: "Srečanje",
      appointmentPlural: "Srečanja",
      orderSingular: "Delovno naročilo",
      orderPlural: "Delovna naročila",
      bookingCta: "Oddaj povpraševanje",
      orderEn: { singular: "Work order", plural: "Work orders" },
      ctaEn: "Send an inquiry",
    }),
    forms: [
      {
        key: "order-details",
        name: "Podrobnosti naročila",
        description: "Vrsta oblačila, material in želene spremembe.",
        fields: [
          { key: "garment_type", label: "Vrsta oblačila", type: "select", required: true, options: ["Hlače", "Suknja", "Srajca", "Jopa", "Obleka", "Plašč", "Drug"] },
          { key: "material", label: "Material (če prinaša svoj)", type: "text", required: false },
          { key: "modifications", label: "Želene spremembe / popravila", type: "textarea", required: true },
          { key: "deadline", label: "Želeni datum prevzema", type: "date", required: false },
        ],
      },
      {
        key: "measurements",
        name: "Merilni list",
        description: "Mere telesa za šivanje po meri (cm).",
        fields: [
          { key: "chest_cm", label: "Obseg prsi", type: "number", required: false, unit: "cm" },
          { key: "waist_cm", label: "Obseg pasu", type: "number", required: false, unit: "cm" },
          { key: "hips_cm", label: "Obseg bokov", type: "number", required: false, unit: "cm" },
          { key: "sleeve_cm", label: "Dolžina rokava", type: "number", required: false, unit: "cm" },
          { key: "inseam_cm", label: "Notranja dolžina hlač", type: "number", required: false, unit: "cm" },
        ],
      },
    ],
    workflows: [
      {
        key: "production-order",
        name: "Proizvodni proces naročila",
        entity: "order",
        stages: [
          { key: "inquiry", name: "Povpraševanje", description: "Stranka odda želje in mere." },
          { key: "measurements", name: "Meritve", description: "Snemanje merilnega lista." },
          { key: "quote", name: "Predračun", description: "Priprava predračuna z rokom." },
          { key: "approval", name: "Potrditev stranke", description: "Stranka potrdi ceno in rok." },
          { key: "production", name: "Izdelava", description: "Šivanje / spremembe v teku." },
          { key: "fitting", name: "Priblon", description: "Priblon in morebitne korekcije." },
          { key: "delivery", name: "Predaja", description: "Prevzem oziroma pošiljanje." },
          { key: "payment", name: "Plačilo", description: "Zaključek plačila." },
          { key: "done", name: "Zaključeno", isFinal: true },
        ],
      },
    ],
    dashboardWidgets: ["activeOrders", "deadlines", "pendingApprovals", "readyForDelivery", "revenue", "customers", "projects"],
    website: { ctaMode: "inquiry" },
    // E2-3: custom tailoring is multi-day project work — the
    // projects runtime ships with this phase.
    extensions: ["body-measurements", "projects"],
    catalog: { seedVerticalId: "seamstress" },
  },

  // TIRE SERVICE / VEHICLE WORKSHOP — bookings optional + work orders + parts.
  {
    id: "tire-service",
    version: 1,
    label: "Vulkanizer & avtoservis",
    description: "Menjava guma, servis vozil, deli in delovni nalogi",
    palette: "charcoal",
    // P2 #36: schema.org @type — del definicije profila (en vir resnice).
    schemaType: "AutoRepair",
    capabilities: {
      appointments: "optional", // e.g. seasonal tire-change bookings
      workOrders: "required",
      shop: "required", // tires & parts sales
      services: "required",
      inventory: "required",
      customers: "required",
      staff: "required",
      analytics: "required",
      reviews: "disabled",
      forms: "required",
      workflows: "required",
      documents: "optional",
      delivery: "disabled",
    walkIn: "optional", // #98: modul je na voljo vsaki dejavnosti (AD-02)
    },
    terminology: terms({
      businessSingular: "servis",
      businessIn: "v servisu",
      businessGenitive: "servisa",
      businessEn: { singular: "service centre", in: "at the service centre", genitive: "the service centre's" },
      appointmentSingular: "Termin menjave",
      appointmentPlural: "Termini menjave",
      orderSingular: "Delovni nalog",
      orderPlural: "Delovni nalogi",
      bookingCta: "Rezerviraj menjavo gum",
      orderEn: { singular: "Work order", plural: "Work orders" },
      ctaEn: "Book a tire change",
    }),
    forms: [
      {
        key: "vehicle-intake",
        name: "Sprejem vozila",
        description: "Podatki vozila in dimenzije gum ob sprejemu.",
        fields: [
          { key: "license_plate", label: "Registrska oznaka", type: "text", required: true },
          { key: "brand_model", label: "Znamka in model", type: "text", required: true },
          { key: "odometer_km", label: "Kilometri", type: "number", required: false, unit: "km" },
          { key: "tire_size", label: "Dimenzija gume (npr. 205/55 R16)", type: "text", required: true },
          { key: "tire_condition", label: "Stanje gum", type: "select", required: false, options: ["Odlično", "Dobro", "Za zamenjavo"] },
          { key: "requested_work", label: "Zahtevano delo", type: "textarea", required: true },
        ],
      },
    ],
    workflows: [
      {
        key: "work-order",
        name: "Delovni nalog",
        entity: "order",
        stages: [
          { key: "checkin", name: "Sprejem vozila", description: "Pregled in zapis stanja." },
          { key: "diagnostics", name: "Pregled / ponudba", description: "Diagnostika in ponudba dela." },
          { key: "approved", name: "Potrjeno", description: "Stranka potrdi obseg dela." },
          { key: "in_progress", name: "Delo v teku", description: "Tehnik izvaja delo." },
          { key: "done", name: "Zaključeno delo", description: "Kontrola kakovosti." },
          { key: "handover", name: "Prevzem in plačilo", description: "Razračun in izročitev vozila." },
          { key: "closed", name: "Oddano", isFinal: true },
        ],
      },
    ],
    dashboardWidgets: ["activeOrders", "deadlines", "todayAppointments", "revenue", "lowStock", "customers"],
    website: { ctaMode: "booking" },
    extensions: ["vehicle-workshop", "suppliers"],
    catalog: { seedVerticalId: "tire-service" },
  },

  // BEEKEEPING — product/production business, NO appointments (§21).
  {
    id: "beekeeping",
    version: 1,
    label: "Čebelarstvo",
    description: "Med in čebelji izdelki: žetev, serije, zaloge in prodaja",
    palette: "amber",
    // P2 #36: schema.org @type — del definicije profila (en vir resnice).
    schemaType: "Store",
    capabilities: {
      appointments: "disabled",
      workOrders: "disabled",
      shop: "required",
      services: "disabled",
      inventory: "required",
      customers: "required",
      staff: "disabled",
      analytics: "required",
      reviews: "optional",
      forms: "optional",
      workflows: "disabled",
      documents: "optional",
      delivery: "optional",
    walkIn: "optional", // #98: modul je na voljo vsaki dejavnosti (AD-02)
    },
    terminology: terms({
      businessSingular: "čebelarstvo",
      businessIn: "v čebelarstvu",
      businessGenitive: "čebelarstva",
      businessEn: { singular: "farm", in: "at the farm", genitive: "the farm's" },
      appointmentSingular: "Srečanje",
      appointmentPlural: "Srečanja",
      orderSingular: "Naročilo",
      orderPlural: "Naročila",
      serviceSingular: "Izdelek",
      servicePlural: "Izdelki",
      productSingular: "Izdelek",
      productPlural: "Izdelki",
      bookingCta: "Naroči izdelke",
      orderEn: { singular: "Order", plural: "Orders" },
      ctaEn: "Order products",
    }),
    forms: [
      {
        key: "harvest-record",
        name: "Zapis žetve",
        description: "Evidence žetve medu po panjski postaji.",
        fields: [
          { key: "harvest_date", label: "Datum žetve", type: "date", required: true },
          { key: "apiary", label: "Panjska postaja", type: "text", required: true },
          { key: "honey_type", label: "Vrsta medu", type: "select", required: true, options: ["Cvetlični", "Lipov", "Gozdni", "Akačijski"] },
          { key: "quantity_kg", label: "Količina", type: "number", required: true, unit: "kg" },
          { key: "notes", label: "Opombe", type: "textarea", required: false },
        ],
      },
    ],
    workflows: [],
    dashboardWidgets: ["revenue", "recentOrders", "lowStock", "customers"],
    website: { ctaMode: "order" },
    extensions: ["batch-production", "suppliers"],
    catalog: { seedVerticalId: "beekeeping" },
  },
]

// ------------------------------------------------------------
// Validation + accessors
// ------------------------------------------------------------

function validateProfiles(list: ActivityProfile[]): Record<string, ActivityProfile> {
  const out: Record<string, ActivityProfile> = {}
  const referencedExtensions = new Set<string>()
  for (const profile of list) {
    const parsed = profileSchema.safeParse(profile)
    if (!parsed.success) {
      throw new Error(
        `[profiles] Invalid profile "${profile.id}": ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
      )
    }
    if (out[profile.id]) throw new Error(`[profiles] Duplicate profile id: ${profile.id}`)
    out[profile.id] = profile
    profile.extensions.forEach((e) => referencedExtensions.add(e))
  }
  for (const extId of referencedExtensions) {
    if (!EXTENSIONS[extId]) throw new Error(`[profiles] Profile references unknown extension: ${extId}`)
  }
  return out
}

export const PROFILES: Record<string, ActivityProfile> = validateProfiles(PROFILE_LIST)

/** Universal fallback: never assume salon-specific behavior (§21). */
export const GENERIC_PROFILE_ID = "generic"

export function getProfile(id: string | null | undefined): ActivityProfile {
  if (id && PROFILES[id]) return PROFILES[id]
  return PROFILES[GENERIC_PROFILE_ID]
}

export function listProfiles(): ActivityProfile[] {
  return PROFILE_LIST
}

/** Client-safe options for pickers (onboarding, admin selectors). */
export function listProfileOptions(): ProfileOption[] {
  return PROFILE_LIST.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    palette: p.palette,
  }))
}

/**
 * Whether a capability is surfaced in the UI.
 * "disabled" never renders anywhere; "required"/"optional" render.
 */
export function isCapabilityEnabled(profile: ActivityProfile, key: CapabilityKey): boolean {
  return profile.capabilities[key] !== "disabled"
}

/** Terminology lookup for a locale. */
export function term(
  profile: ActivityProfile,
  key: keyof ActivityProfile["terminology"],
  locale: "sl" | "en"
): string {
  const entry = profile.terminology[key]
  return locale === "en" ? entry.en : entry.sl
}

export type { ActivityProfile, CapabilityMatrix, CapabilityState, CapabilityKey, ProfileOption }
