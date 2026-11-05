"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MenuIcon, CloseIcon, UserIcon, LogoutIcon, CalendarCheckIcon, SettingsIcon, ReceiptIcon, UserCogIcon, StarIcon, SpinnerGapIcon } from "@/components/icons"
import { useNavigationStore } from "@/store/navigation-store"
import { NavCartButton } from "@/components/shop/nav-cart-button"
import { orgPath } from "@/lib/org-path"
import { useI18n } from "@/lib/i18n/provider"
import { LanguageSwitcher } from "@/components/admin/language-switcher"

interface NavLinkItem {
  href: string
  sectionId?: string
  label: string
}

interface PublicNavbarProps {
  org: { slug: string | null; name: string; logo: string | null }
  /** Profile-resolved call-to-action; null → hidden (e.g. module disabled). */
  cta?: { label: string; href: string } | null
  /**
   * Which home-page sections actually exist (anchor targets). The home page
   * renders #services/#shop only when featured content exists, and #team
   * only when the profile does not disable staff — a missing or disabled
   * section must not be linked (dead anchor). Absent → assumed available.
   */
  availableSections?: { services?: boolean; shop?: boolean; team?: boolean; reviews?: boolean }
  /**
   * #98 (AD-02): walk-in vrsta — povezava se pokaže samo ko je modul
   * vklopljen (capability walkIn); izklopljen = povezava ne obstaja.
   */
  walkInEnabled?: boolean
}

