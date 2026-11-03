"use client"

import { useI18n } from "@/lib/i18n/provider"

import { useSyncExternalStore } from "react"
import { MoonIcon, SunIcon, DesktopIcon } from "@/components/icons"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
export function ThemeToggle() {
  const { t } = useI18n()
  // useSyncExternalStore avoids a setState-in-effect hydration flag:
  // false on the server/first client render, true afterwards.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const { setTheme, theme, resolvedTheme } = useTheme()

  // Render placeholder button during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="group hover:bg-primary/10">
        <MoonIcon size={20} weight="fill" className="text-primary-text" />
        <span className="sr-only">{t.common.theme.toggle}</span>
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <DropdownMenu>
      {/* NOTE: no Tooltip wrapper here — composing TooltipTrigger asChild
          around DropdownMenuTrigger asChild swallows the click and the
          dropdown never opens. */}
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="group hover:bg-primary/10"
        >
          {isDark ? (
            <SunIcon
              size={20}
              weight="fill"
              className="text-accent-text transition-transform group-hover:scale-110"
            />
          ) : (
            <MoonIcon
              size={20}
              weight="fill"
              className="text-primary-text transition-transform group-hover:scale-110"
            />
          )}
          <span className="sr-only">{t.common.theme.toggle}</span>
        </Button>
      </DropdownMenuTrigger>
      {/* P2 #13 (audit-2026-11): proper Radix radio menu — closes on
          selection, keyboard-navigable (arrows + Enter/Esc), localized
          labels. Neutral text colors for AA contrast (the old gold
          text-accent-text/80 failed 4.5:1). RadioItem already reserves pl-8
          for the built-in indicator, so text never overlaps it. */}
      <DropdownMenuContent align="end" className="mt-2 min-w-[160px] bg-card border-border">
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={(v) => setTheme(v)}
        >
          <DropdownMenuRadioItem
            value="light"
            className="gap-2 text-foreground"
          >
            <SunIcon size={16} weight="fill" aria-hidden />
            {t.common.theme.light}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="dark"
            className="gap-2 text-foreground"
          >
            <MoonIcon size={16} weight="fill" aria-hidden />
            {t.common.theme.dark}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="system"
            className="gap-2 text-foreground"
          >
            <DesktopIcon size={16} weight="fill" aria-hidden />
            {t.common.theme.system}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
