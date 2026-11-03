"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CheckCircleIcon, ShoppingBagIcon, HouseIcon, SpinnerIcon, ReceiptIcon } from "@/components/icons"
import { verifyProductOrder } from "@/app/actions/product-checkout"
import { useCartStore } from "@/store/cart-store"
import { useOrgPrefix } from "@/lib/org-path-hooks"

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const clearCart = useCartStore((state) => state.clearCart)
  // Tenant prefix so cart / order-detail / home links stay inside
  // /s/{slug} instead of falling back to the default org's surfaces.
  const orgPrefix = useOrgPrefix()

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [orderId, setOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function verifyOrder() {
      if (!sessionId) {
        setStatus("error")
        setError("Manjka ID plačilne seje")
        return
      }

      const result = await verifyProductOrder(sessionId)

      if (result.success) {
        setStatus("success")
        setOrderId(result.orderId || null)
        // Clear the cart after successful payment
        clearCart()
      } else {
        setStatus("error")
        setError(result.error || "Preverjanje naročila ni uspelo")
      }
    }

    verifyOrder()
  }, [sessionId, clearCart])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <SpinnerIcon size={40} className="text-primary-text animate-spin" />
            </div>
            <CardTitle className="text-2xl">Preverjamo vaše naročilo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Prosimo, počakajte, da potrdimo vaše plačilo.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
              <span className="text-4xl">!</span>
            </div>
            <CardTitle className="text-2xl">Prišlo je do napake</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {error || "Vašega naročila nismo mogli preveriti. Kontaktirajte podporo."}
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link href={`${orgPrefix}/cart`}>Nazaj v košarico</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircleIcon size={48} weight="fill" className="text-green-600" />
          </div>
          <CardTitle className="text-2xl">Naročilo potrjeno!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Hvala za vaš nakup! Vaše naročilo je bilo uspešno oddano.
          </p>
          {orderId && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Številka naročila</p>
              <p className="font-mono font-semibold">{orderId}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            V kratkem boste prejeli e-poštno potrditev s podrobnostmi naročila.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {orderId && (
            <Button asChild className="w-full">
              <Link href={`${orgPrefix}/my-orders/${orderId}`}>
                <ReceiptIcon className="mr-2 h-4 w-4" />
                Podrobnosti naročila
              </Link>
            </Button>
          )}
          <Button variant={orderId ? "outline" : "default"} asChild className="w-full">
            <Link href={`${orgPrefix}/shop`}>
              <ShoppingBagIcon className="mr-2 h-4 w-4" />
              Nadaljuj z nakupovanjem
            </Link>
          </Button>
          <Button variant="ghost" asChild className="w-full">
            {/* "Home" = tenant home on /s/{slug}, platform root on bare routes */}
            <Link href={orgPrefix || "/"}>
              <HouseIcon className="mr-2 h-4 w-4" />
              Nazaj domov
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
