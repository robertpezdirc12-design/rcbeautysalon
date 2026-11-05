"use client"

// ============================================================
// IZGLED IN VSEBINA — admin editor for the public salon site.
// Loads org branding + SiteContent, edits it in local state and
// saves the whole object via updateSiteContent. Theme palette,
// logo and vertical are saved instantly (dedicated actions).
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EyeIcon,
  ImageIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@/components/icons"
import { ArrowDown, ArrowUp, Rocket, Undo2 } from "lucide-react"
import {
  getOrgBranding,
  previewVerticalSwitch,
  revertSiteContentToPublished,
  updateOrgLogo,
  updateOrgPalette,
  updateOrgVertical,
  updateSiteContent,
} from "@/app/actions/site-content"
import { publishSite, type PublicationStatus } from "@/app/actions/publication"
import {
  SECTION_KEYS,
  normalizeSections,
  type FeatureContent,
  type OpeningHour,
  type SectionKey,
  type SiteContent,
  type StatContent,
} from "@/lib/site-content"
import { uploadImage } from "@/lib/upload-client"
import { PALETTE_OPTIONS } from "@/lib/palettes-client"
import { listProfileOptions, getProfile } from "@/lib/profiles/registry"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/provider"

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

const ICON_OPTIONS = [
  "Sparkles",
  "Scissors",
  "CalendarCheck",
  "ShoppingBag",
  "Leaf",
  "ShieldCheck",
  "Microscope",
  "HeartHandshake",
  "Zap",
  "Flame",
  "Star",
  "Clock",
  "LayoutGrid",
  "MessageCircle",
  "FileText",
] as const

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

interface OrgInfo {
  id: string
  slug: string
  name: string
  logo: string | null
  vertical: string
  palette: string | null
  siteUrl: string
}

/** Ensure exactly 7 rows, Monday-first, closed when open/close missing. */
function normalizeHours(hours: OpeningHour[]): OpeningHour[] {
  return DAY_ORDER.map((day) => {
    const found = hours.find((h) => h.day === day)
    if (!found || !found.open || !found.close) {
      return { day, open: null, close: null }
    }
    return { day, open: found.open, close: found.close }
  })
}

// ------------------------------------------------------------
// Small internal building blocks
// ------------------------------------------------------------

function EditorCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ImageField({
  label,
  value,
  variant = "wide",
  uploading = false,
  emptyText,
  uploadLabel,
  hint,
  onFile,
  onRemove,
}: {
  label: string
  value?: string
  variant?: "square" | "wide"
  uploading?: boolean
  emptyText?: string
  uploadLabel?: string
  hint?: string
  onFile: (file: File) => void
  onRemove?: () => void
}) {
  const { t } = useI18n()
  const empty = emptyText ?? t.settings.branding.noImage
  const upload = uploadLabel ?? t.settings.branding.uploadImage
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-lg border bg-muted",
            variant === "wide" ? "h-28 w-48" : "h-20 w-20"
          )}
        >
          {value ? (
            <Image
              src={value}
              alt={label}
              fill
              sizes="192px"
              className={variant === "wide" ? "object-cover" : "object-contain p-1"}
            />
          ) : (
            <div className="grid h-full place-items-center px-2 text-center text-xs text-muted-foreground">
              {empty}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-background/70">
              <SpinnerIcon size={20} className="animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <ImageIcon size={16} className="mr-2" />
            {upload}
          </Button>
          {value && onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={onRemove}
              disabled={uploading}
            >
              <TrashIcon size={16} className="mr-2" />
              {t.settings.branding.remove}
            </Button>
          )}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}

