import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeftIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  ScissorsIcon,
  CurrencyDollarIcon,
  PhoneIcon,
  EnvelopeIcon,
} from "@/components/icons"
import { getAppointmentById } from "@/app/actions/appointments"
import { TipRecorder } from "@/components/dashboard/tip-recorder"
import { formatSalonTime } from "@/lib/booking-time"
import { getSessionSalonTimezone } from "@/lib/tenant"
import { formatCurrency, formatDateStandard } from "@/lib/utils/format"
import { AppointmentStatusActions } from "@/components/appointments/status-actions"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-500 text-white",
  CONFIRMED: "bg-blue-500 text-white",
  COMPLETED: "bg-green-500 text-white",
  CANCELLED: "bg-red-500 text-white",
  NO_SHOW: "bg-gray-500 text-white",
}

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const [appointment, { t, locale }] = await Promise.all([
    getAppointmentById(id),
    getServerI18n(),
  ])

  if (!appointment) {
    return {
      title: t.appointments.details.notFoundTitle,
    }
  }

  const customerName =
    appointment.customer?.name || appointment.guestName || t.appointments.details.guest

  return {
    title: t.appointments.details.metaTitle(customerName),
    description: t.appointments.details.metaDescription(
      customerName,
      formatDateStandard(new Date(appointment.startTime), locale)
    ),
  }
}

