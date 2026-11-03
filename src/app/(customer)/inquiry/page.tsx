import type { Metadata } from "next"
import { getResolvedOrg } from "@/lib/tenant"
import { canonicalMetadata } from "@/lib/seo"
import { term as profileTerm } from "@/lib/profiles/registry"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import { getPublicForms } from "@/app/actions/forms"
import { redirectBareToTenant } from "@/lib/public-site"
import { PublicInquiryForm } from "@/components/public/public-inquiry-form"

// ============================================================
// PUBLIC INQUIRY PAGE (EPIC #1 §7/§8 — Phase 4)
// The universal submission surface for non-booking profiles:
// seamstress (povpraševanje + merilni list), tire service,
// beekeeping orders, … Renders the tenant's ACTIVE form
// definitions (materialized from its activity profile) and
// accepts guest submissions validated server-side.
// ============================================================

// P1 #26: samo-referencirajoč canonical (prej je /inquiry podedoval
// canonical korena najemnika).
// P3 #50: naslov vsebuje IME najemnika — dosledno z ostalimi javnimi
// potmi (zavihki, zaznamki in deljenje povezav brez dvoumnosti).
export async function generateMetadata(): Promise<Metadata> {
  const org = await getResolvedOrg()
  return canonicalMetadata(org?.slug, "/inquiry", {
    title: `Povpraševanje | ${org?.name ?? "Salon"}`,
    description: "Izpolnite obrazec in odgovorimo v najkrajšem možnem času.",
  })
}

export default async function InquiryPage() {
  // P1 #39-5: gola pot → kanonična najemniška pot.
  await redirectBareToTenant("/inquiry")

  const org = await getResolvedOrg()
  // Guard (booking → domov) je v inquiry/layout.tsx — shell faza (P0 #24).

  const forms = await getPublicForms()
  const profile = resolveEffectiveProfile(org)
  const ctaLabel = profileTerm(profile, "bookingCta", "sl")

  return (
    <div className="from-muted/30 via-background to-muted/20 min-h-screen bg-linear-to-b py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="mb-10 text-center">
          <h1 className="from-primary to-accent mb-2 bg-linear-to-r bg-clip-text text-4xl font-bold text-transparent">
            {ctaLabel}
          </h1>
          {/* #24 (fold-in): brez aktivnih obrazcev glava ne obljublja
              "Izpolnite obrazec" — pove, kje so kontaktni podatki. */}
          <p className="text-muted-foreground text-lg">
            {forms.length === 0
              ? "Za povpraševanje nam pišite ali pokličite — kontakti so v nogi strani."
              : "Izpolnite obrazec in odgovorimo v najkrajšem možnem času."}
          </p>
        </div>

        {forms.length === 0 ? (
          <div className="bg-card rounded-2xl border p-10 text-center shadow-sm">
            <p className="text-foreground font-medium">
              Povpraševanje je na voljo prek kontaktnih podatkov.
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              Pokličite nas ali pišite — kontaktne informacije so v nogi strani.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {forms.map((form) => (
              <PublicInquiryForm key={form.id} form={form} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
