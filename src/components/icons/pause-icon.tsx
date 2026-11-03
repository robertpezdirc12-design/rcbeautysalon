import { Pause } from "@phosphor-icons/react/dist/ssr"

interface PauseIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function PauseIcon({ size = 20, weight = "regular", className = "" }: PauseIconProps) {
  return <Pause size={size} weight={weight} className={className} />
}
