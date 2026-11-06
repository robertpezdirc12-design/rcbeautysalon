// ============================================================
// EPIC #4 E4-4 — ONBOARDING WIZARD DRAFT (SERIALIZATION LOGIC)
// Pure-rule tests: the draft never contains a password (structural
// whitelist), stale/malformed/tampered drafts fail closed, unknown
// ids are rejected against the registry allowlist, resume never
// lands further than the saved data allows, and a throwing
// storage can never break the wizard.
// ============================================================

import { describe, it, expect } from "vitest"

import {
  WIZARD_DRAFT_KEY,
  WIZARD_DRAFT_TTL_MS,
  WIZARD_DRAFT_VERSION,
  clearDraftRaw,
  isDraftSubstantial,
  parseWizardDraft,
  readDraftRaw,
  safeResumeStep,
  sanitizeWizardDraftData,
  serializeWizardDraft,
  writeDraftRaw,
  type DraftStorageLike,
  type WizardDraftData,
} from "../../src/lib/onboarding/wizard-draft"

const CTX_BASE = {
  allowedVerticalIds: ["frizer", "nail", "kozmetika"],
  allowedPaletteIds: ["rose", "amber"],
} as const

const T0 = 1_700_000_000_000

function makeStorage(initial?: Record<string, string>) {
  const map = new Map(Object.entries(initial ?? {}))
  const storage: DraftStorageLike & { map: Map<string, string> } = {
    map,
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
  return storage
}

function fullDraft(overrides?: Partial<WizardDraftData>): WizardDraftData {
  return {
    step: 3,
    vertical: "frizer",
    secondary: null,
    palette: "rose",
    name: "Studio Nika",
    contactPhone: "",
    slug: "studio-nika",
    slugTouched: true,
    ownerName: "Nika Novak",
    email: "nika@studionika.si",
    teamSize: null,
    onlineBooking: null,
    skdCodes: [],
    customTags: [],
    verticalSkipped: false,
    ...overrides,
  }
}

describe("serialize → parse round-trip (E4-4)", () => {
  it("preserves every field of a substantial draft", () => {
    const draft = fullDraft()
    const json = serializeWizardDraft(draft, { ...CTX_BASE, now: T0 })
    const res = parseWizardDraft(json, { ...CTX_BASE, now: T0 + 1000 })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.envelope.version).toBe(WIZARD_DRAFT_VERSION)
    expect(res.envelope.savedAt).toBe(T0)
    expect(res.envelope.data).toEqual(draft)
  })

  it("survives storage round-trip through the adapter", () => {
    const storage = makeStorage()
    writeDraftRaw(storage, WIZARD_DRAFT_KEY, serializeWizardDraft(fullDraft(), { ...CTX_BASE, now: T0 }))
    const raw = readDraftRaw(storage, WIZARD_DRAFT_KEY)
    const res = parseWizardDraft(raw, { ...CTX_BASE, now: T0 + 60_000 })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.envelope.data.slug).toBe("studio-nika")
  })
})

describe("passwords can never reach the draft (E4-4 hard rule)", () => {
  it("drops a smuggled password property from the serialized payload", () => {
    const smuggled = { ...fullDraft(), password: "hunter2", confirmPassword: "hunter2" }
    const json = serializeWizardDraft(smuggled as unknown as WizardDraftData, {
      ...CTX_BASE,
      now: T0,
    })
    const parsed = JSON.parse(json) as { data: Record<string, unknown> }
    expect(parsed.data.password).toBeUndefined()
    expect(parsed.data.confirmPassword).toBeUndefined()
    expect(json).not.toContain("hunter2")
  })

  it("drops a smuggled password when parsing a stored envelope", () => {
    const envelope = {
      version: WIZARD_DRAFT_VERSION,
      savedAt: T0,
      data: { ...fullDraft(), password: "hunter2" },
    }
    const res = parseWizardDraft(JSON.stringify(envelope), { ...CTX_BASE, now: T0 + 1000 })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect((res.envelope.data as unknown as Record<string, unknown>).password).toBeUndefined()
  })
})

