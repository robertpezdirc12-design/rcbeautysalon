import type { Metadata } from "next"
import { Great_Vibes, Poppins, Playfair_Display, Cormorant_Garamond, Oswald, Montserrat, Inter, Lora } from "next/font/google"
import { SessionProvider } from "@/components/providers/session-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { CartProvider } from "@/components/providers/cart-provider"
import { TooltipProvider } from "@/components/providers/tooltip-provider"

import { Toaster } from "sonner"
import "./globals.css"
import { headers } from "next/headers"
import { auth } from "@/lib/auth/auth"
import { getOrgBySlug, getOrgById } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { paletteCssVars, PALETTES, type Palette } from "@/lib/verticals"
import { mergeSiteContent } from "@/lib/site-content"
import { CurrencyProvider } from "@/lib/currency"
import { resolvePublishGate } from "@/lib/publish-gate"
import {
  buildTenantMetadata,
  buildTenantJsonLd,
  resolveAppUrl,
  type SeoContext,
} from "@/lib/seo"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import type { Organization } from "@prisma/client"

// P0 #1 (walkthrough): Rouge Script NIMA latin-ext subseta (šumniki š/č/ž so
// padali v fallback pisavo) → Great Vibes, ki ima polno latin-ext podporo.
// CSS spremenljivka ostane --font-rouge-script (FontKey "rouge" je v DB).
const rougeScript = Great_Vibes({
  variable: "--font-rouge-script",
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  display: "swap",
})

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
})

const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin", "latin-ext"], display: "swap" })
const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], display: "swap" })
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin", "latin-ext"], display: "swap" })
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin", "latin-ext"], display: "swap" })
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" })
const lora = Lora({ variable: "--font-lora", subsets: ["latin", "latin-ext"], display: "swap" })

/** Resolve which organization brands the current request:
 *  1. tenant from /s/[slug] (header set by proxy) — publish-gated: a draft
 *     tenant brands the page only for its own owner (EPIC #3 E3-1), so guest
 *     metadata/theme never leak an unpublished tenant
 *  2. signed-in user's organization (dashboard)
 *  3. default (first PUBLISHED) organization (bare public routes, anonymous) */
async function resolveBrandOrg(): Promise<Organization | null> {
  try {
    const h = await headers()
    const slug = h.get("x-org-slug")
    if (slug) {
      const org = await getOrgBySlug(slug)
      if (org) {
        const gate = await resolvePublishGate(org)
        return gate === "hidden" ? null : org
      }
    }
    const session = await auth()
    if (session?.user?.organizationId) {
      return await getOrgById(session.user.organizationId)
    }
    if (session?.user?.role === "ADMIN") {
      return prisma.organization.findFirst({ where: { status: "ACTIVE", publishState: "PUBLISHED" }, orderBy: { createdAt: "asc" } })
    }
    return prisma.organization.findFirst({ where: { status: "ACTIVE", publishState: "PUBLISHED" }, orderBy: { createdAt: "asc" } })
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const appUrl = resolveAppUrl()
  const org = await resolveBrandOrg()

  if (!org) {
    // Skriti osnutek ali brez organizacij — generična platforma, brez indeksa.
    return {
      title: "Salon Platform",
      description: "Rezervacije, trgovina in predstavitev vašega salona",
      robots: { index: false, follow: false },
    }
  }

  const [config, gate, headersList] = await Promise.all([
    prisma.salonConfig.findUnique({ where: { organizationId: org.id } }),
    resolvePublishGate(org),
    headers(),
  ])
  const content = mergeSiteContent(config?.siteContent, org.vertical)

  // Kontekst: /s/[slug] prek proxyja > goli javni dostop (prva objavljena) >
  // prijavljena seja (dashboard) — zasebno.
  const tenantSlugHeader = headersList.get("x-org-slug")
  const session = await auth()
  const context: SeoContext = tenantSlugHeader
    ? "tenant"
    : session
      ? "private"
      : "bare"

  return buildTenantMetadata({
    org: { name: org.name, slug: org.slug, logo: org.logo },
    content,
    appUrl,
    context,
    indexable: context === "bare" ? true : gate === "published",
  })
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const org = await resolveBrandOrg()
  let themeCss = ""
  let orgCurrency = "EUR"
  let jsonLd: Record<string, unknown> | null = null
  if (org) {
    const paletteId = org.palette && PALETTES[org.palette] ? org.palette : "rose"
    const palette: Palette = PALETTES[paletteId]
    const vars = paletteCssVars(palette)
    themeCss = `:root{${Object.entries(vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(";")}}`
    const config = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { currency: true, siteContent: true },
    })
    orgCurrency = config?.currency || "EUR"

    // JSON-LD samo za javne kontekste (tenant/bare) objavljenih najemnikov.
    const tenantSlugHeader = await headers().then((h) => h.get("x-org-slug"))
    const session = await auth()
    const context: SeoContext = tenantSlugHeader
      ? "tenant"
      : session
        ? "private"
        : "bare"
    if (context !== "private") {
      const gate = await resolvePublishGate(org)
      if (gate === "published") {
        const content = mergeSiteContent(config?.siteContent, org.vertical)
        jsonLd = buildTenantJsonLd({
          org: { name: org.name, slug: org.slug, logo: org.logo, vertical: org.vertical },
          content,
          appUrl: resolveAppUrl(),
          indexable: true,
        })
      }
    }
  }

  const htmlLocale = await getLocaleFromCookies()

  return (
    <html
      lang={htmlLocale}
      className="scroll-smooth"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {themeCss && <style id="org-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />}
        {jsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
      </head>
      <body
        className={`${rougeScript.variable} ${poppins.variable} ${playfair.variable} ${cormorant.variable} ${oswald.variable} ${montserrat.variable} ${inter.variable} ${lora.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <CurrencyProvider currency={orgCurrency}>
              <CartProvider>
                <TooltipProvider>{children}</TooltipProvider>
              </CartProvider>
            </CurrencyProvider>

            <Toaster position="top-right" richColors />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
