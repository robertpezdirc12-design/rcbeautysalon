import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { CheckCircle, CalendarCheck, House, Clock } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { verifyAndCreateAppointment } from "@/app/actions/stripe"
import { getStripeForOrg } from "@/lib/stripe"
import { getOrgTimezone } from "@/app/actions/appointments"
import { getPublicSiteData } from "@/lib/public-site"
import { orgPath } from "@/lib/org-path"
import { prisma } from "@/lib/prisma"
import { formatSalonTime } from "@/lib/booking-time"
import { format } from "date-fns"
import { sl } from "date-fns/locale"

export async function generateMetadata(): Promise<Metadata> {
  const site = await getPublicSiteData()
  const orgName = site?.org.name ?? "Salon"
  return {
    title: `Rezervacija potrjena | ${orgName}`,
    description: "Vaš termin je bil uspešno rezerviran",
  }
}

async function BookingSuccessContent({
  sessionId,
  orgSlug,
}: {
  sessionId: string | null
  orgSlug: string | null
}) {
  if (!sessionId) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-destructive">Neveljavna seja</CardTitle>
          <CardDescription>
            Plačilne seje ni bilo mogoče najti. Poskusite znova rezervirati termin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={orgPath(orgSlug, "/services")}>Nazaj na storitve</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Verify payment and create appointment (works as fallback if webhook didn't fire)
  const result = await verifyAndCreateAppointment(sessionId)

  if (!result.success) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-destructive">Plačilo ni bilo zaključeno</CardTitle>
          <CardDescription>
            {result.error || "Plačilo ni bilo zaključeno. Poskusite znova."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={orgPath(orgSlug, "/services")}>Nazaj na storitve</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-lg text-center">
      <CardHeader className="space-y-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle size={48} weight="fill" className="text-green-600 dark:text-green-400" />
        </div>
        <CardTitle className="text-2xl">Rezervacija potrjena!</CardTitle>
        <CardDescription className="text-base">
          Vaš termin je bil uspešno rezerviran, polog pa je bremenjen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg bg-muted/50 p-4 text-sm">
          <p className="text-muted-foreground">
            Potrditveno e-poštno sporočilo smo poslali na{" "}
            <strong className="text-foreground">{result.customerEmail}</strong>{" "}
            z vsemi podrobnostmi vašega termina.
          </p>
        </div>

        {result.intakeToken && (
          <div className="rounded-lg border p-4 text-sm">
            <p className="font-medium">Sprejemni obrazec</p>
            <p className="text-muted-foreground mt-1">
              Če še niste izpolnili sprejemnega obrazca, ga lahko oddate prek
              povezave.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={`/intake/${result.intakeToken}`}>
                Izpolni sprejemni obrazec
              </Link>
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href={orgPath(orgSlug, "/my-appointments")}>
              <CalendarCheck size={20} className="mr-2" weight="regular" />
              Moji termini
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={orgPath(orgSlug, "/")}>
              <House size={20} className="mr-2" weight="regular" />
              Nazaj domov
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string
    appointment?: string
    setup?: string
  }>
}) {
  const params = await searchParams

  // #97 (AD-07): garancija s kartico — Checkout SETUP seja. Verify
  // (idempotenten z webhookom): shrani SI/Customer na termin (SAVED →
  // CONFIRMED) in pokaže pošteno sporočilo (kartica shranjena, nič
  // zaračunano).
  if (params.setup && params.appointment) {
    const site = await getPublicSiteData()
    const orgSlug = site?.org.slug ?? null
    if (!site?.org.id) {
      return (
        <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16">
          <Card className="mx-auto max-w-lg text-center">
            <CardHeader>
              <CardTitle className="text-destructive">
                Rezervacija ni bila najdena
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )
    }
    // Stripe ključ izključno najemnika (E4-3b) — brez platform fallbacka.
    const stripeOrg = await prisma.organization.findUnique({
      where: { id: site.org.id },
      select: { stripeSecretKey: true },
    })
    const stripe = getStripeForOrg(stripeOrg)
    let saved = false
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.retrieve(params.setup)
        if (
          session.mode === "setup" &&
          session.metadata?.appointmentId === params.appointment
        ) {
          const res = await prisma.appointment.updateMany({
            where: { id: params.appointment, noShowSetupStatus: "PENDING" },
            data: {
              stripeSetupIntentId:
                typeof session.setup_intent === "string"
                  ? session.setup_intent
                  : null,
              stripeCustomerId:
                typeof session.customer === "string" ? session.customer : null,
              noShowSetupStatus: "SAVED",
              status: "CONFIRMED",
            },
          })
          saved = res.count > 0
        }
      } catch {
        // webhook bo poskrbel; sporočilo ostane nevtralno
      }
    }

    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16">
        <Card className="mx-auto max-w-lg text-center">
          <CardHeader className="space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle size={48} weight="fill" className="text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">
              {saved ? "Rezervacija potrjena!" : "Rezervacija je oddana"}
            </CardTitle>
            <CardDescription className="text-base">
              {saved
                ? "Kartica je shranjena kot garancija (ničesar nismo zaračunali). Ob ne-prihodu brez odjave bomo zaračunali polog."
                : "Rezervacija je oddana; potrditev garancije sledi."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="lg">
              <Link href={orgPath(orgSlug, "/")}>
                <House size={20} className="mr-2" weight="regular" />
                Nazaj domov
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sessionId = params.session_id || null
  const appointmentId = params.appointment || null
  const site = await getPublicSiteData()
  const orgSlug = site?.org.slug ?? null

  // No-payment booking (salon without Stripe, E4-3b): the appointment was
  // created directly as PENDING — show honest "submitted" state.
  if (appointmentId) {
    // IDOR guard: scope the lookup to THIS tenant (same class of fix as the
    // dashboard order detail). A foreign or unknown id must be indistinguishable
    // from a missing one — never confirm an id exists elsewhere.
    const appointment = site?.org.id
      ? await prisma.appointment.findFirst({
          where: { id: appointmentId, organizationId: site.org.id },
          include: {
            services: { include: { service: true } },
            staff: { select: { name: true } },
          },
        })
      : null

    const tz = site?.org.id ? await getOrgTimezone(site.org.id) : "Europe/Ljubljana"
    const serviceNames =
      appointment?.services.map((s) => s.service.name).join(", ") || null
    const when = appointment
      ? `${format(new Date(appointment.startTime), "d. MMMM yyyy", { locale: sl })} ob ${formatSalonTime(new Date(appointment.startTime), tz)}`
      : null

    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16">
        {appointment ? (
          <Card className="mx-auto max-w-lg text-center">
            <CardHeader className="space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Clock size={48} weight="fill" className="text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-2xl">Rezervacija oddana!</CardTitle>
              <CardDescription className="text-base">
                {/* P2 #84: pasiv brez samostalnika — ne morem napačno
                    poimenovati podjetja (mechanic ≠ salon). */}
                Vaša rezervacija je bila posredovana. Termin bo potrjen po
                pregledu, znesek (
                {appointment.totalPrice.toNumber().toFixed(2).replace(".", ",")}{" "}
                €) pa poravnajte ob obisku.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg bg-muted/50 p-4 text-sm text-left">
                {serviceNames && (
                  <p>
                    <span className="text-muted-foreground">Storitev:</span>{" "}
                    <strong className="text-foreground">{serviceNames}</strong>
                  </p>
                )}
                {when && (
                  <p>
                    <span className="text-muted-foreground">Termin:</span>{" "}
                    <strong className="text-foreground">{when}</strong>
                  </p>
                )}
                {appointment.staff?.name && (
                  <p>
                    <span className="text-muted-foreground">Pri:</span>{" "}
                    <strong className="text-foreground">{appointment.staff.name}</strong>
                  </p>
                )}
              </div>

              {/* #96 v2: povezava do sprejemnega obrazca (izpolnjevanje
                  po rezervaciji) — samo ko storitev ima obrazec. */}
              {appointment.intakeToken && (
                <div className="rounded-lg border p-4 text-sm">
                  <p className="font-medium">Sprejemni obrazec</p>
                  <p className="text-muted-foreground mt-1">
                    Če še niste izpolnili sprejemnega obrazca, ga lahko oddate
                    prek povezave.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href={`/intake/${appointment.intakeToken}`}>
                      Izpolni sprejemni obrazec
                    </Link>
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg">
                  <Link href={orgPath(orgSlug, "/")}>
                    <House size={20} className="mr-2" weight="regular" />
                    Nazaj domov
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mx-auto max-w-lg text-center">
            <CardHeader>
              <CardTitle className="text-destructive">Rezervacija ni bila najdena</CardTitle>
              <CardDescription>
                Te rezervacije ni bilo mogoče najti. Poskusite znova ali kontaktirajte salon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={orgPath(orgSlug, "/services")}>Nazaj na storitve</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16">
      <Suspense
        fallback={
          <Card className="mx-auto max-w-lg text-center">
            <CardContent className="py-12">
              <p className="text-muted-foreground">Preverjanje plačila...</p>
            </CardContent>
          </Card>
        }
      >
        <BookingSuccessContent sessionId={sessionId} orgSlug={orgSlug} />
      </Suspense>
    </div>
  )
}
