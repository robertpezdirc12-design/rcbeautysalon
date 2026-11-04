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
import { createProduct, updateProduct, deleteProduct } from "@/app/actions/products"
import { createCategory } from "@/app/actions/categories"
import {
  categoryPickerMode,
  normalizeCategoryName,
} from "@/lib/dashboard/category-picker"
import {
  createProductSchema,
  updateProductSchema,
  type ProductFormData,
} from "@/lib/validations/product"
import {
  fdStr,
  fdOptStr,
  fdNum,
  fdBool,
  zodIssuesToFieldErrors,
} from "@/lib/forms/form-data"

interface Category {
  id: string
  name: string
}

interface ProductData {
  id: string
  name: string
  description: string | null
  price: number
  compareAtPrice: number | null
  sku: string | null
  trackInventory: boolean
  stockQuantity: number
  images: string[]
  categoryId: string | null
  isActive: boolean
  isFeatured: boolean
  // #78: retail layer
  barcode?: string | null
  brand?: string | null
  unit?: string | null
  vatRate?: number | null
  forSale?: boolean
  reorderPoint?: number | null
}

interface ProductFormProps {
  categories: Category[]
  product?: ProductData
  mode?: "create" | "edit"
}

export function ProductForm({ categories, product, mode = "create" }: ProductFormProps) {
  const { t } = useI18n()
  const router = useRouter()
  const isEditMode = mode === "edit"
  const [images, setImages] = useState<string[]>(product?.images || [])
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // P3 #52: lokalna kopija kategorij — novoustvarjena (iz praznega stanja
  // izbirnika) je takoj izbirna, brez zapuščanja obrazca.
  const [categoryList, setCategoryList] = useState(categories)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [creatingCategory, setCreatingCategory] = useState(false)
  const pickerMode = categoryPickerMode(categoryList.length)

  const handleCreateCategory = async () => {
    const valid = normalizeCategoryName(newCategoryName)
    if (!valid.ok) {
      toast.error(t.products.noCategories)
      return
    }
    setCreatingCategory(true)
    try {
      const res = await createCategory(valid.name)
      if (!res.success || !res.category) {
        toast.error(res.error || t.products.categoryCreateFailed)
        return
      }
      setCategoryList((prev) =>
        res.reused || prev.some((c) => c.id === res.category!.id)
          ? prev
          : [...prev, res.category!]
      )
      setValue("categoryId", res.category.id)
      clearErrors("categoryId")
      toast.success(t.products.categoryCreated)
      setCategoryDialogOpen(false)
      setNewCategoryName("")
    } catch {
      toast.error(t.products.categoryCreateFailed)
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
  } = useForm<ProductFormData>({
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      price: product?.price || undefined,
      compareAtPrice: product?.compareAtPrice || undefined,
      sku: product?.sku || "",
      trackInventory: product?.trackInventory ?? true,
      stockQuantity: product?.stockQuantity || 0,
      categoryId: product?.categoryId || "",
      isActive: product?.isActive ?? true,
      isFeatured: product?.isFeatured ?? false,
      // #78: retail layer
      barcode: product?.barcode || "",
      brand: product?.brand || "",
      unit: product?.unit || "kos",
      vatRate: product?.vatRate ?? undefined,
      forSale: product?.forSale ?? true,
      reorderPoint: product?.reorderPoint ?? undefined,
    },
  })

  const watchName = watch("name")
  const watchDescription = watch("description")
  const watchPrice = watch("price")
  const watchCompareAtPrice = watch("compareAtPrice")
  const watchSku = watch("sku")
  const watchStockQuantity = watch("stockQuantity")
  const watchIsActive = watch("isActive")
  const watchIsFeatured = watch("isFeatured")
  const watchTrackInventory = watch("trackInventory")
  const watchCategoryId = watch("categoryId")
  // #78: retail layer
  const watchBarcode = watch("barcode")
  const watchBrand = watch("brand")
  const watchUnit = watch("unit")
  const watchVatRate = watch("vatRate")
  const watchForSale = watch("forSale")
  const watchReorderPoint = watch("reorderPoint")

  // All text/number fields are CONTROLLED — the React 19 `action={}`
  // pathway resets uncontrolled inputs after every action submission,
  // and controlled values survive that reset on validation errors.
  // Empty number input → undefined (zod "required" message then applies);
  // RHF's setValue types the field as required, hence the explicit cast.
  const numberValue = (raw: string) => (raw === "" ? undefined : Number(raw))

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error(t.products.imageTypeError)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t.products.imageSizeError)
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "product")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t.products.uploadFailed)
      }

      setImages((prev) => [...prev, data.url])
      toast.success(t.products.imageUploadSuccess)
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(
        error instanceof Error ? error.message : t.products.imageUploadFailed
      )
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Remove image
  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  // Handle delete product
  const handleDelete = async () => {
    if (!product?.id) return

    const confirmed = window.confirm(
      t.products.deleteConfirm
    )

    if (!confirmed) return

    setIsDeleting(true)
    try {
      const result = await deleteProduct(product.id)

      if (result.success) {
        toast.success(t.products.deleteSuccess)
        router.push("/dashboard/products")
      } else {
        toast.error(result.error || t.products.deleteFailed)
      }
    } catch (error) {
      console.error("Delete error:", error)
      toast.error(t.products.unexpectedError)
    } finally {
      setIsDeleting(false)
    }
  }

  // Submit form — React 19 `action={}` pathway (F1: E3-8 follow-up).
  // Same contract as ServiceForm: FormData → zod safeParse → server action;
  // on validation failure restore submitted values (React resets
  // uncontrolled inputs after an action) and map issues to inline errors.
  const [, formAction, isPending] = useActionState(
    async (_prev: { ok: boolean } | null, formData: FormData) => {
      const values = {
        name: fdStr(formData, "name"),
        description: fdOptStr(formData, "description"),
        price: fdNum(formData, "price"),
        compareAtPrice: fdNum(formData, "compareAtPrice"),
        sku: fdOptStr(formData, "sku"),
        trackInventory: fdBool(formData, "trackInventory"),
        stockQuantity: fdNum(formData, "stockQuantity") ?? 0,
        images: images.length > 0 ? images : undefined,
        categoryId: fdOptStr(formData, "categoryId"),
        isActive: fdBool(formData, "isActive"),
        isFeatured: fdBool(formData, "isFeatured"),
        // #78: retail layer (fdNum vrača null za prazno — CreateProductInput želi undefined)
        barcode: fdOptStr(formData, "barcode"),
        brand: fdOptStr(formData, "brand"),
        unit: fdOptStr(formData, "unit"),
        vatRate: fdNum(formData, "vatRate") ?? undefined,
        forSale: fdBool(formData, "forSale"),
        reorderPoint: fdNum(formData, "reorderPoint") ?? undefined,
      }

      const schema = isEditMode ? updateProductSchema : createProductSchema
      const parsed = schema.safeParse(values)
      if (!parsed.success) {
        // All fields are controlled, so nothing to restore — just surface
        // the same schema issues inline (same slots as the old resolver).
        const fieldErrors = zodIssuesToFieldErrors(parsed.error)
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as keyof ProductFormData, { message })
        }
        toast.error(
          isEditMode ? t.products.updateFailed : t.products.createFailed
        )
        return { ok: false }
      }

      try {
        const result = isEditMode && product?.id
          ? await updateProduct(product.id, {
              ...parsed.data,
              compareAtPrice: parsed.data.compareAtPrice ?? undefined,
              // #78: prazno polje → eksplicitno null (briše vrednost),
              // ne undefined (ki bi pustil staro vrednost v bazi).
              vatRate: parsed.data.vatRate ?? null,
              reorderPoint: parsed.data.reorderPoint ?? null,
            })
          : await createProduct({
              ...parsed.data,
              compareAtPrice: parsed.data.compareAtPrice ?? undefined,
              vatRate: parsed.data.vatRate ?? undefined,
              reorderPoint: parsed.data.reorderPoint ?? undefined,
            })

        if (result.success) {
          toast.success(isEditMode ? t.products.updateSuccess : t.products.createSuccess)
          router.push("/dashboard/products")
          return { ok: true }
        }
        toast.error(result.error || (isEditMode ? t.products.updateFailed : t.products.createFailed))
        return { ok: false }
      } catch (error) {
        console.error("Submit error:", error)
        toast.error(t.products.unexpectedError)
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
            <DialogTitle>{t.products.createCategory}</DialogTitle>
            <DialogDescription>{t.products.noCategories}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-category">{t.products.newCategoryLabel}</Label>
            <Input
              id="new-category"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t.products.newCategoryPlaceholder}
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
              {t.products.createCategory}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="space-y-6 lg:col-span-2">
          {/* Product Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t.products.productInfoTitle}</CardTitle>
              <CardDescription>{t.products.productInfoDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.products.nameLabel}</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder={t.products.namePlaceholder}
                  value={watchName}
                  onChange={(e) => {
                    setValue("name", e.target.value)
                    clearErrors("name")
                  }}
                  disabled={isPending}
                />
                {errors.name && (
                  <p className="text-destructive text-sm">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t.products.descriptionLabel}</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder={t.products.descriptionPlaceholder}
                  rows={4}
                  value={watchDescription ?? ""}
                  onChange={(e) => {
                    setValue("description", e.target.value)
                    clearErrors("description")
                  }}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">{t.products.categoryLabel}</Label>
                {/* P3 #52: 0 kategorij → razloženo prazno stanje + dejanje
                    "Ustvari kategorijo" (prej prazen popover brez poti naprej). */}
                {pickerMode === "empty" ? (
                  <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-4 text-center">
                    <p className="text-muted-foreground text-sm">
                      {t.products.noCategories}
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
                      {t.products.createCategory}
                    </Button>
                  </div>
                ) : (
                  <Select
                    defaultValue={product?.categoryId || undefined}
                    onValueChange={(value) => setValue("categoryId", value)}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.products.categoryPlaceholder} />
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

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>{t.products.pricingTitle}</CardTitle>
              <CardDescription>{t.products.pricingDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="price">{t.products.priceLabel}</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    placeholder="28.00"
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
                <div className="space-y-2">
                  <Label htmlFor="compareAtPrice">{t.products.compareAtPriceLabel}</Label>
                  <Input
                    id="compareAtPrice"
                    name="compareAtPrice"
                    type="number"
                    step="0.01"
                    placeholder="35.00"
                    value={watchCompareAtPrice ?? ""}
                    onChange={(e) => {
                      setValue(
                        "compareAtPrice",
                        numberValue(e.target.value) as unknown as number
                      )
                      clearErrors("compareAtPrice")
                    }}
                    disabled={isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.products.compareAtPriceHelp}
                  </p>
                </div>
              </div>

              {/* #78: DDV stopnja — cena je bruto, stopnja pove katera je znotraj. */}
              <div className="space-y-2">
                <Label htmlFor="vatRate">{t.products.vatRateLabel}</Label>
                <Input
                  id="vatRate"
                  name="vatRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="22.00"
                  value={watchVatRate ?? ""}
                  onChange={(e) => {
                    setValue(
                      "vatRate",
                      numberValue(e.target.value) as unknown as number
                    )
                    clearErrors("vatRate")
                  }}
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">
                  {t.products.vatRateHelp}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card>
            <CardHeader>
              <CardTitle>{t.products.inventoryTitle}</CardTitle>
              <CardDescription>{t.products.inventoryDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sku">{t.products.skuLabel}</Label>
                  <Input
                    id="sku"
                    name="sku"
                    placeholder="SHMP-001"
                    value={watchSku}
                    onChange={(e) => {
                      setValue("sku", e.target.value)
                      clearErrors("sku")
                    }}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockQuantity">{t.products.stockQuantityLabel}</Label>
                  <Input
                    id="stockQuantity"
                    name="stockQuantity"
                    type="number"
                    placeholder="50"
                    value={watchStockQuantity ?? ""}
                    onChange={(e) => {
                      setValue(
                        "stockQuantity",
                        numberValue(e.target.value) as unknown as number
                      )
                      clearErrors("stockQuantity")
                    }}
                    disabled={isPending}
                  />
                </div>
                {/* #78: črtna koda — prejem blaga z skeniranjem. */}
                <div className="space-y-2">
                  <Label htmlFor="barcode">{t.products.barcodeLabel}</Label>
                  <Input
                    id="barcode"
                    name="barcode"
                    placeholder={t.products.barcodePlaceholder}
                    value={watchBarcode ?? ""}
                    onChange={(e) => {
                      setValue("barcode", e.target.value)
                      clearErrors("barcode")
                    }}
                    disabled={isPending}
                  />
                </div>
                {/* #78: znamka. */}
                <div className="space-y-2">
                  <Label htmlFor="brand">{t.products.brandLabel}</Label>
                  <Input
                    id="brand"
                    name="brand"
                    placeholder={t.products.brandPlaceholder}
                    value={watchBrand ?? ""}
                    onChange={(e) => {
                      setValue("brand", e.target.value)
                      clearErrors("brand")
                    }}
                    disabled={isPending}
                  />
                </div>
                {/* #78: enota. */}
                <div className="space-y-2">
                  <Label htmlFor="unit">{t.products.unitLabel}</Label>
                  <Input
                    id="unit"
                    name="unit"
                    placeholder={t.products.unitPlaceholder}
                    value={watchUnit ?? ""}
                    onChange={(e) => {
                      setValue("unit", e.target.value)
                      clearErrors("unit")
                    }}
                    disabled={isPending}
                  />
                </div>
                {/* #78: per-izdelek prag nizke zaloge. */}
                <div className="space-y-2">
                  <Label htmlFor="reorderPoint">{t.products.reorderPointLabel}</Label>
                  <Input
                    id="reorderPoint"
                    name="reorderPoint"
                    type="number"
                    min="0"
                    placeholder="10"
                    value={watchReorderPoint ?? ""}
                    onChange={(e) => {
                      setValue(
                        "reorderPoint",
                        numberValue(e.target.value) as unknown as number
                      )
                      clearErrors("reorderPoint")
                    }}
                    disabled={isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.products.reorderPointHelp}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t.products.trackInventoryLabel}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t.products.trackInventoryDesc}
                  </p>
                </div>
                <Switch
                  checked={watchTrackInventory}
                  onCheckedChange={(checked) => setValue("trackInventory", checked)}
                  disabled={isPending}
                />
              </div>
              {/* #78: forSale — "do we sell it", ne "do we count it". */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t.products.forSaleLabel}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t.products.forSaleDesc}
                  </p>
                </div>
                <Switch
                  checked={watchForSale}
                  onCheckedChange={(checked) => setValue("forSale", checked)}
                  disabled={isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>{t.products.imagesTitle}</CardTitle>
              <CardDescription>{t.products.imagesDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {images.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {images.map((image, index) => (
                      <div key={index} className="relative aspect-square overflow-hidden rounded-lg">
                        <Image
                          src={image}
                          alt={t.products.imageAlt(index + 1)}
                          fill
                          className="object-cover"
                        
              sizes="128px"/>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => handleRemoveImage(index)}
                        >
                          <TrashIcon size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Naloži sliko izdelka"
                    className={`border-muted-foreground/25 hover:border-muted-foreground/50 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors ${
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
                      <SpinnerIcon size={20} className="animate-spin" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <PlusIcon size={16} />
                        <span className="text-sm">{t.products.addMoreImages}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Naloži sliko izdelka"
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
                    <SpinnerIcon size={48} className="text-muted-foreground/50 animate-spin" />
                  ) : (
                    <ImageIcon size={48} className="text-muted-foreground/50" />
                  )}
                  {!isUploading && (
                    <p className="text-muted-foreground mt-4 text-sm">
                      {t.products.clickToUpload}
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
        </div>

        {/* Mirrors for the React 19 action — controlled state has no DOM
            input of its own, FormData needs explicit carriers. */}
        <input type="hidden" name="categoryId" value={watchCategoryId ?? ""} />
        <input type="hidden" name="trackInventory" value={String(watchTrackInventory)} />
        <input type="hidden" name="isActive" value={String(watchIsActive)} />
        <input type="hidden" name="isFeatured" value={String(watchIsFeatured)} />
        {/* #78: forSale mirror (Switch nima DOM inputa). */}
        <input type="hidden" name="forSale" value={String(watchForSale)} />
        {images.map((image) => (
          <input key={image} type="hidden" name="images" value={image} />
        ))}

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>{t.products.statusTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t.products.activeLabel}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t.products.activeDesc}
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
                  <Label>{t.products.featuredLabel}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t.products.featuredDesc}
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

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isPending || isDeleting}>
              {isPending && (
                <SpinnerIcon size={16} className="mr-2 animate-spin" />
              )}
              {isEditMode ? t.products.updateButton : t.products.createButton}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.push("/dashboard/products")}
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
                    {t.products.deleteButton}
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
