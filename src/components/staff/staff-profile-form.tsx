"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  SpinnerIcon,
  UserIcon,
  PencilIcon,
  EnvelopeIcon,
  PhoneIcon,
} from "@/components/icons"
import {
  staffSelfUpdateSchema,
  type StaffSelfUpdateFormData,
} from "@/lib/validations/staff"

interface StaffProfileData {
  id: string
  name: string
  email: string | null
  phone: string | null
  bio: string | null
}

interface StaffProfileFormProps {
  profile: StaffProfileData | null
}

export function StaffProfileForm({ profile }: StaffProfileFormProps) {
  const [isEditing, setIsEditing] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<StaffSelfUpdateFormData>({
    resolver: zodResolver(staffSelfUpdateSchema),
    defaultValues: {
      name: profile?.name || "",
      phone: profile?.phone || "",
      bio: profile?.bio || "",
    },
  })

  if (!profile) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Profil ni bil najden</p>
        </CardContent>
      </Card>
    )
  }

  async function onSubmit(data: StaffSelfUpdateFormData) {
    // TODO: Implement - call updateStaffProfile server action
    // const result = await updateStaffProfile(data)
    // if (result.success) {
    //   toast.success("Profile updated successfully")
    //   setIsEditing(false)
    // } else {
    //   toast.error(result.error || "Failed to update profile")
    // }
    console.log("Form data:", data)
    toast.success("Profil posodobljen")
    setIsEditing(false)
  }

  function handleCancel() {
    reset()
    setIsEditing(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserIcon size={20} className="text-primary-text" />
            <CardTitle className="text-lg">Osebni podatki</CardTitle>
          </div>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <PencilIcon size={16} className="mr-1" />
              Uredi
            </Button>
          )}
        </div>
        <CardDescription>
          {isEditing ? "Posodobite svoje profilne podatke" : "Vaši profilni podatki"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <UserIcon size={14} className="text-muted-foreground" />
                Ime in priimek
              </Label>
              <Input
                id="name"
                {...register("name")}
                disabled={isSubmitting}
                className="h-11"
              />
              {errors.name && (
                <p className="text-destructive text-sm">{errors.name.message}</p>
              )}
            </div>

            {/* Email - Read only */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <EnvelopeIcon size={14} className="text-muted-foreground" />
                E-pošta
              </Label>
              <Input
                id="email"
                value={profile.email || ""}
                disabled
                className="bg-muted/50 h-11"
              />
              <p className="text-muted-foreground text-xs">
                Za spremembo e-poštnega naslova se obrnite na skrbnika
              </p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <PhoneIcon size={14} className="text-muted-foreground" />
                Telefon
              </Label>
              <Input
                id="phone"
                {...register("phone")}
                placeholder="041 234 567"
                disabled={isSubmitting}
                className="h-11"
              />
              {errors.phone && (
                <p className="text-destructive text-sm">
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Predstavitev</Label>
              <Textarea
                id="bio"
                {...register("bio")}
                placeholder="Predstavite se strankam: vaše izkušnje in specializacije …"
                rows={4}
                disabled={isSubmitting}
                className="resize-none"
              />
              {errors.bio && (
                <p className="text-destructive text-sm">{errors.bio.message}</p>
              )}
              <p className="text-muted-foreground text-xs">
                To bo prikazano na vaši javni profilni strani
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t pt-5">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 min-w-[120px]"
              >
                {isSubmitting && (
                  <SpinnerIcon size={16} className="mr-2 animate-spin" />
                )}
                Shrani spremembe
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="h-11"
              >
                Prekliči
              </Button>
            </div>
          </form>
        ) : (
          <dl className="space-y-5">
            <div className="bg-muted/30 rounded-lg p-4">
              <dt className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <UserIcon size={14} />
                Ime in priimek
              </dt>
              <dd className="mt-1 font-medium">{profile.name}</dd>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <dt className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <EnvelopeIcon size={14} />
                E-pošta
              </dt>
              <dd className="mt-1">{profile.email || "Ni nastavljeno"}</dd>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <dt className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <PhoneIcon size={14} />
                Telefon
              </dt>
              <dd className="mt-1">{profile.phone || "Ni nastavljeno"}</dd>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <dt className="text-muted-foreground text-sm font-medium">Predstavitev</dt>
              <dd className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {profile.bio || "Predstavitev še ni dodana"}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
