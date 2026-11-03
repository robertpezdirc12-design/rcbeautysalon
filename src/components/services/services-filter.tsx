"use client"

import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { SearchIcon, CloseIcon, SlidersIcon } from "@/components/icons"
import { ServiceFilters, ServicesFilterProps } from "@/lib/interfaces"

export function ServicesFilter({
  categories,
  staff,
  onFilterChange,
}: ServicesFilterProps) {
  const [isPending, startTransition] = useTransition()
  // P1 #29: privzeto stanje je "Priporočeno" (katalog vrstni red) — prej
  // je bila labela "Ime (A–Ž)", a je začetni seznam NI bil abecedno
  // sortiran, torej labela ni opisovala stanja.
  const [filters, setFilters] = useState<ServiceFilters>({})
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleFilterChange = (newFilters: Partial<ServiceFilters>) => {
    const updatedFilters = { ...filters, ...newFilters }
    setFilters(updatedFilters)

    startTransition(() => {
      onFilterChange(updatedFilters)
    })
  }

  const clearFilters = () => {
    setFilters({})

    startTransition(() => {
      onFilterChange({})
    })
  }

  const hasActiveFilters = Object.keys(filters).some((key) => {
    const value = filters[key as keyof ServiceFilters]
    return value !== undefined && value !== "" && value !== null
  })

  return (
    <div className="mb-8 space-y-4">
      {/* Search and Sort Row */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Search */}
        <div className="relative flex-1">
          <SearchIcon
            size={16}
            weight="regular"
            className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
          />
          <Input
            type="text"
            placeholder="Išči storitve..."
            value={filters.search || ""}
            onChange={(e) => handleFilterChange({ search: e.target.value })}
            className="pl-10"
            disabled={isPending}
          />
        </div>

        {/* Sort */}
        <Select
          value={filters.sortBy || "featured"}
          onValueChange={(value) =>
            handleFilterChange({
              // "Priporočeno" (featured) = privzeti katalog vrstni red —
              // pošljemo sortBy: undefined, da strežnik uporabi privzeti
              // vrstni red, ki se ujema z začetnim stanjem strani.
              sortBy:
                value === "featured"
                  ? undefined
                  : (value as ServiceFilters["sortBy"]),
            })
          }
          disabled={isPending}
        >
          <SelectTrigger className="w-full sm:w-[200px]" aria-label="Razvrsti storitve">
            <SelectValue placeholder="Razvrsti po" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="featured">Priporočeno</SelectItem>
            <SelectItem value="name_asc">Ime (A–Ž)</SelectItem>
            <SelectItem value="price_asc">Cena (naraščajoče)</SelectItem>
            <SelectItem value="price_desc">Cena (padajoče)</SelectItem>
            <SelectItem value="duration_asc">Trajanje (naraščajoče)</SelectItem>
            <SelectItem value="duration_desc">Trajanje (padajoče)</SelectItem>
            <SelectItem value="rating_desc">Najbolje ocenjeno</SelectItem>
            <SelectItem value="popularity_desc">Najbolj priljubljeno</SelectItem>
          </SelectContent>
        </Select>

        {/* Toggle Advanced Filters — P1 #22: ikonski gumb MORA imeti
            dostopno ime (axe: button-name, critical) + stanje razširjenosti. */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-label={showAdvanced ? "Skrij napredne filtre" : "Pokaži napredne filtre"}
          aria-expanded={showAdvanced}
          className="shrink-0"
        >
          <SlidersIcon size={16} weight="regular" aria-hidden />
        </Button>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Category Filter */}
          <div className="space-y-2">
            <Label>Kategorija</Label>
            <Select
              value={filters.categoryId || "all"}
              onValueChange={(value) =>
                handleFilterChange({
                  categoryId: value === "all" ? undefined : value,
                })
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vse kategorije" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vse kategorije</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Staff Filter */}
          <div className="space-y-2">
            <Label>Osebje</Label>
            <Select
              value={filters.staffId || "all"}
              onValueChange={(value) =>
                handleFilterChange({
                  staffId: value === "all" ? undefined : value,
                })
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vse osebje" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vse osebje</SelectItem>
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Range */}
          <div className="space-y-2">
            <Label>Cenovni razpon</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Od"
                value={filters.minPrice || ""}
                onChange={(e) =>
                  handleFilterChange({
                    minPrice: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                min={0}
                disabled={isPending}
              />
              <Input
                type="number"
                placeholder="Do"
                value={filters.maxPrice || ""}
                onChange={(e) =>
                  handleFilterChange({
                    maxPrice: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                min={0}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Duration Range */}
          <div className="space-y-2">
            <Label>Trajanje (minute)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Od"
                value={filters.minDuration || ""}
                onChange={(e) =>
                  handleFilterChange({
                    minDuration: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                min={0}
                disabled={isPending}
              />
              <Input
                type="number"
                placeholder="Do"
                value={filters.maxDuration || ""}
                onChange={(e) =>
                  handleFilterChange({
                    maxDuration: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                min={0}
                disabled={isPending}
              />
            </div>
          </div>
        </div>
      )}

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            disabled={isPending}
          >
            <CloseIcon size={16} weight="regular" className="mr-2" />
            Počisti filtre
          </Button>
        </div>
      )}

      {/* Loading Indicator */}
      {isPending && (
        <div className="text-muted-foreground text-center text-sm">
          Filtriranje storitev...
        </div>
      )}
    </div>
  )
}
