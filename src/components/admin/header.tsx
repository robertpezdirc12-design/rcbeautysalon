"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  MenuIcon,
  BellIcon,
  LogoutIcon,
  SettingsIcon,
  UsersIcon,
  HouseIcon,
} from "@/components/icons"
import { MobileSidebar } from "./sidebar"
import { LanguageSwitcher } from "./language-switcher"
import { useI18n } from "@/lib/i18n/provider"

export function AdminHeader({ orgSlug }: { orgSlug?: string | null }) {
  // Javna stran lastnega salona (/s/{slug}) — ne platformni landing (P0 #2 walkthrough).
  const publicSiteHref = orgSlug ? `/s/${orgSlug}` : "/"
  const router = useRouter()
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { t } = useI18n()

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push("/login")
    router.refresh()
  }

  const userInitials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U"

  const userRole = session?.user?.role || "CLIENT"
  const isAdmin = userRole === "ADMIN"

  const getRoleBadgeVariant = () => {
    switch (userRole) {
      case "ADMIN":
        return "default"
      case "STAFF":
        return "secondary"
      default:
        return "outline"
    }
  }

  const roleLabel =
    t.common.roles[userRole as keyof typeof t.common.roles] || userRole

  return (
    <>
      <header className="sticky top-0 z-40 shrink-0 bg-card shadow-sm">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          {/* Left side - Mobile menu */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <MenuIcon size={20} />
              <span className="sr-only">{t.common.header.openMenu}</span>
            </Button>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Language switcher */}
            <LanguageSwitcher />

            {/* Visit site link */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden gap-2 sm:flex"
              asChild
            >
              <Link href={publicSiteHref} target="_blank">
                <HouseIcon size={16} />
                <span className="hidden md:inline">{t.common.header.visitSite}</span>
              </Link>
            </Button>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <BellIcon size={20} />
              <span className="sr-only">{t.common.header.notifications}</span>
            </Button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium leading-none">
                        {session?.user?.name || t.common.header.user}
                      </p>
                      <Badge variant={getRoleBadgeVariant()} className="ml-2 text-xs">
                        {roleLabel}
                      </Badge>
                    </div>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session?.user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {isAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/staff-portal">
                        <UsersIcon size={16} className="mr-2" />
                        {t.common.header.staffPortal}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={publicSiteHref}>
                        <HouseIcon size={16} className="mr-2" />
                        {t.common.header.viewAsClient}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <SettingsIcon size={16} className="mr-2" />
                    {t.common.header.settings}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400">
                  <LogoutIcon size={16} className="mr-2" />
                  {t.common.header.signOut}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile sidebar */}
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
    </>
  )
}