export function PublicNavbar({ org, cta, availableSections, walkInEnabled }: PublicNavbarProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { data: session, status } = useSession()
  const { activeSection } = useNavigationStore()
  const { t } = useI18n()

  const homeHref = orgPath(org.slug, "/")
  // #services/#shop/#team are conditionally rendered — drop them when the
  // tenant has no featured services/products or the profile disables staff
  // (P2 #46/#47: about/contact always render).
  // P2 #75: #testimonials enako — samo z vsaj eno oceno (mrtvo sidro).
  const showServices = availableSections?.services !== false
  const showShop = availableSections?.shop !== false
  const showTeam = availableSections?.team !== false
  const showReviews = availableSections?.reviews !== false
  const navLinks: NavLinkItem[] = [
    ...(showServices
      ? [{ href: `${homeHref}#services`, sectionId: "services", label: t.public.navServices }]
      : []),
    { href: `${homeHref}#about`, sectionId: "about", label: t.public.navAbout },
    ...(showTeam
      ? [{ href: `${homeHref}#team`, sectionId: "team", label: t.public.navTeam }]
      : []),
    ...(showReviews
      ? [{ href: `${homeHref}#testimonials`, sectionId: "testimonials", label: t.public.navReviews }]
      : []),
    ...(showShop
      ? [{ href: `${homeHref}#shop`, sectionId: "shop", label: t.public.navShop }]
      : []),
    ...(walkInEnabled
      ? [{ href: orgPath(org.slug, "/vrsta"), label: t.public.navWalkIn }]
      : []),
    { href: `${homeHref}#contact`, sectionId: "contact", label: t.public.navContact },
  ]

  const isLoading = status === "loading"
  const isAuthenticated = !!session?.user

  const isActive = (link: NavLinkItem) => {
    // Home page
    if (link.href === homeHref) {
      return pathname === homeHref
    }

    // Hash links (like /#about, /#contact) - check active section from scroll
    if (link.sectionId) {
      return pathname === homeHref && activeSection === link.sectionId
    }

    // Regular routes like /services, /shop
    // Match exact path or any subpath (e.g., /services/haircut)
    if (pathname === link.href) return true
    if (pathname?.startsWith(link.href + "/")) return true

    return false
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-card/95 backdrop-blur-md shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href={homeHref} className="shrink-0">
          <Logo variant="navbar" src={org.logo} alt={org.name} />
        </Link>

        {/* Desktop Navigation — P1 #30: preklopi na lg (1024px). Pri md
            (768px) se logo + 5 povezav + jezik + tema + košarica + CTA
            ne ujemajo (+51 px prekoračitve in odrezan CTA). Pod lg ostane
            hamburger, ki vedno sprejme celotno vsebino. */}
        <nav className="hidden items-center gap-0.5 lg:flex lg:gap-1 xl:gap-2 2xl:gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-all px-2.5 py-1.5 rounded-md xl:px-3 xl:py-2 ${
                isActive(link)
                  ? "text-primary-foreground bg-primary shadow-sm"
                  : "text-foreground/70 hover:text-primary-text hover:bg-primary/10"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-1.5 xl:gap-2 ml-3 xl:ml-4 pl-3 xl:pl-4 border-l border-border/50">
            <LanguageSwitcher />
            <ThemeToggle />
            <NavCartButton />
            {/*
             * Auth surface rule (interface logic): the salon's customer-facing
             * interface must NOT offer login to anonymous visitors — booking is
             * guest-first and staff/owners reach /login via the discreet footer
             * link. Logged-in users keep their own account menu.
             */}
            {isLoading ? (
              <Button variant="ghost" disabled size="sm" className="w-10">
                <SpinnerGapIcon size={18} className="animate-spin" />
              </Button>
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-foreground/80 hover:bg-secondary hover:text-primary-text gap-1.5">
                    <UserIcon size={18} />
                    <span className="hidden 2xl:inline max-w-20 truncate">{session.user.name || t.public.account}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {session.user.role === "ADMIN" && (
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                        <SettingsIcon size={16} />
                        {t.public.dashboard}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {session.user.role === "STAFF" && (
                    <DropdownMenuItem asChild>
                      <Link href="/staff-portal" className="flex items-center gap-2 cursor-pointer">
                        <SettingsIcon size={16} />
                        {t.public.staffPortal}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {session.user.role === "CLIENTE" && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/my-account" className="flex items-center gap-2 cursor-pointer">
                          <UserCogIcon size={16} />
                          {t.public.myAccount}
                        </Link>
                      </DropdownMenuItem>
                      {/* #53: these surfaces are tenant-scoped — a bare path
                          renders the DEFAULT tenant's chrome on reload. */}
                      <DropdownMenuItem asChild>
                        <Link href={orgPath(org.slug, "/my-appointments")} className="flex items-center gap-2 cursor-pointer">
                          <CalendarCheckIcon size={16} />
                          {t.public.myAppointments}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={orgPath(org.slug, "/my-orders")} className="flex items-center gap-2 cursor-pointer">
                          <ReceiptIcon size={16} />
                          {t.public.myOrders}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={orgPath(org.slug, "/my-reviews")} className="flex items-center gap-2 cursor-pointer">
                          <StarIcon size={16} />
                          {t.public.myReviews}
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogoutIcon size={16} />
                    {t.public.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {cta && (
              <Link href={orgPath(org.slug, cta.href)}>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
                  {cta.label}
                </Button>
              </Link>
            )}
          </div>
        </nav>

        {/* Mobile Menu Button — P1 #30: viden DO lg (prej md) */}
        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher />
          <ThemeToggle />
          <NavCartButton />
          <button
            className="text-foreground/70 hover:text-primary-text transition-colors p-2 -mr-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={t.public.toggleMenu}
          >
            {mobileMenuOpen ? (
              <CloseIcon size={24} weight="bold" />
            ) : (
              <MenuIcon size={24} weight="bold" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu — P1 #30: viden DO lg */}
      {mobileMenuOpen && (
        <div className="border-t border-border/50 bg-card/95 backdrop-blur-md lg:hidden">
          <nav className="container mx-auto flex flex-col gap-1 px-4 py-4 sm:py-6">
            {/* Navigation Links */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col sm:gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-all px-3 py-2.5 rounded-md text-center sm:text-left ${
                    isActive(link)
                      ? "text-primary-foreground bg-primary shadow-sm"
                      : "text-foreground/70 hover:text-primary-text hover:bg-primary/10"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div className="my-3 border-t border-border/50" />

            {/* Auth Section */}
            {/* Auth surface rule: same as desktop — no login entry for guests. */}
            {isLoading ? (
              <Button variant="ghost" disabled className="w-full h-11">
                <SpinnerGapIcon size={20} className="animate-spin" />
              </Button>
            ) : isAuthenticated ? (
              <div className="space-y-1">
                {/* User name header */}
                <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                  {session.user.name || t.public.account}
                </div>

                {session.user.role === "ADMIN" && (
                  <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full h-11 text-foreground/80 hover:bg-secondary hover:text-primary-text gap-2 justify-start">
                      <SettingsIcon size={18} />
                      {t.public.dashboard}
                    </Button>
                  </Link>
                )}
                {session.user.role === "STAFF" && (
                  <Link href="/staff-portal" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full h-11 text-foreground/80 hover:bg-secondary hover:text-primary-text gap-2 justify-start">
                      <SettingsIcon size={18} />
                      {t.public.staffPortal}
                    </Button>
                  </Link>
                )}
                {session.user.role === "CLIENTE" && (
                  <>
                    <Link href="/my-account" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full h-11 text-foreground/80 hover:bg-secondary hover:text-primary-text gap-2 justify-start">
                        <UserCogIcon size={18} />
                        {t.public.myAccount}
                      </Button>
                    </Link>
                    <Link href={orgPath(org.slug, "/my-appointments")} onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full h-11 text-foreground/80 hover:bg-secondary hover:text-primary-text gap-2 justify-start">
                        <CalendarCheckIcon size={18} />
                        {t.public.myAppointments}
                      </Button>
                    </Link>
                    <Link href={orgPath(org.slug, "/my-orders")} onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full h-11 text-foreground/80 hover:bg-secondary hover:text-primary-text gap-2 justify-start">
                        <ReceiptIcon size={18} />
                        {t.public.myOrders}
                      </Button>
                    </Link>
                    <Link href={orgPath(org.slug, "/my-reviews")} onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full h-11 text-foreground/80 hover:bg-secondary hover:text-primary-text gap-2 justify-start">
                        <StarIcon size={18} />
                        {t.public.myReviews}
                      </Button>
                    </Link>
                  </>
                )}
                <Button
                  variant="ghost"
                  className="w-full h-11 text-destructive hover:bg-destructive/10 gap-2 justify-start"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    signOut({ callbackUrl: "/" })
                  }}
                >
                  <LogoutIcon size={18} />
                  {t.public.logout}
                </Button>
              </div>
            ) : null}

            {/* Profile-resolved CTA (hidden when module disabled) */}
            {cta && (
              <Link href={orgPath(org.slug, cta.href)} onClick={() => setMobileMenuOpen(false)} className="mt-2">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 w-full h-12 text-base">
                  {cta.label}
                </Button>
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
