import type { Locale } from "./config"

// ============================================================
// URL-LOCALISED PLATFORM LANDING (F1)
//
// The admin/dashboard locale is cookie-based (LOCALE_COOKIE), but a
// public landing page must be addressable and indexable per language:
//   "/"   → Slovenian (default + x-default)
//   "/en" → English
//
// Root layout owns <html lang>, yet a layout cannot read the pathname.
// The proxy therefore sets a REQUEST header for the explicit /en path.
// Like the signed tenant header, an incoming visitor-supplied value is
// stripped first — only the proxy decides the URL locale.
//
// Pure functions: testable without booting Next.js (see
// tests/landing/platform-landing.test.ts).
// ============================================================

export const PLATFORM_LOCALE_HEADER = "x-markec-locale"

/** Only the explicit English URL is URL-localised; everything else keeps the cookie. */
export function platformLocaleForPath(pathname: string): Locale | null {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : null
}

/** URL locale wins over the admin cookie. Unknown header values are ignored. */
export function resolveHtmlLocale(
  cookieLocale: Locale,
  headerValue: string | null | undefined
): Locale {
  return headerValue === "en" ? "en" : cookieLocale
}
