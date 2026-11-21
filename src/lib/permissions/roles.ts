/**
 * Custom roles (EPIC #4 G8) — permission catalog and PURE helpers.
 *
 * A custom role RESTRICTS an org member to an explicit permission set
 * ("admin brez financ", "senior frizer"). Users WITHOUT a custom role
 * keep the legacy ADMIN/STAFF behaviour unchanged — see
 * `effectivePermissionKeys` for the exact rule.
 *
 * This module is pure (no DB, no React) so the catalog and the
 * permission matrix stay unit-testable by design.
 */

/** Every permission the platform knows about. Adding a new guarded
 *  feature = add a key here + gate the sidebar item / page / action. */
export const PERMISSION_KEYS = [
  "appointments.view",
  "appointments.manage",
  "customers.manage",
  "services.manage",
  "products.manage",
  "orders.manage",
  "workorders.manage",
  "inquiries.manage",
  "staff.manage",
  "analytics.view",
  "finances.view",
  // F5.5.4.1 — pisanje/izdajanje dokumentov (računov, ponudb). `finances.view`
  // ostane samo-bralni pregled; brez tega ključa član ne more ustvariti,
  // urediti, izdati ali preklicati dokumenta (ločitev read/write).
  "finances.documents.manage",
  // F5.5.4.2 — ločena dovoljenja za plačila in dobropise dokumentov.
  "finances.documents.pay",
  "finances.documents.credit",
  "settings.manage",
  // F5.1: upravljanje popustov in promocij.
  "promotions.manage",
  // F5.5.4.6.5 (varnost #1318): upravljanje e-računskih kanalov in poverilnic
  // (povezave, certifikati, zasebni ključi) — ločeno od SAMO-BRALNEGA
  // `finances.view`, da branje ni nikoli isto kot pravica za spreminjanje
  // zunanjih povezav in tajnih materialov.
  "einvoices.channels.manage",
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export interface PermissionMeta {
  key: PermissionKey
  /** Slovenian label shown in the role editor. */
  label: string
}

export interface PermissionGroup {
  id: string
  label: string
  permissions: PermissionMeta[]
}

/** Catalog grouped for the role editor UI (and its a11y labels). */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "booking",
    label: "Termini in katalog",
    permissions: [
      { key: "appointments.view", label: "Vid termine" },
      { key: "appointments.manage", label: "Urejanje terminov" },
      { key: "services.manage", label: "Urejanje storitev" },
      { key: "workorders.manage", label: "Urejanje delovnih naročil" },
    ],
  },
  {
    id: "shop",
    label: "Trgovina",
    permissions: [
      { key: "products.manage", label: "Urejanje izdelkov" },
      { key: "orders.manage", label: "Urejanje spletnih naročil" },
      { key: "promotions.manage", label: "Urejanje popustov in promocij" },
    ],
  },
  {
    id: "people",
    label: "Stranke in osebje",
    permissions: [
      { key: "customers.manage", label: "Urejanje strank" },
      { key: "staff.manage", label: "Urejanje osebja" },
    ],
  },
  {
    id: "office",
    label: "Pisarna",
    permissions: [
      { key: "inquiries.manage", label: "Urejanje povpraševanj in obrazcev" },
      { key: "analytics.view", label: "Vid analitiko" },
      { key: "finances.view", label: "Vid finance (dokumenti, plačila)" },
      { key: "finances.documents.manage", label: "Izdaja in urejanje dokumentov (računi, ponudbe)" },
      { key: "finances.documents.pay", label: "Knjižba plačil dokumentov" },
      { key: "finances.documents.credit", label: "Izdaja dobropisov" },
      { key: "settings.manage", label: "Urejanje nastavitev salona" },
      { key: "einvoices.channels.manage", label: "Upravljanje e-računskih kanalov in poverilnic" },
    ],
  },
]

/** All keys flat — convenience for checks and the "select all" toggle. */
export const ALL_PERMISSION_KEYS: PermissionKey[] = [...PERMISSION_KEYS]

/** True when the array only contains known keys (used by the zod refine). */
export function isValidPermissionSet(value: unknown): value is PermissionKey[] {
  return (
    Array.isArray(value) &&
    value.every(
      (key) =>
        typeof key === "string" &&
        (PERMISSION_KEYS as readonly string[]).includes(key)
    )
  )
}

/** Coerce untrusted JSON (DB `permissions` column) into a valid key list. */
export function permissionsFromJson(value: unknown): PermissionKey[] {
  if (!isValidPermissionSet(value)) return []
  return [...value]
}

/**
 * Effective permission keys for a member.
 *
 * Rule (G8): a custom role RESTRICTS; without one the legacy behaviour is
 * byte-for-byte preserved — ADMIN sees everything, STAFF keeps today's
 * full dashboard access (until the owner opts them into a custom role),
 * CLIENTE gets nothing from the admin surface.
 */
export function effectivePermissionKeys(input: {
  role: "ADMIN" | "STAFF" | "CLIENTE"
  customRolePermissions: unknown
}): PermissionKey[] {
  if (input.customRolePermissions !== undefined && input.customRolePermissions !== null) {
    return permissionsFromJson(input.customRolePermissions)
  }
  if (input.role === "ADMIN" || input.role === "STAFF") {
    return [...ALL_PERMISSION_KEYS]
  }
  return []
}

/** Pure matrix check — the single decision point tests can target. */
export function hasPermission(
  keys: PermissionKey[],
  key: PermissionKey
): boolean {
  return keys.includes(key)
}

/**
 * True when the key set covers EVERYTHING the platform knows about.
 * Only unrestricted admins may escalate: create ADMIN accounts or
 * administer the custom-roles catalog itself (E4-6b). A restricted
 * admin ("admin brez financ") must never be able to grant permissions
 * they do not hold.
 */
export function hasAllPermissions(keys: PermissionKey[]): boolean {
  return ALL_PERMISSION_KEYS.every((key) => keys.includes(key))
}
