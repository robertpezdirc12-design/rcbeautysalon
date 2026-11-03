"use client"
import { useFormatPrice } from "@/lib/currency"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  ShoppingBag,
  Truck,
  ShieldCheck,
  Trash,
  CircleNotch,
} from "@phosphor-icons/react/dist/ssr"
import { useCartStore } from "@/store/cart-store"
import { CartItem } from "@/components/shop/cart-item"
import { toast } from "sonner"
import { createProductCheckoutSession } from "@/app/actions/product-checkout"
import { useOrgPrefix } from "@/lib/org-path-hooks"

export function CartContent() {
  const fmt = useFormatPrice()
  const router = useRouter()
  const { data: session, status } = useSession()
  // Tenant-aware cart path: "/s/[slug]/cart" on tenant sites, "/cart" on
  // bare routes — so the login round-trip returns to the SAME tenant cart.
  const orgPrefix = useOrgPrefix()
  const cartPath = `${orgPrefix}/cart`
  const { items, getTotalPrice, getTotalItems, clearCart } = useCartStore()
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const totalPrice = getTotalPrice()
  const totalItems = getTotalItems()
  const shipping = items.length === 0 || totalPrice >= 50 ? 0 : 5.99
  const tax = totalPrice * 0.08
  const grandTotal = totalPrice + shipping + tax

  const handleClearCart = () => {
    clearCart()
    toast.success("Košarica je bila izpraznjena!")
    setShowClearDialog(false)
  }

  const handleCheckout = async () => {
    // The button is disabled while the session is loading (see JSX below);
    // this guard remains as a belt-and-braces fallback for programmatic calls.
    if (status === "loading") return

    if (!session) {
      toast.error("Za zaključek nakupa se prijavite")
      router.push(`/login?callbackUrl=${encodeURIComponent(cartPath)}`)
      return
    }

    setIsCheckingOut(true)

    try {
      const result = await createProductCheckoutSession(items)

      if (!result.success) {
        if (result.stockErrors && result.stockErrors.length > 0) {
          result.stockErrors.forEach((error) => {
            toast.error(`${error.name}: Na voljo le še ${error.available} kos`)
          })
        } else {
          toast.error(result.error || "Ustvarjanje plačilne seje ni uspelo")
        }
        return
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      }
    } catch (error) {
      console.error("Checkout error:", error)
      toast.error("Prišlo je do napake. Poskusite znova.")
    } finally {
      setIsCheckingOut(false)
    }
  }

  return (
    <>
      {/* Header Badge */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Nakupovalna košarica</h1>
          {totalItems > 0 && (
            <Badge variant="secondary" className="text-sm">
              {totalItems} {" "}
              {totalItems === 1
                ? "izdelek"
                : totalItems === 2
                  ? "izdelka"
                  : totalItems < 5
                    ? "izdelki"
                    : "izdelkov"}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1">
          Pregledajte in upravljajte svoje izdelke
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-border/50 bg-muted/30 flex flex-row items-center justify-between border-b">
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag size={20} />
                Izdelki v košarici
              </CardTitle>
              {items.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearDialog(true)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash size={16} className="mr-2" />
                  Izprazni košarico
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4">
              {items.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="from-primary/10 to-accent/10 mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br">
                    <ShoppingBag
                      size={48}
                      weight="light"
                      className="text-primary-text/60"
                    />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">
                    Vaša košarica je prazna
                  </h3>
                  <p className="text-muted-foreground mx-auto mb-6 max-w-sm">
                    Videti je, da še niste dodali nobenih izdelkov. Začnite z
                    nakupovanjem in napolnite košarico!
                  </p>
                  <Button asChild size="lg" className="shadow-md">
                    <Link href="/shop">
                      <ShoppingBag className="mr-2 h-5 w-5" />
                      Raziščite izdelke
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <CartItem key={item.productId} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="border-border/50 sticky top-24 shadow-sm">
            <CardHeader className="border-border/50 bg-muted/30 border-b">
              <CardTitle>Povzetek naročila</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vmesna vsota</span>
                <span className="font-medium">{fmt(totalPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dostava</span>
                {shipping === 0 ? (
                  <span className="font-medium text-green-600">Brezplačno</span>
                ) : (
                  <span className="font-medium">{fmt(shipping)}</span>
                )}
              </div>
              {shipping > 0 && totalPrice > 0 && (
                <p className="text-muted-foreground bg-accent/10 rounded-lg p-2 text-center text-xs">
                  Dodajte še {fmt((50 - totalPrice))} za brezplačno dostavo!
                </p>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Predvideni davek</span>
                <span className="font-medium">{fmt(tax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Skupaj</span>
                <span className="text-primary-text">{fmt(grandTotal)}</span>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 p-6 pt-0">
              <Button
                className="w-full shadow-md"
                size="lg"
                disabled={
                  items.length === 0 || isCheckingOut || status === "loading"
                }
                onClick={handleCheckout}
              >
                {isCheckingOut ? (
                  <CircleNotch size={20} className="animate-spin" />
                ) : (
                  "Zaključi nakup"
                )}
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/shop">Nadaljuj z nakupovanjem</Link>
              </Button>

              {/* Trust Badges */}
              <div className="text-muted-foreground mt-4 flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <Truck size={16} />
                  <span>Hitra dostava</span>
                </div>
                <div className="flex items-center gap-1">
                  <ShieldCheck size={16} />
                  <span>Varen nakup</span>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Clear Cart Confirmation Dialog */}
      <ConfirmDialog
        open={showClearDialog}
        onOpenChange={setShowClearDialog}
        title="Izprazni košarico"
        description="Ste prepričani, da želite odstraniti vse izdelke iz košarice? Tega dejanja ni mogoče razveljaviti."
        confirmLabel="Izprazni košarico"
        onConfirm={handleClearCart}
        variant="destructive"
      />
    </>
  )
}
