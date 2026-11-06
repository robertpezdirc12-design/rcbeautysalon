import {
  getPublicSiteData,
  getPublicFeaturedServices,
  getPublicFeaturedProducts,
  getPublicFeaturedStaff,
  getPublicTestimonials,
  redirectBareToTenant,
} from "@/lib/public-site"
import { HomeContent } from "@/components/landing/home-content"
import { PlatformLanding } from "@/components/landing/platform-landing"
import { resolveCtaLinks, resolveCtaSectionHref } from "@/lib/public-cta"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import { isCapabilityEnabled } from "@/lib/profiles/registry"
import { sectionsForProfile } from "@/lib/home-sections"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { auth } from "@/lib/auth/auth"
import { getTrustedOrgSlug } from "@/lib/tenant"
import { hostFromHostHeader, isPlatformHost } from "@/lib/domains/normalize"
import { getPlatformHosts } from "@/lib/domains/provider"

export default async function HomePage() {
  // P1 #66: the PLATFORM ROOT is the product landing, not a tenant.
  //  - tenant context (/s/[slug] rewrite or custom domain) → tenant home
  //  - platform root + logged-in owner → their own site (unchanged)
  //  - platform root + anonymous/customer → PRODUCT LANDING
  const h = await headers()
  // V-1 (issue #102): only the proxy-SIGNED header counts — a forged one
  // must not turn the platform root into a tenant surface.
  const slugHeader = await getTrustedOrgSlug()
  const requestHost = hostFromHostHeader(h.get("host"))
  const isTenantContext =
    !!slugHeader ||
    (!!requestHost && !isPlatformHost(requestHost, getPlatformHosts()))

  if (!isTenantContext) {
    const session = await auth()
    if (session?.user?.role === "ADMIN" || session?.user?.role === "STAFF") {
      // Logged-in staff/owner: bare "/" keeps its existing behavior —
      // redirect to their own (or the default) tenant site.
      await redirectBareToTenant("/")
    }
    return <PlatformLanding />
  }

  // P1 #39-5: goli "/" (fail-open preostanek, ko proxy ni preusmeril)
  // servira ISTO vsebino kot /s/{slug} — preusmeri na kanonično pot.
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

  // P2 #60 + P3 #62: teles domače strani izpelje vidnost sekcij iz ISTEGA
  // odločevalnega sloja kot glava (resolveAvailableSections → header).
  // Prej je telo gledalo SAMO na podatke (ali grid sploh ima vrstice) —
  // profil, ki izključi storitve/trgovino/ekipo, je v telesu vseeno
  // izrisal polno sekcijo (čebelar s šiviljskim cenikom iz #58 je bil
  // natanko ta primer), glava pa je povezavo skrila.
  const sections = sectionsForProfile(
    {
      services: featuredServices.length > 0,
      shop: featuredProducts.length > 0,
      team: featuredStaff.length > 0,
      // P2 #75: podatkovna vrata za „Mnenja" — brez njih bi glava kazala
      // mrtvo sidro pri 0 ocen (pravilo #62).
      reviews: testimonials.length > 0,
    },
    profile
  )

  const ctaLinks = resolveCtaLinks(org, content)
  // #100 (ista filozofija kot #62 za sidra v glavi): privzeti sekundarni CTA
  // heroja kaže na /services — pri najemniku BREZ aktivnega kataloga
  // (platformska predstavitev, svež najemnik) bi to bil mrtvi konec poti na
  // prazno stran. Sekundarni CTA, ki ga je lastnik sam nastavil na drug
  // cilj, ostane nedotaknjen (lastniška izbira).
  const heroCtaLinks =
    !sections.services && ctaLinks.secondaryCta?.href === "/services"
      ? { ...ctaLinks, secondaryCta: null }
      : ctaLinks

  return (
    <HomeContent
      org={{ slug: org.slug, name: org.name, logo: org.logo }}
      content={content}
      ctaLinks={heroCtaLinks}
      ctaSectionHref={resolveCtaSectionHref(org, content.cta.buttonHref)}
      serviceCtaLabel={
        bookingEnabled ? "Rezerviraj" : "Poglej"
      }
      featuredServices={featuredServices}
      servicesTotal={servicesTotal}
      featuredProducts={featuredProducts}
      featuredStaff={featuredStaff}
      staffEnabled={sections.team}
      testimonials={testimonials}
      bookingEnabled={bookingEnabled}
      // Sections render only when their featured grid will have content —
      // a catalog that exists but has nothing featured would otherwise
      // render an empty grid with a bare button (EPIC #4 visual pass) —
      // AND when the profile's capability matrix allows them (#60/#62).
      hasServices={sections.services}
      hasProducts={sections.shop}
      // P2 #75: profil brez storitev dobi formo za oceno PODJETJA na
      // domači strani (nima /services/[slug], kjer bi sicer živela).
      canReviewBusiness={!isCapabilityEnabled(profile, "services")}
    />
  )
}
