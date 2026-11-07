import type { Metadata } from "next"
import { PlatformLanding } from "@/components/landing/platform-landing"
import { landingEn } from "@/lib/i18n/dict/landing"
import { resolveAppUrl } from "@/lib/seo"

// ============================================================
// F1 — explicit English platform landing at /en.
//
// Deliberately OUTSIDE the (public) route group: that layout becomes
// tenant-aware on custom domains and would wrap a marketing page in a
// tenant navbar/footer. A static path also avoids competing with
// /login, /start and the /s/[slug] proxy rewrites (see LANDING-PLAN §4).
//
// No IP or Accept-Language redirect: the visitor chooses, and both
// versions are independently crawlable with reciprocal hreflang.
// <html lang="en"> comes from the proxy-signed request header
// (src/lib/i18n/platform-locale.ts) — it is server-rendered, not JS.
// ============================================================

export async function generateMetadata(): Promise<Metadata> {
  const appUrl = resolveAppUrl()
  const enUrl = `${appUrl}/en`
  const t = landingEn.meta

  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: enUrl,
      languages: {
        sl: appUrl,
        en: enUrl,
        "x-default": appUrl,
      },
    },
    openGraph: {
      type: "website",
      url: enUrl,
      siteName: "MARKEC",
      title: t.ogTitle,
      description: t.ogDescription,
      locale: "en_US",
      images: [
        {
          url: `${appUrl}/og-default.png`,
          width: 1200,
          height: 630,
          alt: "MARKEC – MY BUSINESS PLATFORM",
        },
      ],
    },
    robots: { index: true, follow: true },
  }
}

export default function EnglishLandingPage() {
  return <PlatformLanding locale="en" />
}
