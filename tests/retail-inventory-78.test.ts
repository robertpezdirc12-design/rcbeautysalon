// ============================================================
// #78 — RETAIL LAYER: VAT, barcode, brand, unit, forSale,
// reorderPoint, DELIVERY/STOCKTAKE movements, scalable list.
//
// Two layers, like every batch in this repo:
//   1. PURE logic — low-stock helper (one threshold resolver used
//      by the stats card, the table and the dashboard widget).
//   2. SOURCE assertions — the structural guarantees: schema has
//      the fields, the list query paginates, the delivery and
//      stock-take flows write their OWN movement sources, and no
//      hardcoded `<= 10` survives anywhere.
// ============================================================

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  resolveReorderPoint,
  stockTone,
  isLowStock,
  FALLBACK_REORDER_POINT,
} from "@/lib/inventory/low-stock"
import { vatFromGross, SI_VAT_RATE } from "@/lib/vat"

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8")
const schema = read("prisma/schema.prisma")

// ------------------------------------------------------------
// 1. PURE — low-stock helper (the ONE place "low" is defined)
// ------------------------------------------------------------

describe("#78 resolveReorderPoint — per-product wins", () => {
  it("uses the product threshold when present", () => {
    expect(resolveReorderPoint(3, 10)).toBe(3)
    expect(resolveReorderPoint(40, 10)).toBe(40)
  })

  it("falls back to the org default when the product has none", () => {
    expect(resolveReorderPoint(null, 40)).toBe(40)
    expect(resolveReorderPoint(undefined, 40)).toBe(40)
  })

  it("falls back to the safe constant when nothing is set", () => {
    expect(resolveReorderPoint(null, null)).toBe(FALLBACK_REORDER_POINT)
    expect(resolveReorderPoint(undefined, undefined)).toBe(FALLBACK_REORDER_POINT)
  })

  it("rejects invalid numbers instead of trusting them", () => {
    expect(resolveReorderPoint(NaN, 10)).toBe(10)
    expect(resolveReorderPoint(-5, 10)).toBe(10)
    expect(resolveReorderPoint(null, NaN)).toBe(FALLBACK_REORDER_POINT)
  })
})

describe("#78 stockTone — one definition of low, shared by card + table", () => {
  it("out at zero, low within the threshold, ok above it", () => {
    expect(stockTone(0, 10)).toBe("out")
    expect(stockTone(1, 10)).toBe("low")
    expect(stockTone(10, 10)).toBe("low")
    expect(stockTone(11, 10)).toBe("ok")
  })

  it("a 40-unit threshold colours 12 as low (the reorder-at-40 tenant)", () => {
    expect(isLowStock(12, 40)).toBe(true)
    expect(isLowStock(12, 10)).toBe(false)
  })

  it("a 3-unit threshold leaves 12 fine (the reorder-at-3 tenant)", () => {
    expect(isLowStock(4, 3)).toBe(false)
    expect(isLowStock(2, 3)).toBe(true)
  })
})

// ------------------------------------------------------------
// 2. SCHEMA — the retail fields exist, per tenant
// ------------------------------------------------------------

