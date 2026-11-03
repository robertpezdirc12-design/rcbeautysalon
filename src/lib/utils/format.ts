// Utility functions for formatting data
import { format as dfFormat } from "date-fns"
import { sl as slLocale, enUS } from "date-fns/locale"

export function formatCurrency(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("sl-SI", {
    style: "currency",
    currency,
  }).format(amount)
}

 export const formatChange = (change: number) => {
    const sign = change >= 0 ? "+" : ""
    return `${sign}${change.toFixed(1)}%`
  }

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("sl-SI", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d)
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("sl-SI", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d)
}

/**
 * P1 #6 (walkthrough): enotni prikaz datuma po celotnem nadzorni plošči.
 * sl → "6. nov. 2026", en → "Nov 6, 2026" — nikoli US "10/30/2026"
 * in nikoli EN vzorec s slovenskim locale-om ("nov. 6, 2026").
 */
export function formatDateStandard(date: Date | string, locale: string = "sl"): string {
  const d = typeof date === "string" ? new Date(date) : date
  return dfFormat(d, locale === "en" ? "MMM d, yyyy" : "d. MMM yyyy", {
    locale: locale === "en" ? enUS : slLocale,
  })
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "")
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/)
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`
  }
  return phone
}

