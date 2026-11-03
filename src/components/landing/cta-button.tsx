import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CalendarIcon } from "@/components/icons"

interface CTAButtonProps {
  href: string
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  children: React.ReactNode
  variant?: "default" | "outline"
}

export function CTAButton({
  href,
  size = "lg",
  className = "",
  children,
  variant = "default"
}: CTAButtonProps) {
  // P1 #8 (audit-2026-11): asChild — no <a><button> nesting
  return (
    <Button asChild size={size} variant={variant} className={className}>
      <Link href={href}>
        <CalendarIcon className="group-hover:text-accent-text mr-2 h-5 w-5 transition-colors" aria-hidden />
        {children}
      </Link>
    </Button>
  )
}
