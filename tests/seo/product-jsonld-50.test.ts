// ============================================================
// P3 #50 — Product/Offer JSON-LD
//
// Strani izdelkov so prej izpisale SAMO najemniški LocalBusiness blok
// — brez cene, razpoložljivosti in SKU, torej brez Product rich
// results. Ta test zaklene strukturo ponudbe (cena kot "12.50",
// valuta EUR, availability iz stockQuantity, absolutna slika, URL).
// ============================================================

import { describe, it, expect } from "vitest"
import { buildProductJsonLd } from "@/lib/seo"

const ORG = { name: "QA Čebelar Test", slug: "qa-cebelar-test" }
const APP_URL = "https://rcbeautysalon-phi.vercel.app"

const BASE_PRODUCT = {
  id: "prod-1",
  name: "Med s sivko 450 g",
  description: "Temni cvetlični med …",
  sku: "MED-SIV-450",
  price: 12.5,
  compareAtPrice: 15,
  images: ["/api/media/abc"],
  stockQuantity: 24,
}

describe("#50 — buildProductJsonLd", () => {
  it("emits Product with Offer: price, currency, availability, sku, url", () => {
    const ld = buildProductJsonLd({
      org: ORG,
      product: BASE_PRODUCT,
      appUrl: APP_URL,
      indexable: true,
    })
    expect(ld).not.toBeNull()
    expect(ld!["@type"]).toBe("Product")
    expect(ld!["name"]).toBe("Med s sivko 450 g")
    expect(ld!["sku"]).toBe("MED-SIV-450")
    const offers = ld!["offers"] as Record<string, unknown>
    expect(offers["@type"]).toBe("Offer")
    expect(offers["price"]).toBe("12.50")
    expect(offers["priceCurrency"]).toBe("EUR")
    expect(offers["availability"]).toBe("https://schema.org/InStock")
    expect(offers["url"]).toBe(`${APP_URL}/s/${ORG.slug}/shop/prod-1`)
    expect(ld!["image"]).toEqual([`${APP_URL}/api/media/abc`])
  })

  it("out-of-stock → schema.org/OutOfStock", () => {
    const ld = buildProductJsonLd({
      org: ORG,
      product: { ...BASE_PRODUCT, stockQuantity: 0 },
      appUrl: APP_URL,
      indexable: true,
    })
    const offers = ld!["offers"] as Record<string, unknown>
    expect(offers["availability"]).toBe("https://schema.org/OutOfStock")
  })

  it("relative media paths are absolutized, external ones untouched", () => {
    const ld = buildProductJsonLd({
      org: ORG,
      product: { ...BASE_PRODUCT, images: ["https://cdn.example.com/x.jpg"] },
      appUrl: APP_URL,
      indexable: true,
    })
    expect(ld!["image"]).toEqual(["https://cdn.example.com/x.jpg"])
  })

  it("indexable=false (draft/hidden tenant) emits NOTHING", () => {
    const ld = buildProductJsonLd({
      org: ORG,
      product: BASE_PRODUCT,
      appUrl: APP_URL,
      indexable: false,
    })
    expect(ld).toBeNull()
  })

  it("omits empty optionals (no sku/description/images)", () => {
    const ld = buildProductJsonLd({
      org: ORG,
      product: {
        id: "p2",
        name: "Propolis",
        price: 9,
        stockQuantity: 3,
      },
      appUrl: APP_URL,
      indexable: true,
    })
    expect(ld).not.toBeNull()
    expect("sku" in ld!).toBe(false)
    expect("description" in ld!).toBe(false)
    expect("image" in ld!).toBe(false)
  })
})
