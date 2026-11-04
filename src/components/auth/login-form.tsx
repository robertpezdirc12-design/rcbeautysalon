"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { SpinnerIcon } from "@/components/icons"
import { toast } from "sonner"
import { Logo } from "@/components/ui/logo"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"
import { useI18n } from "@/lib/i18n/provider"

interface LoginFormProps {
  orgName?: string | null
  orgLogo?: string | null
  orgSlug?: string | null
}

export function LoginForm({ orgName, orgLogo, orgSlug }: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useI18n()
  // update() re-fetches the session so the SessionProvider context matches
  // the fresh cookie immediately (cart/checkout read it client-side).
  const { update } = useSession()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  // P2 #74: najemniško označena prijava (?org=) je VRATA STRANKE — iz nje
  // je gost prišel prek "Prijava" v nogi najemnikove strani. Nikoli ne
  // ponujaj provider CTA-ja ("Ustvari svoje podjetje") nekomu, ki kupuje
  // med; pot nazaj je trgovina, ne platforma. Nevtralni /login ostane
  // platformina lastna vrata (obe poti sta tam legitimni, glej #68).
  const isTenantContext =
    Boolean(orgSlug) || Boolean(callbackUrl.startsWith("/s/"))

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginInput) {
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        // Check if error is about email verification
        if (result.code === "EMAIL_NOT_VERIFIED" || result.error.includes("EMAIL_NOT_VERIFIED")) {
          toast.error(t.auth.login.toast.verifyRequired, {
            description: t.auth.login.toast.verifyDescription,
            duration: 8000,
          })
          return
        }

        // Show generic error for invalid credentials
        toast.error(t.auth.login.toast.loginFailed, {
          description: t.auth.login.toast.invalidCredentials,
        })
        return
      } else {
        // Sync the SessionProvider context BEFORE navigating — without
        // update() client consumers (useSession) stay unauthenticated and
        // flows like the cart would bounce straight back to /login.
        await update()
        toast.success(t.auth.login.toast.loginSuccess, {
          description: t.auth.login.toast.redirecting,
        })
        router.push(callbackUrl)
        router.refresh()
      }
    } catch (error) {
      console.log("Login error:", error)
      toast.error(t.auth.login.toast.loginFailed, {
        description: t.auth.login.toast.somethingWrong,
      })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mb-6 flex flex-col items-center gap-2">
            <Logo variant="auth" src={orgLogo ?? undefined} alt={orgName ?? undefined} />
            {orgName && orgSlug && (
              <Link
                href={`/s/${orgSlug}`}
                className="text-muted-foreground hover:text-primary-text text-sm transition-colors"
              >
                ← Nazaj v trgovino · {orgName}
              </Link>
            )}
          </div>
          <CardTitle className="text-center text-2xl">{t.auth.login.welcomeBack}</CardTitle>
          <CardDescription className="text-center">
            {t.auth.login.signInSubtitle}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.login.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder="ime@primer.si"
                disabled={isSubmitting}
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t.auth.login.password}</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground hover:text-primary-text"
                >
                  {t.auth.login.forgotPassword}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                disabled={isSubmitting}
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <SpinnerIcon size={16} weight="bold" className="mr-2 animate-spin" />
              )}
              {t.auth.login.signIn}
            </Button>

            <Separator />

            <div className="text-center text-sm text-muted-foreground">
              {t.auth.login.noAccount}{" "}
              <Link href="/register" className="font-medium text-primary-text hover:underline">
                {t.auth.login.createAccount}
              </Link>
            </div>

            {/* P2 #74: provider CTA izključno v nevtralnem kontekstu —
                najemniška prijava ne sme vabiti gosta k ustvarjanju
                lastnega podjetja. */}
            {!isTenantContext && (
              <div className="text-center text-sm text-muted-foreground">
                {t.auth.login.ownSalon}{" "}
                {/* P2 #68: nevtralni CTA — platforma najema strani vsem obrtom. */}
                <Link href="/start" className="font-medium text-primary-text hover:underline">
                  Ustvari svoje podjetje
                </Link>
              </div>
            )}

            <div className="text-center">
              <Link href="/" className="text-sm text-muted-foreground hover:text-primary-text">
                {t.auth.login.backToHome}
              </Link>
            </div>

            {/* Demo credentials are a DEVELOPMENT aid only. They must never
                render in production — printed admin passwords on a public
                login page let anyone log in (security + professionalism). */}
            {process.env.NODE_ENV !== "production" && (
              <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                <p className="font-semibold mb-2">{t.auth.login.demoCredentials}</p>
                <div className="space-y-2">
                  <div>
                    <p className="font-medium text-foreground">{t.auth.login.adminFullAccess}</p>
                    <p>admin@rcbeautysalon.org / admin123</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{t.auth.login.staffAccess}</p>
                    <p>staff@rcbeautysalon.org / staff123</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{t.auth.login.clientAccess}</p>
                    <p>cliente@rcbeautysalon.org / cliente123</p>
                  </div>
                </div>
              </div>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
