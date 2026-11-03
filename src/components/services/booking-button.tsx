"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CalendarIcon } from "@/components/icons"

interface BookingButtonProps {
  href?: string
  size?: "default" | "sm" | "lg" | "icon"
  variant?: "default" | "outline" | "secondary"
  className?: string
  label?: string
}

export function BookingButton({
  href = "/booking",
  size = "lg",
  variant = "default",
  className = "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg",
  label = "Rezerviraj zdaj",
}: BookingButtonProps) {
  // P1 #8 (audit-2026-11): asChild — no <a><button> nesting
  return (
    <Button asChild size={size} variant={variant} className={className}>
      <Link href={href} aria-label={label}>
        <CalendarIcon size={20} weight="regular" className="mr-2" aria-hidden />
        {label}
      </Link>
    </Button>
  )
}
