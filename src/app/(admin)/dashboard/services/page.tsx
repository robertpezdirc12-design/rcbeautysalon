import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ScissorsIcon,
  PlusIcon,
  PencilIcon,
  EyeIcon,
} from "@/components/icons"
import { getAdminServices, getServiceStats } from "@/app/actions/services"
import { formatCurrency } from "@/lib/utils/format"
import { ServiceSearch } from "@/components/dashboard/service-search"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"
import { getSessionOrg } from "@/lib/tenant"

interface ServicesPageProps {
  searchParams: Promise<{ search?: string }>
}

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("services.manage")
  // P2 #72: "javna stran" gumb vodi na najemnikovo KANONIČNO pot
  // (/s/<slug>/services/...) — gola /services/... je od #72 platformska
  // 404, prej pa je odpirala napačen (najstarejši) najemnik.
  const org = await getSessionOrg()
  const params = await searchParams
  const search = params.search || ""

  const [services, stats, { t, withBusiness }] = await Promise.all([
    getAdminServices(search),
    getServiceStats(),
    getServerI18n(),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t.services.title}{" "}
            <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
              {t.services.titleAccent}
            </span>
          </h1>
          <p className="text-muted-foreground">{withBusiness(t.services.subtitle)}</p>
        </div>
        <Link href="/dashboard/services/new">
          <Button>
            <PlusIcon size={16} className="mr-2" />
            {t.services.addService}
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.services.totalServices}</CardDescription>
            <CardTitle className="text-3xl">{stats.totalServices}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.services.activeServices}</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {stats.activeServices}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.services.featured}</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {stats.featuredServices}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.services.categories}</CardDescription>
            <CardTitle className="text-3xl">{stats.categoriesCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <ServiceSearch initialSearch={search} />

      {/* Services Grid */}
      {services.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ScissorsIcon size={48} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg">
              {search ? t.services.noServicesFound : t.services.noServicesYet}
            </p>
            {!search && (
              <Link href="/dashboard/services/new" className="mt-4">
                <Button>
                  <PlusIcon size={16} className="mr-2" />
                  {t.services.addFirstService}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id} className="overflow-hidden">
              <div className="relative aspect-video bg-muted">
                {service.imageUrl ? (
                  <Image
                    src={service.imageUrl}
                    alt={service.name}
                    fill
                    className="object-cover"
                  
              sizes="64px"/>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ScissorsIcon size={48} className="text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-2">
                  {service.isFeatured && (
                    <Badge className="bg-primary text-primary-foreground">
                      {t.services.featuredBadge}
                    </Badge>
                  )}
                  {!service.isActive && (
                    <Badge variant="secondary">{t.services.inactiveBadge}</Badge>
                  )}
                </div>
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <CardDescription>{service.category?.name}</CardDescription>
                  </div>
                  <p className="text-primary-text text-xl font-bold">
                    {formatCurrency(service.price)}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground space-y-1 text-sm">
                    <p>{t.services.durationMinutes(service.duration)}</p>
                    <p>
                      {t.services.bookingsCount(service._count.appointmentServices)} •{" "}
                      {t.services.staffCount(service._count.staffServices)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Link href={org ? `/s/${org.slug}/services/${service.slug}` : "#"}>
                      <Button variant="ghost" size="icon" title={t.services.viewPublicPage}>
                        <EyeIcon size={16} />
                      </Button>
                    </Link>
                    <Link href={`/dashboard/services/${service.id}/edit`}>
                      <Button variant="ghost" size="icon" title={t.services.editService}>
                        <PencilIcon size={16} />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
