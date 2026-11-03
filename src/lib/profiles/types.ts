// ============================================================
// ACTIVITY PROFILE ENGINE — types (EPIC #1)
// Client-safe: NO server-only imports (prisma, fs, …).
// A profile determines the COMPLETE business experience:
// capabilities, terminology, forms, workflows, dashboard,
// website CTA mode and enabled extensions — not just looks.
// ============================================================

/** State of a universal capability inside an activity profile. */
export type CapabilityState = "required" | "optional" | "disabled"

/** Universal core capabilities every profile must declare (§21 critical rule). */
export interface CapabilityMatrix {
  /** Appointment-based booking (staff time slots, durations, calendar). */
  appointments: CapabilityState
  /** Work orders with configurable workflow stages (production/service jobs). */
  workOrders: CapabilityState
  /** Online shop with products, cart and checkout. */
  shop: CapabilityState
  /** Catalog of services. */
  services: CapabilityState
  /** Stock/inventory tracking for products. */
  inventory: CapabilityState
  /** Customer database and history. */
  customers: CapabilityState
  /** Employees / team management. */
  staff: CapabilityState
  /** Reports and statistics. */
  analytics: CapabilityState
  /** Customer reviews on services. */
  reviews: CapabilityState
  /** Dynamic form builder + submissions. */
  forms: CapabilityState
  /** Configurable workflow engine. */
  workflows: CapabilityState
  /** Quotes/invoices/documents (Phase 4+). */
  documents: CapabilityState
  /** Delivery / shipping (Phase 4+). */
  delivery: CapabilityState
}

export type CapabilityKey = keyof CapabilityMatrix

export interface TerminologyEntry {
  sl: string
  en: string
}

/** Industry terminology overriding generic labels per profile. */
export interface TerminologySet {
  appointmentSingular: TerminologyEntry
  appointmentPlural: TerminologyEntry
  orderSingular: TerminologyEntry
  orderPlural: TerminologyEntry
  serviceSingular: TerminologyEntry
  servicePlural: TerminologyEntry
  productSingular: TerminologyEntry
  productPlural: TerminologyEntry
  customerSingular: TerminologyEntry
  customerPlural: TerminologyEntry
  /** Primary call-to-action label on the public site. */
  bookingCta: TerminologyEntry
}

export type ProfileFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "checkbox"

/** A single dynamic form field definition. */
export interface ProfileFieldDef {
  key: string
  label: string
  type: ProfileFieldType
  required: boolean
  /** For type "select": allowed values. */
  options?: string[]
  /** Suffix unit, e.g. "cm", "kg". */
  unit?: string
  /** Placeholder / helper text. */
  placeholder?: string
}

export interface ProfileFormTemplate {
  key: string // stable, e.g. "order-details"
  name: string
  description: string
  fields: ProfileFieldDef[]
}

export interface ProfileWorkflowStage {
  key: string
  name: string
  description?: string
  slaHours?: number
  isFinal?: boolean
}

export interface ProfileWorkflowTemplate {
  key: string
  name: string
  /** Which universal entity the workflow drives. */
  entity: "order" | "appointment" | string
  stages: ProfileWorkflowStage[]
}

export type DashboardWidgetKey =
  | "todayAppointments"
  | "revenue"
  | "customers"
  | "topServices"
  | "recentOrders"
  | "lowStock"
  | "activeOrders"
  | "deadlines"
  | "pendingApprovals"
  | "readyForDelivery"
  | "projects" // E2-3 — multi-day jobs overview (projects extension)

/** How the public site's primary CTA behaves for this activity. */
export type WebsiteCtaMode = "booking" | "inquiry" | "order" | "quote"

export interface ActivityProfile {
  id: string
  /** Semver-ish integer; bumped when the definition materially changes. */
  version: number
  label: string
  description: string
  /** Default palette id (appearance layer, see src/lib/verticals.ts). */
  palette: string
  /** schema.org @type za JSON-LD LocalBusiness (#36) — iz registrja, ne
   * iz ločene preslikave, da ne moreta raziti. */
  schemaType: string
  capabilities: CapabilityMatrix
  terminology: TerminologySet
  forms: ProfileFormTemplate[]
  workflows: ProfileWorkflowTemplate[]
  /** Which dashboard widgets make sense for this activity. */
  dashboardWidgets: DashboardWidgetKey[]
  website: { ctaMode: WebsiteCtaMode }
  /** Enabled extension ids — see src/lib/profiles/extensions.ts. */
  extensions: string[]
  /** Sample catalog preset id (appearance/seed layer). */
  catalog: { seedVerticalId: string }
}

/** Client-safe picker option (onboarding wizard, admin selectors). */
export interface ProfileOption {
  id: string
  label: string
  description: string
  palette: string
}
