"use client"

import { useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { sl } from "date-fns/locale"
import { toast } from "sonner"
import { updateProfileImage } from "@/app/actions/account"
import { CameraIcon } from "@/components/icons/camera-icon"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { ProfileHeaderProps } from "@/lib/interfaces"

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = profile.name
    ? profile.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : profile.email[0].toUpperCase()

  const displayImage = previewUrl || profile.image

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Izberite slikovno datoteko")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Slika mora biti manjša od 5 MB")
      return
    }

    // Show preview
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    setIsUploading(true)

    try {
      // Upload to API
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Nalaganje ni uspelo")
      }

      // Update database
      const result = await updateProfileImage(data.url)

      if (result.success) {
        toast.success("Profilna fotografija posodobljena")
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(
        error instanceof Error ? error.message : "Nalaganje slike ni uspelo"
      )
      setPreviewUrl(null)
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <Card className="border-2">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* Avatar with Edit Button */}
          <div className="relative">
            <Avatar className="border-primary/20 h-24 w-24 border-4">
              <AvatarImage
                src={displayImage || undefined}
                alt={profile.name || "Uporabnik"}
              />
              <AvatarFallback className="bg-primary/10 text-primary-text text-2xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Camera Button Overlay */}
            <Button
              size="icon"
              variant="secondary"
              className="absolute -right-1 -bottom-1 h-8 w-8 rounded-full shadow-md"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <SpinnerIcon size={14} className="animate-spin" />
              ) : (
                <CameraIcon size={14} />
              )}
            </Button>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-2xl font-bold">{profile.name || "Uporabnik"}</h2>
            <p className="text-muted-foreground">{profile.email}</p>
            <p className="text-muted-foreground mt-2 text-sm">
              Član od {format(new Date(profile.createdAt), "MMMM yyyy", { locale: sl })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
