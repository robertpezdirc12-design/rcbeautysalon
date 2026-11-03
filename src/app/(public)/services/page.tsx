import type { Metadata } from "next"
import Image from "next/image"
import { cloudinaryPresets } from "@/lib/utils/cloudinary"
import { getPublicSiteData, getPublicServicesGrouped, getPublicCategories, getPublicActiveStaffOptions } from "@/lib/public-site"
import { orgPath } from "@/lib/org-path"
import { HeroVideo } from "@/components/services/hero-video"
import { ServicesList } from "@/components/services/services-list"
import { Suspense } from "react"
import { ServicesListSkeleton } from "@/components/services/services-list-skeleton"
import { BookingButton } from "@/components/services/booking-button"
import { AccentSpan, splitLastWord } from "@/components/landing/section-title"

export async function generateMetadata(): Promise<Metadata> {
  const site = await getPublicSiteData()
  const orgName = site?.org.name ?? "Salon"
  return {
    title: `${site?.content.services.title ?? "Storitve"} | ${orgName}`,
    description:
      site?.content.services.subtitle ??
      "Celoten pregled profesionalnih storitev našega salona",
  }
}

export default async function ServicesPage() {
  const site = await getPublicSiteData()

  if (!site) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4">
        <h1 className="text-2xl font-bold">Salon ni konfiguriran</h1>
      </div>
    )
  }

  const { org, content } = site
  const slug = org.slug

  // Get all data for services page (tenant-scoped)
  const [servicesByCategory, categories, staff] = await Promise.all([
    getPublicServicesGrouped(org.id),
    getPublicCategories(org.id),
    getPublicActiveStaffOptions(org.id),
  ])

  // Convert Decimal to number for client components
  const servicesForClient = Object.entries(servicesByCategory).reduce<
    Record<string, Array<{
      id: string
      name: string
      slug: string
      description: string | null
      duration: number
      price: number
      imageUrl: string | null
      category: {
        id: string
        name: string
        slug: string
      } | null
    }>>
  >((acc, [categoryName, services]) => {
    acc[categoryName] = services.map(service => ({
      id: service.id,
      name: service.name,
      slug: service.slug,
      description: service.description,
      duration: service.duration,
      price: service.price.toNumber(),
      imageUrl: service.imageUrl,
      category: service.category
        ? {
            id: service.category.id,
            name: service.category.name,
            slug: service.category.slug,
          }
        : null,
    }))
    return acc
  }, {})

  const servicesHeading = splitLastWord(content.services.title)

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section with Video Background */}
      <section className="relative overflow-hidden bg-black py-16 md:py-24">
        {/* Client Component for Video */}
        <HeroVideo
          videoUrl={content.hero.videoUrl}
          posterUrl={content.hero.posterUrl ?? content.hero.imageUrl}
        />

        {/* Content */}
        <div className="container relative z-20 mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-heading mb-4 text-5xl tracking-tight text-white sm:text-6xl md:text-7xl">
              {servicesHeading.lead}{" "}
              {servicesHeading.accent && (
                <span className="from-accent to-primary bg-linear-to-r bg-clip-text text-transparent">
                  {servicesHeading.accent}
                </span>
              )}
            </h1>
            <p className="text-lg text-white/90 md:text-xl">
              {content.services.subtitle}
            </p>
          </div>
        </div>
      </section>

      {/* Services with Filters */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <Suspense fallback={<ServicesListSkeleton />}>
            <ServicesList
              initialServices={servicesForClient}
              categories={categories}
              staff={staff}
            />
          </Suspense>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-primary/30 relative overflow-hidden border-t border-b py-16">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src={
              content.cta.imageUrl ||
              cloudinaryPresets.serviceHero("Beauty Salon/services/book-appoiment_vqo5wj")
            }
            alt={content.cta.title}
            fill
            className="object-cover"
          
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"/>
        </div>

        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative container mx-auto px-4 text-center text-white">
          <h2 className="font-heading mb-4 text-4xl md:text-5xl lg:text-6xl">
            {(() => {
              const { lead, accent } = splitLastWord(content.cta.title)
              return (
                <>
                  {lead} {accent && <AccentSpan>{accent}</AccentSpan>}
                </>
              )
            })()}
          </h2>
          <p className="mb-8 text-lg opacity-90 md:text-xl">
            {content.cta.text}
          </p>
          <BookingButton href={orgPath(slug, content.cta.buttonHref)} label={content.cta.buttonLabel} />
        </div>
      </section>
    </div>
  )
}