export default async function AppointmentDetailPage({ params }: PageProps) {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("appointments.view")
  const [{ t, locale }, salonTz] = await Promise.all([
    getServerI18n(),
    getSessionSalonTimezone(),
  ])
  const { id } = await params
  const appointment = await getAppointmentById(id)

  if (!appointment) {
    notFound()
  }

  // #96: sprejemni obrazec (odgovori gostov ob rezervaciji) — org-scoped
  // prek getAppointmentById (org.zid) … posamična poizvedba po povezani
  // prijavi; brez nje sekcija ne renderira.
  const intakeSubmission = await prisma.formSubmission.findFirst({
    where: {
      contextType: "appointment",
      contextId: appointment.id,
    },
    include: { formDefinition: { select: { name: true, fields: true } } },
    orderBy: { createdAt: "desc" },
  })
  const intakeFields = Array.isArray(intakeSubmission?.formDefinition.fields)
    ? (intakeSubmission.formDefinition.fields as {
        key: string
        label: string
        required: boolean
      }[])
    : []
  const intakeData =
    intakeSubmission && typeof intakeSubmission.data === "object"
      ? (intakeSubmission.data as Record<string, unknown>)
      : {}

  const totalDuration = appointment.services.reduce(
    (sum, s) => sum + (s.service.duration || 0),
    0
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/appointments">
            <Button variant="ghost" size="icon">
              <ArrowLeftIcon size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              {t.appointments.details.detailsTitle}
            </h1>
            <p className="text-muted-foreground">
              {t.appointments.details.booking}
              {appointment.id.slice(-8)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t.appointments.details.statusTitle}</CardTitle>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusColors[appointment.status]}`}
                >
                  {t.common.status[appointment.status]}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <AppointmentStatusActions
                appointmentId={appointment.id}
                currentStatus={appointment.status}
              />
            </CardContent>
          </Card>

          {/* Service Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScissorsIcon size={20} />
                {t.appointments.details.serviceDetails}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {appointment.services.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.service.name}</p>
                    {s.service.description && (
                      <p className="text-muted-foreground text-sm">
                        {s.service.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                    <CalendarIcon size={20} className="text-primary-text" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t.appointments.details.date}
                    </p>
                    <p className="font-medium">
                      {formatDateStandard(new Date(appointment.startTime), locale)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                    <ClockIcon size={20} className="text-primary-text" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t.appointments.details.time}
                    </p>
                    <p className="font-medium">
                      {formatSalonTime(new Date(appointment.startTime), salonTz)} -{" "}
                      {formatSalonTime(new Date(appointment.endTime), salonTz)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-muted-foreground text-sm">
                {t.appointments.details.totalDurationMinutes(totalDuration)}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>{t.appointments.details.notesTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {appointment.notes || t.appointments.details.noNotes}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon size={20} />
                {t.appointments.details.customerTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium">
                  {appointment.customer?.name ||
                    appointment.guestName ||
                    t.appointments.details.guest}
                </p>
              </div>
              <div className="space-y-2">
                {(appointment.customer?.email || appointment.guestEmail) && (
                  <div className="flex items-center gap-2 text-sm">
                    <EnvelopeIcon size={16} className="text-muted-foreground" />
                    <span>
                      {appointment.customer?.email || appointment.guestEmail}
                    </span>
                  </div>
                )}
                {(appointment.customer?.phone || appointment.guestPhone) && (
                  <div className="flex items-center gap-2 text-sm">
                    <PhoneIcon size={16} className="text-muted-foreground" />
                    <span>
                      {appointment.customer?.phone || appointment.guestPhone}
                    </span>
                  </div>
                )}
              </div>
              {appointment.customer?.userId && (
                <Link href={`/dashboard/users/${appointment.customer.userId}`}>
                  <Button variant="outline" className="w-full" size="sm">
                    {t.appointments.details.viewCustomerProfile}
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Staff Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t.appointments.details.assignedStaff}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary-text flex h-12 w-12 items-center justify-center rounded-full font-semibold">
                  {appointment.staff.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <p className="font-medium">{appointment.staff.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {t.appointments.details.staffMember}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CurrencyDollarIcon size={20} />
                {t.appointments.details.paymentTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>{t.appointments.details.serviceTotal}</span>
                <span>{formatCurrency(appointment.totalPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t.appointments.details.deposit}</span>
                <span
                  className={
                    appointment.depositPaid
                      ? "text-green-600"
                      : "text-yellow-600"
                  }
                >
                  {appointment.depositPaid
                    ? `${formatCurrency(appointment.depositAmount)} (${t.appointments.details.paid})`
                    : t.appointments.details.notPaid}
                </span>
              </div>
              {/* #79: napitnina — ločena vrstica, NE del storitvenega prihodka. */}
              {appointment.tipAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>{t.appointments.details.tip}</span>
                  <span className="text-green-600">
                    {formatCurrency(appointment.tipAmount)}
                    {appointment.tipMethod
                      ? ` (${appointment.tipMethod === "card" ? t.appointments.details.tipCard : t.appointments.details.tipCash})`
                      : ""}
                  </span>
                </div>
              )}
              {appointment.status === "COMPLETED" && appointment.commissionAmount !== null && (
                <div className="flex justify-between text-sm">
                  <span>{t.appointments.details.commission}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(appointment.commissionAmount)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-medium">
                <span>{t.appointments.details.balanceDue}</span>
                <span>
                  {formatCurrency(
                    Math.max(
                      0,
                      appointment.totalPrice -
                        (appointment.depositPaid ? appointment.depositAmount : 0)
                    )
                  )}
                </span>
              </div>
              <Separator />
              {/* #79: hitri zapis napitnine (0/5/10 % ali znesek po meri). */}
              <TipRecorder
                appointmentId={appointment.id}
                totalPrice={appointment.totalPrice}
                currentTip={appointment.tipAmount}
                currentMethod={appointment.tipMethod}
                labels={{
                  title: t.appointments.details.tip,
                  hint: t.appointments.details.tipHint,
                  amount: t.appointments.details.tipAmountLabel,
                  method: t.appointments.details.tipMethod,
                  cash: t.appointments.details.tipCash,
                  card: t.appointments.details.tipCard,
                  save: t.appointments.details.tipSave,
                  saved: t.appointments.details.tipSaved,
                  failed: t.appointments.details.tipFailed,
                }}
              />
            </CardContent>
          </Card>

          {/* Booking Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t.appointments.details.bookingInfo}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              <p>
                {t.appointments.details.createdOn(
                  formatDateStandard(new Date(appointment.createdAt), locale)
                )}
              </p>
              <p>
                {t.appointments.details.bookingId} #{appointment.id.slice(-8)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* #96: sprejemni obrazec — odgovori, ki jih je gost izpolnil
          ob rezervaciji (povezani prek FormSubmission contextId). */}
      {intakeSubmission && intakeFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {intakeSubmission.formDefinition.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {intakeFields.map((f) => (
              <div key={f.key} className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="text-foreground font-medium">
                  {String(intakeData[f.key] ?? "—")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
