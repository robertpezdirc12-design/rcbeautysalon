"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import Link from "next/link"
import { SpinnerIcon, LockIcon } from "@/components/icons"
import { Logo } from "@/components/ui/logo"
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { resetPassword } from "@/app/actions/auth"
import { ResetPasswordFormProps } from "@/lib/interfaces"
import { useI18n } from "@/lib/i18n/provider"

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter()
  const { t } = useI18n()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token,
    },
  })

  async function onSubmit(data: ResetPasswordInput) {
    const result = await resetPassword(data)

    if (!result?.success) {
      toast.error(t.auth.reset.toast.error, { description: result?.errors?.[0]?.message })
      return
    }

    toast.success(t.auth.reset.toast.success, {
      description: t.auth.reset.toast.successDescription,
    })

    router.push("/login")
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mb-6 flex justify-center">
            <Logo variant="auth" />
          </div>
          <CardTitle className="text-center text-2xl">
            {t.auth.reset.title}
          </CardTitle>
          <CardDescription className="text-center">
            {t.auth.reset.description}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <input type="hidden" {...register("token")} />
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.reset.newPassword}</Label>
              <div className="relative">
                <LockIcon
                  size={18}
                  className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
                />
                <Input
                  id="password"
                  type="password"
                  placeholder={t.auth.reset.newPasswordPlaceholder}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  className="pl-10"
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <p className="text-destructive text-sm">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t.auth.reset.confirmPassword}</Label>
              <div className="relative">
                <LockIcon
                  size={18}
                  className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
                />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t.auth.reset.confirmPlaceholder}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  className="pl-10"
                  {...register("confirmPassword")}
                />
              </div>
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
              {t.auth.reset.resetBtn}
            </Button>

            <Separator />

            <div className="text-muted-foreground text-center text-sm">
              <Link
                href="/login"
                className="text-primary-text font-medium hover:underline"
              >
                {t.auth.reset.backToLogin}
              </Link>
            </div>

            <div className="text-center">
              <Link
                href="/"
                className="text-muted-foreground hover:text-primary-text text-sm"
              >
                {t.auth.forgot.backToHome}
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
