import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import { auth } from "@/lib/auth/auth"
import { getResolvedOrg } from "@/lib/tenant"
import { canonicalMetadata } from "@/lib/seo"
import { orgPath } from "@/lib/org-path"
import { getPublicServicesGrouped, redirectBareToTenant } from "@/lib/public-site"
import {
  getServiceForBooking,
  getAvailableStaff,
  getSalonConfig,
  getStaffForBooking,
  getCurrentUserStaffId,
} from "@/app/actions/appointments"
import { BookingForm } from "@/components/booking/booking-form"
import { getStripeForOrg } from "@/lib/stripe"
import { getServerI18n } from "@/lib/i18n/server"

interface BookingPageProps {
  searchParams: Promise<{ service?: string; staff?: string }>
}

// P1 #26: samo-referencirajoč canonical (prej je /booking podedoval
// canonical korena najemnika — dvojni vsebinski URL v sitemapu).
export async function generateMetadata(): Promise<Metadata> {
  const org = await getResolvedOrg()
  return canonicalMetadata(org?.slug, "/booking", {
    title: "Rezervacija termina",
    robots: { index: false, follow: true },
  })
}

export default async function BookingPage(props: BookingPageProps) {
  // P1 #39-5: gola pot → kanonična najemniška pot (pod najemnikom nič).
  await redirectBareToTenant("/booking")

  const { t } = await getServerI18n()
  const searchParams = await props.searchParams
  const serviceSlug = searchParams.service
  const staffId = searchParams.staff

  // Tenant-aware redirects: /s/[slug]/booking must keep its prefix
  const org = await getResolvedOrg()
  const p = (path: string) => orgPath(org?.slug, path)
  // Profile guard (EPIC #1 §21) lives in booking/layout.tsx — shell faza,
  // tako da je preusmeritev pravi 307 (P0 #24).

  // Get current session
  const session = await auth()

  // Prepare default values for authenticated users
  const defaultValues = session?.user
    ? {
        firstName: session.user.name?.split(" ")[0] || "",
        lastName: session.user.name?.split(" ").slice(1).join(" ") || "",
        email: session.user.email || "",
      }
    : undefined

  // Check if user is employee (STAFF or ADMIN)
  const isEmployee =
    session?.user?.role === "STAFF" || session?.user?.role === "ADMIN"

  // Get current user's staff ID (to prevent self-booking for employees)
  const currentUserStaffId = isEmployee ? await getCurrentUserStaffId() : null

  // Get salon config (needed for both flows)
  const salonConfig = await getSalonConfig()

  // Payments are optional (E4-3b): when the salon has no Stripe key the
  // booking is submitted without online payment (PENDING, deposit payable
  // in salon) instead of dead-ending at checkout.
  const paymentsEnabled = org ? !!(await getStripeForOrg(org)) : false

  // ============================================
  // FLOW 1: Staff-first (?staff=xxx)
  // User selected a staff member first, now picks service
  // ============================================
  if (staffId) {
    if (isEmployee && currentUserStaffId === staffId) {
      redirect(p("/staff?error=self-booking"))
    }

    const staffData = await getStaffForBooking(staffId)

    // Redirect if staff not found or inactive
    if (!staffData) {
      redirect(p("/staff"))
    }

    // Redirect if staff has no services
    if (staffData.services.length === 0) {
      redirect(p("/staff"))
    }

    return (
      <div className="from-muted/30 via-background to-muted/20 min-h-screen bg-linear-to-b py-12">
        <div className="container mx-auto max-w-6xl px-4">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="from-primary to-accent mb-2 bg-linear-to-r bg-clip-text text-4xl font-bold text-transparent">
              {t.booking.bookWithStaff(staffData.name)}
            </h1>
            <p className="text-muted-foreground text-lg">
              Izberite storitev in željeni termin
            </p>
          </div>

          {/* Booking Form - Staff-first mode */}
          <BookingForm
            mode="staff-first"
            preselectedStaff={staffData}
            staffServices={staffData.services}
            salonConfig={salonConfig}
            isAuthenticated={!!session?.user}
            isEmployee={isEmployee}
            paymentsEnabled={paymentsEnabled}
            defaultValues={defaultValues}
          />
        </div>
      </div>
    )
  }

  // ============================================
  // FLOW 0: No selection — step 1: pick a service.
  // The header CTA "Rezerviraj" lands here; instead of bouncing the
  // visitor to the services page, the wizard starts inline with an
  // org-scoped service picker (P0-2).
  // ============================================
  if (!serviceSlug) {
    if (!org) redirect("/")
    const servicesByCategory = await getPublicServicesGrouped(org.id)
    const categories = Object.entries(servicesByCategory)

    return (
      <div className="from-muted/30 via-background to-muted/20 min-h-screen bg-linear-to-b py-12">
        <div className="container mx-auto max-w-6xl px-4">
          {/* Header */}
          <div className="mb-10 text-center">
            <h1 className="from-primary to-accent mb-2 bg-linear-to-r bg-clip-text text-4xl font-bold text-transparent">
              {t.booking.bookTitle}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t.booking.bookSubtitleFlow0}
            </p>
          </div>

          {categories.length === 0 && (
            <div className="text-center text-muted-foreground">
              <p>Trenutno ni razpoložljivih storitev.</p>
              <Link
                href={p("/")}
                className="text-primary-text underline-offset-4 hover:underline"
              >
                Nazaj na domačo stran
              </Link>
            </div>
          )}

          {categories.map(([categoryName, services]) => (
            <section key={categoryName} className="mb-10">
              <h2 className="mb-4 text-xl font-semibold tracking-tight">
                {categoryName}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* P2 #12 (audit-2026-11): no aria-label on the card — the
                    visible name/price/duration content is the accessible
                    name (label-content-name-mismatch). */}
                {services.map((service) => (
                  <Link
                    key={service.id}
                    href={p(`/booking?service=${service.slug}`)}
                    className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {service.imageUrl && (
                      <div className="relative h-40 w-full overflow-hidden">
                        <Image
                          src={service.imageUrl}
                          alt={service.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <h3 className="truncate font-medium">{service.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {service.duration} min
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-primary-text">
                          {service.price.toNumber().toFixed(2).replace(".", ",")} €
                        </p>
                        <p className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary-text">
                          Izberi →
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  const service = await getServiceForBooking(serviceSlug)

  if (!service) {
    redirect(p("/services"))
  }

  let availableStaff = await getAvailableStaff(service.id)

  // Filter out current employee from available staff (employees can't book with themselves)
  if (isEmployee && currentUserStaffId) {
    availableStaff = availableStaff.filter((s) => s.id !== currentUserStaffId)
  }

  return (
    <div className="from-muted/30 via-background to-muted/20 min-h-screen bg-linear-to-b py-12">
      <div className="container mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="from-primary to-accent mb-2 bg-linear-to-r bg-clip-text text-4xl font-bold text-transparent">
            {t.booking.bookTitle}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t.booking.bookSubtitleService}
          </p>
        </div>

        {/* Booking Form - Service-first mode (original) */}
        <BookingForm
          mode="service-first"
          service={service}
          availableStaff={availableStaff}
          salonConfig={salonConfig}
          isAuthenticated={!!session?.user}
          isEmployee={isEmployee}
          paymentsEnabled={paymentsEnabled}
          defaultValues={defaultValues}
        />
      </div>
    </div>
  )
}
