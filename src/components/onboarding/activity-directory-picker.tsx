"use client"

// ============================================================
// lastnik (7. 11. 2026): "vse združi v padajočo linijo … po temu se
// spustni meni odpre, da ni natopano na vmesniku vse brez potrebe."
// EN spustni meni, ki odpre CELOTEN imenik:
//   • pripravljene predloge (12), grupirane po področjih
//   • področja SKD 2025 (več izbir — samo nasvet za module)
//   • sekcije SKD 2025 (A–V, več izbir)
//   • lastna oznaka
// Iskanje na vrhu filtrira vse skupine. Vmesnik ostane čist — vse
// ostalo je v meniju, ne na strani.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search, Sparkles } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PALETTE_OPTIONS } from "@/lib/palettes-client"
import { listProfileOptions } from "@/lib/profiles/registry"
import {
  SKD_AREAS,
  SKD_MODULE_LABELS,
  SKD_SECTIONS,
  type SkdSuggestedModule,
} from "@/lib/skd/catalog"

const ACTIVITY_OPTIONS = listProfileOptions()

/** Diakritike neutežene, da "sivilje" najde Šiviljstvo. */
function normalizeHr(value: string): string {
  return value
    .toLowerCase()
    .replace(/[čć]/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/đ/g, "d")
    .trim()
}

const PREPARED_GROUPS = [
  {
    label: "Lepota in osebna nega",
    ids: ["beauty", "frizer", "barber", "nails", "cosmetica", "massage", "epilation"],
  },
  { label: "Vozila in servis", ids: ["tire-service", "mehanik"] },
  { label: "Obrt in izdelava", ids: ["seamstress"] },
  { label: "Kmetijstvo", ids: ["beekeeping"] },
  { label: "Univerzalno", ids: ["generic"] },
].map(({ label, ids }) => ({
  label,
  options: ids
    .map((id) => ACTIVITY_OPTIONS.find((v) => v.id === id))
    .filter((v): v is (typeof ACTIVITY_OPTIONS)[number] => !!v),
}))

export interface ActivityDirectoryPickerProps {
  vertical: string | null
  onSelectActivity: (id: string) => void
  skdCodes: string[]
  onToggleSkd: (code: string) => void
  customTags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  suggestions: SkdSuggestedModule[]
  disabled?: boolean
}

