// ============================================================
// #91 — OZNAKE STRANK (segmenti v1)
// Čista sanitizacija + org-scoped urejanje + strežniški segment
// filter na OBEH tabelah (registrirane stranke + linke).
// ============================================================

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { sanitizeCustomerTags, MAX_TAGS, MAX_TAG_LENGTH } from "../src/lib/customers/tags"

const read = (p: string) =>
  readFileSync(__dirname + "/../" + p, "utf8").replace(/\r\n/g, "\n")

describe("#91 sanitizeCustomerTags (čista logika)", () => {
  it("trim + prazne odstranjene + dedupe", () => {
    expect(sanitizeCustomerTags(["  VIP ", "rdeča", "VIP", "", "  "])).toEqual([
      "VIP",
      "rdeča",
    ])
  })

  it("ne-nizi in ne-polja degradirajo v prazen seznam (fail-closed)", () => {
    expect(sanitizeCustomerTags(["ok", 42, null, {}])).toEqual(["ok"])
    expect(sanitizeCustomerTags("VIP")).toEqual([])
    expect(sanitizeCustomerTags(undefined)).toEqual([])
  })

  it("omejitve: max dolžina oznake in max število oznak", () => {
    const long = "x".repeat(100)
    const [first] = sanitizeCustomerTags([long])
    expect(first).toHaveLength(MAX_TAG_LENGTH)

    const many = Array.from({ length: 30 }, (_, i) => `tag-${i}`)
    expect(sanitizeCustomerTags(many)).toHaveLength(MAX_TAGS)
  })
})

describe("#91 akcije: org-scoped in segmentni filter", () => {
  const actions = read("src/app/actions/users.ts")

  it("urejanje oznak poišče Customer Z org filtrom (tujca ne more urediti)", () => {
    expect(actions).toContain(
      "where: { id: customerId, organizationId: org.id },"
    )
  })

  it("segmentni filter dela prek customer.tags.has (users) in tags.has (leads)", () => {
    expect(actions).toContain("customer: { tags: { has: tag.trim() } }")
    expect(actions).toContain("{ tags: { has: tag.trim() } }")
  })

  it("page poda tag v OBE poizvedbi (registrirane + linke)", () => {
    const page = read("src/app/(admin)/dashboard/users/page.tsx")
    expect(page).toContain("getAdminUsers(search, tag)")
    expect(page).toContain("getCustomerLeads(search, tag)")
    expect(page).toContain("getCustomerTagOptions()")
  })

  it("revalidatePath osveži seznam po shranjevanju", () => {
    expect(actions).toContain('revalidatePath("/dashboard/users")')
  })
})
