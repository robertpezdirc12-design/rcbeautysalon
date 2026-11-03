import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/icons"
import { getUserById } from "@/app/actions/users"
import { UserEditForm } from "@/components/dashboard/user-edit-form"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"

interface EditUserPageProps {
  params: Promise<{ id: string }>
}

export default async function EditUserPage({ params }: EditUserPageProps) {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("customers.manage")
  const { t } = await getServerI18n()
  const { id } = await params
  const user = await getUserById(id)

  if (!user) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/users/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeftIcon size={20} />
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          {user.image ? (
            <div className="relative h-12 w-12 overflow-hidden rounded-full">
              <Image
                src={user.image}
                alt={user.name || t.users.altUser}
                fill
                className="object-cover"
              
              sizes="80px"/>
            </div>
          ) : (
            <div className="bg-primary/10 text-primary-text flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold">
              {user.name
                ?.split(" ")
                .map((n) => n[0])
                .join("") || "U"}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{t.users.editUser}</h1>
            <p className="text-muted-foreground">{user.name || user.email}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <UserEditForm
        userId={user.id}
        currentRole={user.role}
        currentNotes={user.customer?.notes || ""}
        hasCustomer={!!user.customer}
        userName={user.name || user.email}
      />
    </div>
  )
}
