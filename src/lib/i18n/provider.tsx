"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import { LOCALE_COOKIE, Locale, localeLabels, locales } from "./config"
import { Dictionary, getDictionary } from "./dictionaries"
import { getProfile, term as profileTerm } from "@/lib/profiles/registry"
import { applyOverrides, parseOverrides } from "@/lib/profiles/overrides"
import { applySecondaryProfile } from "@/lib/profiles/secondary"
import type { ActivityProfile } from "@/lib/profiles/types"

interface I18nContextValue {
  locale: Locale
  t: Dictionary
  /** Effective activity profile of the tenant (EPIC #1): shared profile + owner overrides. */
  profile: ActivityProfile
  /** Terminology lookup: industry-specific label for the current locale. */
  term: (key: keyof ActivityProfile["terminology"]) => string
  /** P2 #84: interpolates {business}/{businessIn}/{businessGenitive} in dict
   *  strings with the tenant's own nouns ("servis" instead of "salon"). */
  withBusiness: (text: string) => string
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

interface AdminI18nProviderProps {
  initialLocale: Locale
  /** Activity profile id of the current tenant's organization. */
  profileId?: string
  /** Optional secondary activity id (E2-4 capability union). */
  secondaryVertical?: string | null
  /** Owner overrides JSON stored on the organization (Phase 5). */
  profileOverrides?: unknown
  children: React.ReactNode
}

export function AdminI18nProvider({
  initialLocale,
  profileId,
  secondaryVertical,
  profileOverrides,
  children,
}: AdminI18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const router = useRouter()

  // Keep client state in sync when the server re-renders with a new cookie value.
  useEffect(() => {
    setLocaleState(initialLocale)
  }, [initialLocale])

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
      setLocaleState(next)
      router.refresh()
    },
    [router]
  )

  const value = useMemo<I18nContextValue>(() => {
    // Effective profile: shared profile + secondary-activity union (E2-4)
    // + owner overrides (Phase 5) — same order as the server resolver.
    const withSecondary = applySecondaryProfile(getProfile(profileId), secondaryVertical)
    const profile = applyOverrides(withSecondary, parseOverrides(profileOverrides))
    const term = (key: keyof ActivityProfile["terminology"]) => profileTerm(profile, key, locale)
    return {
      locale,
      t: getDictionary(locale),
      profile,
      term,
      withBusiness: (text: string) =>
        text
          .replace(/\{business\}/g, term("businessSingular"))
          .replace(/\{businessIn\}/g, term("businessIn"))
          .replace(/\{businessGenitive\}/g, term("businessGenitive")),
      setLocale,
    }
  }, [locale, setLocale, profileId, secondaryVertical, profileOverrides])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error("useI18n must be used within <AdminI18nProvider>")
  }
  return ctx
}

export { localeLabels, locales }