describe("sanitize caps and allowlists (E4-4)", () => {
  it("clamps strings to the field caps", () => {
    const data = sanitizeWizardDraftData(
      {
        name: "n".repeat(200),
        slug: "s".repeat(100),
        ownerName: "o".repeat(150),
        email: "e".repeat(300),
      },
      CTX_BASE
    )
    expect(data.name).toHaveLength(60)
    expect(data.slug).toHaveLength(40)
    expect(data.ownerName).toHaveLength(80)
    expect(data.email).toHaveLength(120)
  })

  it("rejects unknown vertical/palette ids (fail closed, not guessed)", () => {
    const data = sanitizeWizardDraftData(
      { vertical: "no-such-vertical", palette: "no-such-palette", secondary: "frizer" },
      CTX_BASE
    )
    expect(data.vertical).toBeNull()
    expect(data.palette).toBeNull()
    expect(data.secondary).toBe("frizer")
  })

  it("keeps the E2-4 invariant: secondary must differ from primary", () => {
    const data = sanitizeWizardDraftData({ vertical: "frizer", secondary: "frizer" }, CTX_BASE)
    expect(data.secondary).toBeNull()
  })

  it("clamps the step into 1..3", () => {
    expect(sanitizeWizardDraftData({ step: 99 }, CTX_BASE).step).toBe(3)
    expect(sanitizeWizardDraftData({ step: 0 }, CTX_BASE).step).toBe(1)
    expect(sanitizeWizardDraftData({ step: 2.7 }, CTX_BASE).step).toBe(2)
  })
})

describe("P2 #88 — second-level answers in the draft", () => {
  it("round-trips valid answers", () => {
    const draft = fullDraft({ teamSize: "solo", onlineBooking: "no" })
    const json = serializeWizardDraft(draft, { ...CTX_BASE, now: T0 })
    const res = parseWizardDraft(json, { ...CTX_BASE, now: T0 + 1000 })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.envelope.data.teamSize).toBe("solo")
    expect(res.envelope.data.onlineBooking).toBe("no")
  })

  it("rejects tampered answer values (fail closed, not guessed)", () => {
    const data = sanitizeWizardDraftData(
      { teamSize: "medium", onlineBooking: "maybe", extra: 42 },
      CTX_BASE
    )
    expect(data.teamSize).toBeNull()
    expect(data.onlineBooking).toBeNull()
  })

  it("older drafts without the answer keys degrade to null (backward compatible)", () => {
    const legacyEnvelope = {
      version: WIZARD_DRAFT_VERSION,
      savedAt: T0,
      data: { ...fullDraft(), teamSize: undefined, onlineBooking: undefined },
    }
    const res = parseWizardDraft(JSON.stringify(legacyEnvelope), { ...CTX_BASE, now: T0 + 1000 })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.envelope.data.teamSize).toBeNull()
    expect(res.envelope.data.onlineBooking).toBeNull()
  })

  it("answers alone are not 'substantial' progress (vertical/name still gate the resume offer)", () => {
    const answersOnly = fullDraft({
      vertical: null,
      palette: null,
      name: "",
      slug: "",
      slugTouched: false,
      ownerName: "",
      email: "",
      teamSize: "small",
      onlineBooking: "yes",
    })
    expect(isDraftSubstantial(answersOnly)).toBe(false)
  })
})

describe("isDraftSubstantial (E4-4 honest resume)", () => {
  it("an all-empty draft is never offered for resume", () => {
    const empty: WizardDraftData = {
      step: 1,
      vertical: null,
      secondary: null,
      palette: null,
      name: "",
      contactPhone: "",
      slug: "",
      slugTouched: false,
      ownerName: "",
      email: "",
      teamSize: null,
      onlineBooking: null,
      skdCodes: [],
      customTags: [],
      verticalSkipped: false,
    }
    expect(isDraftSubstantial(empty)).toBe(false)
  })

  it("whitespace-only fields are not progress", () => {
    const draft = fullDraft({ name: "   ", ownerName: "  ", email: " " })
    // vertical still present → substantial; but with everything blanked it must be false
    const blanked = fullDraft({
      vertical: null,
      palette: null,
      name: "  ",
      slug: "",
      slugTouched: false,
      ownerName: " ",
      email: "",
    })
    expect(isDraftSubstantial(blanked)).toBe(false)
    expect(isDraftSubstantial(draft)).toBe(true)
  })

  it("a single meaningful field counts as progress", () => {
    expect(isDraftSubstantial(fullDraft({ vertical: "nail" }))).toBe(true)
    expect(isDraftSubstantial(fullDraft({ name: "St" }))).toBe(true)
  })
})

