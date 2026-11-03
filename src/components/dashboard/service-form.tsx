"use client"

import { useState, useRef, useActionState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useForm } from "react-hook-form"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ImageIcon, TrashIcon, PlusIcon } from "@/components/icons"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"
import {
  createService,
  updateService,
  deleteService,
} from "@/app/actions/services"
import { createCategory } from "@/app/actions/categories"
import {
  categoryPickerMode,
  normalizeCategoryName,
} from "@/lib/dashboard/category-picker"
import {
  createServiceSchema,
  updateServiceSchema,
  type ServiceFormData,
} from "@/lib/validations/service"
import {
  fdStr,
  fdOptStr,
  fdNum,
  fdBool,
  fdStrList,
  zodIssuesToFieldErrors,
} from "@/lib/forms/form-data"

interface Category {
  id: string
  name: string
}

interface Staff {
  id: string
  name: string
}

interface ServiceData {
  id: string
  name: string
  slug: string
  description: string | null
  duration: number
  price: number
  imageUrl: string | null
  categoryId: string | null
  isActive: boolean
  isFeatured: boolean
  staffServices?: { staffId: string }[]
}

interface ServiceFormProps {
  categories: Category[]
  staff: Staff[]
  service?: ServiceData
  mode?: "create" | "edit"
}

