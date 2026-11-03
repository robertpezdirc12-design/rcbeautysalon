"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ImageIcon, TrashIcon } from "@/components/icons"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { updateSalonSettings, resetSalonSettings } from "@/app/actions/settings"
import { settingsSchema, type SettingsFormData } from "@/lib/validations/settings"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"

interface SettingsFormProps {
  initialSettings: {
    name: string
    logo: string | null
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    state: string | null
    zipCode: string | null
    country: string
    timezone: string
    currency: string
    bookingDeposit: number
    depositRefundable: boolean
    minBookingAdvance: number
    maxBookingAdvance: number
    cancellationPolicy: string | null
  }
}

// Locale-independent option values (sent to the API); labels come from the i18n dict.
const COUNTRIES = ["US", "CA", "MX", "GB", "ES"] as const

const TIMEZONES = [
  "Europe/Ljubljana",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const

const currencies = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "CAD", label: "CAD ($)" },
  { value: "MXN", label: "MXN ($)" },
]

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const { t } = useI18n()
  const [logo, setLogo] = useState<string | null>(initialSettings.logo)
  const [isUploading, setIsUploading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: initialSettings.name,
      logo: initialSettings.logo || undefined,
      email: initialSettings.email || "",
      phone: initialSettings.phone || "",
      address: initialSettings.address || "",
      city: initialSettings.city || "",
      state: initialSettings.state || "",
      zipCode: initialSettings.zipCode || "",
      country: initialSettings.country,
      timezone: initialSettings.timezone,
      currency: initialSettings.currency,
      bookingDeposit: initialSettings.bookingDeposit,
      depositRefundable: initialSettings.depositRefundable,
      minBookingAdvance: initialSettings.minBookingAdvance,
      maxBookingAdvance: initialSettings.maxBookingAdvance,
      cancellationPolicy: initialSettings.cancellationPolicy || "",
    },
  })

  const watchDepositRefundable = watch("depositRefundable")

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error(t.settings.form.invalidImageType)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t.settings.form.imageTooLarge)
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "logo")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t.settings.form.uploadFailed)
      }

      setLogo(data.url)
      toast.success(t.settings.form.logoUploaded)
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(
        error instanceof Error ? error.message : t.settings.form.logoUploadFailed
      )
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Remove logo
  const handleRemoveLogo = () => {
    setLogo(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Handle reset
  const handleReset = async () => {
    const confirmed = window.confirm(t.settings.form.resetConfirm)

    if (!confirmed) return

    setIsResetting(true)
    try {
      const result = await resetSalonSettings()

      if (result.success && result.settings) {
        reset({
          name: result.settings.name,
          logo: result.settings.logo || undefined,
          email: result.settings.email || "",
          phone: result.settings.phone || "",
          address: result.settings.address || "",
          city: result.settings.city || "",
          state: result.settings.state || "",
          zipCode: result.settings.zipCode || "",
          country: result.settings.country,
          timezone: result.settings.timezone,
          currency: result.settings.currency,
          bookingDeposit: result.settings.bookingDeposit,
          depositRefundable: result.settings.depositRefundable,
          minBookingAdvance: result.settings.minBookingAdvance,
          maxBookingAdvance: result.settings.maxBookingAdvance,
          cancellationPolicy: result.settings.cancellationPolicy || "",
        })
        setLogo(result.settings.logo)
        toast.success(t.settings.form.resetSuccess)
      } else {
        toast.error(result.error || t.settings.form.resetFailed)
      }
    } catch (error) {
      console.error("Reset error:", error)
      toast.error(t.settings.form.unexpectedError)
    } finally {
      setIsResetting(false)
    }
  }

  // Submit form
  const onSubmit = async (data: SettingsFormData) => {
    try {
      const settingsData = {
        ...data,
        logo: logo || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zipCode: data.zipCode || undefined,
        cancellationPolicy: data.cancellationPolicy || undefined,
      }

      const result = await updateSalonSettings(settingsData)

      if (result.success) {
        toast.success(t.settings.form.saveSuccess)
      } else {
        toast.error(result.error || t.settings.form.saveFailed)
      }
    } catch (error) {
      console.error("Submit error:", error)
      toast.error(t.settings.form.unexpectedError)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t.settings.title}</h1>
            <p className="text-muted-foreground">{t.settings.subtitle}</p>
          </div>
          <Button type="submit" disabled={isSubmitting || isResetting}>
            {isSubmitting && (
              <SpinnerIcon size={16} className="mr-2 animate-spin" />
            )}
            {t.settings.form.saveAll}
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Business Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.form.businessInfo}</CardTitle>
              <CardDescription>{t.settings.form.businessInfoDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.settings.form.salonName}</Label>
                  <Input
                    id="name"
                    {...register("name")}
                    disabled={isSubmitting}
                  />
                  {errors.name && (
                    <p className="text-destructive text-sm">{errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t.settings.form.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    disabled={isSubmitting}
                  />
                  {errors.email && (
                    <p className="text-destructive text-sm">{errors.email.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t.settings.form.phone}</Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
          </Card>

          {/* Logo */}
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.form.logo}</CardTitle>
              <CardDescription>{t.settings.form.logoDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {logo ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                  <Image
                    src={logo}
                    alt={t.settings.form.logoAlt}
                    fill
                    className="object-cover"
                  
              sizes="128px"/>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveLogo}
                  >
                    <TrashIcon size={16} />
                  </Button>
                </div>
              ) : (
                <div
                  className={`border-muted-foreground/25 hover:border-muted-foreground/50 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                    isUploading ? "pointer-events-none opacity-50" : ""
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <SpinnerIcon size={48} className="text-muted-foreground/50 animate-spin" />
                  ) : (
                    <ImageIcon size={48} className="text-muted-foreground/50" />
                  )}
                  {!isUploading && (
                    <p className="text-muted-foreground mt-4 text-sm">
                      {t.settings.form.clickToUpload}
                    </p>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.form.address}</CardTitle>
              <CardDescription>{t.settings.form.addressDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">{t.settings.form.streetAddress}</Label>
                <Input
                  id="address"
                  {...register("address")}
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t.settings.form.city}</Label>
                  <Input
                    id="city"
                    {...register("city")}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">{t.settings.form.state}</Label>
                  <Input
                    id="state"
                    {...register("state")}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">{t.settings.form.zipCode}</Label>
                  <Input
                    id="zipCode"
                    {...register("zipCode")}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">{t.settings.form.country}</Label>
                  <Select
                    defaultValue={initialSettings.country}
                    onValueChange={(value) => setValue("country", value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.settings.form.selectCountry} />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {t.settings.form.countries[code]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Localization */}
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.form.localization}</CardTitle>
              <CardDescription>{t.settings.form.localizationDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone">{t.settings.form.timezone}</Label>
                  <Select
                    defaultValue={initialSettings.timezone}
                    onValueChange={(value) => setValue("timezone", value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.settings.form.selectTimezone} />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {t.settings.form.timezones[tz]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">{t.settings.form.currency}</Label>
                  <Select
                    defaultValue={initialSettings.currency}
                    onValueChange={(value) => setValue("currency", value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.settings.form.selectCurrency} />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((curr) => (
                        <SelectItem key={curr.value} value={curr.value}>
                          {curr.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Settings */}
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.form.bookingSettings}</CardTitle>
              <CardDescription>{t.settings.form.bookingSettingsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bookingDeposit">{t.settings.form.bookingDeposit}</Label>
                  <Input
                    id="bookingDeposit"
                    type="number"
                    step="0.01"
                    {...register("bookingDeposit", { valueAsNumber: true })}
                    disabled={isSubmitting}
                  />
                  {errors.bookingDeposit && (
                    <p className="text-destructive text-sm">{errors.bookingDeposit.message}</p>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label>{t.settings.form.depositRefundable}</Label>
                    <p className="text-xs text-muted-foreground">{t.settings.form.depositRefundableHint}</p>
                  </div>
                  <Switch
                    checked={watchDepositRefundable}
                    onCheckedChange={(checked) => setValue("depositRefundable", checked)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="minBookingAdvance">{t.settings.form.minBookingAdvance}</Label>
                  <Input
                    id="minBookingAdvance"
                    type="number"
                    {...register("minBookingAdvance", { valueAsNumber: true })}
                    disabled={isSubmitting}
                  />
                  {errors.minBookingAdvance && (
                    <p className="text-destructive text-sm">{errors.minBookingAdvance.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxBookingAdvance">{t.settings.form.maxBookingAdvance}</Label>
                  <Input
                    id="maxBookingAdvance"
                    type="number"
                    {...register("maxBookingAdvance", { valueAsNumber: true })}
                    disabled={isSubmitting}
                  />
                  {errors.maxBookingAdvance && (
                    <p className="text-destructive text-sm">{errors.maxBookingAdvance.message}</p>
                  )}
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="cancellationPolicy">{t.settings.form.cancellationPolicy}</Label>
                <Textarea
                  id="cancellationPolicy"
                  {...register("cancellationPolicy")}
                  rows={4}
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">{t.settings.form.dangerZone}</CardTitle>
              <CardDescription>{t.settings.form.dangerZoneDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                <div>
                  <p className="font-medium">{t.settings.form.resetAll}</p>
                  <p className="text-sm text-muted-foreground">{t.settings.form.resetToDefaults}</p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleReset}
                  disabled={isSubmitting || isResetting}
                >
                  {isResetting ? (
                    <SpinnerIcon size={14} className="animate-spin" />
                  ) : (
                    t.settings.form.reset
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  )
}
