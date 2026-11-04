// ============================================================
// #94 — PLATFORMSKA TEMA (single source of truth)
// Nevtralna profesionalna osnova + poglobljena rose kot edini
// akcent. Velja SAMO za brez-org površine (landing, /start,
// prijava) — layout.tsx jo vbrizga prek themeCss, ko najemniški
// kontekst NE obstaja. Najemniške strani dobijo svojo paleto
// (paletteCssVars) in teh vrednostih ne vidijo.
//
// Čist modul: testabilna kontrastna zaščita v CI
// (tests/contrast-wcag-94.test.ts) bere te iste vrednosti.
// ============================================================

export const PLATFORM_LIGHT_VARS: Record<string, string> = {
  "--background": "0 0% 100%",
  "--foreground": "222 13% 14%",
  "--card": "0 0% 100%",
  "--muted": "220 14% 96%",
  "--muted-foreground": "220 9% 38%",
  "--border": "220 13% 90%",
  "--secondary": "220 14% 96%",
  "--secondary-foreground": "222 13% 20%",
  "--primary-50": "340 45% 97%",
  "--primary-100": "340 45% 94%",
  "--primary-200": "340 45% 85%",
  "--primary-300": "340 45% 70%",
  "--primary-400": "340 45% 56%",
  "--primary-500": "340 45% 42%",
  "--primary-600": "340 45% 36%",
  "--primary-700": "340 45% 30%",
  "--primary-800": "340 45% 24%",
  "--primary-900": "340 45% 18%",
  "--primary": "340 45% 42%",
  "--primary-foreground": "0 0% 100%",
  "--primary-hover": "340 45% 36%",
  "--primary-active": "340 45% 30%",
  "--primary-text": "340 45% 32%",
  "--accent-text": "38 70% 30%",
  "--ring": "340 45% 42%",
}

export const PLATFORM_DARK_VARS: Record<string, string> = {
  "--background": "222 13% 9%",
  "--foreground": "0 0% 95%",
  "--card": "222 13% 11%",
  "--muted": "222 10% 16%",
  "--muted-foreground": "220 9% 65%",
  "--border": "222 10% 20%",
  "--secondary": "222 10% 16%",
  "--secondary-foreground": "0 0% 90%",
  "--primary-text": "340 45% 78%",
  "--accent-text": "38 70% 60%",
}

/** CSS string v isti obliki, kot jo layout vbrizga za najemniške palete. */
export function platformThemeCss(): string {
  const light = Object.entries(PLATFORM_LIGHT_VARS)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")
  const dark = Object.entries(PLATFORM_DARK_VARS)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")
  return `:root{${light}}.dark{${dark}}`
}
