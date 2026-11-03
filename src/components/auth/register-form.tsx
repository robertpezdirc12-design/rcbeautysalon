"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import { SpinnerIcon } from "@/components/icons"
import { toast } from "sonner"
import { Logo } from "@/components/ui/logo"
import { registerSchema, type RegisterInput } from "@/lib/validations/auth"
import { registerUser } from "@/app/actions/auth"
import { useI18n } from "@/lib/i18n/provider"

export function RegisterForm() {
  const router = useRouter()
  // P1 #38 (re-audit 2026-11): callbackUrl (npr. košarica z zastavico
  // nadaljuj=1) se po uspešni registraciji prenese na prijavo — uporabnik
  // nadaljuje tam, kjer je končal.
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl")
  const { t } = useI18n()
  const [fallbackVerificationUrl, setFallbackVerificationUrl] = useState<
    string | null
  >(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data: RegisterInput) {
    const result = await registerUser(data)

    if (!result.success) {
      const errorMessage =
        result.errors?.[0]?.message || t.auth.register.toast.failedDescription
      toast.error(t.auth.register.toast.failed, {
        description: errorMessage,
      })
      return
    }

    // E-poštni servis ni konfiguriran — povezavo za potrditev pokaži direktno,
    // sicer uporabnik ostane brez dostopa (sporočilo nikoli ne prispe).
    if (!result.emailSent && result.verificationUrl) {
      setFallbackVerificationUrl(result.verificationUrl)
      return
    }

    toast.success(t.auth.register.toast.created, {
      description: t.auth.register.toast.createdDescription,
      duration: 6000,
    })

    // P1 #38: samo varne, relativne poti (odprto-preusmeritvena zaščita —
    // enaka pravila kot proxy za callbackUrl).
    const safeCallback =
      callbackUrl?.startsWith("/") &&
      !callbackUrl.startsWith("//") &&
      !callbackUrl.includes("\\")
        ? `?callbackUrl=${encodeURIComponent(callbackUrl)}`
        : ""
    router.push(`/login${safeCallback}`)
  }

  // Dostopen potrditveni korak, ko e-pošta ne deluje (pogojno, brez laži).
  if (fallbackVerificationUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="mb-6 flex justify-center">
              <Logo variant="auth" />
            </div>
            <CardTitle className="text-center text-2xl">
              {t.auth.register.fallbackTitle}
            </CardTitle>
            <CardDescription className="text-center">
              {t.auth.register.fallbackDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTitle>{t.auth.register.fallbackCta}</AlertTitle>
              <AlertDescription className="break-all">
                <Link
                  href={fallbackVerificationUrl}
                  className="text-primary-text font-medium underline underline-offset-4"
                >
                  {t.auth.register.fallbackLink}
                </Link>
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="justify-center">
            <Button asChild variant="outline">
              <Link href="/login">{t.auth.register.fallbackToLogin}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mb-6 flex justify-center">
            <Logo variant="auth" />
          </div>
          <CardTitle className="text-center text-2xl">
            {t.auth.register.createAccountTitle}
          </CardTitle>
          <CardDescription className="text-center">
            {t.auth.register.getStarted}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.auth.register.fullName}</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                disabled={isSubmitting}
                autoComplete="name"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-destructive text-sm">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.register.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                disabled={isSubmitting}
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-destructive text-sm">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.register.password}</Label>
              <Input
                id="password"
                type="password"
                disabled={isSubmitting}
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-destructive text-sm">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t.auth.register.confirmPassword}</Label>
              <Input
                id="confirmPassword"
                type="password"
                disabled={isSubmitting}
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-destructive text-sm">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              className="w-full"
              size="lg"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <SpinnerIcon
                  size={16}
                  weight="bold"
                  className="mr-2 animate-spin"
                />
              )}
              {t.auth.register.createAccountBtn}
            </Button>

            <Separator />

            <div className="text-muted-foreground text-center text-sm">
              {t.auth.register.haveAccount}{" "}
              <Link
                href="/login"
                className="text-primary-text font-medium hover:underline"
              >
                {t.auth.register.signIn}
              </Link>
            </div>

            <div className="text-center">
              <Link
                href="/"
                className="text-muted-foreground hover:text-primary-text text-sm"
              >
                {t.auth.register.backToHome}
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
