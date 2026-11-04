import { cookies } from "next/headers"
import { LOCALE_COOKIE, Locale, parseLocale } from "./config"
import { getDictionary, getDateFnsLocale } from "./dictionaries"
import { getResolvedOrg } from "@/lib/tenant"
import {
  getProfile,
  term as profileTerm,
} from "@/lib/profiles/registry"
import { applyOverrides, parseOverrides } from "@/lib/profiles/overrides"
import type { ActivityProfile } from "@/lib/profiles/types"

/** Read the admin locale from cookies (server components / server actions). */
export async function getLocaleFromCookies(): Promise<Locale> {
  const store = await cookies()
  return parseLocale(store.get(LOCALE_COOKIE)?.value)
}

/** Convenience helper: locale + full dictionary for server components.
 *  P2 #84: exposes term()/withBusiness() resolved against the CURRENT
 *  tenant's effective profile — "servis" za vulkanizerja, "salon" za
 *  lepotni salon, "podjetje" za neznano/najemniški kontekst brez profila. */
export async function getServerI18n(): Promise<{
  locale: Locale
  t: ReturnType<typeof getDictionary>
  dateFnsLocale: ReturnType<typeof getDateFnsLocale>
  profile: ActivityProfile
  term: (key: keyof ActivityProfile["terminology"]) => string
  withBusiness: (text: string) => string
}> {
  const locale = await getLocaleFromCookies()
  const org = await getResolvedOrg().catch(() => null)
  const profile = applyOverrides(
    getProfile(org?.vertical),
    parseOverrides(org?.profileOverrides)
  )
  const term = (key: keyof ActivityProfile["terminology"]) =>
    profileTerm(profile, key, locale)
  return {
    locale,
    t: getDictionary(locale),
    dateFnsLocale: getDateFnsLocale(locale),
    profile,
    term,
    withBusiness: (text: string) =>
      text
        .replace(/\{business\}/g, term("businessSingular"))
        .replace(/\{businessIn\}/g, term("businessIn"))
        .replace(/\{businessGenitive\}/g, term("businessGenitive")),
  }
}
