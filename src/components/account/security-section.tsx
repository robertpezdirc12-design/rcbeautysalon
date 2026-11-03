"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { sendPasswordResetFromAccount } from "@/app/actions/account"
import { LockIcon } from "@/components/icons/lock-icon"
import { EnvelopeIcon } from "@/components/icons/envelope-icon"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { SecuritySectionProps } from "@/lib/interfaces"

export function SecuritySection({ email }: SecuritySectionProps) {
  const [isSending, setIsSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handleSendResetEmail() {
    setIsSending(true)
    try {
      const result = await sendPasswordResetFromAccount()

      if (result.success) {
        setEmailSent(true)
        toast.success("E-poštno sporočilo za ponastavitev gesla poslano", {
          description:
            "Preverite svojo mapo »Prejeto« za navodila za ponastavitev gesla.",
        })
      } else {
        toast.error(result.error || "Pošiljanje e-poštnega sporočila za ponastavitev ni uspelo")
      }
    } catch {
      toast.error("Prišlo je do napake")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <LockIcon size={20} className="text-primary-text" />
          <CardTitle className="text-lg">Varnost</CardTitle>
        </div>
        <CardDescription>
          Upravljajte svoje geslo in varnostne nastavitve
        </CardDescription>
      </CardHeader>
      <CardContent>
        {emailSent ? (
          <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/20">
            <div className="flex items-center gap-2">
              <EnvelopeIcon
                size={20}
                className="text-green-600 dark:text-green-400"
              />
              <p className="font-semibold text-green-900 dark:text-green-100">
                E-poštno sporočilo poslano!
              </p>
            </div>
            <p className="mt-2 text-sm text-green-800 dark:text-green-200">
              Povezavo za ponastavitev gesla smo poslali na <strong>{email}</strong>.
              Preverite svojo mapo »Prejeto« in sledite navodilom.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setEmailSent(false)}
            >
              Pošlji znova
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Geslo</p>
                <p className="text-muted-foreground text-sm">
                  Zaščitite svoj račun z močnim geslom
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleSendResetEmail}
                disabled={isSending}
              >
                {isSending && (
                  <SpinnerIcon size={16} className="mr-2 animate-spin" />
                )}
                Spremeni geslo
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Varno povezavo za ponastavitev gesla bomo poslali na vaš
              e-poštni naslov ({email}).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
