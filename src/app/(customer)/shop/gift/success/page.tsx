import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import { getPublicOrg } from "@/lib/tenant"
import { orgPath } from "@/lib/org-path"
import { activatePrepaidPurchase } from "@/app/actions/prepaid"
import { formatCurrency } from "@/lib/utils/format"

// #80: USPEŠNA STRAN nakupa darilnega bona. Aktivacija je IDEMPOTENTNA
// (webhook je lahko že poskrbel; updateMany status PENDING varuje pred
// dvojno aktivacijo). Koda se pokaže tukaj IN pošlje po e-pošti.
export default async function GiftCardSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id: sessionId } = await searchParams

  let code: string | null = null
  let faceValue: number | null = null
  let expiresAt: Date | null = null
  let notFound = !sessionId

  if (sessionId) {
    // Fallback aktivacija (webhook morda še ni prišel) — idempotentna.
    await activatePrepaidPurchase(sessionId).catch(() => undefined)

    const purchase = await prisma.prepaidPurchase.findFirst({
      where: { stripeSessionId: sessionId },
      include: { prepaidProduct: true },
    })
    if (purchase) {
      code = purchase.code
      faceValue = purchase.prepaidProduct.faceValue
        ? purchase.prepaidProduct.faceValue.toNumber()
        : purchase.prepaidProduct.price.toNumber()
      expiresAt = purchase.expiresAt
    } else {
      notFound = true
    }
  }

  const org = await getPublicOrg()

  return (
    <div className="bg-background flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mb-2 text-5xl">🎁</div>
          <CardTitle className="text-2xl">
            {notFound ? "Darilni bon" : "Hvala za nakup!"}
          </CardTitle>
          <CardDescription>
            {notFound
              ? "Plačila ni bilo mogoče potrditi. Če ste plačali, bo bon aktiviran samodejno — poskusite osvežiti stran."
              : "Vaš darilni bon je aktiven. Kodo smo poslali tudi po e-pošti."}
          </CardDescription>
        </CardHeader>
        {code && (
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-6">
              <p className="text-muted-foreground text-xs">Vrednost bona</p>
              <p className="text-2xl font-bold">
                {formatCurrency(faceValue ?? 0)}
              </p>
              <p className="text-muted-foreground mt-3 text-xs">Koda bona</p>
              <p className="text-xl font-bold tracking-widest">{code}</p>
            </div>
            <p className="text-muted-foreground text-xs">
              {expiresAt
                ? `Bon velja do ${expiresAt.toLocaleDateString("sl-SI")}.`
                : "Bon ne poteče."}{" "}
              Kodo vnesite v košarico pri naslednjem nakupu.
            </p>
            <Link href={orgPath(org?.slug ?? null, "/shop")}>
              <Button className="w-full">Nazaj v trgovino</Button>
            </Link>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