describe("#78 schema — Product retail layer", () => {
  it("has barcode, brand, unit, vatRate, forSale and reorderPoint", () => {
    expect(schema).toMatch(/model Product \{[\s\S]*?barcode\s+String\?/)
    expect(schema).toMatch(/model Product \{[\s\S]*?brand\s+String\?/)
    expect(schema).toMatch(/model Product \{[\s\S]*?unit\s+String\s+@default\("kos"\)/)
    expect(schema).toMatch(/model Product \{[\s\S]*?vatRate\s+Decimal\? @db\.Decimal\(5, 2\)/)
    expect(schema).toMatch(/model Product \{[\s\S]*?forSale\s+Boolean\s+@default\(true\)/)
    expect(schema).toMatch(/model Product \{[\s\S]*?reorderPoint\s+Int\?/)
  })

  it("keeps barcode unique PER TENANT (same rule as SKU #77)", () => {
    expect(schema).toMatch(/@@unique\(\[organizationId, barcode\]\)/)
  })

  it("indexes the org × forSale pair (public shop filter)", () => {
    expect(schema).toMatch(/@@index\(\[organizationId, forSale\]\)/)
  })

  it("StockMovementSource gained DELIVERY, STOCKTAKE and RETURN", () => {
    expect(schema).toMatch(
      /enum StockMovementSource \{[\s\S]*?MANUAL[\s\S]*?ORDER[\s\S]*?DELIVERY[\s\S]*?STOCKTAKE[\s\S]*?RETURN[\s\S]*?\}/
    )
  })

  it("SalonConfig has the org default reorder point", () => {
    expect(schema).toMatch(/defaultReorderPoint\s+Int\s+@default\(10\)/)
  })
})

// ------------------------------------------------------------
// 3. SOURCE — the list SCALES (take/skip, filters, sorting)
// ------------------------------------------------------------

describe("#78 getAdminProducts — the list must scale", () => {
  const products = read("src/app/actions/products.ts")

  it("paginates: take/skip from perPage (25) and page", () => {
    expect(products).toContain("take: perPage")
    expect(products).toContain("skip: (page - 1) * perPage")
    expect(products).toContain("ADMIN_PRODUCTS_PER_PAGE = 25")
  })

  it("returns a count for paging, not just rows", () => {
    expect(products).toContain("totalPages")
    expect(products).toMatch(/prisma\.product\.count\(\{ where \}\)/)
  })

  it("supports category, stock and inactive filters", () => {
    expect(products).toContain('q.stock === "out"')
    expect(products).toContain('q.stock === "low"')
    expect(products).toContain('q.stock === "inactive"')
    expect(products).toContain("q.categoryId")
  })

  it("supports sorting by name, price and stock (fixed createdAt no longer the only order)", () => {
    expect(products).toMatch(/q\.sort === "name"/)
    expect(products).toMatch(/q\.sort === "price"/)
    expect(products).toMatch(/q\.sort === "stock"/)
  })

  it("searches barcode and brand too", () => {
    expect(products).toMatch(/barcode: \{ contains: q\.search/)
    expect(products).toMatch(/brand: \{ contains: q\.search/)
  })
})

// ------------------------------------------------------------
// 4. SOURCE — the hardcoded 10 is GONE (one helper everywhere)
// ------------------------------------------------------------

describe("#78 — no duplicated low-stock constant survives", () => {
  it("products.ts stats use the helper, not lte: 10", () => {
    const products = read("src/app/actions/products.ts")
    expect(products).toContain("isLowStock(")
    expect(products).toContain("resolveReorderPoint(")
    expect(products).not.toMatch(/lte: 10/)
  })

  it("the products table colour resolves through stockTone", () => {
    const page = read("src/app/(admin)/dashboard/products/page.tsx")
    expect(page).toContain("stockTone(")
    expect(page).not.toMatch(/<= 10/)
  })

  it("the dashboard widget agrees (same helper)", () => {
    const inventory = read("src/app/actions/inventory.ts")
    expect(inventory).toContain("isLowStock(")
    expect(inventory).not.toMatch(/stockQuantity: \{ (gt|lte): 10/)
  })
})

// ------------------------------------------------------------
// 5. SOURCE — delivery + stock take are real flows, not manual edits
// ------------------------------------------------------------

describe("#78 recordDelivery — one event, N movements, source DELIVERY", () => {
  const inventory = read("src/app/actions/inventory.ts")

  it("writes source DELIVERY rows sharing the document reference", () => {
    expect(inventory).toMatch(/source: "DELIVERY"/)
    expect(inventory).toContain('`Dobava ${data.documentNumber.trim()}`')
  })

  it("is one transaction for the whole delivery", () => {
    // recordDelivery must run inside prisma.$transaction (its own, below MANUAL).
    const deliveryBody = inventory.slice(inventory.indexOf("export async function recordDelivery"))
    expect(deliveryBody).toContain("prisma.$transaction")
  })

  it("rejects untracked products and foreign product ids", () => {
    const deliveryBody = inventory.slice(inventory.indexOf("export async function recordDelivery"))
    expect(deliveryBody).toContain('"NOT_TRACKED"')
    expect(deliveryBody).toContain('"NOT_FOUND"')
  })
})

describe("#78 submitStockTake — only the deltas, source STOCKTAKE", () => {
  const inventory = read("src/app/actions/inventory.ts")

  it("writes source STOCKTAKE rows", () => {
    expect(inventory).toMatch(/source: "STOCKTAKE"/)
  })

  it("skips zero deltas (no noise in the ledger)", () => {
    const body = inventory.slice(inventory.indexOf("export async function submitStockTake"))
    expect(body).toContain("if (delta === 0) continue")
  })

  it("derives the direction from the sign of the delta", () => {
    const body = inventory.slice(inventory.indexOf("export async function submitStockTake"))
    expect(body).toMatch(/delta > 0 \? "IN" : "OUT"/)
  })

  it("is reversible by a second count — state update and ledger row happen together", () => {
    const body = inventory.slice(inventory.indexOf("export async function submitStockTake"))
    expect(body).toContain("prisma.$transaction")
    expect(body).toContain("stockQuantity: computed.nextStock")
  })
})

// ------------------------------------------------------------
// 6. SOURCE — VAT is honest: per-product rate, gross prices
// ------------------------------------------------------------

describe("#78 VAT — per-product rate in checkout, forSale gate", () => {
  const checkout = read("src/app/actions/product-checkout.ts")
  const publicSite = read("src/lib/public-site.ts")

  it("tax breaks down per line with the product's own rate", () => {
    expect(checkout).toMatch(/product\.vatRate && product\.vatRate\.toNumber\(\) > 0/)
    expect(checkout).toContain("vatFromGross(item.price * item.quantity, rate)")
  })

  it("checkout only accepts sellable products (forSale)", () => {
    expect(checkout).toContain("forSale: true")
  })

  it("the public shop hides back-bar products (forSale filter)", () => {
    expect(publicSite).toMatch(/getPublicShopProducts[\s\S]*?forSale: true/)
  })

  it("the gross math still holds: vatFromGross(65, 22%) = 11.72", () => {
    // Regression guard: prices stay GROSS — the tax number is informational.
    expect(vatFromGross(65, SI_VAT_RATE)).toBeCloseTo(11.7213, 4)
    expect(vatFromGross(0)).toBe(0)
  })
})

// ------------------------------------------------------------
// 7. SOURCE — the form exposes the retail fields
// ------------------------------------------------------------

describe("#78 product form — the owner can actually set them", () => {
  const form = read("src/components/dashboard/product-form.tsx")

  it("has inputs for barcode, brand, unit, vatRate and reorderPoint", () => {
    for (const field of ["barcode", "brand", "unit", "vatRate", "reorderPoint"]) {
      expect(form).toMatch(new RegExp(`id="${field}"`))
    }
  })

  it("has the forSale switch (distinct from trackInventory)", () => {
    expect(form).toMatch(/setValue\("forSale", checked\)/)
    expect(form).toMatch(/name="forSale"/)
  })

  it("clearing vatRate/reorderPoint on update writes null (not a stuck old value)", () => {
    expect(form).toMatch(/vatRate: parsed\.data\.vatRate \?\? null/)
    expect(form).toMatch(/reorderPoint: parsed\.data\.reorderPoint \?\? null/)
  })
})

// ------------------------------------------------------------
// 8. SOURCE — stocktake screen exists
// ------------------------------------------------------------

describe("#78 stocktake page — /dashboard/products/stocktake", () => {
  it("the page exists and is permission-guarded", () => {
    const page = read("src/app/(admin)/dashboard/products/stocktake/page.tsx")
    expect(page).toContain('requirePagePermission("products.manage")')
    expect(page).toContain("StocktakeClient")
  })

  it("only tracked products are countable", () => {
    const page = read("src/app/(admin)/dashboard/products/stocktake/page.tsx")
    expect(page).toContain("trackInventory: true")
  })

  it("the client shows system vs counted with a live delta", () => {
    const client = read("src/components/dashboard/stocktake-client.tsx")
    expect(client).toContain("submitStockTake")
    expect(client).toMatch(/n - p\.stockQuantity/)
  })
})