export function ServiceForm({
  categories,
  staff,
  service,
  mode = "create",
}: ServiceFormProps) {
  const { t } = useI18n()
  const router = useRouter()
  const isEditMode = mode === "edit"
  const [imageUrl, setImageUrl] = useState<string | null>(
    service?.imageUrl || null
  )
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<string[]>(
    service?.staffServices?.map((s) => s.staffId) || []
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  // P3 #52: prazno stanje izbirnika kategorij — ista obravnava kot pri
  // izdelkih (razlaga + "Ustvari kategorijo" brez zapuščanja obrazca).
  const [categoryList, setCategoryList] = useState(categories)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [creatingCategory, setCreatingCategory] = useState(false)
  const pickerMode = categoryPickerMode(categoryList.length)

  const handleCreateCategory = async () => {
    const valid = normalizeCategoryName(newCategoryName)
    if (!valid.ok) {
      toast.error(t.services.noCategories)
      return
    }
    setCreatingCategory(true)
    try {
      const res = await createCategory(valid.name)
      if (!res.success || !res.category) {
        toast.error(res.error || t.services.categoryCreateFailed)
        return
      }
      setCategoryList((prev) =>
        res.reused || prev.some((c) => c.id === res.category!.id)
          ? prev
          : [...prev, res.category!]
      )
      setValue("categoryId", res.category.id)
      clearErrors("categoryId")
      toast.success(t.services.categoryCreated)
      setCategoryDialogOpen(false)
      setNewCategoryName("")
    } catch {
      toast.error(t.services.categoryCreateFailed)
    } finally {
      setCreatingCategory(false)
    }
  }

  const {
    setValue,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ServiceFormData>({
    defaultValues: {
      name: service?.name || "",
      slug: service?.slug || "",
      description: service?.description || "",
      duration: service?.duration || undefined,
      price: service?.price || undefined,
      categoryId: service?.categoryId || "",
      isActive: service?.isActive ?? true,
      isFeatured: service?.isFeatured ?? false,
      staffIds: service?.staffServices?.map((s) => s.staffId) || [],
    },
  })

  const watchName = watch("name")
  const watchSlug = watch("slug")
  const watchDescription = watch("description")
  const watchDuration = watch("duration")
  const watchPrice = watch("price")
  const watchCategoryId = watch("categoryId")
  const watchIsActive = watch("isActive")
  const watchIsFeatured = watch("isFeatured")

  // All text/number fields are CONTROLLED — the React 19 `action={}`
  // pathway resets uncontrolled inputs after every action submission,
  // and controlled values survive that reset on validation errors.
  // Empty number input → undefined (zod "required" message then applies);
  // RHF's setValue types the field as required, hence the explicit cast.
  const numberValue = (raw: string) => (raw === "" ? undefined : Number(raw))

  // Transliterate diacritics BEFORE stripping non-ASCII — "Žensko
  // striženje" must become "zensko-strizenje", not "ensko-stri-enje"
  // (the old code deleted the letters instead of transliterating them).
  // Runs after lowercase, so only lowercase keys are needed. Affects
  // newly generated slugs only; existing data is untouched.
  const TRANSLITERATE: Record<string, string> = {
    č: "c", ć: "c",
    š: "s",
    ž: "z",
    đ: "d",
    ä: "a", á: "a", à: "a", â: "a",
    é: "e", è: "e", ê: "e", ë: "e",
    í: "i", ì: "i",
    ó: "o", ò: "o", ö: "o",
    ú: "u", ù: "u", ü: "u",
    ñ: "n",
  }
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(
        /[čćšžđäáàâéèêëíìóòöúùüñ]/g,
        (ch) => TRANSLITERATE[ch] ?? ch
      )
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  }

  // Handle name change and auto-generate slug
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setValue("name", name)
    setValue("slug", generateSlug(name))
    clearErrors("name")
    clearErrors("slug")
  }

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error(t.services.imageTypeError)
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t.services.imageSizeError)
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "service")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t.services.uploadFailed)
      }

      setImageUrl(data.url)
      toast.success(t.services.imageUploadSuccess)
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(
        error instanceof Error ? error.message : t.services.imageUploadFailed
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
    setImageUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Toggle staff selection
  const handleStaffToggle = (staffId: string) => {
    setSelectedStaff((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    )
  }

  // Handle delete service
  const handleDelete = async () => {
    if (!service?.id) return

    const confirmed = window.confirm(
      t.services.deleteConfirm
    )

    if (!confirmed) return

    setIsDeleting(true)
    try {
      const result = await deleteService(service.id)

      if (result.success) {
        toast.success(t.services.deleteSuccess)
        router.push("/dashboard/services")
      } else {
        toast.error(result.error || t.services.deleteFailed)
      }
    } catch (error) {
      console.error("Delete error:", error)
      toast.error(t.services.unexpectedError)
    } finally {
      setIsDeleting(false)
    }
  }

  // Submit form — React 19 `action={}` pathway (F1: E3-8 follow-up).
  // The action parses FormData, validates against the SAME server schema
  // (zod safeParse) and only then calls the server action. On validation
  // failure the submitted values are restored (React resets uncontrolled
  // fields after an action completes) and zod issues map to inline errors.
  const [, formAction, isPending] = useActionState(
    async (_prev: { ok: boolean } | null, formData: FormData) => {
      const values = {
        name: fdStr(formData, "name"),
        slug: fdStr(formData, "slug"),
        description: fdOptStr(formData, "description"),
        duration: fdNum(formData, "duration"),
        price: fdNum(formData, "price"),
        imageUrl: imageUrl || undefined,
        categoryId: fdOptStr(formData, "categoryId"),
        isActive: fdBool(formData, "isActive"),
        isFeatured: fdBool(formData, "isFeatured"),
        staffIds: fdStrList(formData, "staffIds"),
      }

      const schema = isEditMode ? updateServiceSchema : createServiceSchema
      const parsed = schema.safeParse(values)
      if (!parsed.success) {
        // All fields are controlled, so nothing to restore — just surface
        // the same schema issues inline (same slots as the old resolver).
        const fieldErrors = zodIssuesToFieldErrors(parsed.error)
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as keyof ServiceFormData, { message })
        }
        toast.error(
          isEditMode ? t.services.updateFailed : t.services.createFailed
        )
        return { ok: false }
      }

      try {
        const result =
          isEditMode && service?.id
            ? await updateService(service.id, parsed.data)
            : await createService(parsed.data)

        if (result.success) {
          toast.success(
            isEditMode
              ? t.services.updateSuccess
              : t.services.createSuccess
          )
          router.push("/dashboard/services")
          return { ok: true }
        }
        toast.error(
          result.error ||
            (isEditMode ? t.services.updateFailed : t.services.createFailed)
        )
        return { ok: false }
      } catch (error) {
        console.error("Submit error:", error)
        toast.error(t.services.unexpectedError)
        return { ok: false }
      }
    },
    null
  )

  return (
    <form action={formAction}>
      {/* P3 #52: inline ustvarjanje prve kategorije — brez zapuščanja
          obrazca; uspeh jo takoj izbere v izbirniku. */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.services.createCategory}</DialogTitle>
            <DialogDescription>{t.services.noCategories}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-category">{t.services.newCategoryLabel}</Label>
            <Input
              id="new-category"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t.services.newCategoryPlaceholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleCreateCategory()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCategoryDialogOpen(false)}
              disabled={creatingCategory}
            >
              {t.common.actions.cancel}
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateCategory()}
              disabled={creatingCategory || newCategoryName.trim().length === 0}
            >
              {creatingCategory ? (
                <SpinnerIcon size={16} className="animate-spin" />
              ) : (
                <PlusIcon size={16} className="mr-1" />
              )}
              {t.services.createCategory}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="space-y-6 lg:col-span-2">
          {/* Service Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t.services.serviceInfoTitle}</CardTitle>
              <CardDescription>{t.services.serviceInfoDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.services.nameLabel}</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder={t.services.namePlaceholder}
                  value={watchName}
                  onChange={handleNameChange}
                  disabled={isPending}
                />
                {errors.name && (
                  <p className="text-destructive text-sm">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">{t.services.slugLabel}</Label>
                <Input
                  id="slug"
                  name="slug"
                  placeholder={t.services.slugPlaceholder}
                  value={watchSlug}
                  onChange={(e) => {
                    setValue("slug", e.target.value)
                    clearErrors("slug")
                  }}
                  disabled={isPending}
                />
                <p className="text-muted-foreground text-xs">
                  {t.services.slugHelp}
                </p>
                {errors.slug && (
                  <p className="text-destructive text-sm">
                    {errors.slug.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t.services.descriptionLabel}</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder={t.services.descriptionPlaceholder}
                  rows={4}
                  value={watchDescription ?? ""}
                  onChange={(e) => {
                    setValue("description", e.target.value)
                    clearErrors("description")
                  }}
                  disabled={isPending}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="duration">{t.services.durationLabel}</Label>
                  <Input
                    id="duration"
                    name="duration"
                    type="number"
                    placeholder="60"
                    value={watchDuration ?? ""}
                    onChange={(e) => {
                      setValue(
                        "duration",
                        numberValue(e.target.value) as unknown as number
                      )
                      clearErrors("duration")
                    }}
                    disabled={isPending}
                  />
                  {errors.duration && (
                    <p className="text-destructive text-sm">
                      {errors.duration.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">{t.services.priceLabel}</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    placeholder="85.00"
                    value={watchPrice ?? ""}
                    onChange={(e) => {
                      setValue(
                        "price",
                        numberValue(e.target.value) as unknown as number
                      )
                      clearErrors("price")
                    }}
                    disabled={isPending}
                  />
                  {errors.price && (
                    <p className="text-destructive text-sm">
                      {errors.price.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">{t.services.categoryLabel}</Label>
                {/* P3 #52: 0 kategorij → razloženo prazno stanje + dejanje. */}
                {pickerMode === "empty" ? (
                  <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-4 text-center">
                    <p className="text-muted-foreground text-sm">
                      {t.services.noCategories}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setCategoryDialogOpen(true)}
                      disabled={isPending}
                    >
                      <PlusIcon size={14} className="mr-1" />
                      {t.services.createCategory}
                    </Button>
                  </div>
                ) : (
                  <Select
                    defaultValue={service?.categoryId || undefined}
                    onValueChange={(value) => setValue("categoryId", value)}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.services.categoryPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryList.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle>{t.services.imageTitle}</CardTitle>
              <CardDescription>{t.services.imageDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {imageUrl ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                  <Image
                    src={imageUrl}
                    alt={t.services.imageAlt}
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
                  role="button"
                  tabIndex={0}
                  aria-label="Naloži sliko storitve"
                  className={`border-muted-foreground/25 hover:border-muted-foreground/50 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                    isUploading ? "pointer-events-none opacity-50" : ""
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                >
                  {isUploading ? (
                    <SpinnerIcon
                      size={48}
                      className="text-muted-foreground/50 animate-spin"
                    />
                  ) : (
                    <ImageIcon size={48} className="text-muted-foreground/50" />
                  )}
                  {!isUploading && (
                    <p className="text-muted-foreground mt-4 text-sm">
                      {t.services.clickToUpload}
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

          {/* Mirrors for the React 19 action — controlled state has no DOM
              input of its own, FormData needs explicit carriers. */}
          <input type="hidden" name="categoryId" value={watchCategoryId ?? ""} />
          <input type="hidden" name="isActive" value={String(watchIsActive)} />
          <input type="hidden" name="isFeatured" value={String(watchIsFeatured)} />
          {imageUrl && <input type="hidden" name="imageUrl" value={imageUrl} />}
          {selectedStaff.map((id) => (
            <input key={id} type="hidden" name="staffIds" value={id} />
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Visibility */}
          <Card>
            <CardHeader>
              <CardTitle>{t.services.visibilityTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t.services.activeLabel}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t.services.activeDesc}
                  </p>
                </div>
                <Switch
                  checked={watchIsActive}
                  onCheckedChange={(checked) => setValue("isActive", checked)}
                  disabled={isPending}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t.services.featuredLabel}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t.services.featuredDesc}
                  </p>
                </div>
                <Switch
                  checked={watchIsFeatured}
                  onCheckedChange={(checked) => setValue("isFeatured", checked)}
                  disabled={isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* Staff Selection */}
          <Card>
            <CardHeader>
              <CardTitle>{t.services.staffTitle}</CardTitle>
              <CardDescription>
                {t.services.staffDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {staff.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {t.services.noStaff}
                  </p>
                ) : (
                  staff.map((member) => (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={selectedStaff.includes(member.id)}
                        onChange={() => handleStaffToggle(member.id)}
                        disabled={isPending}
                      />
                      <span className="text-sm">{member.name}</span>
                    </label>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              className="w-full"
              disabled={isPending || isDeleting}
            >
              {isPending && (
                <SpinnerIcon size={16} className="mr-2 animate-spin" />
              )}
              {isEditMode ? t.services.updateButton : t.services.createButton}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.push("/dashboard/services")}
              disabled={isPending || isDeleting}
            >
              {t.common.actions.cancel}
            </Button>
            {isEditMode && (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={handleDelete}
                disabled={isPending || isDeleting}
              >
                {isDeleting ? (
                  <SpinnerIcon size={16} className="animate-spin" />
                ) : (
                  <>
                    <TrashIcon size={16} className="mr-2" />
                    {t.services.deleteButton}
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
