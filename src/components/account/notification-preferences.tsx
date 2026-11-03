"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { BellIcon, EnvelopeIcon, SpinnerGapIcon } from "@/components/icons"
import { updateNotificationPreferences } from "@/app/actions/account"

interface NotificationPreferencesProps {
  preferences: {
    emailReminders: boolean
    reminderTime: string // "24h" | "48h" | "1week"
    promotionalEmails: boolean
    appointmentUpdates: boolean
  }
}

export function NotificationPreferences({ preferences }: NotificationPreferencesProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState(preferences)
  const [hasChanges, setHasChanges] = useState(false)

  const handleToggle = (field: keyof typeof formData) => {
    if (field === "reminderTime") return // reminderTime is string, not boolean
    setFormData((prev) => ({ ...prev, [field]: !prev[field] }))
    setHasChanges(true)
  }

  const handleReminderTimeChange = (value: string) => {
    setFormData((prev) => ({ ...prev, reminderTime: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await updateNotificationPreferences(formData)
      if (result.success) {
        toast.success("Nastavitve uspešno shranjene")
        setHasChanges(false)
      } else {
        toast.error(result.error || "Shranjevanje nastavitev ni uspelo")
      }
    } catch {
      toast.error("Med shranjevanjem je prišlo do napake")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellIcon size={20} className="text-primary-text" />
          Nastavitve obveščanja
        </CardTitle>
        <CardDescription>
          Upravljajte, kako in kdaj prejemate obvestila
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Appointment Reminders */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Opomniki za termine
          </h4>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="email-reminders" className="text-base font-medium">
                E-poštni opomniki
              </Label>
              <p className="text-sm text-muted-foreground">
                Prejemajte e-poštne opomnike pred svojimi termini
              </p>
            </div>
            <Switch
              id="email-reminders"
              checked={formData.emailReminders}
              onCheckedChange={() => handleToggle("emailReminders")}
            />
          </div>

          {formData.emailReminders && (
            <div className="ml-4 space-y-2 border-l-2 border-primary/20 pl-4">
              <Label htmlFor="reminder-time" className="text-sm font-medium">
                Pošlji opomnik
              </Label>
              <Select
                value={formData.reminderTime}
                onValueChange={handleReminderTimeChange}
              >
                <SelectTrigger id="reminder-time" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24 ur pred terminom</SelectItem>
                  <SelectItem value="48h">48 ur pred terminom</SelectItem>
                  <SelectItem value="1week">1 teden pred terminom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Other Notifications */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Druga obvestila
          </h4>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="appointment-updates" className="text-base font-medium">
                Spremembe terminov
              </Label>
              <p className="text-sm text-muted-foreground">
                Prejmite obvestilo, ko je termin potrjen, prestavljen ali odpovedan
              </p>
            </div>
            <Switch
              id="appointment-updates"
              checked={formData.appointmentUpdates}
              onCheckedChange={() => handleToggle("appointmentUpdates")}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="promotional-emails" className="text-base font-medium">
                Promocijska e-pošta
              </Label>
              <p className="text-sm text-muted-foreground">
                Prejemajte posebne ponudbe, popuste in novosti
              </p>
            </div>
            <Switch
              id="promotional-emails"
              checked={formData.promotionalEmails}
              onCheckedChange={() => handleToggle("promotionalEmails")}
            />
          </div>
        </div>

        {/* Email Info */}
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-start gap-3">
            <EnvelopeIcon size={20} className="text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>
                Obvestila bomo poslali na vaš registrirani e-poštni naslov.
                Svojo e-pošto lahko posodobite v razdelku Osebni podatki.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && (
                <SpinnerGapIcon size={16} className="mr-2 animate-spin" />
              )}
              Shrani nastavitve
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
