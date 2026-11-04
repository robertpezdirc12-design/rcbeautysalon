import { describe, expect, it } from "vitest"
import { PROFILES, getProfile, term } from "@/lib/profiles/registry"

// ============================================================
// P2 #84 — panoga pove svoje ime: „Servis potrdi", ne „Salon potrdi".
//
// TerminologySet ima ključa businessSingular/businessIn/businessGenitive;
// beauty skupina izrecno deklarira „salon", vsi drugi profili imajo svoje
// samostalnik ali nevtralno „podjetje". Nizov v slovarjih z hardkodicijo
// „salon" ni več — namesto tega {business} vstavitve.
// ============================================================

const BEAUTY_GROUP = ["beauty", "frizer", "nails", "cosmetica", "massage", "epilation"]

describe("P2 #84: business terminology per profile", () => {
  it("every profile defines the business noun in all three cases (sl + en)", () => {
    for (const profile of Object.values(PROFILES)) {
      for (const key of ["businessSingular", "businessIn", "businessGenitive"] as const) {
        expect(profile.terminology[key], `${profile.id}.${key} missing`).toBeTruthy()
        expect(profile.terminology[key].sl.trim().length).toBeGreaterThan(0)
        expect(profile.terminology[key].en.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it("beauty group keeps 'salon' — no regression where it is correct", () => {
    for (const id of BEAUTY_GROUP) {
      const profile = getProfile(id)
      expect(term(profile, "businessSingular", "sl"), id).toBe("salon")
      expect(term(profile, "businessIn", "sl"), id).toBe("v salonu")
      expect(term(profile, "businessGenitive", "sl"), id).toBe("salona")
    }
  })

  it("non-beauty trades never say 'salon'", () => {
    expect(term(getProfile("barber"), "businessSingular", "sl")).toBe("barber shop")
    expect(term(getProfile("seamstress"), "businessSingular", "sl")).toBe("atelje")
    expect(term(getProfile("seamstress"), "businessGenitive", "sl")).toBe("ateljeja")
    expect(term(getProfile("tire-service"), "businessSingular", "sl")).toBe("servis")
    expect(term(getProfile("tire-service"), "businessIn", "sl")).toBe("v servisu")
    expect(term(getProfile("beekeeping"), "businessSingular", "sl")).toBe("čebelarstvo")
    expect(term(getProfile("generic"), "businessSingular", "sl")).toBe("podjetje")

    for (const id of ["barber", "seamstress", "tire-service", "beekeeping", "generic"]) {
      const all = JSON.stringify(getProfile(id).terminology).toLowerCase()
      expect(all.includes('"salon"'), `${id} mentions salon`).toBe(false)
    }
  })

  it("English values are coherent (not the SL word)", () => {
    expect(term(getProfile("tire-service"), "businessSingular", "en")).toBe("service centre")
    expect(term(getProfile("seamstress"), "businessSingular", "en")).toBe("studio")
    expect(term(getProfile("beekeeping"), "businessSingular", "en")).toBe("farm")
  })
})
