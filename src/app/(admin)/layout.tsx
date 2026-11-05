import { AdminSidebar } from "@/components/admin/sidebar"
import { AdminHeader } from "@/components/admin/header"
import { PermissionsProvider } from "@/components/admin/permissions-provider"
import { PushSetup } from "@/components/dashboard/push-setup"
import { AdminI18nProvider } from "@/lib/i18n/provider"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import { getSessionOrg } from "@/lib/tenant"
import { auth } from "@/lib/auth/auth"
import { getEffectivePermissions } from "@/lib/permissions/effective"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocaleFromCookies()
  // Activity profile of the tenant — drives capability-gated navigation
  // and industry terminology across the dashboard (EPIC #1).
  // Owner overrides (Phase 5) are applied on top of the shared profile.
  const org = await getSessionOrg()
  const profileId = org?.vertical

  // Effective permissions for the signed-in member (G8). Computed fresh
  // server-side so the sidebar chrome reflects role edits immediately.
  const session = await auth()
  const permissions = session?.user?.id
    ? await getEffectivePermissions(session.user.id)
    : []

  // #100 8.A (M3): podjetja na računu (članstva) — preklop v sidebarju
  // se pokaže samo ko jih je več kot eno (aktivna org izolirano).
  const memberOrgs = session?.user?.id
    ? await prisma.organizationMember.findMany({
        where: { userId: session.user.id, organization: { status: "ACTIVE" } },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { organization: { select: { id: true, name: true } } },
      })
    : []
  const organizations = memberOrgs.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
  }))

  return (
    <AdminI18nProvider
      initialLocale={locale}
      profileId={profileId}
      secondaryVertical={org?.secondaryVertical}
      profileOverrides={org?.profileOverrides}
    >
      <PermissionsProvider
        value={{
          permissions,
          isAdmin: session?.user?.role === "ADMIN",
        }}
      >
      <div className="admin-sans-headings flex h-screen overflow-hidden bg-background">
        {/* #99: registracija service workerja (push kanal, tiha napaka) */}
        <PushSetup />
        {/* Desktop Sidebar */}
        <AdminSidebar
          organizations={organizations}
          currentOrganizationId={org?.id ?? null}
        />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminHeader orgSlug={org?.slug} />
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
      </PermissionsProvider>
    </AdminI18nProvider>
  )
}
