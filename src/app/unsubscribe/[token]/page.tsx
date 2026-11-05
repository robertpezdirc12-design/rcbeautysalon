// #95 (AD-03): javna odjavna stran — žeton je HMAC-podpisan (org,
// e-pošta), stran je noindex in brez org konteksta (žeton je nosilec).

import { getUnsubscribePreview } from "@/app/actions/unsubscribe"
import { Card, CardContent } from "@/components/ui/card"

import { ConfirmUnsubscribe } from "./confirm-unsubscribe"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Odjava od e-pošte — MARKEC",
  robots: { index: false, follow: false },
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const preview = await getUnsubscribePreview(token)

  if (!preview.valid) {
    return (
      <main className="bg-background flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center">
            <p className="text-lg font-semibold">Povezava ni veljavna.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Povezava je morda nepopolna. Odprite najnovejše sporočilo in
              uporabite povezavo za odjavo iz njegovega noge.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-10 text-center">
          <h1 className="text-xl font-semibold">Odjava od e-pošte</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Želite prenehati prejemati marketinška sporočila od{" "}
            <strong className="text-foreground">{preview.businessName}</strong>{" "}
            na naslov{" "}
            <strong className="text-foreground">{preview.email}</strong>?
          </p>
          <div className="mt-6 flex justify-center">
            <ConfirmUnsubscribe token={token} />
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
