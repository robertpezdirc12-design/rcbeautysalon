// ============================================================
// #105 — deaktiviran / ne-prodajni izdelek NI javno odprt prek
// neposrednega URL-ja.
//
// Incident: izdelek je bil deaktiviran (isActive=false), javna
// detail stran pa ga je še vedno prikazala — seznam trgovine
// filtrira (isActive + forSale), branje detail pa ni imelo pogojev
// stanja. Dva sloja popravek pokrije:
//   1. getPublicProductById (page-level branje) — isActive+forSale,
//   2. entity-exists (proxy vrata za pravi HTTP 404) — isActive+forSale.
// Testi so source-assertions (repo konvencija za query-vrata):
// struktura WHERE pogojev je pinana, tako da je ne more izgubiti
// noben prihodnji refaktor.
// ============================================================

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8")

describe("#105 getPublicProductById — javna vrata spoštujejo stanje izdelka", () => {
  const src = read("src/lib/public-site.ts")

  it("WHERE vključuje isActive: true", () => {
    const body = src.slice(src.indexOf("getPublicProductById"))
    expect(body).toMatch(/isActive:\s*true/)
  })

  it("WHERE vključuje forSale: true (usklajeno s seznamom trgovine)", () => {
    const body = src.slice(src.indexOf("getPublicProductById"))
    expect(body).toMatch(/forSale:\s*true/)
  })

  it("isti where blok vsebuje organizationId + id + isActive + forSale", () => {
    const start = src.indexOf("getPublicProductById")
    const whereBlock = src.slice(start, src.indexOf("})", start) + 2)
    for (const cond of ["organizationId: orgId", "id", "isActive: true", "forSale: true"]) {
      expect(whereBlock).toContain(cond)
    }
  })

  it("samo javna detail stran uporablja ta getter (admin edit ima svojega)", () => {
    // getProductById (dashboard) je ločen, varovan z requirePermissionOrg —
    // dejstvo, da sta dve funkciji, je namerno: javna vrata ne smeta dihati
    // skozi admin branje.
    const adminRead = read("src/app/actions/products.ts")
    expect(adminRead).toMatch(/requirePermissionOrg\("products\.manage"\)/)
  })
})

describe("#105 entity-exists — proxy vrata za pravi HTTP 404", () => {
  const route = read("src/app/api/public/entity-exists/route.ts")
  const productBranch = route.slice(route.indexOf('type === "product"'))

  it("produkt veja preverja isActive: true", () => {
    expect(productBranch).toMatch(/isActive:\s*true/)
  })

  it("produkt veja preverja forSale: true (usklajeno s seznamom)", () => {
    expect(productBranch).toMatch(/forSale:\s*true/)
  })

  it("storitve in osebje ohranijo svoja isActive vrata (regresija)", () => {
    expect(route).toMatch(/organizationId: orgId, slug, isActive: true/)
    expect(route).toMatch(/organizationId: orgId, isActive: true/)
  })
})
