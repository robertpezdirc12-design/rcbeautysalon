"use client"

import { useState } from "react"
import Image from "next/image"
import { cloudinaryPresets } from "@/lib/utils/cloudinary"

interface StaffAvatarProps {
  image: string | null
  name: string
  className?: string
  sizes?: string
  priority?: boolean
  /**
   * P3 #51: slika je okrasna, kadar je ime izpisano VZRAZNO poleg nje
   * (ekipna kartica, seznam osebja, stran osebja) — prazen alt bralniku
   * zaslona prepreči dvojno branje imena (axe image-redundant-alt).
   * Privzeto ""; ime je vzporedno vidno v vseh obstoječih uporabah,
   * zato lahko ostane prazen.
   */
  alt?: string
}

/**
 * Robust staff photo for the customer-facing surface.
 *
 * Resolves every supported source — Cloudinary public ID, absolute URL and
 * local "/..." path — and degrades to a clean initials monogram whenever the
 * image is missing OR fails to load (broken/removed CDN assets must never
 * render as empty white boxes on the salon's public site).
 */
export function StaffAvatar({
  image,
  name,
  className = "",
  // P3 #19 (audit-2026-11): default sizes matching the avatar's rendered
  // boxes (next/image otherwise assumes 100vw and over-downloads).
  sizes = "(min-width: 768px) 128px, 96px",
  priority,
  alt = "",
}: StaffAvatarProps) {
  const [failed, setFailed] = useState(false)

  const src = image
    ? image.startsWith("http") || image.startsWith("/")
      ? image
      : cloudinaryPresets.staffCard(image)
    : null

  if (!src || failed) {
    return (
      <div
        className={`absolute inset-0 flex items-center justify-center bg-linear-to-br from-primary/15 via-primary/5 to-accent/15 ${className}`}
      >
        <div className="bg-primary/10 flex h-20 w-20 items-center justify-center rounded-full">
          <span className="text-primary-text text-2xl font-bold">
            {name
              .split(" ")
              .map((part) => part.charAt(0))
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
        </div>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
      sizes={sizes}
      priority={priority}
    />
  )
}
