// ============================================================
// #98 (AD-02) — WALK-IN VRSTA (regresijska varovala)
// Čista jedra (pozicija iz vrstnega reda, prehodi, kode) + vrata:
// capability walkIn v vseh profilih, javna stran 404 ob izklopu,
// akcije org-scoped, proxy dovoljuje golo /vrsta samo z glavo.
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  canTransition,
  generateTicketCode,
  pickNextToServe,
  queuePosition,
  sanitizeWalkInInput,
  waitingQueue,
} from "../src/lib/walkin/queue"
import { listProfileOptions, isCapabilityEnabled, getProfile } from "../src/lib/profiles/registry"
import { applyOverrides } from "../src/lib/profiles/overrides"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

const entry = (
  id: string,
  status: "WAITING" | "SERVING" | "SERVED" | "LEFT",
  createdAt: string
) => ({ id, status, createdAt })

describe("#98 čista jedra: pozicija iz vrstnega reda (brez shranjevanja)", () => {
  const rows = [
    entry("c", "WAITING", "2026-11-05T10:20:00Z"),
    entry("a", "WAITING", "2026-11-05T10:00:00Z"),
    entry("s", "SERVING", "2026-11-05T09:50:00Z"),
    entry("b", "WAITING", "2026-11-05T10:10:00Z"),
    entry("d", "LEFT", "2026-11-05T09:55:00Z"),
  ]

  it("čakajoči urejeni po prijavi: a(1), b(2), c(3); SERVING/LEFT izven", () => {
    const q = waitingQueue(rows)
    expect(q.map((e) => e.id)).toEqual(["a", "b", "c"])
    expect(queuePosition(rows, "a")).toBe(1)
    expect(queuePosition(rows, "c")).toBe(3)
    expect(queuePosition(rows, "s")).toBeNull()
    expect(queuePosition(rows, "d")).toBeNull()
    expect(queuePosition(rows, "neobstaja")).toBeNull()
  })

  it("naslednji na potezi = najstarejši WAITING", () => {
    expect(pickNextToServe(rows)?.id).toBe("a")
    expect(pickNextToServe([entry("x", "SERVED", "2026-01-01T00:00:00Z")])).toBeNull()
  })
})

describe("#98 prehodi statusov (strogi, brez preskokov nazaj)", () => {
  it("WAITING→SERVING/LEFT dovoljena; SERVING→SERVED/LEFT dovoljena", () => {
    expect(canTransition("WAITING", "SERVING")).toBe(true)
    expect(canTransition("WAITING", "LEFT")).toBe(true)
    expect(canTransition("SERVING", "SERVED")).toBe(true)
    expect(canTransition("SERVING", "LEFT")).toBe(true)
  })

  it("vse ostale poti zavrnjene (SERVED/LEFT so končne, brez nazaj)", () => {
    expect(canTransition("SERVED", "WAITING")).toBe(false)
    expect(canTransition("LEFT", "SERVING")).toBe(false)
    expect(canTransition("WAITING", "SERVED")).toBe(false)
    expect(canTransition("SERVING", "WAITING")).toBe(false)
  })
})

describe("#98 kode vstopnic in sanitizacija javnega vnosa", () => {
  it("6 znakov iz alfabeta brez dvoumnih (ni 0/O/1/I/L/S/5)", () => {
    for (let i = 0; i < 20; i += 1) {
      const code = generateTicketCode()
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
    }
    expect(generateTicketCode()).not.toBe(generateTicketCode())
  })

  it("ime obvezno (2–60), telefon opcionalen (min 3) — ne-nizi varno", () => {
    expect(sanitizeWalkInInput({ name: "  Ana  ", phone: "040 123 456" })).toEqual({
      name: "Ana",
      phone: "040 123 456",
    })
    expect(sanitizeWalkInInput({ name: "A", phone: 42 })).toEqual({ name: "A", phone: null })
    expect(sanitizeWalkInInput({ name: null, phone: "12" })).toEqual({ name: "", phone: null })
    const long = sanitizeWalkInInput({ name: "x".repeat(100), phone: undefined })
    expect(long.name.length).toBe(60)
  })
})

describe("#98 vrata: capability walkIn na voljo VSEM profilom (AD-02)", () => {
  it("walkIn je optional v vseh 11 profilih (izklopljiv, ne izgubljen)", () => {
    for (const option of listProfileOptions()) {
      const profile = getProfile(option.id)
      expect(profile.capabilities.walkIn, option.id).toBe("optional")
      expect(isCapabilityEnabled(profile, "walkIn"), option.id).toBe(true)
    }
  })

  it("izklop prek overrides pravi dejansko izklop (applyOverrides — isti sloj kot resolveEffectiveProfile)", () => {
    const overridden = applyOverrides(getProfile("beauty"), {
      v: 1,
      capabilityStates: { walkIn: "disabled" },
    })
    expect(isCapabilityEnabled(overridden, "walkIn")).toBe(false)
  })
})

describe("#98 struktura: javna stran, akcije, proxy, navigacija", () => {
  it("javna stran: izklopljen modul = pravi notFound (§5.2)", () => {
    const page = read("src/app/(public)/vrsta/page.tsx")
    expect(page).toContain("resolveEffectiveProfile(site.org)")
    expect(page).toContain("if (!isCapabilityEnabled(profile, \"walkIn\")) notFound()")
  })

  it("akcije: javna prijava prek resolveWalkInOrg (org + capability), staff prek guarda", () => {
    const actions = read("src/app/actions/walk-in.ts")
    expect(actions).toContain("getResolvedOrg()")
    expect(actions).toContain("requirePermissionOrg(\"appointments.manage\")")
    expect(actions).toContain("organizationId: org.id, status: \"WAITING\"")
    expect(actions).toContain("generateTicketCode()")
  })

  it("proxy: gola /vrsta je javna pot (z glavo najemnika; brez = 404 kot doslej)", () => {
    const proxy = read("src/proxy.ts")
    expect(proxy).toContain("inquiry|vrsta")
  })

  it("sidebar + i18n: vhod vhodno-viden samo z zmožnostjo walkIn", () => {
    const sidebar = read("src/components/admin/sidebar.tsx")
    expect(sidebar).toContain('nameKey: "walkIn", href: "/dashboard/walk-in"')
    const common = read("src/lib/i18n/dict/common.ts")
    expect(common).toContain('walkIn: "Walk-in vrsta"')
    expect(common).toContain('walkIn: "Walk-in queue"')
  })

  it("shema: WalkInEntry org-scoped, ticketCode unikaten, brez shranjene pozicije", () => {
    const schema = read("prisma/schema.prisma")
    const block = schema.slice(
      schema.indexOf("model WalkInEntry"),
      schema.indexOf("}", schema.indexOf("model WalkInEntry"))
    )
    expect(block).toContain("model WalkInEntry")
    expect(block).toContain("ticketCode     String       @unique")
    expect(block).not.toMatch(/position\s+Int/)
  })
})
