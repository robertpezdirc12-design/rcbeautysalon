import { describe, expect, it } from "vitest"
import { defaultSiteContent } from "@/lib/site-content"
import { VERTICALS, verticalSiteContent } from "@/lib/verticals"

// ============================================================
// P2 #85 — „Univerzalno" ni lepotni salon.
//
// Prej je `defaultSiteContent("generic")` dobesedno vrnil beauty
// vsebino (hero „Vaša lepota, naša strast", sliko notranjosti
// salona), dvojni fallback pa je vsak neznan vertikal poslal v
// lepotni salon. Ta test zagotavlja: generic ima lastno nevtralno
// vsebino, lastne nevtralne slike, in je edini fallback.
// ============================================================

describe("P2 #85: generic profile is trade-neutral", () => {
  const generic = defaultSiteContent("generic")
  const beauty = defaultSiteContent("beauty")

  it("defaultSiteContent('generic') differs from beauty in hero, about and CTA", () => {
    expect(generic.hero.title).not.toBe(beauty.hero.title)
    expect(generic.about.title).not.toBe(beauty.about.title)
    expect(generic.cta.title).not.toBe(beauty.cta.title)
    expect(generic.hero.primaryCta.href).not.toBe(beauty.hero.primaryCta.href)
  })

  it("contains no beauty vocabulary (no 'lepota', no 'salon')", () => {
    const copy = JSON.stringify(generic).toLowerCase()
    expect(copy).not.toContain("lepota")
    expect(copy).not.toContain("salon")
    expect(copy).not.toContain("koža")
  })

  it("CTA points at /inquiry, not /booking (generic has appointments optional)", () => {
    expect(generic.hero.primaryCta.href).toBe("/inquiry")
    expect(generic.cta.buttonHref).toBe("/inquiry")
  })

  it("verticalSiteContent('generic') uses no IMG.salon*/transform asset", () => {
    const content = verticalSiteContent("generic")
    const urls = [
      content.hero.imageUrl ?? "",
      content.about.imageUrl ?? "",
      content.cta.imageUrl ?? "",
    ]
    for (const url of urls) {
      expect(url).not.toContain("salon")
      expect(url).not.toContain("transform")
    }
    // In ima nevtralne samostojne slike (delovna miza / roki obrtnika).
    expect(content.about.imageUrl).toBe("/img/presets/workspace.jpg")
    expect(content.cta.imageUrl).toBe("/img/presets/craft.jpg")
  })

  it("an unknown/legacy vertical falls back to generic, never to beauty", () => {
    const unknown = defaultSiteContent("vodovodidar-1999")
    expect(unknown.hero.title).toBe(generic.hero.title)
    expect(unknown.hero.title).not.toBe(beauty.hero.title)
  })

  it("no two verticals share the same hero.title (the check that would have caught #85)", () => {
    const seen = new Map<string, string>()
    for (const v of VERTICALS) {
      const prev = seen.get(v.siteContent.hero.title)
      expect(prev, `${v.id} shares hero title with ${prev}`).toBeUndefined()
      seen.set(v.siteContent.hero.title, v.id)
    }
  })

  it("other verticals are unchanged (tire-service, seamstress, beekeeping keep their heroes)", () => {
    expect(
      VERTICALS.find((v) => v.id === "tire-service")!.siteContent.hero.title
    ).toBe("Vaše vozilo v najboljših rokah")
    expect(
      VERTICALS.find((v) => v.id === "seamstress")!.siteContent.hero.title
    ).toBe("Vsako oblačilo, popolno prileganje")
    expect(
      VERTICALS.find((v) => v.id === "beekeeping")!.siteContent.hero.title
    ).toBe("Med, kot ga daje narava")
  })
})
