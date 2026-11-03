import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EnvelopeIcon } from "@/components/icons"
import { getAdminUsers, getCustomerLeads, getUserStats } from "@/app/actions/users"
import { UserSearch } from "@/components/dashboard/user-search"
import { ExportUsersButton } from "@/components/dashboard/export-users-button"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"

interface UsersPageProps {
  searchParams: Promise<{ search?: string }>
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  // Custom roles (G8): server-side page guard
  await requirePagePermission("customers.manage")
  const { search } = await searchParams
  const [{ t, locale }, users, leads, stats] = await Promise.all([
    getServerI18n(),
    getAdminUsers(search),
    // P2 #48: linke iz javnih obrazcev (Customer brez računa) — prej so
    // bili nevidni, ker je seznam gradil izključno iz User vrstic.
    getCustomerLeads(search),
    getUserStats(),
  ])
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t.users.title}{" "}
            <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
              {t.users.titleAccent}
            </span>
          </h1>
          <p className="text-muted-foreground">
            {t.users.subtitle}
          </p>
        </div>
        <ExportUsersButton users={users} />
      </div>

      {/* Stats Cards — P2 #48: števec odraža stranke (vključno z linki brez
          računa), ne samo registrirane račune */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.users.stats.totalCustomersLabel}</CardDescription>
            <CardTitle className="text-3xl">{stats.totalCustomers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.users.stats.activeSessions}</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.activeThisMonth}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.users.stats.newThisMonth}</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{stats.newThisMonth}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.users.stats.leadsWithoutAccount}</CardDescription>
            <CardTitle className="text-3xl">{stats.leadsWithoutAccount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <UserSearch />

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t.users.allUsersTitle}</CardTitle>
          <CardDescription>{t.users.allUsersDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t.users.noUsersFound}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">{t.users.table.user}</th>
                    <th className="pb-3 font-medium">{t.users.table.email}</th>
                    <th className="pb-3 font-medium">{t.users.table.role}</th>
                    <th className="pb-3 font-medium">{t.users.table.appointments}</th>
                    <th className="pb-3 font-medium">{t.users.table.orders}</th>
                    <th className="pb-3 font-medium">{t.users.table.joined}</th>
                    <th className="pb-3 font-medium">{t.users.table.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          {user.image ? (
                            <div className="relative h-10 w-10 overflow-hidden rounded-full">
                              <Image
                                src={user.image}
                                alt={user.name || t.users.altUser}
                                fill
                                className="object-cover"

              sizes="40px"/>
                            </div>
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary-text">
                              {user.name?.split(" ").map(n => n[0]).join("") || "?"}
                            </div>
                          )}
                          <p className="font-medium">{user.name || t.users.noName}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1 text-sm">
                          <EnvelopeIcon size={12} className="text-muted-foreground" />
                          <span>{user.email}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          user.role === "ADMIN"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                            : user.role === "STAFF"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        }`}>
                          {t.users.roleLabel(user.role)}
                        </span>
                      </td>
                      <td className="py-4 text-sm">{user.customer?._count.appointments || 0}</td>
                      <td className="py-4 text-sm">{user.customer?._count.orders || 0}</td>
                      <td className="py-4 text-sm">
                        {new Date(user.createdAt).toLocaleDateString(locale === "sl" ? "sl-SI" : "en-US")}
                      </td>
                      <td className="py-4">
                        <Link href={`/dashboard/users/${user.id}`}>
                          <Button variant="ghost" size="sm">
                            {t.common.actions.view}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* P2 #48: linke iz javnih obrazcev — stranke BREZ računa. Prej je
          povpraševanje ustvarilo Customer vrstico, ki pod "Stranke" ni bila
          nikoli vidna (seznam je gradil izključno iz User vrstic). */}
      <Card>
        <CardHeader>
          <CardTitle>{t.users.leads.title}</CardTitle>
          <CardDescription>{t.users.leads.desc}</CardDescription>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t.users.leads.empty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">{t.users.leads.table.customer}</th>
                    <th className="pb-3 font-medium">{t.users.table.email}</th>
                    <th className="pb-3 font-medium">{t.users.table.appointments}</th>
                    <th className="pb-3 font-medium">{t.users.table.orders}</th>
                    <th className="pb-3 font-medium">{t.users.leads.table.submissions}</th>
                    <th className="pb-3 font-medium">{t.users.table.joined}</th>
                    <th className="pb-3 font-medium">{t.users.table.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b last:border-0">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary-text">
                            {lead.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"}
                          </div>
                          <div>
                            <p className="font-medium">{lead.name}</p>
                            <Badge variant="outline" className="mt-0.5 text-xs font-normal">
                              {t.users.leads.badge}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-sm">
                        <div className="flex flex-col gap-0.5">
                          {lead.email && (
                            <div className="flex items-center gap-1">
                              <EnvelopeIcon size={12} className="text-muted-foreground" />
                              <span>{lead.email}</span>
                            </div>
                          )}
                          {lead.phone && (
                            <span className="text-muted-foreground">{lead.phone}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-sm">{lead._count.appointments}</td>
                      <td className="py-4 text-sm">{lead._count.orders}</td>
                      <td className="py-4 text-sm">{lead._count.formSubmissions}</td>
                      <td className="py-4 text-sm">
                        {new Date(lead.createdAt).toLocaleDateString(locale === "sl" ? "sl-SI" : "en-US")}
                      </td>
                      <td className="py-4">
                        {/* Oddaje javnih obrazcev so v predalu Obrazci —
                            vodi Lastnika direktno k evidence linka. */}
                        <Link href="/dashboard/forms">
                          <Button variant="ghost" size="sm">
                            {t.users.leads.viewSubmissions}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
