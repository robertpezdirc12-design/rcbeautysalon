import Image from "next/image"
import { cloudinaryPresets } from "@/lib/utils/cloudinary"

interface GalleryImage {
  id: string
  imageUrl: string
  caption: string | null
  order: number
}

interface GallerySectionProps {
  gallery: GalleryImage[]
  serviceName: string
  /** P1 #35 (re-audit 2026-11): prevedeni naslovi iz slovarja — prej sta
   * bila naslov + podnaslov trdo kodirana v angleščini na slovenski strani. */
  title?: string
  subtitle?: string
}

export function GallerySection({
  gallery,
  serviceName,
  title = "Galerija",
  subtitle,
}: GallerySectionProps) {
  if (gallery.length === 0) {
    return null // Don't show section if no gallery images
  }

  // Sort by order field
  const sortedGallery = [...gallery].sort((a, b) => a.order - b.order)

  return (
    <section className="border-t border-primary/30 bg-muted/30 py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          {/* Section Header */}
          <div className="mb-12 text-center">
            <h2 className="font-heading mb-4 text-4xl md:text-5xl">
              <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
                {title}
              </span>
            </h2>
            <p className="text-muted-foreground text-lg">
              {subtitle ?? `Pred in po — ${serviceName}`}
            </p>
          </div>

          {/* Gallery Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sortedGallery.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-4/3 overflow-hidden rounded-lg shadow-md transition-all duration-300 hover:shadow-xl"
              >
                {/* Image */}
                <Image
                  src={cloudinaryPresets.gallery(item.imageUrl)}
                  alt={item.caption || serviceName}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"/>

                {/* Overlay with Caption (on hover) */}
                {item.caption && (
                  <div className="absolute inset-0 flex items-end bg-linear-to-t from-black/80 via-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <p className="w-full p-4 text-sm text-white">
                      {item.caption}
                    </p>
                  </div>
                )}

                {/* Subtle border glow on hover */}
                <div className="absolute inset-0 rounded-lg border-2 border-primary/0 transition-colors duration-300 group-hover:border-primary/30" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
