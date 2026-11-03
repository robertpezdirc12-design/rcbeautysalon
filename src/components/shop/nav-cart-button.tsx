"use client"

import { ShoppingBagIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useCartStore } from "@/store/cart-store"
import { useOrgPrefix } from "@/lib/org-path-hooks"
import { useI18n } from "@/lib/i18n/provider"
import Link from "next/link"

export function NavCartButton() {
  const itemCount = useCartStore((state) => state.getTotalItems())
  const prefix = useOrgPrefix()
  const { t } = useI18n()

  return (
    <Tooltip>
      {/* P1 #8 (audit-2026-11): single interactive element via asChild —
          no <a><button> nesting; localized accessible name announces the
          item count; the visual badge is aria-hidden (already in the name). */}
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="relative h-11 w-11 hover:bg-primary/10 hover:text-primary"
        >
          <Link
            href={`${prefix}/cart`}
            aria-label={itemCount > 0 ? t.public.cartWithCount(itemCount) : t.public.cart}
          >
            <ShoppingBagIcon size={28} weight="regular" aria-hidden />
            {itemCount > 0 && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground shadow-sm"
              >
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t.public.cart}</p>
      </TooltipContent>
    </Tooltip>
  )
}
