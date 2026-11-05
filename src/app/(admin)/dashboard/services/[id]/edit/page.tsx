import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/icons"
import { ServiceForm } from "@/components/dashboard/service-form"
import { ServiceAddonsEditor } from "@/components/dashboard/service-addons-editor"
import { ServiceIntakeFormPicker } from "@/components/dashboard/service-intake-form-picker"
import {
  getServiceById,
  getAllCategories,
  getAllActiveStaff,
  getServiceAddonsForEdit,
  getIntakeFormOptions,
} from "@/app/actions/services"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"

interface EditServicePageProps {
  params: Promise<{ id: string }>
}

export default async function EditServicePage({ params }: EditServicePageProps) {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("services.manage")
  const { id } = await params

  // Fetch service, categories, staff, addons and intake options in parallel
  const [service, categories, staff, addons, intakeOptions, { t }] = await Promise.all([
    getServiceById(id),
    getAllCategories(),
    getAllActiveStaff(),
    // #92: dodatki za urejevalnik (org-scoped)
    getServiceAddonsForEdit(id),
    // #96: sprejemni obrazci za izbiro (org-scoped)
    getIntakeFormOptions(),
    getServerI18n(),
  ])

  if (!service) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/services">
          <Button variant="ghost" size="icon">
            <ArrowLeftIcon size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{t.services.editTitle}</h1>
          <p className="text-muted-foreground">{service.name}</p>
        </div>
      </div>

      {/* Form */}
      <ServiceForm
        categories={categories}
        staff={staff}
        service={service}
        mode="edit"
      />

      {/* #92: dodatki — urejajo se ločeno od storitve (replace-all) */}
      <ServiceAddonsEditor serviceId={service.id} initialAddons={addons} />

      {/* #96: sprejemni obrazec — gost izpolni ob rezervaciji */}
      <ServiceIntakeFormPicker
        serviceId={service.id}
        currentFormId={service.intakeFormDefinitionId}
        options={intakeOptions}
      />
    </div>
  )
}
