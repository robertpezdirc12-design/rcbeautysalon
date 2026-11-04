import { useFormatPrice } from "@/lib/currency"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  WarningCircleIcon,
  CalendarCheckIcon,
  CalendarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  InfoIcon,
  SpinnerGapIcon,
} from "@/components/icons"
import { format } from "date-fns"
import { AvailableStaffMember, TimeSlot } from "@/lib/interfaces"
import { useI18n } from "@/lib/i18n/provider"
import { getDateFnsLocale } from "@/lib/i18n/dictionaries"
// #79: polog kot pravilo — čisti helper, deljen s strežnikom.
import { resolveDeposit } from "@/lib/booking/deposit"

interface BookingSummaryCardProps {
  service: {
    name: string
    price: number
    duration: number
    // #79: deposit rule fields (optional — INHERIT fallback)
    depositType?: "INHERIT" | "NONE" | "FIXED" | "PERCENT"
    depositValue?: number | null
  } | null
  selectedStaff?: AvailableStaffMember
  selectedDate?: Date
  selectedTime?: string
  salonConfig: {
    bookingDeposit: number
    bookingDepositType?: "INHERIT" | "NONE" | "FIXED" | "PERCENT"
    depositRefundable: boolean
  }
  submitting: boolean
  error: string | null
  availableSlots: TimeSlot[]
  // #92: izbrani dodatki — vidni v povzetku PRED potrditvijo
  selectedAddons?: { name: string; price: number; durationMin: number }[]
  isEmployee?: boolean
  // False when the salon has no Stripe key: the booking is submitted
  // WITHOUT online payment (PENDING, deposit payable in salon).
  paymentsEnabled?: boolean
}

