"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { SpinnerGapIcon } from "@/components/icons"
import { format, addDays } from "date-fns"
import { getAvailableTimeSlots } from "@/app/actions/appointments"
import { TimeSlot } from "@/lib/interfaces"
import type { BookingResource } from "@/app/actions/appointments"
import { useI18n } from "@/lib/i18n/provider"
import { getDateFnsLocale } from "@/lib/i18n/dictionaries"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DateTimeStepProps {
  selectedStaffId: string
  serviceDuration: number
  selectedDate: Date | undefined
  selectedTime: string
  onSelectDate: (date: Date | undefined) => void
  onSelectTime: (time: string) => void
  maxBookingAdvance: number
  dateError?: string
  timeError?: string
  // E2-7 (G7): optional workspace resources — rendered ONLY when the org
  // profile enables workspace-resources + appointments AND at least one
  // resource exists. Empty for everyone else (no visual change).
  resources?: BookingResource[]
  selectedResourceId?: string | null
  onSelectResource?: (id: string | null) => void
}

export function DateTimeStep({
  selectedStaffId,
  serviceDuration,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
  maxBookingAdvance,
  dateError,
  timeError,
  resources = [],
  selectedResourceId = null,
  onSelectResource,
}: DateTimeStepProps) {
  const { t, locale, withBusiness } = useI18n()
  const dfLocale = getDateFnsLocale(locale)
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Load available time slots when staff and date are selected
  useEffect(() => {
    async function loadTimeSlots() {
      if (!selectedStaffId || !selectedDate) {
        setAvailableSlots([])
        return
      }

      setLoadingSlots(true)
      try {
        // Send a plain "yyyy-MM-dd" key — the server interprets it in the
        // salon's timezone (never the server's own clock).
        const dateKey = format(selectedDate, "yyyy-MM-dd")
        const slots = await getAvailableTimeSlots(
          selectedStaffId,
          dateKey,
          serviceDuration,
          selectedResourceId
        )
        setAvailableSlots(slots)
      } catch (err) {
        console.error("Error loading time slots:", err)
        setAvailableSlots([])
      } finally {
        setLoadingSlots(false)
      }
    }

    loadTimeSlots()
  }, [selectedStaffId, selectedDate, serviceDuration, selectedResourceId])

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
            3
          </div>
          <CardTitle>{t.booking.pickDateTime}</CardTitle>
        </div>
        <CardDescription>{withBusiness(t.booking.pickDateTimeDesc)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!selectedStaffId ? (
          <p className="text-center text-sm text-muted-foreground">
            {t.booking.pickStaffFirst}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={onSelectDate}
                  disabled={(date) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const maxDate = addDays(today, maxBookingAdvance)
                    return date < today || date > maxDate
                  }}
                  className="rounded-lg border shadow-sm"
                />
              </div>
              {dateError && <p className="text-center text-sm text-destructive">{dateError}</p>}
            </div>

            {/* E2-7 (G7): optional resource differentiator — only when the
                profile offers workspace resources and at least one exists. */}
            {resources.length > 0 && onSelectResource && (
              <div className="space-y-2">
                <Label htmlFor="booking-resource" className="block text-sm font-medium">
                  {t.booking.resourceLabel}
                </Label>
                <Select
                  value={selectedResourceId ?? "none"}
                  onValueChange={(v) => onSelectResource(v === "none" ? null : v)}
                >
                  <SelectTrigger id="booking-resource" className="w-full sm:w-72">
                    <SelectValue placeholder={t.booking.resourcePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.booking.resourceNone}</SelectItem>
                    {resources.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {/* P2 #15 (audit-2026-11): samo ime — "Stol 1 — Stol"
                            ponavlja vrsto, ki jo stranki ni treba videti. */}
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t.booking.resourceNote}
                </p>
              </div>
            )}

            {selectedDate && (
              <div className="space-y-2">
                <Label className="block text-base font-semibold">
                  {t.booking.slotsFor(format(selectedDate, locale === "sl" ? "d. MMMM yyyy" : "MMMM d, yyyy", { locale: dfLocale }))}
                </Label>
                {loadingSlots ? (
                  <div className="flex justify-center py-8">
                    <SpinnerGapIcon size={32} className="animate-spin text-primary-text" weight="regular" />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="space-y-2 text-center">
                    <p className="text-muted-foreground">{t.booking.noSlots}</p>
                    {/* #90: pošten izhod — če je dan poln, ponudimo
                        prijavo na čakalno listo (kartica je na isti strani). */}
                    <a
                      href="#waitlist"
                      className="text-sm font-medium text-primary-text underline-offset-4 hover:underline"
                    >
                      {t.booking.waitlistHint}
                    </a>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot.time}
                        type="button"
                        onClick={() => slot.available && onSelectTime(slot.time)}
                        variant={selectedTime === slot.time ? "default" : "outline"}
                        size="sm"
                        disabled={!slot.available}
                        className={`${
                          !slot.available ? "opacity-40" : ""
                        } transition-all hover:scale-105`}
                      >
                        {slot.formattedTime}
                      </Button>
                    ))}
                  </div>
                )}
                {timeError && <p className="text-sm text-destructive">{timeError}</p>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
