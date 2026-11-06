"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ImageIcon, TrashIcon } from "@/components/icons"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { toast } from "sonner"
import {
  createStaffSchema,
  updateStaffSchema,
  type StaffFormData,
  type WorkingHourFormData,
} from "@/lib/validations/staff"
import { useI18n } from "@/lib/i18n/provider"

interface Service {
  id: string
  name: string
}

interface WorkingHour {
  id?: string
  dayOfWeek: number
  isActive: boolean
  startTime: string
  endTime: string
}

interface StaffData {
  id: string
  name: string
  email: string | null
  phone: string | null
  bio: string | null
  image: string | null
  isActive: boolean
  services?: { service: { id: string; name: string } }[]
  workingHours?: WorkingHour[]
  // #79: payroll
  defaultTipPercent?: number | null
  commissionType?: "NONE" | "PERCENT" | "FIXED"
  commissionValue?: number | null
}

interface StaffFormProps {
  services: Service[]
  staff?: StaffData
  mode?: "create" | "edit"
  onSubmit: (data: StaffFormData) => Promise<{ success: boolean; error?: string }>
  onDelete?: () => Promise<{ success: boolean; error?: string }>
}

const daysOfWeek = [
  { id: 0, name: "Sunday" },
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
]

const defaultWorkingHours: WorkingHourFormData[] = daysOfWeek.map((day) => ({
  dayOfWeek: day.id,
  isActive: day.id >= 1 && day.id <= 5, // Mon-Fri active by default
  startTime: "09:00",
  endTime: "17:00",
}))

