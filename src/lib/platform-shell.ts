// ============================================================
// F2 — NARROW SSR GATE FOR THE PLATFORM LANDING
//
// The root layout wraps every page in CartProvider, a client component
// whose server snapshot returns `false` and therefore renders `null`.
// That blanks the whole SSR <body>: no <h1>, no JSON-LD, no visible
// content until hydration. Fixing it globally would expose components
// that read `window` during render on tenant/admin pages, so the root
// layout omits that ONE wrapper only on the two platform marketing
// routes, tagged here by the proxy.
//
// The proxy strips any incoming value and sets it ONLY for "/" and
// "/en" when no signed tenant header and no custom-domain host is in
// play. A rewritten /s/<slug> -> / pass carries ORG_HEADER and is
// never tagged. Pure functions, no imports: safe in the edge runtime
// and testable without booting Next.js.
// ============================================================

export const PLATFORM_LANDING_HEADER = "x-markec-platform-landing"
export const PLATFORM_LANDING_HEADER_VALUE = "1"

/** Exact marketing routes; subpaths such as /en/faq are not routes here. */
export function isPlatformLandingPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/en"
}

/** Strict value check — a malformed or forged header is ignored. */
export function isPlatformLandingRequest(
  value: string | null | undefined
): boolean {
  return value === PLATFORM_LANDING_HEADER_VALUE
}
