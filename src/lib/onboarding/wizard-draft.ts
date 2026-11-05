// ============================================================
// ONBOARDING WIZARD DRAFT (EPIC #4 E4-4 — CLIENT-SIDE PURE CORE)
//
// "Save progress and resume onboarding later" (#3 §2).
//
// Contract (docs/EPIC-4/PLAN.md E4-4):
//  - the draft lives ONLY in the browser (localStorage, per browser
//    profile) — no server draft, no anonymous DB rows (decision log:
//    /start runs BEFORE login/tenant creation, a server draft would
//    need anonymous records + a GDPR layer; localStorage + TTL +
//    delete-on-success is proportionate to the risk);
//  - PASSWORDS ARE NEVER PART OF THE DRAFT — the data shape has no
//    password field and the serializer whitelists keys, so a
//    smuggled property can never reach storage;
//  - drafts expire (TTL) and are removed after a tenant is created,
//    so the next person on the same browser starts clean;
//  - every read is defensive: malformed, stale or tampered drafts
//    are treated as absent (fail-closed), never as partial truth;
//  - resume never lands further than the saved data actually allows
//    (a saved "step 3" without a vertical/name cannot submit an
//    incomplete organization).
// ============================================================

export const WIZARD_DRAFT_KEY = "rc_onboarding_draft_v1"
export const WIZARD_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
export const WIZARD_DRAFT_VERSION = 1

/** Small clock-skew allowance: a slightly-future savedAt is tolerated. */
const CLOCK_SKEW_MS = 5 * 60 * 1000

import { SKD_AREA_KEYS, SKD_SECTION_CODES } from "@/lib/skd/catalog"

// F1 #100 — SKD katalog je čista podatkovna datoteka (varna na odjemalcu);
// draft preslikuje izbire prek istih allowlist kot panoge.
const ALLOWED_SKD_CODES: readonly string[] = [
  ...SKD_SECTION_CODES,
  ...[...SKD_AREA_KEYS].map((k) => `area:${k}`),
]

/**
 * The persisted shape — deliberately WITHOUT password/confirmPassword.
 * Everything here is non-secret onboarding context the owner already
 * typed into the wizard.
 */
export interface WizardDraftData {
  step: number
  vertical: string | null
  secondary: string | null
  palette: string | null
  name: string
  slug: string
  slugTouched: boolean
  ownerName: string
  email: string
  /** P2 #88 — team-size answer (null = not answered / older draft). */
  teamSize: "solo" | "small" | "team" | null
  /** P2 #88 — online-booking answer (null = not answered / older draft). */
  onlineBooking: "yes" | "no" | null
  /**
   * F1 #100 — SKD 2025 izbira (nasvet): sekcije "A".."V" + področja
   * "area:<key>"; lastne oznake; ekspliciten preskok dejavnosti.
   * Starejši drafti brez teh polj se preslikajo v prazno/ne-skočeno.
   */
  skdCodes: string[]
  customTags: string[]
  verticalSkipped: boolean
}

export interface WizardDraftEnvelope {
  version: number
  savedAt: number
  data: WizardDraftData
}

export type WizardDraftParseReason =
  | "empty" // nothing stored
  | "malformed" // unparsable JSON / wrong envelope types
  | "stale" // expired or implausible timestamps
  | "invalid" // wrong version / shape / unknown ids

export type WizardDraftParseResult =
  | { ok: true; envelope: WizardDraftEnvelope }
  | { ok: false; reason: WizardDraftParseReason }

/** Field caps mirror the wizard inputs (maxLength) — storage never grows unbounded. */
const CAPS = {
  step: 3,
  name: 60,
  slug: 40,
  ownerName: 80,
  email: 120,
  skdCodes: 10,
  skdCode: 20, // sekcija "A".."V" oz. "area:<key>" (najdaljši ključ 17)
  customTags: 10,
  customTag: 40,
} as const

export interface WizardDraftContext {
  now: number
  allowedVerticalIds: readonly string[]
  allowedPaletteIds: readonly string[]
}

function clampString(value: unknown, cap: number): string {
  return typeof value === "string" ? value.slice(0, cap) : ""
}

function optionalId(value: unknown, allowed: readonly string[] | null): string | null {
  return typeof value === "string" &&
    value.length > 0 &&
    (allowed === null || allowed.includes(value))
    ? value
    : null
}

/** P2 #88 — whitelist one of the literal answer values, else null. */
function optionalAnswer<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null
}

/**
 * Whitelist + clamp raw draft-shaped input. Unknown keys (including any
 * smuggled password-like property) are structurally dropped — only the
 * fields of WizardDraftData can ever survive.
 */
