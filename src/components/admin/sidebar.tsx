"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useI18n } from "@/lib/i18n/provider"
import type { CapabilityKey } from "@/lib/profiles/types"
import {
  LayoutDashboardIcon,
  ChartBarIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  EnvelopeIcon,
  ScissorsIcon,
  PackageIcon,
  ToteIcon,
  ShoppingBagIcon,
  ReceiptIcon,
  FileTextIcon,
  SlidersIcon,
  StackIcon,
  UserCogIcon,
  SettingsIcon,
  CloseIcon,
  FolderIcon,
  LockIcon,
} from "@/components/icons"
import { usePermissions } from "@/components/admin/permissions-provider"
import type { PermissionKey } from "@/lib/permissions/roles"

interface NavItem {
  nameKey: "dashboard" | "analytics" | "appointments" | "waitlist" | "walkIn" | "customers" | "marketing" | "services" | "products" | "packages" | "shopOrders" | "workOrders" | "documents" | "forms" | "records" | "projects" | "staff" | "roles" | "settings"
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  /** Capability that must not be "disabled" for this item to render. */
  capability?: CapabilityKey
  /** Item renders when ANY of these capabilities is enabled (§11: packages combine services AND products). */
  anyCapabilities?: CapabilityKey[]
  /** Item renders only when the profile enables at least one extension with entities (§13). */
  requiresExtensions?: boolean
  /** Item renders only when the profile enables THIS extension id (E2-3: projects). */
  extension?: string
  /** Terminology key overriding the generic dictionary label. */
  termKey?: "appointmentPlural" | "servicePlural" | "productPlural" | "orderPlural"
  /** Custom-role permission required (G8). Absent → visible to all members. */
  permission?: PermissionKey
}

const navigation: NavItem[] = [
  { nameKey: "dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { nameKey: "analytics", href: "/dashboard/analytics", icon: ChartBarIcon, capability: "analytics", permission: "analytics.view" },
  { nameKey: "appointments", href: "/dashboard/appointments", icon: CalendarIcon, capability: "appointments", termKey: "appointmentPlural", permission: "appointments.view" },
  // #90: čakalna lista — isti zmožnost/dovoljenje kot termini
  { nameKey: "waitlist", href: "/dashboard/waitlist", icon: ClockIcon, capability: "appointments", permission: "appointments.view" },
  // #98 (AD-02): walk-in vrsta — samostojen izbirni modul (vse dejavnosti)
  { nameKey: "walkIn", href: "/dashboard/walk-in", icon: UsersIcon, capability: "walkIn", permission: "appointments.view" },
  { nameKey: "customers", href: "/dashboard/users", icon: UsersIcon, capability: "customers", permission: "customers.manage" },
  // #95: marketing avtomatika — isti zmožnost/dovoljenje kot stranke
  { nameKey: "marketing", href: "/dashboard/marketing", icon: EnvelopeIcon, capability: "customers", permission: "customers.manage" },
  { nameKey: "services", href: "/dashboard/services", icon: ScissorsIcon, capability: "services", termKey: "servicePlural", permission: "services.manage" },
  { nameKey: "products", href: "/dashboard/products", icon: PackageIcon, capability: "shop", termKey: "productPlural", permission: "products.manage" },
  // Packages (bundles of services and/or products) — shown when either exists
  { nameKey: "packages", href: "/dashboard/packages", icon: ToteIcon, anyCapabilities: ["shop", "services"], permission: "products.manage" },
  // Work orders (workflow-driven jobs) — terminology comes from the profile
  { nameKey: "workOrders", href: "/dashboard/work-orders", icon: ReceiptIcon, capability: "workOrders", termKey: "orderPlural", permission: "workorders.manage" },
  // Documents (quotes/invoices) — gated by the documents capability (§13)
  { nameKey: "documents", href: "/dashboard/documents", icon: FileTextIcon, capability: "documents", permission: "finances.view" },
  // E-commerce shop orders — generic label, only for shop-capable tenants
  { nameKey: "shopOrders", href: "/dashboard/orders", icon: ShoppingBagIcon, capability: "shop", permission: "orders.manage" },
  { nameKey: "forms", href: "/dashboard/forms", icon: SlidersIcon, capability: "forms", permission: "inquiries.manage" },
  // Extension entity registries (vehicles, batches, …) — §13, rendered
  // only when the profile enables extensions that contribute entities
  { nameKey: "records", href: "/dashboard/records", icon: StackIcon, requiresExtensions: true, permission: "workorders.manage" },
  // Projects & tasks (E2-3) — rendered only when the profile enables
  // the `projects` extension (runtime shipped in E2-3; other profiles
  // keep today's experience verbatim).
  { nameKey: "projects", href: "/dashboard/projects", icon: FolderIcon, extension: "projects", permission: "workorders.manage" },
  { nameKey: "staff", href: "/dashboard/staff", icon: UserCogIcon, capability: "staff", permission: "staff.manage" },
  // Custom roles (G8) — admin-only, gated in the filter below by isAdmin.
  { nameKey: "roles", href: "/dashboard/roles", icon: LockIcon },
  { nameKey: "settings", href: "/dashboard/settings", icon: SettingsIcon, permission: "settings.manage" },
]

interface SidebarNavProps {
  onNavigate?: () => void
}

function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname()
  const { t, term, profile } = useI18n()
  const { permissions, isAdmin } = usePermissions()

  // Capability-gated navigation (EPIC #1 §21): irrelevant modules never render.
  // G8: items may additionally require a custom-role permission; the
  // "roles" item is admin-only. Members WITHOUT a custom role hold the
  // full legacy set (see effectivePermissionKeys), so their chrome is
  // byte-for-byte unchanged.
  const visible = navigation.filter((item) => {
    if (item.nameKey === "roles" && !isAdmin) return false
    if (item.permission && !permissions.includes(item.permission)) {
      return false
    }
    if (item.extension) {
      return profile.extensions.includes(item.extension)
    }
    if (item.requiresExtensions) {
      return profile.extensions.length > 0
    }
    if (item.anyCapabilities?.length) {
      return item.anyCapabilities.some(
        (cap) => profile.capabilities[cap] !== "disabled"
      )
    }
    if (!item.capability) return true
    return profile.capabilities[item.capability] !== "disabled"
  })

  return (
    <nav className="space-y-1 px-3">
      {visible.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href))
        const IconComponent = item.icon
        // Industry terminology overrides the generic dictionary label.
        const label = item.termKey ? term(item.termKey) : t.common.nav[item.nameKey]
        return (
          <Link
            key={item.nameKey}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <IconComponent size={18} className={cn(isActive && "text-primary-foreground")} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminSidebar() {
  const { t } = useI18n()
  return (
    <aside className="hidden w-64 shrink-0 bg-card shadow-sm lg:block">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo variant="sidebar" />
          </Link>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <SidebarNav />
        </ScrollArea>

        {/* Footer */}
        <div className="space-y-2 p-4">
          <p className="text-center text-xs text-muted-foreground">
            {t.common.platformTagline}
          </p>
        </div>
      </div>
    </aside>
  )
}

interface MobileSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const { t } = useI18n()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="flex h-16 flex-row items-center justify-between px-4">
          <SheetTitle className="flex items-center gap-2">
            <Logo variant="sidebar" />
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <CloseIcon size={18} />
            <span className="sr-only">{t.common.header.closeMenu}</span>
          </Button>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-4rem)] py-4">
          <SidebarNav onNavigate={() => onOpenChange(false)} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
