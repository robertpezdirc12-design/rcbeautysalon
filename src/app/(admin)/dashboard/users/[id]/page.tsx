import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeftIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon,
  ClockIcon,
  PencilIcon,
  LockIcon,
} from "@/components/icons"
import { getUserById, getCustomerTotalSpent } from "@/app/actions/users"
import { ResetPasswordDialog } from "@/components/dashboard/reset-password-dialog"
import { auth } from "@/lib/auth/auth"
import { formatSalonTime } from "@/lib/booking-time"
import { getSessionSalonTimezone } from "@/lib/tenant"
import { formatCurrency, formatDateStandard } from "@/lib/utils/format"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-500 text-white",
  STAFF: "bg-blue-500 text-white",
  CLIENTE: "bg-green-500 text-white",
}

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-500 text-white",
  CONFIRMED: "bg-blue-500 text-white",
  COMPLETED: "bg-green-500 text-white",
  CANCELLED: "bg-red-500 text-white",
  NO_SHOW: "bg-gray-500 text-white",
}

const orderStatusColors: Record<string, string> = {
  PENDING: "bg-amber-500 text-white",
  PAID: "bg-blue-500 text-white",
  COMPLETED: "bg-green-500 text-white",
  CANCELLED: "bg-red-500 text-white",
  REFUNDED: "bg-gray-500 text-white",
}

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { t } = await getServerI18n()
  const user = await getUserById(id)

  if (!user) {
    return {
      title: t.users.userNotFound,
    }
  }

  return {
    title: t.users.userMetaTitle(user.name ?? t.users.altUser),
    description: t.users.userMetaDesc(user.name ?? t.users.altUser),
  }
}