export function BookingSummaryCard({
  service,
  selectedStaff,
  selectedDate,
  selectedTime,
  selectedAddons = [],
  salonConfig,
  submitting,
  error,
  availableSlots,
  isEmployee = false,
  paymentsEnabled = true,
}: BookingSummaryCardProps) {
  const fmt = useFormatPrice()
  const { t, locale, withBusiness } = useI18n()

  // #79: polog je PRAVILO — isti čisti helper kot na strežniku (booking
  // akcija, Stripe, webhook). 15 € storitev z org pologom 50 € prikaže 15 €,
  // ne 50 €; oproščena storitev (NONE) pokaže "brez pologa".
  const resolvedDeposit =
    service && !isEmployee
      ? resolveDeposit(
          {
            price: service.price,
            depositType: service.depositType ?? "INHERIT",
            depositValue: service.depositValue ?? null,
          },
          {
            bookingDeposit: salonConfig.bookingDeposit,
            bookingDepositType: salonConfig.bookingDepositType ?? "FIXED",
          }
        )
      : 0
  const depositExempt = service?.depositType
    ? service.depositType === "NONE"
    : (salonConfig.bookingDepositType ?? "FIXED") === "NONE"
  const dfLocale = getDateFnsLocale(locale)
  const selectedSlot = availableSlots.find((s) => s.time === selectedTime)

  // P1 #9 (audit-2026-11): a visible checklist of what's still missing, so
  // the submit button can't look broken when it refuses an incomplete
  // booking. Rendered right above the CTA with aria-live="polite".
  const missing: string[] = []
  if (!service?.name) missing.push(t.booking.service)
  if (!selectedStaff) missing.push(t.booking.staff)
  if (!selectedDate || !selectedTime) missing.push(t.booking.dateTime)

  // Calculate employee discount (20%) — na celotno košarico (storitev +
  // dodatki), enako kot strežnik v createAppointment/createCheckout.
  const employeeDiscountRate = 0.20
  const addonsPrice = selectedAddons.reduce((s, a) => s + a.price, 0)
  const addonsDuration = selectedAddons.reduce((s, a) => s + a.durationMin, 0)
  const originalPrice = (service?.price || 0) + addonsPrice
  const discountAmount = isEmployee ? originalPrice * employeeDiscountRate : 0
  const finalPrice = originalPrice - discountAmount

  return (
    <div className="space-y-4">
      <Card className="sticky top-4 border-border/50 shadow-xl">
        <CardHeader className="rounded-t-lg bg-linear-to-br from-primary/10 via-primary/5 to-accent/10 dark:from-primary/20 dark:via-primary/10 dark:to-accent/15">
          <CardTitle className="text-foreground">{t.booking.summaryTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-muted-foreground">{t.booking.service}</p>
              <p className="text-base font-medium text-foreground">{service?.name || t.booking.notSelected}</p>
            </div>
            <Separator className="bg-border/50" />
            <div>
              <p className="font-semibold text-muted-foreground">{t.booking.staff}</p>
              <p className="text-base font-medium text-foreground">
                {selectedStaff ? selectedStaff.name : t.booking.notSelected}
              </p>
            </div>
            <Separator className="bg-border/50" />
            <div>
              <p className="font-semibold text-muted-foreground">{t.booking.dateTime}</p>
              <p className="text-base font-medium text-foreground">
                {selectedDate && selectedTime ? (
                  <>
                    <CalendarIcon
                      size={14}
                      className="mr-1 inline text-primary-text"
                      weight="regular"
                    />
                    {format(selectedDate, locale === "sl" ? "d. MMMM yyyy" : "MMMM d, yyyy", { locale: dfLocale })} {t.booking.atSeparator}{" "}
                    {selectedSlot?.formattedTime || selectedTime}
                  </>
                ) : (
                  t.booking.notSelected
                )}
              </p>
            </div>
            <Separator className="bg-border/50" />
            <div>
              <p className="font-semibold text-muted-foreground">{t.booking.duration}</p>
              <p className="text-base font-medium text-foreground">
                <ClockIcon size={14} className="mr-1 inline text-primary-text" weight="regular" />
                {t.booking.minutes((service?.duration || 0) + addonsDuration)}
              </p>
            </div>
            {selectedAddons.length > 0 && (
              <>
                <Separator className="bg-border/50" />
                <div>
                  <p className="font-semibold text-muted-foreground">{t.booking.addonsTitle}</p>
                  <ul className="mt-1 space-y-1">
                    {selectedAddons.map((a) => (
                      <li key={a.name} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">
                          + {a.name}
                          {a.durationMin > 0 ? (
                            <span className="text-muted-foreground"> · +{a.durationMin} min</span>
                          ) : null}
                        </span>
                        <span className="font-medium text-foreground">{fmt(a.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>

          <Separator className="my-4 bg-border/50" />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.booking.servicePrice}</span>
              <span className="font-medium text-foreground">{fmt(originalPrice)}</span>
            </div>
            {isEmployee && (
              <div className="flex justify-between text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <span>{t.booking.employeeDiscount}</span>
                <span>-{fmt(discountAmount)}</span>
              </div>
            )}
            {isEmployee && (
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-foreground">{t.booking.finalPrice}</span>
                <span className="text-primary-text">{fmt(finalPrice)}</span>
              </div>
            )}
            <Separator className="my-2 bg-border/50" />
            <div className="flex justify-between text-lg font-bold">
              <span className="text-foreground">
                {paymentsEnabled || isEmployee
                  ? t.booking.requiredDeposit
                  : t.booking.depositInSalon}
              </span>
              {isEmployee ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  {t.booking.notRequired}
                </span>
              ) : paymentsEnabled ? (
                <span className="text-primary-text">
                  {/* #79: izračunani polog (per storitev); oproščena storitev
                      (NONE) pokaže "ni potreben" namesto 0,00 €. */}
                  {depositExempt ? t.booking.notRequired : fmt(resolvedDeposit)}
                </span>
              ) : (
                <span className="text-primary-text">
                  {/* P2 #84: "v salonu" / "At the salon" — prva črka velika,
                      ker je samostojna vrednost v vrstici. */}
                  {withBusiness(t.booking.depositInSalonValue).replace(
                    /^./,
                    (c) => c.toUpperCase()
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Payment info box — honest state per payment availability */}
          {!isEmployee && !paymentsEnabled ? (
            <div className="rounded-xl border-2 border-sky-300 bg-sky-50 p-4 dark:border-sky-700 dark:bg-sky-950/40">
              <div className="flex gap-3">
                <InfoIcon
                  size={32}
                  weight="fill"
                  className="shrink-0 text-sky-700 dark:text-sky-400"
                />
                <div className="space-y-1">
                  <p className="text-base font-bold text-sky-950 dark:text-sky-300">
                    {withBusiness(t.booking.depositInSalonBoxTitle)}
                  </p>
                  <p className="text-sm text-sky-900 dark:text-sky-400">
                    {withBusiness(t.booking.depositInSalonBoxBody)}
                  </p>
                </div>
              </div>
            </div>
          ) : !isEmployee ? (
            <div className="rounded-xl border-2 border-amber-400 bg-white p-4 dark:border-amber-600 dark:bg-amber-950/40">
              <div className="flex gap-3">
                <WarningCircleIcon
                  size={32}
                  weight="fill"
                  className="shrink-0 text-amber-700 dark:text-amber-400"
                />
                <div className="space-y-1">
                  <p className="text-base font-bold text-amber-950 dark:text-amber-300">
                    {t.booking.nonRefundableTitle}
                  </p>
                  <p className="text-sm text-amber-900 dark:text-amber-400">
                    {t.booking.nonRefundableIntro(
                      // #79: isti izračunani polog, ne globalna številka.
                      fmt(resolvedDeposit)
                    )}
                    <strong className="font-bold">{t.booking.nonRefundableStrong}</strong>.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-emerald-400 bg-emerald-100 p-4 dark:border-emerald-600 dark:bg-emerald-950/50">
              <div className="flex gap-3">
                <div className="shrink-0 text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  ✓
                </div>
                <div className="space-y-1">
                  <p className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                    {t.booking.employeeBoxTitle}
                  </p>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    {t.booking.employeeBoxBody}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-3 pt-6">
          {error && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive w-full rounded-lg border-2 p-3 text-sm">
              <WarningCircleIcon
                size={16}
                className="mr-1 inline"
                weight="regular"
              />
              {error}
            </div>
          )}
          {missing.length > 0 && (
            <div
              aria-live="polite"
              className="border-accent/40 bg-accent/10 text-foreground w-full rounded-lg border p-3 text-sm"
            >
              <p className="font-semibold">{t.booking.missingHeading}</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          <Button
            type="submit"
            className="w-full text-base shadow-lg transition-all hover:scale-105"
            size="lg"
            disabled={submitting}
          >
            {submitting ? (
              <SpinnerGapIcon
                size={20}
                className="animate-spin"
                weight="regular"
              />
            ) : isEmployee ? (
              <>
                <CurrencyDollarIcon size={20} className="mr-2" weight="regular" />
                {t.booking.confirmEmployee}
              </>
            ) : paymentsEnabled ? (
              <>
                <CurrencyDollarIcon size={20} className="mr-2" weight="regular" />
                {t.booking.payAndConfirm(
                  // #79: CTA nosi izračunani polog — združljivo s Stripe sejo.
                  fmt(resolvedDeposit)
                )}
              </>
            ) : (
              <>
                <CalendarCheckIcon size={20} className="mr-2" weight="regular" />
                {t.booking.submitNoPayment}
              </>
            )}
          </Button>

          {/* Test Mode Indicator */}
          {process.env.NODE_ENV === "development" && (
            <div className="w-full rounded-lg border border-border bg-muted/50 p-3 text-xs">
              <p className="mb-1 font-bold text-muted-foreground">
                Testni način – brez pravih obremenitev
              </p>
              <p className="text-muted-foreground">
                Kartica: <code className="rounded bg-background px-1.5 py-0.5 font-mono font-bold text-foreground">4242 4242 4242 4242</code>
              </p>
              <p className="text-muted-foreground">
                Veljavnost: katerikoli prihodnji datum • CVV: katerikoli 3-mestni
              </p>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
