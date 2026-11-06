// ============================================================
// ACTIVITY ICONS — shared by the guided-entry wizard and the
// dashboard's activity card. Client-safe AND server-safe
// (no "use client" directive): lucide icons render fine in
// server components, so both worlds import the same map and
// never drift apart.
// ============================================================

import {
  Feather,
  Flower2,
  Gem,
  Hand,
  Hexagon,
  LayoutGrid,
  Ruler,
  Scissors,
  Sparkles,
  Wrench,
  type LucideIcon,
  Car,
} from "lucide-react"

export const PROFILE_ICONS: Record<string, LucideIcon> = {
  beauty: Sparkles,
  frizer: Scissors,
  barber: Scissors,
  nails: Gem,
  cosmetica: Flower2,
  massage: Hand,
  epilation: Feather,
  generic: LayoutGrid,
  seamstress: Ruler,
  "tire-service": Wrench,
  // #100-nadaljevanje: avtomehanik — svoja ikona (ločen profil).
  mehanik: Car,
  beekeeping: Hexagon,
}

/** Icon for a profile id — unknown ids fall back to the neutral grid. */
export function iconForProfile(id: string): LucideIcon {
  return PROFILE_ICONS[id] ?? LayoutGrid
}