export function ActivityDirectoryPicker({
  vertical,
  onSelectActivity,
  skdCodes,
  onToggleSkd,
  customTags,
  onAddTag,
  onRemoveTag,
  suggestions,
  disabled = false,
}: ActivityDirectoryPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [tagInput, setTagInput] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  // Klik izven / Escape zapre panel (toda ne toggle gumba SKD-jev).
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const q = normalizeHr(query)

  const preparedGroups = useMemo(
    () =>
      PREPARED_GROUPS.map((g) => ({
        label: g.label,
        options: g.options.filter((v) =>
          q ? normalizeHr(`${v.label} ${v.description}`).includes(q) : true
        ),
      })).filter((g) => g.options.length > 0),
    [q]
  )
  const areas = useMemo(
    () => (q ? SKD_AREAS.filter((a) => normalizeHr(a.name).includes(q)) : SKD_AREAS),
    [q]
  )
  const sections = useMemo(
    () =>
      q
        ? SKD_SECTIONS.filter(
            (s) =>
              normalizeHr(s.name).includes(q) || s.code.toLowerCase() === q
          )
        : SKD_SECTIONS,
    [q]
  )

  const selectedActivity = ACTIVITY_OPTIONS.find((v) => v.id === vertical) ?? null
  const nothing = preparedGroups.length === 0 && areas.length === 0 && sections.length === 0

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger — videti kot SelectTrigger, odpre imenik. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        className={cn(
          "border-input bg-background flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border px-4 py-2 text-left text-base transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "border-primary ring-2 ring-primary/20",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className={cn("min-w-0 truncate", !vertical && "text-muted-foreground")}>
          {selectedActivity
            ? selectedActivity.label
            : skdCodes.length > 0
              ? `${skdCodes.length} izbranih po SKD 2025 (nasvet)`
              : "Izberite dejavnost — npr. frizer, mehanik, čebelar …"}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "text-muted-foreground size-5 shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Imenik dejavnosti — SKD 2025"
          className="bg-background border-border/60 absolute inset-x-0 top-full z-30 mt-2 max-h-[26rem] overflow-y-auto rounded-xl border p-2 shadow-xl"
        >
          <div className="sticky top-0 z-10 bg-background pb-2">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Iščite po imeniku …"
                aria-label="Iskanje po imeniku dejavnosti"
                maxLength={60}
                className="pl-9"
              />
            </div>
          </div>

          {preparedGroups.length > 0 && (
            <>
              <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide">
                Pripravljene predloge
              </p>
              {preparedGroups.map((group) => (
                <div key={group.label} className="mb-1">
                  <p className="text-muted-foreground/80 px-2 py-1 text-xs font-medium">
                    {group.label}
                  </p>
                  {group.options.map((v) => {
                    const paletteOption = PALETTE_OPTIONS.find((p) => p.id === v.palette)
                    const isSelected = vertical === v.id
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onSelectActivity(v.id)
                          setOpen(false)
                          setQuery("")
                        }}
                        className={cn(
                          "hover:bg-primary/5 flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors",
                          isSelected && "bg-primary/10"
                        )}
                      >
                        <span className="mt-1 flex shrink-0 items-center">
                          <span
                            className="h-3.5 w-3.5 rounded-full ring-1 ring-border"
                            style={{ backgroundColor: paletteOption?.primary ?? "#000" }}
                          />
                          <span
                            className="-ml-1.5 h-3.5 w-3.5 rounded-full ring-1 ring-border"
                            style={{ backgroundColor: paletteOption?.accent ?? "#d4af37" }}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{v.label}</span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {v.description}
                          </span>
                        </span>
                        {isSelected && (
                          <Check aria-hidden="true" className="text-primary size-4 shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </>
          )}

          {areas.length > 0 && (
            <>
              <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide">
                Področja SKD 2025 <span className="normal-case">(več izbir — nasvet)</span>
              </p>
              {areas.map((a) => {
                const code = `area:${a.key}`
                const isSelected = skdCodes.includes(code)
                return (
                  <button
                    key={code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => onToggleSkd(code)}
                    className="hover:bg-primary/5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "border-input flex size-4 shrink-0 items-center justify-center rounded border",
                        isSelected && "border-primary bg-primary text-primary-foreground"
                      )}
                    >
                      {isSelected && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 truncate">{a.name}</span>
                  </button>
                )
              })}
            </>
          )}

          {sections.length > 0 && (
            <>
              <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide">
                Sekcije SKD 2025 <span className="normal-case">(več izbir — nasvet)</span>
              </p>
              <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                {sections.map((sec) => {
                  const isSelected = skdCodes.includes(sec.code)
                  return (
                    <button
                      key={sec.code}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      title={sec.name}
                      onClick={() => onToggleSkd(sec.code)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary/50",
                        isSelected && "border-primary bg-primary/10 font-medium"
                      )}
                    >
                      <span className="font-mono font-semibold">{sec.code}</span>
                      <span className="text-muted-foreground truncate">
                        {sec.name.length > 26 ? `${sec.name.slice(0, 26)}…` : sec.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {nothing && (
            <p className="text-muted-foreground px-2 py-3 text-sm">
              Ni zadetkov v imeniku — dodajte lastno oznako spodaj.
            </p>
          )}

          <div className="border-t px-2 pt-2 pb-1">
            <p className="text-muted-foreground pb-1 text-xs font-semibold uppercase tracking-wide">
              Lastna oznaka (neobvezno)
            </p>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    if (tagInput.trim()) {
                      onAddTag(tagInput)
                      setTagInput("")
                    }
                  }
                }}
                placeholder="npr. vulkanizer po meri"
                maxLength={40}
                aria-label="Lastna oznaka"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (tagInput.trim()) {
                    onAddTag(tagInput)
                    setTagInput("")
                  }
                }}
              >
                Dodaj
              </Button>
            </div>
            {customTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 py-2">
                {customTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    aria-label={`Odstrani oznako ${tag}`}
                    className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                  >
                    {tag}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="border-t px-2 py-2">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Predlogi modulov (samo nasvet — vklopite, kar potrebujete)
              </p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {suggestions.map((m) => (
                  <li key={m} className="flex items-center gap-1">
                    <Sparkles aria-hidden="true" className="text-primary size-3.5" />
                    {SKD_MODULE_LABELS[m]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
