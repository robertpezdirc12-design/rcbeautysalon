"use client"
import { useFormatPrice } from "@/lib/currency"

import { useMemo, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CalendarIcon } from "@/components/icons"
import { cloudinaryPresets } from "@/lib/utils/cloudinary"
import { ServicesFilter } from "./services-filter"
import { filterServices } from "@/app/actions/services"
import { ServiceFilters, ServiceListItem, ServicesListProps } from "@/lib/interfaces"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ServicesGridSkeleton } from "./services-grid-skeleton"
import { useOrgPrefix } from "@/lib/org-path-hooks"

/**
 * Sentinel tab value for the "Vse" (all categories) tab.
 */
const ALL_TAB = "__all__"

/**
 * P1 #29 (re-audit 2026-11): seznam prihaja FLAT in GLOBAlno sortiran
 * s strežnika (filterServices). Kategorije razporedimo iz flat seznama
 * v vrstnem redu prve pojavitve — zato:
 *  - "Vse" tab prikaže ENO monotono zaporedje za vsako sortiranje
 *    (prej je bil seznam sortiran samo znotraj kategorij), in
 *  - kategorija tabi ohranijo sortiranje znotraj svoje skupine.
 *
 * P1 #39-1: izbrana kategorija se zrcali v URL (?kategorija=<slug>) —
 * stanje preživi reload, deljenje povezave in gumb Nazaj.
 */