export default async function UserDetailsPage({ params }: PageProps) {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("customers.manage")
  const [{ t, locale }, salonTz, session] = await Promise.all([
    getServerI18n(),
    getSessionSalonTimezone(),
    auth(),
  ])
  const { id } = await params
  const user = await getUserById(id)

  if (!user) {
    notFound()
  }

  // Get total spent if user has a customer profile
  const totalSpent = user.customer
    ? await getCustomerTotalSpent(user.customer.id)
    : 0

  const appointments = user.customer?.appointments || []
  const orders = user.customer?.orders || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/users">
            <Button variant="ghost" size="icon">
              <ArrowLeftIcon size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{t.users.userDetails}</h1>
            <p className="text-muted-foreground">
              {t.users.memberSince(formatDateStandard(new Date(user.createdAt), locale))}
            </p>
          </div>
        </div>
        <Link href={`/dashboard/users/${id}/edit`}>
          <Button>
            <PencilIcon size={16} className="mr-2" />
            {t.users.editUser}
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Recent Appointments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon size={20} />
                {t.users.recentAppointments}
                {appointments.length > 0 && (
                  <Badge variant="secondary">{appointments.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t.users.noAppointmentsFound}
                </p>
              ) : (
                <div className="space-y-4">
                  {appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">
                          {apt.services.map((s) => s.service.name).join(", ")}
                        </p>
                        <div className="text-muted-foreground flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <CalendarIcon size={14} />
                            {formatDateStandard(new Date(apt.startTime), locale)}
                          </span>
                          <span className="flex items-center gap-1">
                            <ClockIcon size={14} />
                            {formatSalonTime(new Date(apt.startTime), salonTz)}
                          </span>
                          <span>{t.users.withStaff(apt.staff.name)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusColors[apt.status]}`}
                        >
                          {t.common.status[apt.status]}
                        </span>
                        <Link href={`/dashboard/appointments/${apt.id}`}>
                          <Button variant="outline" size="sm">
                            {t.common.actions.view}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                  {appointments.length >= 10 && (
                    <Link
                      href={`/dashboard/appointments?customerId=${user.customer?.id}`}
                    >
                      <Button variant="link" className="w-full">
                        {t.users.viewAllAppointments}
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBagIcon size={20} />
                {t.users.recentOrders}
                {orders.length > 0 && (
                  <Badge variant="secondary">{orders.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t.users.noOrdersFound}</p>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">
                          {t.users.orderNumber(order.id.slice(-8))}
                        </p>
                        <div className="text-muted-foreground text-sm">
                          <span>
                            {t.users.itemCount(order.items.length)} •{" "}
                            {formatDateStandard(new Date(order.createdAt), locale)}
                          </span>
                        </div>
                        <p className="text-sm">
                          {order.items
                            .map((item) => item.product.name)
                            .join(", ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(order.total.toNumber())}
                          </p>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${orderStatusColors[order.status]}`}
                          >
                            {t.users.orderStatus[order.status]}
                          </span>
                        </div>
                        <Link href={`/dashboard/orders/${order.id}`}>
                          <Button variant="outline" size="sm">
                            {t.common.actions.view}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                  {orders.length >= 10 && (
                    <Link
                      href={`/dashboard/orders?customerId=${user.customer?.id}`}
                    >
                      <Button variant="link" className="w-full">
                        {t.users.viewAllOrders}
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon size={20} />
                {t.users.profile}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Avatar & Name */}
              <div className="flex items-center gap-4">
                {user.image ? (
                  <div className="relative h-16 w-16 overflow-hidden rounded-full">
                    <Image
                      src={user.image}
                      alt={user.name || t.users.altUser}
                      fill
                      className="object-cover"
                    
              sizes="80px"/>
                  </div>
                ) : (
                  <div className="bg-primary/10 text-primary-text flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold">
                    {user.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("") || "U"}
                  </div>
                )}
                <div>
                  <p className="text-lg font-semibold">{user.name}</p>
                  <Badge className={roleColors[user.role]}>
                    {t.users.roleLabel(user.role)}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Contact Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <EnvelopeIcon size={16} className="text-muted-foreground" />
                  <span>{user.email}</span>
                  {user.emailVerified && (
                    <Badge variant="outline" className="text-green-600">
                      {t.users.verified}
                    </Badge>
                  )}
                </div>
                {user.customer?.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <PhoneIcon size={16} className="text-muted-foreground" />
                    <span>{user.customer.phone}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Customer Stats */}
          {user.customer && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CurrencyDollarIcon size={20} />
                  {t.users.customerStats}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-primary-text text-2xl font-bold">
                      {appointments.length}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t.users.appointmentsLabel}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-primary-text text-2xl font-bold">
                      {orders.length}
                    </p>
                    <p className="text-muted-foreground text-xs">{t.users.ordersLabel}</p>
                  </div>
                </div>
                <Separator />
                <div className="text-center">
                  <p className="text-muted-foreground text-sm">{t.users.totalSpent}</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(totalSpent)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Staff Info */}
          {user.staff && (
            <Card>
              <CardHeader>
                <CardTitle>{t.users.staffProfile}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  <span className="text-muted-foreground">{t.users.position}</span>{" "}
                  <span className="font-medium">{t.users.staffMember}</span>
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t.users.statusLabel}</span>
                  <Badge
                    variant={user.staff.isActive ? "default" : "secondary"}
                  >
                    {user.staff.isActive ? t.users.active : t.users.inactive}
                  </Badge>
                </div>
                {user.staff.bio && (
                  <p className="text-muted-foreground text-sm">
                    {user.staff.bio}
                  </p>
                )}
                <Link href={`/dashboard/staff/${user.staff.id}`}>
                  <Button variant="outline" className="w-full" size="sm">
                    {t.users.viewStaffProfile}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t.users.accountInfo}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2 text-sm">
              <p>
                <span className="font-medium">{t.users.userId}</span>{" "}
                {user.id.slice(-8)}
              </p>
              <p>
                <span className="font-medium">{t.users.created}</span>{" "}
                {formatDateStandard(new Date(user.createdAt), locale)}
              </p>
              <p>
                <span className="font-medium">{t.users.lastUpdated}</span>{" "}
                {formatDateStandard(new Date(user.updatedAt), locale)}
              </p>
            </CardContent>
          </Card>

          {/* Password reset (admin helper) — not for self, not for other admins */}
          {session?.user?.id !== user.id && user.role !== "ADMIN" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LockIcon size={20} />
                  {t.users.resetPassword.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResetPasswordDialog userId={user.id} userName={user.name || user.email} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