export function sanitizeWizardDraftData(
  raw: unknown,
  ctx: Pick<WizardDraftContext, "allowedVerticalIds" | "allowedPaletteIds">
): WizardDraftData {
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {}
  const stepRaw =
    typeof obj.step === "number" && Number.isFinite(obj.step) ? Math.floor(obj.step) : 1
  const step = Math.min(Math.max(stepRaw, 1), CAPS.step)
  const vertical = optionalId(obj.vertical, ctx.allowedVerticalIds)
  const palette = optionalId(obj.palette, ctx.allowedPaletteIds)
  let secondary = optionalId(obj.secondary, ctx.allowedVerticalIds)
  // E2-4 invariant: the secondary activity must differ from the primary.
  if (secondary !== null && secondary === vertical) secondary = null
  // F1 #100 — SKD izbire: whitelist proti katalogu, cap števila/dolžine.
  const skdCodes = clampCodeList(obj.skdCodes, CAPS.skdCodes, CAPS.skdCode, ALLOWED_SKD_CODES)
  const customTags = clampStringList(obj.customTags, CAPS.customTags, CAPS.customTag)
  return {
    step,
    vertical,
    secondary,
    palette,
    name: clampString(obj.name, CAPS.name),
    slug: clampString(obj.slug, CAPS.slug),
    slugTouched: obj.slugTouched === true,
    ownerName: clampString(obj.ownerName, CAPS.ownerName),
    email: clampString(obj.email, CAPS.email),
    // P2 #88 — same answer shape the guided-entry wizard persists on the
    // organization; older drafts (and tampered values) degrade to null.
    teamSize: optionalAnswer(obj.teamSize, ["solo", "small", "team"] as const),
    onlineBooking: optionalAnswer(obj.onlineBooking, ["yes", "no"] as const),
    skdCodes,
    customTags,
    verticalSkipped: obj.verticalSkipped === true && vertical === null,
  }
}

/** Whitelist + cap seznam kod (F1) — neznane/tujе vrednosti strukturno padejo. */
function clampCodeList(value: unknown, maxCount: number, maxLen: number, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const raw of value.slice(0, maxCount)) {
    if (typeof raw !== "string") continue
    const v = raw.slice(0, maxLen)
    if (allowed.includes(v) && !out.includes(v)) out.push(v)
  }
  return out
}

/** Cap seznam prostih oznak (F1 customTags) — samo nizi, dolžina + dedup. */
function clampStringList(value: unknown, maxCount: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const raw of value.slice(0, maxCount)) {
    if (typeof raw !== "string") continue
    const v = raw.trim().slice(0, maxLen)
    if (v && !out.includes(v)) out.push(v)
  }
  return out
}

/**
 * A draft is worth offering a resume for only when the owner actually
 * made progress — an all-empty draft is never surfaced as "Nadaljuj".
 */
export function isDraftSubstantial(data: WizardDraftData): boolean {
  return Boolean(
    data.vertical ||
      data.palette ||
      data.name.trim().length > 0 ||
      data.slug.trim().length > 0 ||
      data.ownerName.trim().length > 0 ||
      data.email.trim().length > 0 ||
      // F1 #100 — preskok in SKD izbira sta tudi pravi napredek.
      data.verticalSkipped ||
      data.skdCodes.length > 0 ||
      data.customTags.length > 0
  )
}

export function serializeWizardDraft(data: WizardDraftData, ctx: WizardDraftContext): string {
  // Re-sanitize on write: storage only ever receives whitelist data.
  const clean = sanitizeWizardDraftData(data, ctx)
  const envelope: WizardDraftEnvelope = {
    version: WIZARD_DRAFT_VERSION,
    savedAt: Math.floor(ctx.now),
    data: clean,
  }
  return JSON.stringify(envelope)
}

export function parseWizardDraft(
  raw: string | null | undefined,
  ctx: WizardDraftContext
): WizardDraftParseResult {
  if (raw === null || raw === undefined || raw === "") return { ok: false, reason: "empty" }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: "malformed" }
  }
  if (typeof parsed !== "object" || parsed === null) return { ok: false, reason: "malformed" }
  const env = parsed as Record<string, unknown>
  if (env.version !== WIZARD_DRAFT_VERSION) return { ok: false, reason: "invalid" }
  const savedAt =
    typeof env.savedAt === "number" && Number.isFinite(env.savedAt)
      ? Math.floor(env.savedAt)
      : Number.NaN
  if (Number.isNaN(savedAt)) return { ok: false, reason: "malformed" }
  // Expired, or implausible future (tampered / imported) — both fail closed.
  if (savedAt > ctx.now + CLOCK_SKEW_MS) return { ok: false, reason: "stale" }
  if (ctx.now - savedAt > WIZARD_DRAFT_TTL_MS) return { ok: false, reason: "stale" }
  if (typeof env.data !== "object" || env.data === null) return { ok: false, reason: "invalid" }
  const data = sanitizeWizardDraftData(env.data, ctx)
  return { ok: true, envelope: { version: WIZARD_DRAFT_VERSION, savedAt, data } }
}

/**
 * The wizard may only land on a step whose earlier requirements are met.
 * Honest resume: never further than the saved data allows.
 */
export function safeResumeStep(data: WizardDraftData): number {
  // F1 #100: preskok dejavnosti je veljavna pot naprej — kot izbrana panoga.
  if (!data.vertical && !data.verticalSkipped) return 1
  if (data.name.trim().length < 2 || data.slug.trim().length < 2) {
    return Math.min(data.step, 2)
  }
  return Math.min(data.step, CAPS.step)
}

// ------------------------------------------------------------
// Storage adapter — the StorageLike is injected so the logic is
// testable without a DOM, and every quota/security error is
// swallowed: draft persistence is best-effort by design, a
// throwing storage must never break /start.
// ------------------------------------------------------------

export interface DraftStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function readDraftRaw(storage: DraftStorageLike, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

export function writeDraftRaw(storage: DraftStorageLike, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch {
    // Quota exceeded / privacy mode — the wizard keeps working without a draft.
  }
}

export function clearDraftRaw(storage: DraftStorageLike, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    // Ignore — nothing else to do.
  }
}