export function ServicesList({
  initialServices,
  categories,
  staff,
}: ServicesListProps) {
  const fmt = useFormatPrice()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [services, setServices] = useState(initialServices)
  const [isPending, startTransition] = useTransition()
  const prefix = useOrgPrefix()

  const handleFilterChange = async (filters: ServiceFilters) => {
    startTransition(async () => {
      try {
        const filtered = await filterServices(filters)
        setServices(filtered)
      } catch (error) {
        console.error("Napaka pri filtriranju storitev:", error)
      }
    })
  }

  // --- Kategorije (iz flat seznama, vrstni red prve pojavitve) ---
  const categoriesWithSlug = useMemo(() => {
    const map = new Map<
      string,
      { name: string; slug: string; items: ServiceListItem[] }
    >()
    for (const service of services) {
      const name = service.category?.name || "Brez kategorije"
      const slug = service.category?.slug || name
      if (!map.has(name)) map.set(name, { name, slug, items: [] })
      map.get(name)!.items.push(service)
    }
    return Array.from(map.values())
  }, [services])

  // --- URL sync (#39-1): preberi ?kategorija=<slug> in najdi tab ---
  const urlCategory = searchParams.get("kategorija")
  const activeCategoryName = urlCategory
    ? categoriesWithSlug.find((c) => c.slug === urlCategory)?.name
    : null
  const [tabValue, setTabValue] = useState<string>(
    activeCategoryName ?? ALL_TAB
  )

  const handleTabChange = (value: string) => {
    setTabValue(value)
    // #39-1: URL odraža stanje (replace — brez dodanega zgodovinskega vknosa
    // za vsak klik; gumb Nazaj se vede naravno med preusmeritvami).
    const slug =
      value === ALL_TAB
        ? null
        : categoriesWithSlug.find((c) => c.name === value)?.slug ?? null
    const params = new URLSearchParams(searchParams.toString())
    if (slug) {
      params.set("kategorija", slug)
    } else {
      params.delete("kategorija")
    }
    const qs = params.toString()
    router.replace(`${prefix}/services${qs ? `?${qs}` : ""}`, {
      scroll: false,
    })
  }

  const renderServiceCard = (service: ServiceListItem) => (
    <Link
      key={service.id}
      href={`${prefix}/services/${service.slug}`}
      className="group border-primary/10 relative w-full overflow-hidden rounded-lg border shadow-sm transition-all duration-500 hover:shadow-xl sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] xl:w-[calc(25%-1.125rem)]"
    >
      {/* Background Image */}
      <div className="relative h-[280px] overflow-hidden">
        {service.imageUrl ? (
          <Image
            src={
              service.imageUrl.startsWith("http")
                ? service.imageUrl
                : cloudinaryPresets.serviceCard(
                    service.imageUrl
                  )
            }
            alt={service.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          
              sizes="(min-width: 768px) 240px, 100vw"/>
        ) : (
          <div className="from-muted to-muted/50 flex h-full w-full items-center justify-center bg-linear-to-br">
            <div className="p-4 text-center">
              <div className="bg-primary/10 mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full">
                <CalendarIcon
                  size={32}
                  weight="regular"
                  className="text-primary-text/50"
                />
              </div>
              <span className="text-muted-foreground text-sm font-medium">
                {service.name}
              </span>
            </div>
          </div>
        )}

        {/* Elegant Overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/60 to-black/20 opacity-90 transition-opacity duration-500 group-hover:opacity-95" />

        {/* Content Overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-5">
          <div className="transform transition-transform duration-500 group-hover:-translate-y-1">
            <h3 className="font-heading group-hover:text-accent-text mb-2 text-lg font-semibold tracking-tight text-white transition-colors duration-300">
              {service.name}
            </h3>

            {service.description && (
              <p className="mb-3 line-clamp-2 text-xs text-white/70">
                {service.description}
              </p>
            )}

            <div className="group-hover:text-accent-text/90 flex items-center justify-between text-sm text-white/90 transition-colors duration-300">
              <span className="font-medium">
                {fmt(Number(service.price))}
              </span>
              {service.duration && (
                <span className="group-hover:text-accent-text/70 text-white/70">
                  {service.duration} min
                </span>
              )}
            </div>

            {/* Hover Button */}
            <div className="mt-3 translate-y-2 transform opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
              <div className="text-accent-text border-accent/50 inline-flex items-center border-b pb-1 text-xs font-medium">
                Podrobnosti
                <svg
                  className="ml-1 h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )

  const renderGrid = (items: ServiceListItem[]) => (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap justify-center gap-6">
        {items.map(renderServiceCard)}
      </div>
    </div>
  )

  return (
    <>
      {/* Filters */}
      <ServicesFilter
        categories={categories}
        staff={staff}
        onFilterChange={handleFilterChange}
      />

      {/* Services Grid */}
      {categoriesWithSlug.length > 0 ? (
        <Tabs value={tabValue} onValueChange={handleTabChange} className="w-full">
          {/* Category Tabs — P1 #30: strip se pomika V SVOJEM vsebniku
              (overflow-x-auto), ne vleče celotnega dokumenta v vodoravni
              pomik (prej +125 px prekoračitev na 375 px). */}
          <div className="mb-12 flex justify-start overflow-x-auto px-4 py-1 sm:justify-center sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="bg-muted text-muted-foreground inline-flex h-12 items-center justify-center rounded-lg p-1">
              <TabsTrigger
                value={ALL_TAB}
                className="ring-offset-background focus-visible:ring-ring hover:text-accent-text data-[state=active]:bg-background data-[state=active]:text-accent-text inline-flex shrink-0 items-center justify-center rounded-md px-6 py-2 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm"
              >
                Vse
              </TabsTrigger>
              {categoriesWithSlug.map((category) => (
                <TabsTrigger
                  key={category.name}
                  value={category.name}
                  className="ring-offset-background focus-visible:ring-ring hover:text-accent-text data-[state=active]:bg-background data-[state=active]:text-accent-text inline-flex shrink-0 items-center justify-center rounded-md px-6 py-2 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm"
                >
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* All Services (default tab) — flat, globalno sortirano (#29) */}
          <TabsContent value={ALL_TAB}>{renderGrid(services)}</TabsContent>

          {/* Services Grid for Each Category */}
          {categoriesWithSlug.map((category) => (
            <TabsContent key={category.name} value={category.name}>
              {renderGrid(category.items)}
            </TabsContent>
          ))}
        </Tabs>
      ) : isPending ? (
        <ServicesGridSkeleton />
      ) : (
        <div className="py-12 text-center">
          <p className="text-muted-foreground text-lg">
            Ni storitev, ki ustrezajo izbranim filtrom.
          </p>
        </div>
      )}
    </>
  )
}
