import {
  getPublicSiteData,
  getPublicFeaturedServices,
  getPublicFeaturedProducts,
  getPublicFeaturedStaff,
  getPublicTestimonials,
} from "@/lib/public-site"
import { HomeContent } from "@/components/landing/home-content"
import { resolveCtaLinks, resolveCtaSectionHref } from "@/lib/public-cta"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import { prisma } from "@/lib/prisma"
import { redirectBareToTenant } from "@/lib/public-site"

export default async function HomePage() {
  // P1 #39-5: goli "/" servira ISTO vsebino kot /s/{slug} — preusmeri na
  // kanonično najemniško pot (pod najemnikom se ne zgodi nič).
  await redirectBareToTenant("/")

  const site = await getPublicSiteData()

  if (!site) {
    return (
      <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-3xl font-bold md:text-4xl">Salon ni konfiguriran</h1>
        <p className="text-muted-foreground mt-3 max-w-md">
          Ta stran še ni nastavljena. Če ste lastnik salona, se prijavite v
          nadzorno ploščo in dokončajte nastavitve.
        </p>
      </div>
    )
  }

  const { org, content } = site
  const profile = resolveEffectiveProfile(org)
  const bookingEnabled =
    profile.website.ctaMode === "booking" &&
    profile.capabilities.appointments !== "disabled"
  const [featuredServices, featuredProducts, featuredStaff, testimonials, servicesTotal] = await Promise.all([
    getPublicFeaturedServices(org.id),
    getPublicFeaturedProducts(org.id),
    getPublicFeaturedStaff(org.id),
    getPublicTestimonials(org.id),
    // P1 #39-3: skupno število aktivnih storitev — domača stran prikaže
    // IZBRANE (5) z vidno oznako, da obiskovalec ne sklepa, da salon
    // ponuja le teh 5.
    prisma.service
      .count({ where: { organizationId: org.id, isActive: true } })
      .catch(() => 0),
  ])

  return (
    <HomeContent
      org={{ slug: org.slug, name: org.name, logo: org.logo }}
      content={content}
      ctaLinks={resolveCtaLinks(org.vertical, content, org.profileOverrides)}
      ctaSectionHref={resolveCtaSectionHref(org.vertical, content.cta.buttonHref, org.profileOverrides)}
      serviceCtaLabel={
        bookingEnabled ? "Rezerviraj" : "Poglej"
      }
      featuredServices={featuredServices}
      servicesTotal={servicesTotal}
      featuredProducts={featuredProducts}
      featuredStaff={featuredStaff}
      testimonials={testimonials}
      bookingEnabled={bookingEnabled}
      // Sections render only when their featured grid will have content —
      // a catalog that exists but has nothing featured would otherwise
      // render an empty grid with a bare button (EPIC #4 visual pass).
      hasServices={featuredServices.length > 0}
      hasProducts={featuredProducts.length > 0}
    />
  )
}
