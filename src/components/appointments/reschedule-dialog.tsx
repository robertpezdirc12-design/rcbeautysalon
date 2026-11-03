"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { CalendarIcon, ClockIcon, SpinnerGapIcon } from "@/components/icons"
import { format } from "date-fns"
import { sl } from "date-fns/locale"
import { TimeSlot } from "@/lib/interfaces"

interface RescheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentDate: Date
  isPending: boolean
  onSubmit: (newDate: Date, newTime: string) => void
  availableSlots: TimeSlot[]
  loadingSlots: boolean
  onDateChange: (date: Date) => void
}

export function RescheduleDialog({
  open,
  onOpenChange,
  currentDate,
  isPending,
  onSubmit,
  availableSlots,
  loadingSlots,
  onDateChange,
}: RescheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string>("")

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    setSelectedTime("") // Reset time when date changes
    if (date) {
      onDateChange(date)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when dialog closes
      setSelectedDate(undefined)
      setSelectedTime("")
    }
    onOpenChange(isOpen)
  }

  const handleSubmit = () => {
    if (selectedDate && selectedTime) {
      onSubmit(selectedDate, selectedTime)
    }
  }

  const availableTimeSlots = availableSlots.filter((slot) => slot.available)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon size={20} className="text-primary-text" />
            Prestavi termin
          </DialogTitle>
          <DialogDescription>
            Izberite nov datum in uro termina. Trenutno:{" "}
            {format(currentDate, "d. MMMM yyyy 'ob' HH:mm", { locale: sl })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Izberite nov datum</Label>
            <div className="flex justify-center rounded-lg border p-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={(date) => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  return date < today
                }}
                className="rounded-md"
              />
            </div>
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <ClockIcon size={16} />
              Izberite novo uro
            </Label>
            <Select
              value={selectedTime}
              onValueChange={setSelectedTime}
              disabled={!selectedDate || loadingSlots}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !selectedDate
                      ? "Najprej izberite datum"
                      : loadingSlots
                        ? "Nalaganje ur …"
                        : "Izberite uro"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableTimeSlots.length === 0 && !loadingSlots ? (
                  <SelectItem value="no-slots" disabled>
                    Za ta datum ni prostih ur
                  </SelectItem>
                ) : (
                  availableTimeSlots.map((slot) => (
                    <SelectItem key={slot.time} value={slot.time}>
                      {slot.formattedTime}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedDate && availableTimeSlots.length > 0 && !loadingSlots && (
              <p className="text-muted-foreground text-xs">
                Na voljo: {availableTimeSlots.length} terminov
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Prekliči
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedDate || !selectedTime || isPending}
          >
            {isPending && (
              <SpinnerGapIcon size={16} className="mr-2 animate-spin" />
            )}
            Potrdi prestavitev
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
