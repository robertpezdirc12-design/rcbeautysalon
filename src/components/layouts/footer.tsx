import Link from "next/link"
import { Globe, Music2 } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { auth } from "@/lib/auth/auth"
import { getPublicSiteData } from "@/lib/public-site"
import { orgPath } from "@/lib/org-path"
import { formatOpeningHours } from "@/lib/site-content"
import { term as profileTerm } from "@/lib/profiles/registry"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import { resolvePublishGate } from "@/lib/publish-gate"

function truncate(text: string, max = 160): string {
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

const legalLinks = [
  { href: "/privacy", label: "Zasebnost" },
  { href: "/terms", label: "Pogoji uporabe" },
  { href: "/cookies", label: "Piškotki" },
]

/**
 * Auth surface rule (interface logic): anonymous visitors must not see a
 * prominent login entry on the salon's customer-facing site. Staff, owners
 * and returning customers reach /login through this single discreet footer
 * link (same visual weight as the legal links).
 * P2 #68: the link CARRIES the tenant (`/login?org=<slug>`) — the header
 * alone cannot (auth is platform-level, #53), and without it the login
 * fell back to the oldest tenant's brand. Bare /login stays valid.
 */
const staffLoginHref = (slug: string | null) =>
  slug ? `/login?org=${encodeURIComponent(slug)}` : "/login"

/**
 * #53: legal pages are tenant-scoped (canonical /s/{slug}/privacy|terms|cookies)
 * — a bare path is NOT rewritten by the proxy (BARE_PUBLIC_PATH covers only
 * content routes) and renders the DEFAULT tenant's chrome, i.e. the customer
 * of tenant B reads tenant A's name/contact in a GDPR document. Everything
 * except the platform-level login link goes through orgPath().
 * P2 #68: the login link keeps its explicit `?org=` context (platform auth
 * surface) — never tenant-prefixed, never stripped of its context.
 */
const isPlatformAuthHref = (href: string): boolean =>
  href === "/login" || href.startsWith("/login?")
const tenantScopedHref = (slug: string | null, href: string): string =>
  isPlatformAuthHref(href) ? href : orgPath(slug, href)

const Footer = async () => {
  const session = await auth()
  const site = await getPublicSiteData()
  const org = site?.org ?? null
  const config = site?.config ?? null
  const content = site?.content ?? null
  const slug = org?.slug ?? null

  // Publication gate (EPIC #3 E3-1): when the resolved tenant is not
  // published and the viewer is not its owner, render NO footer — otherwise
  // the platform footer would leak the draft tenant's name/contact/links
  // (e.g. under the maintenance screen).
  if (org && (await resolvePublishGate(org)) === "hidden") {
    return null
  }

  const aboutText = content?.about.paragraphs[0]
    ? truncate(content.about.paragraphs[0])
    : "Vaš salon lepote — rezervacije terminov, storitve in izbrani izdelki na enem mestu."

  // Profile-aware footer links (EPIC #1 §21): irrelevant modules never render.
  // Phase 5: effective profile = shared profile + owner overrides.
  // "Moji termini" is an account surface — hidden from anonymous visitors.
  const profile = resolveEffectiveProfile(org)
  const cap = (k: keyof typeof profile.capabilities) =>
    profile.capabilities[k] !== "disabled"
  const quickLinks = [
    cap("services") && { href: "/services", label: "Storitve" },
    cap("shop") && { href: "/shop", label: "Trgovina" },
    profile.website.ctaMode === "booking" &&
      cap("appointments") && { href: "/booking", label: "Rezerviraj termin" },
    session &&
      cap("appointments") && { href: "/my-appointments", label: "Moji termini" },
    (profile.website.ctaMode === "inquiry" || profile.website.ctaMode === "quote") && {
      href: "/inquiry",
      label: profileTerm(profile, "bookingCta", "sl"),
    },
  ].filter(Boolean) as { href: string; label: string }[]

  const openingHours = content ? formatOpeningHours(content.openingHours) : []

  const socialLinks = content
    ? [
        content.social.instagram && {
          key: "instagram",
          href: content.social.instagram,
          label: "Instagram",
        },
        content.social.facebook && {
          key: "facebook",
          href: content.social.facebook,
          label: "Facebook",
        },
        content.social.tiktok && {
          key: "tiktok",
          href: content.social.tiktok,
          label: "TikTok",
        },
        content.social.website && {
          key: "website",
          href: content.social.website,
          label: "Spletna stran",
        },
      ].filter(Boolean) as { key: string; href: string; label: string }[]
    : []

  return (
    <footer className="border-primary/10 from-muted/30 via-muted/50 to-muted/30 relative overflow-hidden border-t bg-linear-to-b py-16">
      {/* Decorative gradient overlay */}
      <div className="from-primary/5 to-accent/5 pointer-events-none absolute inset-0 bg-linear-to-br via-transparent" />

      <div className="relative container mx-auto px-4">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand Section */}
          <div className="space-y-4 lg:col-span-1">
            <Link href={orgPath(slug, "/")} className="inline-block">
              <Logo
                variant="footer"
                src={org?.logo ?? null}
                alt={org?.name}
                className="transition-transform duration-300 hover:scale-105"
              />
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {aboutText}
            </p>
            {/* Social Links */}
            {socialLinks.length > 0 && (
              <div className="flex gap-3 pt-2">
                {socialLinks.map((link) => (
                  <a
                    key={link.key}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group border-primary/30 bg-primary/5 text-muted-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-primary/30 relative flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-sm transition-all duration-500 ease-out hover:-translate-y-1 hover:scale-110 hover:shadow-lg"
                    aria-label={link.label}
                  >
                    {link.key === "instagram" && (
                      <svg
                        className="h-5 w-5 transition-all duration-500 ease-out"
                        viewBox="0 0 24 24"
                      >
                        <path
                          className="fill-current transition-all duration-500 ease-out"
                          d="M16 3H8C5.243 3 3 5.243 3 8v8c0 2.757 2.243 5 5 5h8c2.757 0 5-2.243 5-5V8c0-2.757-2.243-5-5-5zm3 13c0 1.654-1.346 3-3 3H8c-1.654 0-3-1.346-3-3V8c0-1.654 1.346-3 3-3h8c1.654 0 3 1.346 3 3v8z"
                        />
                        <circle
                          className="fill-current transition-all duration-500 ease-out"
                          cx="12"
                          cy="12"
                          r="3"
                        />
                        <circle
                          className="fill-current transition-all duration-500 ease-out"
                          cx="17.5"
                          cy="6.5"
                          r=".5"
                        />
                      </svg>
                    )}
                    {link.key === "facebook" && (
                      <svg
                        className="h-5 w-5 fill-current transition-all duration-500 ease-out"
                        viewBox="0 0 24 24"
                      >
                        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                      </svg>
                    )}
                    {link.key === "tiktok" && <Music2 size={20} />}
                    {link.key === "website" && <Globe size={20} />}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h2 className="font-heading text-2xl tracking-tight md:text-3xl">
              Hitre povezave
            </h2>
            <ul className="space-y-3 text-sm">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={orgPath(slug, link.href)}
                    className="group text-muted-foreground hover:text-primary-text inline-flex min-h-11 items-center py-2 transition-colors"
                  >
                    <span className="text-accent-text mr-2 transition-transform group-hover:translate-x-1">
                      →
                    </span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h2 className="font-heading text-2xl tracking-tight md:text-3xl">
              Kontakt
            </h2>
            <ul className="space-y-3 text-sm">
              {(config?.address || config?.city) && (
                <li className="text-muted-foreground flex items-start gap-3">
                  <svg
                    className="text-primary-text mt-0.5 h-5 w-5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>
                    {config?.address}
                    {config?.address && config?.city && <br />}
                    {config?.city}
                  </span>
                </li>
              )}
              {config?.email && (
                <li className="text-muted-foreground hover:text-accent-text flex items-center gap-3 transition-colors">
                  <svg
                    className="text-primary-text h-5 w-5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  {/* P2 #16 (audit-2026-11): ≥44px dotik-cilj tudi za kontaktne povezave */}
                  <a
                    href={`mailto:${config.email}`}
                    className="inline-flex min-h-11 items-center py-2"
                  >
                    {config.email}
                  </a>
                </li>
              )}
              {config?.phone && (
                <li className="text-muted-foreground hover:text-accent-text flex items-center gap-3 transition-colors">
                  <svg
                    className="text-primary-text h-5 w-5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  <a
                    href={`tel:${config.phone.replace(/\s+/g, "")}`}
                    className="inline-flex min-h-11 items-center py-2"
                  >
                    {config.phone}
                  </a>
                </li>
              )}
              {!config?.address && !config?.city && !config?.email && !config?.phone && (
                <li className="text-muted-foreground">
                  Kontaktne informacije še niso objavljene.
                </li>
              )}
            </ul>
          </div>

          {/* Business Hours */}
          <div className="space-y-4">
            <h2 className="font-heading text-2xl tracking-tight md:text-3xl">
              Delovni čas
            </h2>
            <ul className="text-muted-foreground space-y-2 text-sm">
              {openingHours.map((item) => (
                <li key={item.day} className="flex items-center justify-between">
                  <span>{item.day}</span>
                  <span
                    className={`font-medium ${
                      item.value === "Zaprto" ? "text-accent-text" : "text-foreground"
                    }`}
                  >
                    {item.value}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-primary/20 bg-primary/5 rounded-lg border p-4">
              {profile.website.ctaMode === "booking" ? (
                <p className="text-primary-text text-xs font-medium">
                  ✨ Rezervirajte online za zagotovljen termin.
                </p>
              ) : (
                <p className="text-primary-text text-xs font-medium">
                  ✨ {profileTerm(profile, "bookingCta", "sl")} — odgovorimo v najkrajšem možnem času.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-primary/10 mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row">
          <p className="text-muted-foreground text-center text-sm md:text-left">
            &copy; {new Date().getFullYear()}{" "}
            <span className="from-accent to-primary bg-linear-to-r bg-clip-text font-semibold text-transparent">
              {org?.name ?? "Poslovna platforma"}
            </span>{" "}
            — Oblikovano s ❤ na Poslovni platformi
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {(session
              ? legalLinks
              : [...legalLinks, { href: staffLoginHref(slug), label: "Prijava" }]
            ).map((link) => (
              <Link
                key={link.label}
                href={tenantScopedHref(slug, link.href)}
                className="text-muted-foreground hover:text-primary-text inline-flex min-h-11 items-center px-1 py-2 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
