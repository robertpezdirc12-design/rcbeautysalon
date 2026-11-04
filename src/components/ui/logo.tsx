import Image from "next/image"
import { cn } from "@/lib/utils"

type LogoVariant = "navbar" | "sidebar" | "footer" | "auth" | "small"

interface LogoProps {
  className?: string
  variant?: LogoVariant
  /** Organization logo URL (falls back to the platform default logo). */
  src?: string | null
  /** Alt text — should be the organization name. */
  alt?: string
}

// Preset sizes for different contexts
const variantSizes: Record<LogoVariant, { width: number; height: number }> = {
  navbar: { width: 108, height: 36 },
  sidebar: { width: 100, height: 35 },
  footer: { width: 140, height: 50 },
  auth: { width: 160, height: 55 },
  small: { width: 80, height: 28 },
}

export function Logo({ className, variant = "navbar", src, alt }: LogoProps) {
  const { width, height } = variantSizes[variant]
  const name = alt?.trim() || "Salon"

  // No custom logo uploaded — render the salon's initials instead of a
  // generic platform mark (avoids wrong branding for other tenants).
  // P2 #17 (audit-2026-11): keep a leading acronym intact — "RC Beauty
  // Salon" must monogram as "RC", not "RB". role="img" makes the
  // aria-label meaningful, and the size reads ≥ 18 px in the navbar.
  if (!src || src.trim().length === 0) {
    const words = name.split(/\s+/).filter(Boolean)
    const initials =
      words.length >= 2 && /^[A-ZČŠŽ]{2,4}$/.test(words[0])
        ? words[0].toUpperCase()
        : words
            .slice(0, 2)
            .map((w) => w[0]!.toUpperCase())
            .join("")
    return (
      <div
        role="img"
        aria-label={name}
        className={cn(
          // P1 #22 (re-audit): text-primary-text na bg-primary/10 je pri svetli
          // rozni paleti padel pod 4.5:1 (4.17) — solid čip (bg-primary +
          // text-primary-foreground) zagotovi AA v obeh temah pri vsaki
          // paleti in daje znački profesionalno težo (#94: bledi oblak je
          // bil platformski P2 finding).
          "font-heading flex items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
          className
        )}
        style={{ width, height, fontSize: Math.min(Math.max(height * 0.5, 14), 22) }}
      >
        {initials || name[0]?.toUpperCase()}
      </div>
    )
  }

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width, height }}
    >
      <Image
        src={src}
        alt={name}
        width={width}
        height={height}
        className="h-auto w-auto object-contain dark:brightness-110 dark:contrast-90"
        priority
      />
    </div>
  )
}
