import { Play } from "@phosphor-icons/react/dist/ssr"

interface PlayIconProps {
  size?: number
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
  className?: string
}

export function PlayIcon({ size = 20, weight = "regular", className = "" }: PlayIconProps) {
  return <Play size={size} weight={weight} className={className} />
}
