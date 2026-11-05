// ============================================================
// E2-1 — capability extension registry tests (EPIC #2 §3/E2-1)
// Locks the acceptance criteria in place:
//   • the 5 new capability extensions load through zod
//     (import itself asserts structural validity — fail fast);
//   • dependency declarations reference only REAL universal
//     capability keys (typed dependencies, z.enum at load);
//   • extensions WITHOUT a shipped runtime are enabled by NO
//     existing profile — every tenant keeps today's experience
//     (default disabled); a runtime phase flips its own id to
//     live and MOVES it out of DORMANT here (E2-2 suppliers,
//     E2-3 projects);
//   • referenced ⊆ defined + unique ids + non-empty entities.
// ============================================================

import { describe, it, expect } from "vitest"
import { EXTENSIONS, CAPABILITY_KEYS } from "@/lib/profiles/extensions"
import { listProfiles } from "@/lib/profiles/registry"
import type { CapabilityMatrix } from "@/lib/profiles/types"

const E21_IDS = [
  "projects",
  "multi-location",
  "memberships",
  "suppliers",
  "delivery-runtime",
] as const

describe("E2-1 — capability extension registry", () => {
  it("registers the 5 new capability extensions (zod-validated at load)", () => {
    for (const id of E21_IDS) {
      expect(EXTENSIONS[id], `missing extension ${id}`).toBeDefined()
    }
  })

  it("extensions without a shipped runtime are enabled by NO existing profile", () => {
    // E2-1 delivered the declarations; runtimes arrive phase by phase.
    // `suppliers` became live in E2-2 (inventory runtime), `projects`
    // in E2-3 — the rest must stay dormant until their phase ships.
    const DORMANT = ["multi-location", "memberships", "delivery-runtime"] as const
    for (const profile of listProfiles()) {
      for (const id of DORMANT) {
        expect(
          profile.extensions,
          `${profile.id} unexpectedly enables "${id}"`
        ).not.toContain(id)
      }
    }
  })

  it("dependency declarations reference only real universal capabilities", () => {
    for (const ext of Object.values(EXTENSIONS)) {
      expect(ext.capabilities.length, `${ext.id} must declare dependencies`).toBeGreaterThan(0)
      for (const cap of ext.capabilities) {
        expect(
          (CAPABILITY_KEYS as readonly string[]).includes(cap),
          `${ext.id} depends on unknown capability "${cap}"`
        ).toBe(true)
      }
    }
  })

  it("profiles reference only defined extensions (referenced ⊆ defined)", () => {
    for (const profile of listProfiles()) {
      for (const extId of profile.extensions) {
        expect(EXTENSIONS[extId], `${profile.id} → unknown ${extId}`).toBeDefined()
      }
    }
  })

  it("extension ids are unique and every entity has non-empty fields", () => {
    const ids = Object.keys(EXTENSIONS)
    expect(new Set(ids).size).toBe(ids.length)
    for (const ext of Object.values(EXTENSIONS)) {
      expect(ext.entities.length, ext.id).toBeGreaterThan(0)
      for (const entity of ext.entities) {
        expect(entity.fields.length, `${ext.id}.${entity.key}`).toBeGreaterThan(0)
      }
    }
  })

  it("entity keys are unique within each new extension", () => {
    for (const id of E21_IDS) {
      const ext = EXTENSIONS[id]!
      const keys = ext.entities.map((e) => e.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it("CAPABILITY_KEYS covers exactly the universal CapabilityMatrix (sync lock)", () => {
    // Compile-time `satisfies readonly CapabilityKey[]` guards soundness;
    // this locks completeness — a 14th capability must be added here too.
    const matrixKeys = Object.keys({
      appointments: 0,
      workOrders: 0,
      shop: 0,
      services: 0,
      inventory: 0,
      customers: 0,
      staff: 0,
      analytics: 0,
      reviews: 0,
      forms: 0,
      workflows: 0,
      documents: 0,
      delivery: 0,
      walkIn: 0, // #98: 15. capability (AD-02)
    } satisfies Record<keyof CapabilityMatrix, number>)
    expect([...CAPABILITY_KEYS].sort()).toEqual(matrixKeys.sort())
  })
})

describe("E2-1 — dependency matrix of the new extensions", () => {
  const EXPECTED: Record<(typeof E21_IDS)[number], readonly string[]> = {
    projects: ["workOrders", "customers"],
    "multi-location": ["customers", "appointments"],
    memberships: ["customers", "shop"],
    suppliers: ["inventory"],
    "delivery-runtime": ["shop", "delivery"],
  }

  it("each new extension declares exactly its planned dependencies", () => {
    for (const [id, caps] of Object.entries(EXPECTED)) {
      expect([...EXTENSIONS[id]!.capabilities].sort(), id).toEqual([...caps].sort())
    }
  })
})

describe("E2-2 — suppliers extension runtime enablement", () => {
  // E2-2 ships the inventory runtime and enables `suppliers` on the
  // inventory-REQUIRED profiles — the supplier picker in the stock
  // movement ledger reads exactly these registry entries.
  it("inventory-required profiles enable the suppliers extension", () => {
    for (const id of ["tire-service", "beekeeping"]) {
      const profile = listProfiles().find((p) => p.id === id)!
      expect(profile.capabilities.inventory, id).toBe("required")
      expect(
        profile.extensions,
        `${id} must enable "suppliers" (E2-2)`
      ).toContain("suppliers")
    }
  })

  it("profiles WITHOUT inventory still do not enable suppliers", () => {
    for (const profile of listProfiles()) {
      if (profile.capabilities.inventory === "required") continue
      expect(
        profile.extensions,
        `${profile.id} unexpectedly enables suppliers`
      ).not.toContain("suppliers")
    }
  })
})

describe("E2-3 — projects extension runtime enablement", () => {
  // E2-3 ships the projects runtime and enables `projects` exactly on
  // the profiles whose scenario is a multi-day job: `generic` (the
  // photographer/cleaner/consultant template) and `seamstress`
  // (custom tailoring). Every other profile keeps today's experience.
  it("generic and seamstress enable the projects extension", () => {
    for (const id of ["generic", "seamstress"]) {
      const profile = listProfiles().find((p) => p.id === id)!
      expect(
        profile.extensions,
        `${id} must enable "projects" (E2-3)`
      ).toContain("projects")
    }
  })

  it("profiles OTHER than generic/seamstress do not enable projects", () => {
    for (const profile of listProfiles()) {
      if (profile.id === "generic" || profile.id === "seamstress") continue
      expect(
        profile.extensions,
        `${profile.id} unexpectedly enables projects`
      ).not.toContain("projects")
    }
  })

  it("projects-enabling profiles keep the extension's dependencies enabled", () => {
    // The `projects` extension declares workOrders + customers as its
    // dependencies — a profile enabling it must never disable them.
    for (const profile of listProfiles()) {
      if (!profile.extensions.includes("projects")) continue
      expect(profile.capabilities.workOrders, profile.id).not.toBe("disabled")
      expect(profile.capabilities.customers, profile.id).not.toBe("disabled")
    }
  })
})