describe("parseWizardDraft fail-closed (E4-4)", () => {
  it("treats null/undefined/empty storage as no draft", () => {
    expect(parseWizardDraft(null, { ...CTX_BASE, now: T0 })).toEqual({ ok: false, reason: "empty" })
    expect(parseWizardDraft(undefined, { ...CTX_BASE, now: T0 })).toEqual({ ok: false, reason: "empty" })
    expect(parseWizardDraft("", { ...CTX_BASE, now: T0 })).toEqual({ ok: false, reason: "empty" })
  })

  it("treats unparsable JSON as malformed", () => {
    expect(parseWizardDraft("{not json", { ...CTX_BASE, now: T0 })).toEqual({
      ok: false,
      reason: "malformed",
    })
    expect(parseWizardDraft("42", { ...CTX_BASE, now: T0 })).toEqual({ ok: false, reason: "malformed" })
  })

  it("rejects a foreign version outright", () => {
    const envelope = { version: 999, savedAt: T0, data: fullDraft() }
    expect(parseWizardDraft(JSON.stringify(envelope), { ...CTX_BASE, now: T0 + 1 })).toEqual({
      ok: false,
      reason: "invalid",
    })
  })

  it("rejects a missing/NaN savedAt as malformed", () => {
    const envelope = { version: WIZARD_DRAFT_VERSION, data: fullDraft() }
    expect(parseWizardDraft(JSON.stringify(envelope), { ...CTX_BASE, now: T0 })).toEqual({
      ok: false,
      reason: "malformed",
    })
  })

  it("a draft within the TTL parses; an expired one is stale", () => {
    const json = serializeWizardDraft(fullDraft(), { ...CTX_BASE, now: T0 })
    const fresh = parseWizardDraft(json, { ...CTX_BASE, now: T0 + WIZARD_DRAFT_TTL_MS - 1000 })
    expect(fresh.ok).toBe(true)
    const expired = parseWizardDraft(json, { ...CTX_BASE, now: T0 + WIZARD_DRAFT_TTL_MS + 1000 })
    expect(expired).toEqual({ ok: false, reason: "stale" })
  })

  it("an implausible future savedAt (tampered/imported) is stale, within skew is fine", () => {
    const json = serializeWizardDraft(fullDraft(), { ...CTX_BASE, now: T0 })
    const skewed = parseWizardDraft(json, { ...CTX_BASE, now: T0 - 4 * 60 * 1000 })
    expect(skewed.ok).toBe(true)
    const tampered = parseWizardDraft(json, { ...CTX_BASE, now: T0 - 60 * 60 * 1000 })
    expect(tampered).toEqual({ ok: false, reason: "stale" })
  })

  it("a non-object data payload is invalid", () => {
    const envelope = { version: WIZARD_DRAFT_VERSION, savedAt: T0, data: "nonsense" }
    expect(parseWizardDraft(JSON.stringify(envelope), { ...CTX_BASE, now: T0 })).toEqual({
      ok: false,
      reason: "invalid",
    })
  })
})

describe("safeResumeStep (E4-4 honest resume)", () => {
  it("never lands past step 1 without a vertical", () => {
    expect(safeResumeStep(fullDraft({ vertical: null, step: 3 }))).toBe(1)
  })

  it("never lands on step 3 without a usable name+slug", () => {
    expect(safeResumeStep(fullDraft({ name: "", step: 3 }))).toBe(2)
    expect(safeResumeStep(fullDraft({ slug: "", slugTouched: false, step: 3 }))).toBe(2)
    expect(safeResumeStep(fullDraft({ name: "S", step: 3 }))).toBe(2)
  })

  it("allows the saved step when the data supports it", () => {
    expect(safeResumeStep(fullDraft({ step: 3 }))).toBe(3)
    expect(safeResumeStep(fullDraft({ step: 2 }))).toBe(2)
    expect(safeResumeStep(fullDraft({ step: 1 }))).toBe(1)
  })

  it("clamps an out-of-range saved step", () => {
    expect(safeResumeStep(fullDraft({ step: 99 }))).toBe(3)
  })
})

describe("storage adapter is best-effort (E4-4)", () => {
  it("a throwing storage never breaks the wizard", () => {
    const hostile: DraftStorageLike = {
      getItem: () => {
        throw new Error("SecurityError: blocked")
      },
      setItem: () => {
        throw new Error("QuotaExceededError")
      },
      removeItem: () => {
        throw new Error("SecurityError: blocked")
      },
    }
    expect(readDraftRaw(hostile, WIZARD_DRAFT_KEY)).toBeNull()
    expect(() =>
      writeDraftRaw(hostile, WIZARD_DRAFT_KEY, serializeWizardDraft(fullDraft(), { ...CTX_BASE, now: T0 }))
    ).not.toThrow()
    expect(() => clearDraftRaw(hostile, WIZARD_DRAFT_KEY)).not.toThrow()
  })
})
