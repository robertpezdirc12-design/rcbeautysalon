import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import {
  CalendarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ArrowLeftIcon,
  UserIcon,
} from "@/components/icons"
import { cloudinaryPresets } from "@/lib/utils/cloudinary"
import { getPublicSiteData, getPublicServiceBySlug, getPublicRelatedServices, redirectBareToTenant } from "@/lib/public-site"
import { canonicalMetadata } from "@/lib/seo"
import { isBookingEnabled } from "@/lib/public-cta"
import { orgPath } from "@/lib/org-path"
import { ReviewsSection } from "@/components/reviews/reviews-section"
import { GallerySection } from "@/components/services/gallery-section"
import { FAQSection } from "@/components/services/faq-section"
import { RelatedServicesSection } from "@/components/services/related-services-section"
import { ServiceBreadcrumbs } from "@/components/services/breadcrumbs"
import { ReviewForm } from "@/components/reviews/review-form"
import { StaffCard } from "@/components/staff/staff-card"
import { auth } from "@/lib/auth/auth"
import { getServerI18n } from "@/lib/i18n/server"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const site = await getPublicSiteData()
  const orgName = site?.org.name ?? "Salon"
  const service = site ? await getPublicServiceBySlug(site.org.id, slug) : null

  if (!service) {
    return {
      title: `Storitev ni najdena | ${orgName}`,
    }
  }

  // P1 #26: samo-referencirajoč canonical + P1 #39-6: OG slika storitve
  // (fotografija, sicer dinamično generirana s strani imena prek /og).
  return canonicalMetadata(site?.org.slug, `/services/${slug}`, {
    title: `${service.name} | ${orgName}`,
    description:
      service.description || `Rezervirajte ${service.name} pri ${orgName}.`,
    openGraph: {
      title: `${service.name} | ${orgName}`,
      description:
        service.description || `Rezervirajte ${service.name} pri ${orgName}.`,
      images: [
        service.imageUrl
          ? { url: service.imageUrl, alt: service.name }
          : {
              url: `/og?title=${encodeURIComponent(service.name)}&subtitle=${encodeURIComponent(orgName)}`,
              alt: service.name,
            },
      ],
    },
  })
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  // Get the service by slug from the database (tenant-scoped)
  const { slug } = await params
  // P1 #39-5: gola pot najprej na kanonični najemnik (storitev je lahko
  // na pravem najemniku, četudi je ne najde privzeti org).
  await redirectBareToTenant(`/services/${slug}`)

  const { t } = await getServerI18n()
  const site = await getPublicSiteData()
  const service = site ? await getPublicServiceBySlug(site.org.id, slug) : null

  // If it doesn't exist, show 404
  if (!site || !service) {
    notFound()
  }

  const orgSlug = site.org.slug

  // Org-aware server-side price formatter
  const fmt = (amount: number | string | null | undefined): string => {
    const n = Number(amount ?? 0)
    try {
      return new Intl.NumberFormat("sl-SI", {
        style: "currency",
        currency: site?.config?.currency || "EUR",
      }).format(n)
    } catch {
      return `${n.toFixed(2)} €`
    }
  }

  // Get related services by category and user session
  const [relatedServices, session] = await Promise.all([
    getPublicRelatedServices(site.org.id, service.categoryId, service.id),
    auth(),
  ])

  // P0 #24 (re-audit 2026-11): profil poganja CTA — najemnik z izklopljenimi
  // rezervacijami ne sme videti "Rezerviraj to storitev", ki vodi na mrtvo
  // pot (/booking preusmeri na /inquiry in izgubi izbrano storitev).
  const bookingEnabled = isBookingEnabled(site.org)

  return (
    <div className="flex min-h-screen flex-col">
      {/* Back Button & Breadcrumbs */}
      <div className="container mx-auto px-4 pt-8">
        <Link href={orgPath(orgSlug, "/services")}>
          <Button variant="ghost" className="hover:bg-primary/10 mb-4">
            <ArrowLeftIcon size={16} className="mr-2" />
            Nazaj na storitve
          </Button>
        </Link>
        <ServiceBreadcrumbs
          homeHref={orgPath(orgSlug, "/")}
          items={[
            { label: "Storitve", href: orgPath(orgSlug, "/services") },
            ...(service.category
              ? [{ label: service.category.name, href: orgPath(orgSlug, "/services") }]
              : []),
            { label: service.name },
          ]}
        />
      </div>

      {/* Service Detail */}
      <section className="py-8 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Image */}
            <div className="relative h-[400px] overflow-hidden rounded-2xl lg:h-[600px]">
              {service.imageUrl ? (
                <Image
                  src={
                    service.imageUrl.startsWith("http")
                      ? service.imageUrl
                      : cloudinaryPresets.serviceHero(service.imageUrl)
                  }
                  alt={service.name}
                  fill
                  className="object-cover"
                  priority
                
              sizes="100vw"/>
              ) : (
                <div className="bg-muted flex h-full w-full items-center justify-center">
                  <span className="text-muted-foreground text-lg">
                    Slika ni na voljo
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />
            </div>

            {/* Content */}
            <div>
              {/* Category Badge */}
              {service.category && (
                <Badge variant="outline" className="border-primary/50 mb-4">
                  {service.category.name}
                </Badge>
              )}

              {/* Title */}
              <h1 className="mb-6 text-4xl font-bold md:text-5xl">
                {service.name}
              </h1>

              {/* Description */}
              {service.description && (
                <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
                  {service.description}
                </p>
              )}

              {/* Service Details Cards */}
              <div className="mb-8 grid grid-cols-2 gap-4">
                <Card className="border-primary/20">
                  <CardHeader className="pb-3">
                    <div className="text-primary-text flex items-center gap-2">
                      <CurrencyDollarIcon size={20} />
                      <CardTitle className="text-sm font-medium">
                        Cena
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {fmt(Number(service.price))}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-primary/20">
                  <CardHeader className="pb-3">
                    <div className="text-primary-text flex items-center gap-2">
                      <ClockIcon size={20} />
                      <CardTitle className="text-sm font-medium">
                        Trajanje
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{service.duration} min</p>
                  </CardContent>
                </Card>
              </div>

              {/* Staff Section */}
              {service.staffServices && service.staffServices.length > 0 && (
                <div className="mb-8">
                  <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                    <UserIcon size={20} className="text-primary-text" />
                    Razpoložljivi člani ekipe
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {service.staffServices.map((staffService) => (
                      <StaffCard
                        key={staffService.staff.id}
                        staff={staffService.staff}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Book Button — P0 #24: profilsko pogojena CTA (booking
                  ohrani izbrano storitev prek ?service=; inquiry profile
                  dobita pošteno povpraševanje, ne mrtve poti). */}
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link
                  href={
                    bookingEnabled
                      ? orgPath(orgSlug, `/booking?service=${service.slug}`)
                      : orgPath(orgSlug, "/inquiry")
                  }
                  className="flex-1"
                >
                  <Button
                    size="lg"
                    className="from-primary to-accent w-full bg-linear-to-r hover:opacity-90"
                  >
                    <CalendarIcon size={20} className="mr-2" />
                    {bookingEnabled ? "Rezerviraj to storitev" : "Oddaj povpraševanje"}
                  </Button>
                </Link>
                <Link href={orgPath(orgSlug, "/services")}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-primary/50 hover:bg-primary/5 dark:hover:text-accent-text w-full sm:w-auto"
                  >
                    Prikaži več storitev
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What to Expect Section */}
      <section className="border-primary/30 bg-muted/30 border-t py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-3xl font-bold">
              Kaj lahko{" "}
              <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
                pričakujete
              </span>
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="from-primary to-accent mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br">
                    <span className="text-2xl font-bold text-white">1</span>
                  </div>
                  <CardTitle className="text-lg">Posvet</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    Skupaj razjasnimo vaše želje in potrebe, da zagotovimo
                    popoln rezultat.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="from-primary to-accent mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br">
                    <span className="text-2xl font-bold text-white">2</span>
                  </div>
                  <CardTitle className="text-lg">Tretma</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    Sprostite se, medtem ko naši strokovnjaki poskrbijo za
                    detajle.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="from-primary to-accent mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br">
                    <span className="text-2xl font-bold text-white">3</span>
                  </div>
                  <CardTitle className="text-lg">Rezultat</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    Zapustite salon samozavestno in v najboljši obliki.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <ReviewsSection reviews={service.reviews} />

      {/* Review Form Section - Only for authenticated users */}
      <section className="border-t py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            {session?.user ? (
              <div>
                <h2 className="mb-6 text-3xl font-bold">
                  Pustite{" "}
                  <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
                    mnenje
                  </span>
                </h2>
                <ReviewForm serviceId={service.id} serviceName={service.name} />
              </div>
            ) : (
              <div className="border-primary/20 bg-muted/30 rounded-lg border p-8 text-center">
                <h3 className="mb-2 text-xl font-semibold">
                  Delite svojo izkušnjo
                </h3>
                <p className="text-muted-foreground mb-4">
                  Za objavo mnenja o tej storitvi se prijavite
                </p>
                <Link href="/login">
                  <Button variant="default">Prijava za objavo mnenja</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <GallerySection
        gallery={service.gallery}
        serviceName={service.name}
        title={t.public.galleryTitle}
        subtitle={t.public.gallerySubtitle(service.name)}
      />

      {/* FAQ Section */}
      <FAQSection
        faqs={service.faqs}
        title={t.public.faqTitle}
        subtitle={t.public.faqSubtitle}
      />

      {/* Related Services Section */}
      <RelatedServicesSection
        services={relatedServices}
        currentServiceId={service.id}
        orgSlug={orgSlug}
      />
    </div>
  )
}
