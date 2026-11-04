"use client"

import { Fragment, useEffect, type ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { cloudinaryPresets } from "@/lib/utils/cloudinary"
import { orgPath } from "@/lib/org-path"
import type { CtaLink, SectionKey, SiteContent } from "@/lib/site-content"
import { homeSectionOrder } from "@/lib/site-content"
import { HeroVideo } from "@/components/landing/hero-video"
import { HeroActions } from "@/components/landing/hero-actions"
import { FeatureCards } from "@/components/landing/feature-cards"
import { CTAButton } from "@/components/landing/cta-button"
import { ProductCard } from "@/components/landing/product-card"
import { StaffAvatar } from "@/components/landing/staff-avatar"
import { HowItWorksSection } from "@/components/landing/how-it-works-section"
import { TestimonialsSection, type LandingTestimonial } from "@/components/landing/testimonials-section"
import { SectionWrapper } from "@/components/layouts/section-wrapper"
import { AccentSpan, splitLastWord, splitOnComma } from "./section-title"
import { useI18n } from "@/lib/i18n/provider"
import { useNavigationStore } from "@/store/navigation-store"
import { formatCurrency } from "@/lib/utils/format"
import { DEFAULT_CATALOG_IMAGES } from "@/lib/default-assets"

// P1 #18 (audit-2026-11): centralized default assets (single source of truth)
const DEFAULT_ABOUT_IMAGE = DEFAULT_CATALOG_IMAGES.salonInterior
const DEFAULT_CTA_IMAGE = DEFAULT_CATALOG_IMAGES.transform

interface Service {
  id: string
  name: string
  slug: string
  price: number | { toString: () => string }
  duration: number | null
  imageUrl: string | null
}

interface Product {
  id: string
  name: string
  price: number
  images?: string[]
  category: { name: string } | null
}

interface Staff {
  id: string
  name: string
  bio: string | null
  image: string | null
}

interface HomeContentProps {
  org: { slug: string | null; name: string; logo: string | null }
  content: SiteContent
  /** Profile-resolved hero/CTA links (EPIC #1 §4) — falls back to content. */
  ctaLinks?: { primaryCta: CtaLink; secondaryCta: CtaLink | null }
  /** Profile-guarded bottom CTA target (stale /booking seeds are remapped, §21). */
  ctaSectionHref?: string
  /** Label on service cards — booking profiles say "Rezerviraj", others "Poglej". */
  serviceCtaLabel?: string
  featuredServices: Service[]
  /** P1 #39-3: skupno število aktivnih storitev — oznaka "Izbranih 5 od 12
   * storitev" pod naslovom, da grid ne prikazuje lažnega vtisa celotne
   * ponudbe. */
  servicesTotal?: number
  featuredProducts: Product[]
  featuredStaff: Staff[]
  /** P2 #47: profil z izklopljenim osebjem ne prikaže sekcije ekipe —
   * niti za obstoječe najemnike z zapuščeno staff vrstico (brez migracije). */
  staffEnabled?: boolean
  /** Real moderated reviews for the tenant — section renders only when non-empty. */
  testimonials?: LandingTestimonial[]
  /** True when the tenant's website CTA is real booking (not inquiry/quote)
   *  and the appointments capability is enabled — gates the "Kako deluje"
   *  trust section, which would otherwise describe a flow the tenant
   *  does not offer. */
  bookingEnabled?: boolean
  /** Whether the tenant has ANY services/products at all (catalog counts).
   * Empty-catalog sections render no markup at all — an empty "Naše
   * storitve" heading with only a button confused product-only verticals
   * (e.g. beekeeping, which has zero services by design). */
  hasServices: boolean
  hasProducts: boolean
  /** P2 #75: profil brez storitev (npr. čebelarstvo) nima /services/[slug]
   *  strani, kjer živi forma za ocene — pokaže se v „Izjavah strank". */
  canReviewBusiness?: boolean
}

export function HomeContent({
  org,
  content,
  ctaLinks,
  ctaSectionHref,
  serviceCtaLabel = "Rezerviraj",
  featuredServices,
  servicesTotal = 0,
  featuredProducts,
  featuredStaff,
  staffEnabled = true,
  testimonials = [],
  bookingEnabled = false,
  hasServices,
  hasProducts,
  canReviewBusiness = false,
}: HomeContentProps) {
  const primaryCta = ctaLinks?.primaryCta ?? content.hero.primaryCta
  const secondaryCta = ctaLinks ? ctaLinks.secondaryCta : content.hero.secondaryCta
  const { setActiveSection } = useNavigationStore()
  // P1 #8/#15 (audit-2026-11): i18n for CTA labels and placeholders
  const { t } = useI18n()

  const prefix = org.slug ? `/s/${org.slug}` : ""
  const toHref = (href: string) =>
    href.startsWith("http") || !href.startsWith("/") ? href : orgPath(org.slug, href)

  const sectionVisible = (key: SectionKey) =>
    content.sections.find((s) => s.key === key)?.visible ?? true

  const heroTitle = splitOnComma(content.hero.title)

  // Reset active section when leaving home page
  useEffect(() => {
    return () => setActiveSection("")
  }, [setActiveSection])

  /**
   * E3-2: sections render in the owner-defined order — hero is always first
   * when visible (it is the page header); hidden sections never render.
   */
  const sectionNodes: Partial<Record<SectionKey, ReactNode>> = {
    /* Hero Section */
    hero: sectionVisible("hero") && (
        <section className="relative overflow-hidden py-20 md:py-32">
          <HeroVideo
            imageUrl={content.hero.imageUrl}
            videoUrl={content.hero.videoUrl}
            posterUrl={content.hero.posterUrl}
            alt={content.hero.title}
          />
          <div className="relative container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              {content.hero.eyebrow && (
                <p className="mb-4 text-sm font-medium uppercase tracking-[0.3em] text-white/80 drop-shadow-md">
                  {content.hero.eyebrow}
                </p>
              )}
              <h1 className="font-heading mb-6 text-5xl tracking-tight text-white drop-shadow-lg sm:text-7xl md:text-8xl lg:text-9xl">
                {heroTitle.lead}
                {heroTitle.accent && (
                  <>
                    {" "}
                    <span className="from-primary via-accent to-primary bg-linear-to-r bg-clip-text text-transparent">
                      {heroTitle.accent}
                    </span>
                  </>
                )}
              </h1>
              <p className="mb-8 text-lg font-medium text-white/90 drop-shadow-md md:text-xl">
                {content.hero.subtitle}
              </p>
              <HeroActions
                primaryCta={primaryCta}
                secondaryCta={secondaryCta}
                orgSlug={org.slug}
              />
            </div>
          </div>
        </section>
      ),

    // Features
    features: (
        <section className="from-muted/30 to-background border-primary/30 border-t bg-linear-to-b py-16">
          <div className="container mx-auto px-4">
            <FeatureCards
              title={content.features.title}
              subtitle={content.features.subtitle}
              items={content.features.items}
            />
          </div>
        </section>
      ),

    // Services Preview — skipped entirely when the tenant has no
    // services at all (product-only verticals, e.g. beekeeping)
    services: !hasServices ? null : (
        <SectionWrapper id="services" className="py-16">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center">
              <GradientHeading title={content.services.title} />
              <p className="text-muted-foreground md:text-lg">
                {content.services.subtitle}
              </p>
              {/* P1 #39-3 + #22: vidna oznaka "izbranih N od M" — polna
                  muted-foreground barva (the /80 odtenek je padel pod AA). */}
              {servicesTotal > featuredServices.length &&
                featuredServices.length > 0 && (
                  <p className="text-muted-foreground mt-2 text-sm">
                    {t.public.featuredServicesCount(
                      featuredServices.length,
                      servicesTotal
                    )}
                  </p>
                )}
            </div>
            <div className="mx-auto max-w-7xl">
              <div className="flex flex-wrap justify-center gap-4">
                {featuredServices.map((service) => (
                  <Link
                    key={service.id}
                    href={toHref(`/services/${service.slug}`)}
                    className="group border-primary/10 hover:shadow-primary/10 hover:border-primary/30 w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)] xl:w-[calc(20%-0.8rem)] relative overflow-hidden rounded-lg border shadow-sm transition-all duration-500 hover:shadow-xl"
                  >
                    <div className="relative h-80 overflow-hidden">
                      {service.imageUrl ? (
                        <Image
                          src={service.imageUrl.startsWith('http') ? service.imageUrl : cloudinaryPresets.serviceCard(service.imageUrl)}
                          alt={service.name}
                          fill
                          sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="bg-muted flex h-full w-full items-center justify-center">
                          <span className="text-muted-foreground">{t.public.noImage}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/60 to-black/20 opacity-90 transition-opacity duration-500 group-hover:opacity-95" />
                      <div className="absolute inset-0 flex flex-col justify-end p-5">
                        <div className="transform transition-transform duration-500 group-hover:-translate-y-1">
                          <h3 className="font-heading group-hover:text-accent-text mb-2 text-xl font-semibold tracking-tight text-white transition-colors duration-300">
                            {service.name}
                          </h3>
                          <div className="flex items-center justify-between text-sm text-white/90 transition-colors duration-300">
                            <span className="group-hover:text-accent-text/90 font-medium">
                              {formatCurrency(Number(service.price))}
                            </span>
                            {service.duration && (
                              <span className="text-white/70 group-hover:text-accent-text/70 transition-colors">
                                {service.duration} min
                              </span>
                            )}
                          </div>
                          <div className="mt-4 translate-y-2 transform opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                            <div className="text-accent-text border-accent/50 hover:border-accent inline-flex items-center border-b-2 pb-1 text-sm font-medium">
                              {serviceCtaLabel}
                              <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-12 text-center">
              <Button asChild size="lg" variant="outline" className="border-primary/50 hover:bg-primary hover:text-white">
                <Link href={toHref("/services")}>{t.public.allServices}</Link>
              </Button>
            </div>
          </div>
        </SectionWrapper>
      ),

    // About Our Salon
    about: (
        <SectionWrapper id="about" className="relative overflow-hidden py-20">
          <div className="container mx-auto px-4">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="relative h-[400px] overflow-hidden rounded-2xl lg:h-[500px]">
                <Image
                  src={content.about.imageUrl || DEFAULT_ABOUT_IMAGE}
                  alt={content.about.title}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                  quality={90}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />
              </div>
              <div>
                <h2 className="mb-6 text-3xl font-bold md:text-4xl">
                  {(() => {
                    const { lead, accent } = splitLastWord(content.about.title)
                    return (
                      <>
                        {lead} {accent && <AccentSpan>{accent}</AccentSpan>}
                      </>
                    )
                  })()}
                </h2>
                {content.about.paragraphs.map((paragraph, index) => (
                  <p
                    key={index}
                    className={`text-muted-foreground leading-relaxed ${
                      index === 0 ? "mb-6 text-lg" : ""
                    } ${index === content.about.paragraphs.length - 1 ? "mb-8" : "mb-6"}`}
                  >
                    {paragraph}
                  </p>
                ))}
                <div className="mb-8 grid grid-cols-2 gap-6">
                  {content.about.stats.map((stat, index) => (
                    <div
                      key={`${stat.label}-${index}`}
                      className="bg-primary/5 border-primary/20 rounded-lg border p-4 text-center"
                    >
                      <div className="text-primary-text mb-1 text-3xl font-bold">{stat.value}</div>
                      <div className="text-muted-foreground text-sm">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <CTAButton
                  href={toHref(primaryCta.href)}
                  className="from-primary to-primary/90 group bg-linear-to-r text-white shadow-lg hover:opacity-90"
                >
                  {primaryCta.label}
                </CTAButton>
              </div>
            </div>
          </div>
        </SectionWrapper>
      ),

    // Our Team — P2 #47: prikazan SAMO, ko profil omogoča osebje IN ko
    // obstaja vsak en član (prej je prazna/izklopljena ekipa izrisala
    // naslov in gumb brez vsebine, ki je lastnik ne more urejati).
    team: !staffEnabled || featuredStaff.length === 0 ? null : (
        <SectionWrapper id="team" className="border-primary/30 border-t py-16">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center">
              <GradientHeading title={content.team.title} />
              <p className="text-muted-foreground md:text-lg">
                {content.team.subtitle}
              </p>
            </div>
            <div className="mx-auto max-w-5xl">
              <div className="flex flex-wrap justify-center gap-6">
                {featuredStaff.map((staff) => (
                  <Link
                    key={staff.id}
                    href={toHref(`/staff/${staff.name.toLowerCase().replace(/\s+/g, "-")}`)}
                    className="group w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]"
                  >
                    <div className="border-primary/10 hover:border-primary/30 overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-300 hover:shadow-xl">
                      <div className="relative aspect-3/4 overflow-hidden">
                        <StaffAvatar
                          image={staff.image}
                          name={staff.name}
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      </div>
                      <div className="p-4 text-center">
                        <h3 className="font-semibold group-hover:text-accent-text transition-colors">{staff.name}</h3>
                        {staff.bio && (
                          <p className="text-muted-foreground mt-1 text-sm line-clamp-2">{staff.bio}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-12 text-center">
              <Button asChild size="lg" variant="outline" className="border-primary/50 hover:bg-primary hover:text-white">
                <Link href={toHref("/staff")}>{t.public.allTeam}</Link>
              </Button>
            </div>
          </div>
        </SectionWrapper>
      ),

    // Featured Products — skipped when the tenant has no products at all
    shop: !hasProducts ? null : (
        <SectionWrapper id="shop" className="border-primary/30 border-t py-16">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center">
              <GradientHeading title={content.shop.title} />
              <p className="text-muted-foreground md:text-lg">
                {content.shop.subtitle}
              </p>
            </div>
            <div className="mx-auto max-w-5xl">
              <div className="flex flex-wrap justify-center gap-6">
                {featuredProducts.map((product) => (
                  <div key={product.id} className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]">
                    <ProductCard
                      id={product.id}
                      name={product.name}
                      price={product.price}
                      category={product.category?.name || t.public.uncategorized}
                      image={product.images?.[0] || null}
                      hrefPrefix={prefix}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-12 text-center">
              <Button asChild size="lg" variant="outline" className="border-primary/50 hover:bg-primary hover:text-white">
                <Link href={toHref("/shop")}>{t.public.allProducts}</Link>
              </Button>
            </div>
          </div>
        </SectionWrapper>
      ),

    // Contact / CTA Section
    cta: (
        <SectionWrapper id="contact" className="border-primary/30 relative overflow-hidden border-t py-20 md:py-32">
          <div className="absolute inset-0">
            <Image
              src={content.cta.imageUrl || DEFAULT_CTA_IMAGE}
              alt={content.cta.title}
              fill
              sizes="100vw"
              className="object-cover"
              quality={90}
            />
            <div className="absolute inset-0 bg-black/40" />
          </div>
          <div className="relative container mx-auto px-4 text-center text-white">
            <h2 className="mb-4 text-3xl font-bold drop-shadow-lg md:text-4xl">
              {content.cta.title}
            </h2>
            <p className="mb-8 text-lg opacity-95 drop-shadow-md md:text-xl">
              {content.cta.text}
            </p>
            <CTAButton
              // resolveCtaSectionHref returns a RAW path (never prefixed) —
              // route it through toHref like every other internal href so the
              // tenant prefix is applied (bare "/booking" otherwise falls back
              // to the default tenant under /s/{slug}).
              href={toHref(ctaSectionHref ?? content.cta.buttonHref)}
              className="from-primary to-primary/90 border-accent/30 group border-2 bg-linear-to-r text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:opacity-90"
            >
              {content.cta.buttonLabel}
            </CTAButton>
          </div>
        </SectionWrapper>
      ),

    // P2 #75: „Izjave strank" je LASTNA sekcija (ključ "reviews") —
    // prej je bila pasavica ekipe in je izginila, kadar je bil ekipa
    // izklopljena (čebelarstvo: staff "disabled" → brez ocen vendar).
    // Komponenta sama vrne null pri 0 ocen (razen showForm — forma za
    // profile brez storitev, ki morajo lahko dobiti PRVO oceno).
    reviews: (
      <TestimonialsSection
        testimonials={testimonials}
        showForm={canReviewBusiness}
        businessName={org.name}
      />
    ),
  }

  return (
    <div className="flex min-h-screen flex-col">
      {homeSectionOrder(content.sections).map((key) => (
        <Fragment key={key}>
          {sectionNodes[key]}
          {/* "Kako deluje" trust cluster rides right after the features
              section — only for tenants whose CTA really is online booking. */}
          {key === "features" && bookingEnabled && <HowItWorksSection />}
        </Fragment>
      ))}
    </div>
  )
}

function GradientHeading({ title }: { title: string }) {
  const { lead, accent } = splitLastWord(title)
  return (
    <h2 className="font-heading mb-4 text-4xl md:text-5xl lg:text-6xl">
      {lead} {accent && <AccentSpan>{accent}</AccentSpan>}
    </h2>
  )
}