function FeatureRow({
  index,
  item,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number
  item: FeatureContent
  canRemove: boolean
  onChange: (patch: Partial<FeatureContent>) => void
  onRemove: () => void
}) {
  const { t } = useI18n()

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={item.icon} onValueChange={(v) => onChange({ icon: v })}>
          <SelectTrigger
            className="sm:w-48"
            aria-label={t.settings.branding.featureIconAria(index + 1)}
          >
            <SelectValue placeholder={t.settings.branding.iconPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {ICON_OPTIONS.map((icon) => (
              <SelectItem key={icon} value={icon}>
                {t.settings.branding.iconLabels[icon]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="flex-1"
          value={item.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={t.settings.branding.featureTitlePlaceholder}
          aria-label={t.settings.branding.featureTitleAria(index + 1)}
        />
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
            aria-label={t.settings.branding.featureRemoveAria(index + 1)}
          >
            <TrashIcon size={16} />
          </Button>
        )}
      </div>
      <Input
        value={item.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder={t.settings.branding.featureDescPlaceholder}
        aria-label={t.settings.branding.featureDescAria(index + 1)}
      />
    </div>
  )
}

function SectionTitlePair({
  label,
  titleId,
  subtitleId,
  title,
  subtitle,
  onTitle,
  onSubtitle,
}: {
  label: string
  titleId: string
  subtitleId: string
  title: string
  subtitle: string
  onTitle: (value: string) => void
  onSubtitle: (value: string) => void
}) {
  const { t } = useI18n()

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t.settings.branding.labels.title} htmlFor={titleId}>
          <Input id={titleId} value={title} onChange={(e) => onTitle(e.target.value)} />
        </Field>
        <Field label={t.settings.branding.labels.subtitle} htmlFor={subtitleId}>
          <Input id={subtitleId} value={subtitle} onChange={(e) => onSubtitle(e.target.value)} />
        </Field>
      </div>
    </div>
  )
}

function EditorSkeleton() {
  const { t } = useI18n()

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">{t.settings.branding.loadingSr}</span>
    </div>
  )
}

// ------------------------------------------------------------
// Main component
// ------------------------------------------------------------

export function BrandingEditor() {
  const router = useRouter()
  const { t } = useI18n()
  const b = t.settings.branding

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [content, setContent] = useState<SiteContent | null>(null)
  const [dirty, setDirty] = useState(false)
  const [publication, setPublication] = useState<PublicationStatus | null>(null)

  const [saving, setSaving] = useState(false)
  const [savingPalette, setSavingPalette] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null) // "logo" | "hero" | "about"
  const [savingLogo, setSavingLogo] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [revertOpen, setRevertOpen] = useState(false)
  const [reverting, setReverting] = useState(false)

  const [vertical, setVertical] = useState("")
  const [reseed, setReseed] = useState(false)
  const [savingVertical, setSavingVertical] = useState(false)
  // P1 #58: explicit content decision inside a dialog — the old
  // window.confirm left the previous trade's hero/about/CTA live.
  const [verticalDialogOpen, setVerticalDialogOpen] = useState(false)
  const [contentMode, setContentMode] = useState<"reseed" | "keep">("reseed")
  // P1 #69: what the switch will do to forms/workflows (read-only preview).
  const [assetPreview, setAssetPreview] = useState<{
    formsAdded: number
    workflowsAdded: number
    formsDeactivated: number
    workflowsDeactivated: number
  } | null>(null)

  // P3 #49: namig hero/CTA gumba sledi načinu CTA profila — prodajni
  // profil vodi v trgovino, povpraševalni na obrazec (prej je namig
  // VEDNO obljubljal rezervacijo (/booking), tudi čebelarju).
  const primaryCtaHint = (() => {
    const mode = getProfile(vertical || null).website.ctaMode
    if (mode === "order") return b.ctaOrderHint
    if (mode === "inquiry" || mode === "quote") return b.ctaInquiryHint
    return b.ctaBookingHint
  })()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getOrgBranding()
      if ("org" in res && "siteContent" in res && res.org && res.siteContent) {
        setOrg(res.org)
        setContent(res.siteContent)
        setVertical(res.org.vertical)
        setPublication(
          "publication" in res && res.publication ? res.publication : null
        )
        // P1 #58: default content mode — reseed while the content is still
        // the wizard's untouched sample, keep once the owner edited it.
        if (typeof res.contentUntouched === "boolean") {
          setContentMode(res.contentUntouched ? "reseed" : "keep")
        }
        setDirty(false)
      } else {
        setError(
          "error" in res && typeof res.error === "string"
            ? res.error
            : b.loadError
        )
      }
    } catch {
      setError(b.loadErrorRetry)
    } finally {
      setLoading(false)
    }
  }, [b])

  useEffect(() => {
    void load()
  }, [load])

  /** Immutable update of a top-level SiteContent field. */
  const set = useCallback(
    <K extends keyof SiteContent>(field: K, value: SiteContent[K]) => {
      setContent((prev) => (prev ? { ...prev, [field]: value } : prev))
      setDirty(true)
    },
    []
  )

  // ----------------------------------------------------------
  // Instant-save handlers (palette, logo, vertical, images)
  // ----------------------------------------------------------

  const handlePalette = async (id: string) => {
    if (!org || savingPalette || org.palette === id) return
    setSavingPalette(id)
    try {
      const res = await updateOrgPalette(id)
      if ("error" in res && typeof res.error === "string") {
        toast.error(res.error)
        return
      }
      setOrg({ ...org, palette: id })
      toast.success(b.themeSaved)
      router.refresh()
    } catch {
      toast.error(b.themeSaveFailed)
    } finally {
      setSavingPalette(null)
    }
  }

  const handleLogoUpload = async (file: File) => {
    setUploading("logo")
    try {
      const url = await uploadImage(file, "logo")
      const res = await updateOrgLogo(url)
      if ("error" in res && typeof res.error === "string") {
        toast.error(res.error)
        return
      }
      setOrg((prev) => (prev ? { ...prev, logo: url } : prev))
      toast.success(b.logoSaved)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : b.logoUploadFailed)
    } finally {
      setUploading(null)
    }
  }

  const handleLogoRemove = async () => {
    setSavingLogo(true)
    try {
      const res = await updateOrgLogo(null)
      if ("error" in res && typeof res.error === "string") {
        toast.error(res.error)
        return
      }
      setOrg((prev) => (prev ? { ...prev, logo: null } : prev))
      toast.success(b.logoRemoved)
      router.refresh()
    } catch {
      toast.error(b.logoRemoveFailed)
    } finally {
      setSavingLogo(false)
    }
  }

  const handleImageUpload = async (key: "hero" | "about", file: File) => {
    if (!content) return
    setUploading(key)
    try {
      const url = await uploadImage(file, key)
      if (key === "hero") {
        set("hero", { ...content.hero, imageUrl: url })
      } else {
        set("about", { ...content.about, imageUrl: url })
      }
      toast.success(b.imageUploaded)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : b.imageUploadFailed)
    } finally {
      setUploading(null)
    }
  }

  const handleVertical = async () => {
    if (!org || savingVertical) return
    // P1 #69: the dialog owns the decision — opening it IS the explicit
    // confirmation flow (published impact, content mode, catalog note,
    // forms/workflows preview).
    setAssetPreview(null)
    setVerticalDialogOpen(true)
    const res = await previewVerticalSwitch(vertical)
    if (res.success && res.assets) setAssetPreview(res.assets)
  }

  const confirmVertical = async () => {
    if (!org || savingVertical) return
    setSavingVertical(true)
    try {
      const res = await updateOrgVertical(vertical, {
        reseedCatalog: reseed,
        contentMode,
      })
      if ("error" in res && typeof res.error === "string") {
        toast.error(res.error)
        return
      }
      setOrg({ ...org, vertical })
      if (contentMode === "reseed") {
        // Reload the editor so the form reflects the freshly seeded content.
        await load()
      }
      if (res.seed) {
        const { added, replaced, kept } = res.seed
        toast.success(b.vertical.changed, {
          description: [
            b.vertical.seedAdded(added.categories, added.services, added.products),
            replaced.categories + replaced.services + replaced.products > 0
              ? b.vertical.seedReplaced(replaced.categories, replaced.services, replaced.products)
              : null,
            kept > 0 ? b.vertical.seedKept(kept) : null,
          ].filter(Boolean).join(" "),
        })
      } else {
        toast.success(b.vertical.changed)
      }
      if (res.assets) {
        const { formsAdded, workflowsAdded, formsDeactivated, workflowsDeactivated } = res.assets
        if (formsDeactivated + workflowsDeactivated > 0) {
          toast.info(
            b.vertical.assetsReplaced(formsDeactivated, workflowsDeactivated),
            {
              description:
                formsAdded + workflowsAdded > 0
                  ? b.vertical.assetsAdded(formsAdded, workflowsAdded)
                  : undefined,
            }
          )
        }
      }
      setVerticalDialogOpen(false)
      router.refresh()
    } catch {
      toast.error(b.vertical.changeFailed)
    } finally {
      setSavingVertical(false)
    }
  }

  // ----------------------------------------------------------
  // Content field helpers
  // ----------------------------------------------------------

  const updateParagraph = (idx: number, value: string) => {
    if (!content) return
    const paragraphs = [...content.about.paragraphs]
    while (paragraphs.length < 2) paragraphs.push("")
    paragraphs[idx] = value
    set("about", { ...content.about, paragraphs })
  }

  const updateStat = (idx: number, patch: Partial<StatContent>) => {
    if (!content) return
    const stats = content.about.stats.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    set("about", { ...content.about, stats })
  }

  const addStat = () => {
    if (!content || content.about.stats.length >= 4) return
    set("about", {
      ...content.about,
      stats: [...content.about.stats, { value: "", label: "" }],
    })
  }

  const removeStat = (idx: number) => {
    if (!content) return
    set("about", {
      ...content.about,
      stats: content.about.stats.filter((_, i) => i !== idx),
    })
  }

  const updateFeature = (idx: number, patch: Partial<FeatureContent>) => {
    if (!content) return
    const items = content.features.items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    set("features", { ...content.features, items })
  }

  const addFeature = () => {
    if (!content || content.features.items.length >= 6) return
    set("features", {
      ...content.features,
      items: [...content.features.items, { icon: "Sparkles", title: "", description: "" }],
    })
  }

  const removeFeature = (idx: number) => {
    if (!content) return
    set("features", {
      ...content.features,
      items: content.features.items.filter((_, i) => i !== idx),
    })
  }

  const updateHour = (day: number, patch: Partial<OpeningHour>) => {
    if (!content) return
    const hours = normalizeHours(content.openingHours).map((h) =>
      h.day === day ? { ...h, ...patch } : h
    )
    set("openingHours", hours)
  }

  const toggleDayOpen = (day: number, open: boolean) => {
    updateHour(day, open ? { open: "09:00", close: "18:00" } : { open: null, close: null })
  }

  const toggleSection = (key: SectionKey, visible: boolean) => {
    if (!content) return
    // E3-2: preserve the owner-defined order — only visibility changes here.
    const exists = content.sections.some((s) => s.key === key)
    const next = exists
      ? content.sections.map((s) => (s.key === key ? { ...s, visible } : s))
      : [...content.sections, { key, visible }]
    set("sections", normalizeSections(next) ?? [])
  }

  /** Swap a section with its neighbor (E3-2). Hero stays pinned first. */
  const moveSection = (key: SectionKey, dir: -1 | 1) => {
    if (!content) return
    const list = [...content.sections]
    const idx = list.findIndex((s) => s.key === key)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= list.length) return
    // Hero is the page header — always first, never swapped.
    if (key === "hero" || list[target].key === "hero") return
    const [item] = list.splice(idx, 1)
    list.splice(target, 0, item)
    set("sections", list)
  }

  // ----------------------------------------------------------
  // Save whole SiteContent
  // ----------------------------------------------------------

  const handleSave = async () => {
    if (!content) return
    if (!content.hero.title.trim()) {
      toast.error(b.heroTitleRequired)
      return
    }
    setSaving(true)
    try {
      const payload: SiteContent = {
        ...content,
        hero: {
          ...content.hero,
          eyebrow: content.hero.eyebrow?.trim() || undefined,
          videoUrl: content.hero.videoUrl?.trim() || undefined,
          posterUrl: content.hero.posterUrl?.trim() || undefined,
          primaryCta: {
            label: content.hero.primaryCta.label.trim() || "Rezerviraj termin",
            href: "/booking",
          },
          secondaryCta: content.hero.secondaryCta?.label?.trim()
            ? { label: content.hero.secondaryCta.label.trim(), href: "/shop" }
            : null,
        },
        about: {
          ...content.about,
          paragraphs: content.about.paragraphs.map((p) => p.trim()).filter(Boolean),
          stats: content.about.stats.filter((s) => s.value.trim() || s.label.trim()),
        },
        features: {
          ...content.features,
          items: content.features.items.filter((i) => i.title.trim()),
        },
        openingHours: normalizeHours(content.openingHours),
        // E3-2: keep the owner-defined section ORDER (not the canonical one).
        sections:
          normalizeSections(content.sections) ??
          SECTION_KEYS.map((key) => ({ key, visible: true })),
      }
      const res = await updateSiteContent(payload)
      if ("error" in res && typeof res.error === "string") {
        toast.error(res.error)
        return
      }
      setDirty(false)
      // After a save the draft differs from the published snapshot — but only
      // when a snapshot exists at all (pre-E3-2 tenants render live content).
      setPublication((p) =>
        p ? { ...p, hasUnpublishedChanges: p.hasPublishedSnapshot } : p
      )
      toast.success(b.contentSaved)
      router.refresh()
    } catch {
      toast.error(b.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // ----------------------------------------------------------
  // Publish / revert (EPIC #3 E3-2)
  // ----------------------------------------------------------

  const handlePublish = async () => {
    if (publishing) return
    setPublishing(true)
    try {
      const res = await publishSite()
      if (res.success) {
        setPublication({
          state: "PUBLISHED",
          publishedAt: new Date(),
          hasUnpublishedChanges: false,
          hasPublishedSnapshot: true,
          warnings: res.warnings,
        })
        toast.success(b.publishDone)
        router.refresh()
      } else {
        toast.error(res.errors.join(" "))
      }
    } catch {
      toast.error(b.publishFailed)
    } finally {
      setPublishing(false)
    }
  }

  const handleRevert = async () => {
    if (reverting) return
    setReverting(true)
    try {
      const res = await revertSiteContentToPublished()
      if ("error" in res && typeof res.error === "string") {
        toast.error(res.error)
        return
      }
      setRevertOpen(false)
      await load()
      toast.success(b.revert.done)
      router.refresh()
    } catch {
      toast.error(b.revert.failed)
    } finally {
      setReverting(false)
    }
  }

  // ----------------------------------------------------------
  // Loading / error states
  // ----------------------------------------------------------

  if (loading) {
    return <EditorSkeleton />
  }

  if (error || !org || !content) {
    return (
      <Card className="mx-auto w-full max-w-3xl border-destructive/40">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <WarningCircleIcon size={32} className="text-destructive" />
          <p className="font-medium">{error || b.contentLoadError}</p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            {b.retry}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const hours = normalizeHours(content.openingHours)
  const paragraph0 = content.about.paragraphs[0] ?? ""
  const paragraph1 = content.about.paragraphs[1] ?? ""
  const selectedVertical = listProfileOptions().find((v) => v.id === vertical)

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">{b.title}</h2>
          <p className="text-muted-foreground">{b.subtitle}</p>
          {publication?.hasUnpublishedChanges && (
            <Badge className="mt-2 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300">
              {b.unpublishedBadge}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/s/${org.slug}/preview`} target="_blank" rel="noopener noreferrer">
              <EyeIcon size={16} className="mr-2" />
              {b.previewLink}
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={org.siteUrl} target="_blank" rel="noopener noreferrer">
              <EyeIcon size={16} className="mr-2" />
              {b.viewSite}
            </a>
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {/* a) Tema */}
        <EditorCard
          title={b.theme.title}
          description={b.theme.desc}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {PALETTE_OPTIONS.map((p) => {
              const active = org.palette === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void handlePalette(p.id)}
                  disabled={savingPalette !== null}
                  aria-pressed={active}
                  aria-label={b.themeAria(p.label)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center transition-all hover:border-primary/50 disabled:opacity-60",
                    active && "border-primary ring-2 ring-primary"
                  )}
                >
                  <span className="flex h-10 w-10 overflow-hidden rounded-full border border-border">
                    <span
                      className="h-full w-1/2"
                      style={{ backgroundColor: p.primary }}
                      aria-hidden
                    />
                    <span
                      className="h-full w-1/2"
                      style={{ backgroundColor: p.accent }}
                      aria-hidden
                    />
                  </span>
                  <span className="text-xs font-medium leading-tight">{p.label}</span>
                </button>
              )
            })}
          </div>
        </EditorCard>

        {/* b) Logo */}
        <EditorCard title={b.logoSection.title} description={b.logoSection.desc}>
          <ImageField
            label={b.salonLogo}
            variant="square"
            value={org.logo ?? undefined}
            uploading={uploading === "logo" || savingLogo}
            emptyText={b.noLogo}
            uploadLabel={b.uploadLogo}
            hint={b.logoHint}
            onFile={(file) => void handleLogoUpload(file)}
            onRemove={() => void handleLogoRemove()}
          />
        </EditorCard>

        {/* c) Hero sekcija */}
        <EditorCard
          title={b.hero.title}
          description={b.hero.desc}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={b.eyebrowLabel} htmlFor="hero-eyebrow">
              <Input
                id="hero-eyebrow"
                value={content.hero.eyebrow ?? ""}
                onChange={(e) => set("hero", { ...content.hero, eyebrow: e.target.value })}
                placeholder={b.eyebrowPlaceholder}
              />
            </Field>
            <Field label={b.labels.title} htmlFor="hero-title" hint={b.requiredHint}>
              <Input
                id="hero-title"
                value={content.hero.title}
                onChange={(e) => set("hero", { ...content.hero, title: e.target.value })}
                placeholder={b.heroTitlePlaceholder}
              />
            </Field>
          </div>
          <Field label={b.labels.subtitle} htmlFor="hero-subtitle">
            <Textarea
              id="hero-subtitle"
              rows={3}
              value={content.hero.subtitle}
              onChange={(e) => set("hero", { ...content.hero, subtitle: e.target.value })}
            />
          </Field>
          <ImageField
            label={b.labels.image}
            value={content.hero.imageUrl}
            uploading={uploading === "hero"}
            onFile={(file) => void handleImageUpload("hero", file)}
            onRemove={() => set("hero", { ...content.hero, imageUrl: undefined })}
            hint={b.imageWidthHint}
          />
          <Field
            label={b.videoUrlLabel}
            htmlFor="hero-video"
            hint={b.videoUrlHint}
          >
            <Input
              id="hero-video"
              type="url"
              value={content.hero.videoUrl ?? ""}
              onChange={(e) => set("hero", { ...content.hero, videoUrl: e.target.value })}
              placeholder="https://primer.com/video.mp4"
            />
          </Field>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={b.cta1Label} htmlFor="hero-cta1" hint={primaryCtaHint}>
              <Input
                id="hero-cta1"
                value={content.hero.primaryCta.label}
                onChange={(e) =>
                  set("hero", {
                    ...content.hero,
                    primaryCta: { ...content.hero.primaryCta, label: e.target.value },
                  })
                }
              />
            </Field>
            <Field
              label={b.cta2Label}
              htmlFor="hero-cta2"
              hint={b.ctaShopHint}
            >
              <Input
                id="hero-cta2"
                value={content.hero.secondaryCta?.label ?? ""}
                onChange={(e) =>
                  set("hero", {
                    ...content.hero,
                    secondaryCta: { label: e.target.value, href: "/shop" },
                  })
                }
              />
            </Field>
          </div>
        </EditorCard>

        {/* d) O salonu */}
        <EditorCard
          title={b.about.title}
          description={b.about.desc}
        >
          <Field label={b.labels.title} htmlFor="about-title">
            <Input
              id="about-title"
              value={content.about.title}
              onChange={(e) => set("about", { ...content.about, title: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={b.paragraph1} htmlFor="about-p1">
              <Textarea
                id="about-p1"
                rows={4}
                value={paragraph0}
                onChange={(e) => updateParagraph(0, e.target.value)}
              />
            </Field>
            <Field label={b.paragraph2} htmlFor="about-p2">
              <Textarea
                id="about-p2"
                rows={4}
                value={paragraph1}
                onChange={(e) => updateParagraph(1, e.target.value)}
              />
            </Field>
          </div>
          <ImageField
            label={b.labels.image}
            value={content.about.imageUrl}
            uploading={uploading === "about"}
            onFile={(file) => void handleImageUpload("about", file)}
            onRemove={() => set("about", { ...content.about, imageUrl: undefined })}
          />
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{b.statsLabel}</Label>
              <Badge variant="secondary">{content.about.stats.length}/4</Badge>
            </div>
            {content.about.stats.map((stat, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
              >
                <Input
                  className="sm:w-28"
                  value={stat.value}
                  onChange={(e) => updateStat(i, { value: e.target.value })}
                  placeholder="10+"
                  aria-label={b.statValueAria(i + 1)}
                />
                <Input
                  className="flex-1"
                  value={stat.label}
                  onChange={(e) => updateStat(i, { label: e.target.value })}
                  placeholder={b.statLabelPlaceholder}
                  aria-label={b.statLabelAria(i + 1)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeStat(i)}
                  aria-label={b.statRemoveAria(i + 1)}
                >
                  <TrashIcon size={16} />
                </Button>
              </div>
            ))}
            {content.about.stats.length < 4 && (
              <Button type="button" variant="outline" size="sm" onClick={addStat}>
                <PlusIcon size={16} className="mr-2" />
                {b.addStat}
              </Button>
            )}
          </div>
        </EditorCard>

        {/* e) Prednosti */}
        <EditorCard
          title={b.features.title}
          description={b.features.desc}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={b.labels.title} htmlFor="features-title">
              <Input
                id="features-title"
                value={content.features.title}
                onChange={(e) => set("features", { ...content.features, title: e.target.value })}
              />
            </Field>
            <Field label={b.labels.subtitle} htmlFor="features-subtitle">
              <Input
                id="features-subtitle"
                value={content.features.subtitle}
                onChange={(e) =>
                  set("features", { ...content.features, subtitle: e.target.value })
                }
              />
            </Field>
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{b.features.title}</Label>
              <Badge variant="secondary">{content.features.items.length}/6</Badge>
            </div>
            {content.features.items.map((item, i) => (
              <FeatureRow
                key={i}
                index={i}
                item={item}
                canRemove={content.features.items.length > 1}
                onChange={(patch) => updateFeature(i, patch)}
                onRemove={() => removeFeature(i)}
              />
            ))}
            {content.features.items.length < 6 && (
              <Button type="button" variant="outline" size="sm" onClick={addFeature}>
                <PlusIcon size={16} className="mr-2" />
                {b.addFeature}
              </Button>
            )}
          </div>
        </EditorCard>

        {/* f) Naslovi sekcij */}
        <EditorCard
          title={b.sectionTitles.title}
          description={b.sectionTitles.desc}
        >
          <SectionTitlePair
            label={b.sectionLabels.services}
            titleId="services-title"
            subtitleId="services-subtitle"
            title={content.services.title}
            subtitle={content.services.subtitle}
            onTitle={(v) => set("services", { ...content.services, title: v })}
            onSubtitle={(v) => set("services", { ...content.services, subtitle: v })}
          />
          <Separator />
          <SectionTitlePair
            label={b.sectionLabels.team}
            titleId="team-title"
            subtitleId="team-subtitle"
            title={content.team.title}
            subtitle={content.team.subtitle}
            onTitle={(v) => set("team", { ...content.team, title: v })}
            onSubtitle={(v) => set("team", { ...content.team, subtitle: v })}
          />
          <Separator />
          <SectionTitlePair
            label={b.sectionLabels.shop}
            titleId="shop-title"
            subtitleId="shop-subtitle"
            title={content.shop.title}
            subtitle={content.shop.subtitle}
            onTitle={(v) => set("shop", { ...content.shop, title: v })}
            onSubtitle={(v) => set("shop", { ...content.shop, subtitle: v })}
          />
        </EditorCard>

        {/* g) CTA */}
        <EditorCard
          title={b.sectionLabels.cta}
          description={b.cta.desc}
        >
          <Field label={b.labels.title} htmlFor="cta-title">
            <Input
              id="cta-title"
              value={content.cta.title}
              onChange={(e) => set("cta", { ...content.cta, title: e.target.value })}
            />
          </Field>
          <Field label={b.labels.text} htmlFor="cta-text">
            <Textarea
              id="cta-text"
              rows={2}
              value={content.cta.text}
              onChange={(e) => set("cta", { ...content.cta, text: e.target.value })}
            />
          </Field>
          <Field
            label={b.labels.buttonText}
            htmlFor="cta-button"
            hint={primaryCtaHint}
          >
            <Input
              id="cta-button"
              value={content.cta.buttonLabel}
              onChange={(e) => set("cta", { ...content.cta, buttonLabel: e.target.value })}
            />
          </Field>
        </EditorCard>

        {/* h) Delovni čas */}
        <EditorCard
          title={b.openingHours.title}
          description={b.openingHours.desc}
        >
          <div className="space-y-2">
            {hours.map((h) => {
              const open = !!(h.open && h.close)
              return (
                <div
                  key={h.day}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center",
                    !open && "bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-3 sm:w-48">
                    <Switch
                      checked={open}
                      onCheckedChange={(v) => toggleDayOpen(h.day, v)}
                      aria-label={
                        open
                          ? b.markClosed(b.days[h.day])
                          : b.markOpen(b.days[h.day])
                      }
                    />
                    <span className="text-sm font-medium">{b.days[h.day]}</span>
                    {!open && <Badge variant="secondary">{b.closed}</Badge>}
                  </div>
                  <div className="flex flex-1 items-center gap-2 sm:justify-end">
                    <Input
                      type="time"
                      className="sm:w-32"
                      value={h.open ?? ""}
                      disabled={!open}
                      onChange={(e) => updateHour(h.day, { open: e.target.value || null })}
                      aria-label={b.opensAt(b.days[h.day])}
                    />
                    <span className="text-sm text-muted-foreground" aria-hidden>
                      –
                    </span>
                    <Input
                      type="time"
                      className="sm:w-32"
                      value={h.close ?? ""}
                      disabled={!open}
                      onChange={(e) => updateHour(h.day, { close: e.target.value || null })}
                      aria-label={b.closesAt(b.days[h.day])}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </EditorCard>

        {/* i) Družabna omrežja */}
        <EditorCard
          title={b.social.title}
          description={b.social.desc}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={b.social.instagram} htmlFor="social-instagram">
              <Input
                id="social-instagram"
                type="url"
                value={content.social.instagram ?? ""}
                onChange={(e) =>
                  set("social", { ...content.social, instagram: e.target.value || undefined })
                }
                placeholder="https://instagram.com/…"
              />
            </Field>
            <Field label={b.social.facebook} htmlFor="social-facebook">
              <Input
                id="social-facebook"
                type="url"
                value={content.social.facebook ?? ""}
                onChange={(e) =>
                  set("social", { ...content.social, facebook: e.target.value || undefined })
                }
                placeholder="https://facebook.com/…"
              />
            </Field>
            <Field label={b.social.tiktok} htmlFor="social-tiktok">
              <Input
                id="social-tiktok"
                type="url"
                value={content.social.tiktok ?? ""}
                onChange={(e) =>
                  set("social", { ...content.social, tiktok: e.target.value || undefined })
                }
                placeholder="https://tiktok.com/@…"
              />
            </Field>
            <Field label={b.social.website} htmlFor="social-website">
              <Input
                id="social-website"
                type="url"
                value={content.social.website ?? ""}
                onChange={(e) =>
                  set("social", { ...content.social, website: e.target.value || undefined })
                }
                placeholder="https://…"
              />
            </Field>
          </div>
        </EditorCard>

        {/* j) SEO */}
        <EditorCard
          title={b.seo.title}
          description={b.seo.desc}
        >
          <Field
            label={b.seo.metaTitle}
            htmlFor="seo-title"
            hint={b.seo.metaTitleHint}
          >
            <Input
              id="seo-title"
              value={content.seo.title ?? ""}
              onChange={(e) => set("seo", { ...content.seo, title: e.target.value || undefined })}
            />
          </Field>
          <Field
            label={b.seo.metaDescription}
            htmlFor="seo-description"
            hint={b.seo.metaDescriptionHint}
          >
            <Textarea
              id="seo-description"
              rows={3}
              value={content.seo.description ?? ""}
              onChange={(e) =>
                set("seo", { ...content.seo, description: e.target.value || undefined })
              }
            />
          </Field>
        </EditorCard>

        {/* k) Sekcije */}
        <EditorCard
          title={b.sections.title}
          description={b.sections.desc}
        >
          <div className="space-y-2">
            {normalizeSections(content.sections)?.map((section, idx) => {
              const key = section.key
              const label = b.sectionLabels[key]
              const pinned = key === "hero"
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-muted-foreground w-5 text-center text-xs font-medium" aria-hidden>
                      {idx + 1}
                    </span>
                    <Label htmlFor={`section-${key}`} className="truncate font-normal">
                      {label}
                    </Label>
                    {pinned && (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {b.sections.pinned}
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={pinned || idx <= 1}
                      onClick={() => moveSection(key, -1)}
                      aria-label={b.sections.moveUpAria(label)}
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={pinned || idx >= (content.sections.length ?? 0) - 1}
                      onClick={() => moveSection(key, 1)}
                      aria-label={b.sections.moveDownAria(label)}
                    >
                      <ArrowDown size={14} />
                    </Button>
                    <Switch
                      id={`section-${key}`}
                      checked={section.visible}
                      onCheckedChange={(v) => toggleSection(key, v)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-muted-foreground text-xs">{b.sections.hint}</p>
        </EditorCard>

        {/* l) Panoga (napredno) */}
        <EditorCard
          title={b.vertical.title}
          description={b.vertical.desc}
        >
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer select-none text-sm font-medium">
              {b.vertical.showAdvanced}
            </summary>
            <div className="mt-4 space-y-4">
              <Field
                label={b.vertical.current}
                htmlFor="vertical-select"
                hint={selectedVertical?.description}
              >
                <Select value={vertical} onValueChange={setVertical}>
                  <SelectTrigger id="vertical-select">
                    <SelectValue placeholder={b.vertical.select} />
                  </SelectTrigger>
                  <SelectContent>
                    {listProfileOptions().map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  id="reseed-catalog"
                  checked={reseed}
                  onCheckedChange={(checked) => setReseed(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="reseed-catalog" className="font-normal">
                    {b.vertical.reseedLabel}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {b.vertical.reseedHint}
                  </p>
                </div>
              </div>
              <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <WarningCircleIcon size={16} className="mt-0.5 shrink-0" />
                {b.vertical.warning}
              </p>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => void handleVertical()}
                disabled={savingVertical}
              >
                {savingVertical && <SpinnerIcon size={16} className="mr-2 animate-spin" />}
                {b.vertical.change}
              </Button>

              {/* P1 #58: explicit content decision — the old flow left the
                  previous trade's hero/about/CTA live and silently produced
                  a public page describing two businesses at once. */}
              <AlertDialog open={verticalDialogOpen} onOpenChange={setVerticalDialogOpen}>
                <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {b.vertical.dialogTitle(
                        listProfileOptions().find((v) => v.id === vertical)?.label ?? vertical
                      )}
                    </AlertDialogTitle>
                    <AlertDialogDescription>{b.vertical.dialogDesc}</AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="space-y-3" role="radiogroup" aria-label={b.vertical.contentTitle}>
                    <p className="text-sm font-medium">{b.vertical.contentTitle}</p>
                    {([
                      { mode: "reseed" as const, label: b.vertical.contentReseed, hint: b.vertical.contentReseedHint },
                      { mode: "keep" as const, label: b.vertical.contentKeep, hint: b.vertical.contentKeepHint },
                    ]).map((opt) => {
                      const selected = contentMode === opt.mode
                      return (
                        <button
                          key={opt.mode}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setContentMode(opt.mode)}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            selected
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                                selected ? "border-primary" : "border-muted-foreground/40"
                              }`}
                              aria-hidden
                            >
                              {selected && <span className="bg-primary size-2 rounded-full" />}
                            </span>
                            <span className="text-sm font-medium">{opt.label}</span>
                          </span>
                          <span className="text-muted-foreground mt-1 block pl-6 text-xs">
                            {opt.hint}
                          </span>
                        </button>
                      )
                    })}
                    {reseed && (
                      <p className="text-muted-foreground flex items-start gap-2 text-xs">
                        <WarningCircleIcon size={14} className="mt-0.5 shrink-0" />
                        {b.vertical.catalogNote}
                      </p>
                    )}
                    {assetPreview && (assetPreview.formsDeactivated + assetPreview.workflowsDeactivated > 0 || assetPreview.formsAdded + assetPreview.workflowsAdded > 0) && (
                      <p className="text-muted-foreground flex items-start gap-2 text-xs">
                        <WarningCircleIcon size={14} className="mt-0.5 shrink-0" />
                        {[
                          assetPreview.formsDeactivated + assetPreview.workflowsDeactivated > 0
                            ? b.vertical.assetsReplaced(assetPreview.formsDeactivated, assetPreview.workflowsDeactivated)
                            : null,
                          assetPreview.formsAdded + assetPreview.workflowsAdded > 0
                            ? b.vertical.assetsAdded(assetPreview.formsAdded, assetPreview.workflowsAdded)
                            : null,
                        ].filter(Boolean).join(" ")}
                      </p>
                    )}
                    {publication?.state === "PUBLISHED" && (
                      <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                        <WarningCircleIcon size={14} className="mt-0.5 shrink-0" />
                        {b.vertical.publishedImpact}
                      </p>
                    )}
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={savingVertical}>
                      {b.vertical.cancel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault()
                        void confirmVertical()
                      }}
                      disabled={savingVertical}
                      className="min-h-11"
                    >
                      {savingVertical && <SpinnerIcon size={16} className="mr-2 animate-spin" />}
                      {b.vertical.change}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </details>
        </EditorCard>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-20 mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card/95 p-4 shadow-lg backdrop-blur">
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                dirty ? "bg-amber-500" : "bg-emerald-500"
              )}
              aria-hidden
            />
            {/* P2 #43: po shranjevanju, dokler spremembe NISO objavljene,
                status pove osnutek — prejšnje "Vse spremembe so shranjene"
                je protislovno pravilu "javno šele po objavi". */}
            {dirty
              ? b.unsavedChanges
              : publication?.hasUnpublishedChanges
                ? b.savedDraft
                : b.allSaved}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {publication?.hasPublishedSnapshot && publication.hasUnpublishedChanges && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setRevertOpen(true)}
                disabled={saving || reverting || publishing}
              >
                <Undo2 size={16} className="mr-2" />
                {b.revert.button}
              </Button>
            )}
            {(!publication ||
              publication.state !== "PUBLISHED" ||
              publication.hasUnpublishedChanges ||
              !publication.hasPublishedSnapshot) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handlePublish()}
                disabled={saving || publishing || dirty}
              >
                {publishing ? (
                  <SpinnerIcon size={16} className="mr-2 animate-spin" />
                ) : (
                  <Rocket size={16} className="mr-2" />
                )}
                {publication?.state === "PUBLISHED" ? b.publishChanges : b.publishSite}
              </Button>
            )}
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving && <SpinnerIcon size={16} className="mr-2 animate-spin" />}
              {b.saveContent}
            </Button>
          </div>
        </div>
      </div>

      {/* Revert confirmation (E3-2): discard draft, restore published content. */}
      <AlertDialog open={revertOpen} onOpenChange={setRevertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{b.revert.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{b.revert.confirmNote}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{b.revert.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                setRevertOpen(false)
                void handleRevert()
              }}
            >
              <Undo2 size={16} className="mr-2" />
              {b.revert.button}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
