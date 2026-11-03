"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon, SpinnerGapIcon } from "@/components/icons"
import { format, setHours, setMinutes } from "date-fns"
import { sl, enUS } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/provider"
import {
  adminAppointmentSchema,
  AdminAppointmentInput,
} from "@/lib/validations/admin-appointment"
import {
  getAvailableStaff,
  getAvailableTimeSlots,
  createAppointment,
  listBookingResources,
  type BookingResource,
} from "@/app/actions/appointments"
import { TimeSlot, AvailableStaffMember } from "@/lib/interfaces"
import { AdminAppointmentFormProps } from "@/lib/interfaces"
import { formatCurrency } from "@/lib/utils/format"

export default function AdminAppointmentForm({
  services,
  customers,
}: AdminAppointmentFormProps) {
  const router = useRouter()
  const { t, locale } = useI18n()
  const dateFnsLocale = locale === "sl" ? sl : enUS
  const [isLoading, setIsLoading] = useState(false)
  const [availableStaff, setAvailableStaff] = useState<AvailableStaffMember[]>(
    []
  )
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  // E2-7 (G7): optional workspace resources (empty = selector hidden).
  const [resources, setResources] = useState<BookingResource[]>([])
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listBookingResources()
      .then((res) => {
        if (!cancelled) setResources(res)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AdminAppointmentInput>({
    resolver: zodResolver(adminAppointmentSchema),
    defaultValues: {
      serviceId: "",
      staffId: "",
      time: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      notes: "",
    },
  })

  const selectedServiceId = watch("serviceId")
  const selectedStaffId = watch("staffId")
  const selectedDate = watch("date")

  // Get selected service duration
  const selectedService = services.find((s) => s.id === selectedServiceId)
  const serviceDuration = selectedService?.duration || 60

  // Load available staff when service changes
  useEffect(() => {
    if (!selectedServiceId) {
      setAvailableStaff([])
      setValue("staffId", "")
      return
    }

    const loadStaff = async () => {
      setLoadingStaff(true)
      try {
        const staff = await getAvailableStaff(selectedServiceId)
        setAvailableStaff(staff)
        setValue("staffId", "")
        setValue("time", "")
        setAvailableSlots([])
      } catch (error) {
        console.error("Error loading staff:", error)
      } finally {
        setLoadingStaff(false)
      }
    }

    loadStaff()
  }, [selectedServiceId, setValue])

  // Load available time slots when staff, date, or service changes
  useEffect(() => {
    if (!selectedStaffId || !selectedDate || !selectedServiceId) {
      setAvailableSlots([])
      setValue("time", "")
      return
    }

    const loadSlots = async () => {
      setLoadingSlots(true)
      try {
        // "yyyy-MM-dd" — the server resolves it in the salon timezone
        const slots = await getAvailableTimeSlots(
          selectedStaffId,
          format(selectedDate, "yyyy-MM-dd"),
          serviceDuration,
          selectedResourceId
        )
        setAvailableSlots(slots)
        setValue("time", "")
      } catch (error) {
        console.error("Error loading time slots:", error)
      } finally {
        setLoadingSlots(false)
      }
    }

    loadSlots()
  }, [
    selectedStaffId,
    selectedDate,
    selectedServiceId,
    serviceDuration,
    selectedResourceId,
    setValue,
  ])

  // Auto-fill customer info when selecting from existing customers
  const handleCustomerSelect = (customerId: string) => {
    const customer = customers?.find((c) => c.id === customerId)
    if (customer) {
      setValue("customerName", customer.name)
      setValue("customerEmail", customer.email || "")
      setValue("customerPhone", customer.phone || "")
    }
  }

  const onSubmit = async (data: AdminAppointmentInput) => {
    setIsLoading(true)

    try {
      // Combine date and time into startTime
      const [hours, minutes] = data.time.split(":").map(Number)
      const startTime = setMinutes(setHours(data.date, hours), minutes)

      const result = await createAppointment({
        serviceIds: [data.serviceId],
        staffId: data.staffId,
        startTime,
        // Preferred contract: the server builds the exact instant in the
        // salon's timezone from these salon-local strings.
        bookingDate: format(data.date, "yyyy-MM-dd"),
        bookingTime: data.time,
        guestName: data.customerName,
        guestEmail: data.customerEmail || undefined,
        guestPhone: data.customerPhone,
        notes: data.notes,
        resourceRecordId: selectedResourceId,
      })

      if (result.success) {
        router.push("/dashboard/appointments")
      } else {
        alert(result.error || t.appointments.form.createFailed)
      }
    } catch (error) {
      console.error("Error creating appointment:", error)
      alert(t.appointments.form.createFailedRetry)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Existing Customer Selection (optional) */}
      {customers && customers.length > 0 && (
        <div className="space-y-2">
          <Label>{t.appointments.form.selectExistingCustomer}</Label>
          <Select onValueChange={handleCustomerSelect}>
            <SelectTrigger>
              <SelectValue
                placeholder={t.appointments.form.searchExistingCustomers}
              />
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name} - {customer.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {t.appointments.form.selectCustomerHint}
          </p>
        </div>
      )}

      {/* Customer Info Section */}
      <div className="space-y-4">
        <h3 className="font-medium">{t.appointments.form.customerInfo}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customerName">{t.appointments.form.nameLabel}</Label>
            <Input
              id="customerName"
              placeholder={t.appointments.form.namePlaceholder}
              {...register("customerName")}
            />
            {errors.customerName && (
              <p className="text-destructive text-sm">
                {errors.customerName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone">
              {t.appointments.form.phoneLabel}
            </Label>
            <Input
              id="customerPhone"
              type="tel"
              placeholder={t.appointments.form.phonePlaceholder}
              {...register("customerPhone")}
            />
            {errors.customerPhone && (
              <p className="text-destructive text-sm">
                {errors.customerPhone.message}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="customerEmail">{t.appointments.form.emailLabel}</Label>
          <Input
            id="customerEmail"
            type="email"
            placeholder={t.appointments.form.emailPlaceholder}
            {...register("customerEmail")}
          />
          {errors.customerEmail && (
            <p className="text-destructive text-sm">
              {errors.customerEmail.message}
            </p>
          )}
        </div>
      </div>

      {/* Service Selection */}
      <div className="space-y-2">
        <Label>{t.appointments.form.serviceLabel}</Label>
        <Select
          value={selectedServiceId}
          onValueChange={(value) => setValue("serviceId", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t.appointments.form.servicePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name} – {formatCurrency(Number(service.price))} ({service.duration} min)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.serviceId && (
          <p className="text-destructive text-sm">{errors.serviceId.message}</p>
        )}
      </div>

      {/* Staff Selection */}
      <div className="space-y-2">
        <Label>{t.appointments.form.staffLabel}</Label>
        <Select
          value={selectedStaffId}
          onValueChange={(value) => setValue("staffId", value)}
          disabled={!selectedServiceId || loadingStaff}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                loadingStaff
                  ? t.appointments.form.staffLoading
                  : !selectedServiceId
                    ? t.appointments.form.staffSelectServiceFirst
                    : t.appointments.form.staffPlaceholder
              }
            />
          </SelectTrigger>
          <SelectContent>
            {availableStaff.length === 0 && !loadingStaff ? (
              <SelectItem value="no-staff" disabled>
                {t.appointments.form.staffNone}
              </SelectItem>
            ) : (
              availableStaff.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {errors.staffId && (
          <p className="text-destructive text-sm">{errors.staffId.message}</p>
        )}
      </div>

      {/* E2-7 (G7): optional workspace resource — rendered only when the org
          profile enables workspace-resources + appointments and resources exist. */}
      {resources.length > 0 && (
        <div className="space-y-2">
          <Label>{t.appointments.form.resourceLabel}</Label>
          <Select
            value={selectedResourceId ?? "none"}
            onValueChange={(value) => {
              // The slot set depends on the resource — clear a stale time.
              setSelectedResourceId(value === "none" ? null : value)
              setValue("time", "")
            }}
          >
            <SelectTrigger className="sm:w-96">
              <SelectValue placeholder={t.appointments.form.resourcePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t.appointments.form.resourceNone}</SelectItem>
              {resources.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                  {r.kind ? ` — ${r.kind}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t.appointments.form.resourceHint}</p>
        </div>
      )}

      {/* Date Selection */}
      <div className="space-y-2">
        <Label>{t.appointments.form.dateLabel}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
              disabled={!selectedStaffId}
            >
              <CalendarIcon size={16} className="mr-2" />
              {selectedDate
                ? format(selectedDate, "d. MMMM yyyy", { locale: dateFnsLocale })
                : t.appointments.form.datePlaceholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setValue("date", date)}
              disabled={(date) => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                return date < today
              }}
            />
          </PopoverContent>
        </Popover>
        {errors.date && (
          <p className="text-destructive text-sm">{errors.date.message}</p>
        )}
      </div>

      {/* Time Selection */}
      <div className="space-y-2">
        <Label>{t.appointments.form.timeLabel}</Label>
        <Select
          value={watch("time")}
          onValueChange={(value) => setValue("time", value)}
          disabled={!selectedStaffId || !selectedDate || loadingSlots}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                loadingSlots
                  ? t.appointments.form.timeLoading
                  : !selectedStaffId || !selectedDate
                    ? t.appointments.form.timeSelectFirst
                    : t.appointments.form.timePlaceholder
              }
            />
          </SelectTrigger>
          <SelectContent>
            {availableSlots.length === 0 && !loadingSlots ? (
              <SelectItem value="no-slots" disabled>
                {t.appointments.form.timeNone}
              </SelectItem>
            ) : (
              availableSlots
                .filter((slot) => slot.available)
                .map((slot) => (
                  <SelectItem key={slot.time} value={slot.time}>
                    {slot.formattedTime}
                  </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>
        {errors.time && (
          <p className="text-destructive text-sm">{errors.time.message}</p>
        )}
        <p className="text-muted-foreground text-xs">
          {availableSlots.filter((s) => s.available).length > 0
            ? t.appointments.form.slotsAvailable(
                availableSlots.filter((s) => s.available).length
              )
            : t.appointments.form.slotsHint}
        </p>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">{t.appointments.form.notesLabel}</Label>
        <Textarea
          id="notes"
          placeholder={t.appointments.form.notesPlaceholder}
          rows={3}
          {...register("notes")}
        />
        {errors.notes && (
          <p className="text-destructive text-sm">{errors.notes.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => router.back()}
        >
          {t.common.actions.cancel}
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading && (
            <SpinnerGapIcon size={18} className="mr-2 animate-spin" />
          )}
          {t.appointments.form.create}
        </Button>
      </div>
    </form>
  )
}