export function StaffForm({ services, staff, mode = "create", onSubmit, onDelete }: StaffFormProps) {
  const { t } = useI18n()
  const router = useRouter()
  const isEditMode = mode === "edit"
  const [image, setImage] = useState<string | null>(staff?.image || null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedServices, setSelectedServices] = useState<string[]>(
    staff?.services?.map((s) => s.service.id) || []
  )
  const [workingHours, setWorkingHours] = useState<WorkingHourFormData[]>(
    staff?.workingHours?.map((wh) => ({
      dayOfWeek: wh.dayOfWeek,
      isActive: wh.isActive,
      startTime: wh.startTime,
      endTime: wh.endTime,
    })) || defaultWorkingHours
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormData>({
    resolver: zodResolver(isEditMode ? updateStaffSchema : createStaffSchema),
    defaultValues: {
      name: staff?.name || "",
      email: staff?.email || "",
      phone: staff?.phone || "",
      bio: staff?.bio || "",
      isActive: staff?.isActive ?? true,
      // #79: payroll
      defaultTipPercent: staff?.defaultTipPercent ?? undefined,
      commissionType: staff?.commissionType ?? "NONE",
      commissionValue: staff?.commissionValue ?? undefined,
    },
  })

  const watchIsActive = watch("isActive")
  // #79: payroll
  const watchCommissionType = watch("commissionType")

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error(t.staff.toasts.selectImageFile)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t.staff.toasts.imageTooLarge)
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "staff")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t.staff.toasts.uploadError)
      }

      setImage(data.url)
      toast.success(t.staff.toasts.imageUploaded)
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(
        error instanceof Error ? error.message : t.staff.toasts.uploadFailed
      )
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Remove image
  const handleRemoveImage = () => {
    setImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Toggle service selection
  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    )
  }

  // Update working hours
  const updateWorkingHour = (dayOfWeek: number, field: keyof WorkingHourFormData, value: string | boolean) => {
    setWorkingHours((prev) =>
      prev.map((wh) =>
        wh.dayOfWeek === dayOfWeek ? { ...wh, [field]: value } : wh
      )
    )
  }

  // Handle delete
  const handleDelete = async () => {
    if (!onDelete) return

    const confirmed = window.confirm(t.staff.confirmDeleteThis)

    if (!confirmed) return

    setIsDeleting(true)
    try {
      const result = await onDelete()

      if (result.success) {
        toast.success(t.staff.toasts.deleted)
        router.push("/dashboard/staff")
      } else {
        toast.error(result.error || t.staff.toasts.deleteFailed)
      }
    } catch (error) {
      console.error("Delete error:", error)
      toast.error(t.staff.toasts.unexpectedError)
    } finally {
      setIsDeleting(false)
    }
  }

  // Submit form
  const handleFormSubmit = async (data: StaffFormData) => {
    try {
      const staffData: StaffFormData = {
        ...data,
        image: image || undefined,
        serviceIds: selectedServices,
        workingHours: workingHours,
      }

      const result = await onSubmit(staffData)

      if (result.success) {
        toast.success(isEditMode ? t.staff.toasts.updated : t.staff.toasts.created)
        router.push("/dashboard/staff")
      } else {
        toast.error(result.error || (isEditMode ? t.staff.toasts.updateFailed : t.staff.toasts.createFailed))
      }
    } catch (error) {
      console.error("Submit error:", error)
      toast.error(t.staff.toasts.unexpectedError)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="space-y-6 lg:col-span-2">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t.staff.form.personalInfo}</CardTitle>
              <CardDescription>{t.staff.form.personalInfoDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.staff.form.fullName}</Label>
                <Input
                  id="name"
                  placeholder={t.staff.form.fullNamePlaceholder}
                  {...register("name")}
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="text-destructive text-sm">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">{t.staff.form.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t.staff.form.emailPlaceholder}
                    {...register("email")}
                    disabled={isSubmitting}
                  />
                  {errors.email && (
                    <p className="text-destructive text-sm">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t.staff.form.phone}</Label>
                  <Input
                    id="phone"
                    placeholder={t.staff.form.phonePlaceholder}
                    {...register("phone")}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">{t.staff.form.bio}</Label>
                <Textarea
                  id="bio"
                  placeholder={t.staff.form.bioPlaceholder}
                  rows={4}
                  {...register("bio")}
                  disabled={isSubmitting}
                />
              </div>

              {/* #79: plačilni sloj — predlog napitnine + pravilo provizije.
                  Provizija se izračuna ENKRAT ob zaključku termina in se
                  zapiše na termin (kasnejša sprememba pravila ne prepiše
                  zgodovine). */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="defaultTipPercent">{t.staff.form.defaultTipPercent}</Label>
                  <Input
                    id="defaultTipPercent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="10.00"
                    {...register("defaultTipPercent", {
                      setValueAs: (v) =>
                        v === "" || v == null || Number.isNaN(Number(v))
                          ? undefined
                          : Number(v),
                    })}
                    disabled={isSubmitting}
                  />
                  <p className="text-muted-foreground text-xs">{t.staff.form.defaultTipPercentHint}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commissionType">{t.staff.form.commissionType}</Label>
                  <select
                    id="commissionType"
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                    {...register("commissionType")}
                    disabled={isSubmitting}
                  >
                    <option value="NONE">{t.staff.form.commissionNone}</option>
                    <option value="PERCENT">{t.staff.form.commissionPercent}</option>
                    <option value="FIXED">{t.staff.form.commissionFixed}</option>
                  </select>
                </div>
                {watchCommissionType === "PERCENT" && (
                  <div className="space-y-2">
                    <Label htmlFor="commissionValue">{t.staff.form.commissionPercentValue}</Label>
                    <Input
                      id="commissionValue"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="10.00"
                      {...register("commissionValue", {
                        setValueAs: (v) =>
                          v === "" || v == null || Number.isNaN(Number(v))
                            ? undefined
                            : Number(v),
                      })}
                      disabled={isSubmitting}
                    />
                  </div>
                )}
                {watchCommissionType === "FIXED" && (
                  <div className="space-y-2">
                    <Label htmlFor="commissionValue">{t.staff.form.commissionFixedValue}</Label>
                    <Input
                      id="commissionValue"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="2.00"
                      {...register("commissionValue", {
                        setValueAs: (v) =>
                          v === "" || v == null || Number.isNaN(Number(v))
                            ? undefined
                            : Number(v),
                      })}
                      disabled={isSubmitting}
                    />
                  </div>
                )}
              </div>
              {watchCommissionType !== "NONE" && (
                <p className="text-muted-foreground text-xs">
                  {t.staff.form.commissionFreezeHelp}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Profile Photo */}
          <Card>
            <CardHeader>
              <CardTitle>{t.staff.form.profilePhoto}</CardTitle>
              <CardDescription>{t.staff.form.profilePhotoDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {image ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                  <Image
                    src={image}
                    alt={t.staff.form.staffPhotoAlt}
                    fill
                    className="object-cover"
                  
              sizes="128px"/>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveImage}
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
                      {t.staff.form.clickToUpload}
                    </p>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Working Hours */}
          <Card>
            <CardHeader>
              <CardTitle>{t.staff.form.workingHours}</CardTitle>
              <CardDescription>{t.staff.form.workingHoursDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {daysOfWeek.map((day) => {
                  const hours = workingHours.find((wh) => wh.dayOfWeek === day.id)
                  return (
                    <div key={day.id} className="flex items-center gap-4">
                      <div className="w-28">
                        <Label>{t.staff.days[day.id]}</Label>
                      </div>
                      <Switch
                        checked={hours?.isActive || false}
                        onCheckedChange={(checked) =>
                          updateWorkingHour(day.id, "isActive", checked)
                        }
                        disabled={isSubmitting}
                      />
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          type="time"
                          value={hours?.startTime || "09:00"}
                          onChange={(e) =>
                            updateWorkingHour(day.id, "startTime", e.target.value)
                          }
                          className="w-32"
                          disabled={isSubmitting || !hours?.isActive}
                        />
                        <span className="text-muted-foreground">{t.staff.form.to}</span>
                        <Input
                          type="time"
                          value={hours?.endTime || "17:00"}
                          onChange={(e) =>
                            updateWorkingHour(day.id, "endTime", e.target.value)
                          }
                          className="w-32"
                          disabled={isSubmitting || !hours?.isActive}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>{t.staff.form.status}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t.staff.form.active}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t.staff.form.activeDescription}
                  </p>
                </div>
                <Switch
                  checked={watchIsActive}
                  onCheckedChange={(checked) => setValue("isActive", checked)}
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
          </Card>

          {/* Services */}
          <Card>
            <CardHeader>
              <CardTitle>{t.staff.form.services}</CardTitle>
              <CardDescription>{t.staff.form.servicesDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {services.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t.staff.form.noServices}</p>
                ) : (
                  services.map((service) => (
                    <label
                      key={service.id}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={selectedServices.includes(service.id)}
                        onChange={() => handleServiceToggle(service.id)}
                        disabled={isSubmitting}
                      />
                      <span className="text-sm">{service.name}</span>
                    </label>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isSubmitting || isDeleting}>
              {isSubmitting && (
                <SpinnerIcon size={16} className="mr-2 animate-spin" />
              )}
              {isEditMode ? t.staff.form.updateStaff : t.staff.form.createStaff}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.push("/dashboard/staff")}
              disabled={isSubmitting || isDeleting}
            >
              {t.common.actions.cancel}
            </Button>
            {isEditMode && onDelete && (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={handleDelete}
                disabled={isSubmitting || isDeleting}
              >
                {isDeleting ? (
                  <SpinnerIcon size={16} className="animate-spin" />
                ) : (
                  <>
                    <TrashIcon size={16} className="mr-2" />
                    {t.staff.form.deleteStaff}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
