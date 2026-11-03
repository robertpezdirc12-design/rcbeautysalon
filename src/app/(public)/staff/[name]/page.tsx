import type { Metadata } from "next"
import { getPublicSiteData, getPublicStaffBySlug, redirectBareToTenant } from "@/lib/public-site"
import { canonicalMetadata } from "@/lib/seo"
import { notFound } from "next/navigation"
import Link from "next/link"
import { orgPath } from "@/lib/org-path"
import { formatCurrency } from "@/lib/utils/format"
import { StaffAvatar } from "@/components/landing/staff-avatar"
import {
  EnvelopeIcon,
  PhoneIcon,
  ClockIcon,
  StarIcon,
  CalendarIcon,
} from "@/components/icons"

interface StaffDetailPageProps {
  params: Promise<{ name: string }>
}

export async function generateMetadata({ params }: StaffDetailPageProps): Promise<Metadata> {
  const { name } = await params
  const site = await getPublicSiteData()
  const orgName = site?.org.name ?? "Salon"
  const staffMember = site ? await getPublicStaffBySlug(site.org.id, name) : null

  if (!staffMember) {
    return {
      title: `Član ekipe ni najden | ${orgName}`,
    }
  }

  // P1 #26: samo-referencirajoč canonical (/s/{slug}/staff/{name}).
  return canonicalMetadata(site?.org.slug, `/staff/${name}`, {
    title: `${staffMember.name} | ${orgName}`,
    description:
      staffMember.bio || `Rezervirajte termin pri ${staffMember.name} — ${orgName}.`,
  })
}

// Day names for working hours
const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

const StaffDetailPage = async ({ params }: StaffDetailPageProps) => {
  const { name } = await params
  // P1 #39-5: gola pot najprej na kanoničnega najemnika.
  await redirectBareToTenant(`/staff/${name}`)

  const site = await getPublicSiteData()
  const staffMember = site ? await getPublicStaffBySlug(site.org.id, name) : null

  if (!site || !staffMember) {
    notFound()
  }

  const orgSlug = site.org.slug

  // Convert Decimal to number for services
  const services = staffMember.services.map((s) => ({
    ...s.service,
    price: Number(s.service.price),
  }))

  // Sort working hours by day
  const workingHours = [...staffMember.workingHours].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek
  )

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Image */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative aspect-3/4 overflow-hidden rounded-3xl shadow-2xl">
                <StaffAvatar
                  image={staffMember.image}
                  name={staffMember.name}
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                {/* Decorative border */}
                <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/20" />
              </div>
              {/* Decorative element */}
              <div className="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-3xl bg-accent/20" />
            </div>

            {/* Info */}
            <div className="text-center lg:text-left">
              {/* Rating */}
              <div className="mb-4 flex items-center justify-center gap-1 lg:justify-start">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    size={20}
                    weight="fill"
                    className="text-accent-text"
                  />
                ))}
                <span className="ml-2 text-sm text-muted-foreground font-body">
                  5.0 (24 reviews)
                </span>
              </div>

              {/* Name */}
              <h1 className="font-heading mb-4 text-5xl sm:text-6xl md:text-7xl lg:text-8xl">
                {staffMember.name}
              </h1>

              {/* Bio */}
              {staffMember.bio && (
                <p className="mb-8 text-lg text-muted-foreground font-body leading-relaxed">
                  {staffMember.bio}
                </p>
              )}

              {/* Contact Info */}
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
                {staffMember.email && (
                  <a
                    href={`mailto:${staffMember.email}`}
                    className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary-text transition-colors hover:bg-primary/20 font-body"
                  >
                    <EnvelopeIcon size={18} />
                    {staffMember.email}
                  </a>
                )}
                {staffMember.phone && (
                  <a
                    href={`tel:${staffMember.phone}`}
                    className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/20 font-body"
                  >
                    <PhoneIcon size={18} />
                    {staffMember.phone}
                  </a>
                )}
              </div>

              {/* Book Button */}
              <Link
                href={orgPath(orgSlug, `/booking?staff=${staffMember.id}`)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl font-body"
              >
                <CalendarIcon size={22} />
                Rezerviraj pri {staffMember.name.split(" ")[0]}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="font-heading mb-12 text-center text-4xl md:text-5xl lg:text-6xl">
            Storitve —{" "}
            <span className="bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">
              {staffMember.name.split(" ")[0]}
            </span>
          </h2>

          {services.length === 0 ? (
            <p className="text-center text-muted-foreground font-body">
              Trenutno ni razpoložljivih storitev.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <Link
                  key={service.id}
                  href={orgPath(orgSlug, `/services/${service.slug}`)}
                  className="group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <h3 className="font-heading text-2xl transition-colors group-hover:text-accent-text">
                      {service.name}
                    </h3>
                    <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent-text font-body">
                      {formatCurrency(Number(service.price))}
                    </span>
                  </div>
                  {service.description && (
                    <p className="mb-4 text-sm text-muted-foreground line-clamp-2 font-body">
                      {service.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
                    <ClockIcon size={16} />
                    <span>{service.duration} min</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Working Hours Section */}
      {workingHours.length > 0 && (
        <section className="border-t bg-muted/30 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <h2 className="font-heading mb-12 text-center text-4xl md:text-5xl lg:text-6xl">
              Delovni{" "}
              <span className="bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">
                čas
              </span>
            </h2>

            <div className="mx-auto max-w-md">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                {dayNames.map((day, index) => {
                  const hours = workingHours.find((h) => h.dayOfWeek === index)
                  return (
                    <div
                      key={day}
                      className={`flex items-center justify-between py-3 ${
                        index !== 6 ? "border-b border-border" : ""
                      }`}
                    >
                      <span className="font-medium font-body">{day}</span>
                      {hours && hours.isActive ? (
                        <span className="text-sm text-muted-foreground font-body">
                          {hours.startTime} - {hours.endTime}
                        </span>
                      ) : (
                        <span className="text-sm text-destructive font-body">
                          Zaprto
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="border-t bg-linear-to-br from-primary/5 to-accent/5 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-heading mb-4 text-4xl md:text-5xl lg:text-6xl">
            Pripravljeni na rezervacijo?
          </h2>
          <p className="mb-8 text-muted-foreground font-body">
            Rezervirajte svoj termin pri {staffMember.name.split(" ")[0]} še
            danes
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href={orgPath(orgSlug, `/booking?staff=${staffMember.id}`)}
              className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg font-body"
            >
              Rezerviraj zdaj
            </Link>
            <Link
              href={orgPath(orgSlug, "/staff")}
              className="inline-flex items-center justify-center rounded-full border border-border px-8 py-3 font-semibold transition-colors hover:bg-muted font-body"
            >
              Vsa ekipa
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default StaffDetailPage
