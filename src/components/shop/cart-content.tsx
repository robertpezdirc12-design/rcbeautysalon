"use client"
import { useFormatPrice } from "@/lib/currency"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  ShoppingBag,
  Truck,
  ShieldCheck,
  Trash,
  CircleNotch,
  CheckCircle,
  Phone,
  EnvelopeSimple,
} from "@phosphor-icons/react/dist/ssr"
import { useCartStore } from "@/store/cart-store"
import { CartItem } from "@/components/shop/cart-item"
import { toast } from "sonner"
import { createProductCheckoutSession } from "@/app/actions/product-checkout"
import { validateGiftCard } from "@/app/actions/prepaid"
import { useOrgPrefix } from "@/lib/org-path-hooks"
import { SI_VAT_RATE, vatFromGross, vatLabel } from "@/lib/vat"

// P1 #65: guest checkout contact — account is an OFFER, not a precondition.
interface GuestContact {
  name: string
  email: string
  phone: string
  address: string
}

interface OfflineConfirmation {
  orderNumber: string
  contactPhone: string | null
  contactEmail: string | null
  /** #80: order fully paid with a gift card. */
  giftCardPaid?: boolean
}

export function CartContent() {
  const fmt = useFormatPrice()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status } = useSession()
  // Tenant-aware cart path: "/s/[slug]/cart" on tenant sites, "/cart" on
  // bare routes — so the login round-trip returns to the SAME tenant cart.
  const orgPrefix = useOrgPrefix()
  const cartPath = `${orgPrefix}/cart`
  const { items, getTotalPrice, getTotalItems, clearCart } = useCartStore()
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  // P1 #65: guest contact form + offline confirmation screen.
  const [contact, setContact] = useState<GuestContact>({
    name: "",
    email: "",
    phone: "",
    address: "",
  })
  // #80: darilni bon pri checkoutu.
  const [giftCardCode, setGiftCardCode] = useState("")
  const [giftCardState, setGiftCardState] = useState<
    { ok: boolean; balance?: number; message: string } | null
  >(null)
  const [isCheckingCard, startCardCheck] = useTransition()

  const handleCheckGiftCard = () => {
    if (!giftCardCode.trim()) return
    startCardCheck(async () => {
      const result = await validateGiftCard(giftCardCode)
      if (result.ok) {
        setGiftCardState({
          ok: true,
          balance: result.balance,
          message: `Bon veljaven — stanje ${fmt(result.balance ?? 0)}`,
        })
      } else {
        const messages: Record<string, string> = {
          NOT_FOUND: "Darilni bon s to kodo ne obstaja.",
          FOREIGN_TENANT:
            "Ta darilni bon ni iz te trgovine in ga tukaj ni mogoče unovčiti.",
          PENDING: "Ta darilni bon še ni plačan.",
          EXPIRED: "Ta darilni bon je potekel.",
          EXHAUSTED: "Ta darilni bon je že porabljen.",
          REFUNDED: "Ta darilni bon je preklican.",
        }
        setGiftCardState({
          ok: false,
          message: messages[result.rejection ?? "NOT_FOUND"],
        })
      }
    })
  }
  const [confirmation, setConfirmation] = useState<OfflineConfirmation | null>(
    null
  )
  const totalPrice = getTotalPrice()
  const totalItems = getTotalItems()
  const shipping = items.length === 0 || totalPrice >= 50 ? 0 : 5.99
  // P1 #33 (re-audit 2026-11): BRUTO cenik — cene že vsebujejo DDV (/terms),
  // zato košarica NE prišteva davka. DDV je samo informativni razpad bruto
  // zneska (prej magični 8 % DODAN k ceni → napačen znesek + odprava).
  const vatIncluded = vatFromGross(totalPrice, SI_VAT_RATE)
  const grandTotal = totalPrice + shipping

  // P1 #38 (re-audit 2026-11): po prijavi uporabnik nadaljuje na checkout,
  // ne nazaj na košarico. Prijava vodi na /cart?nadaljuj=1; ko seja pride
  // in je zastavica prisotna, se checkout sproži samodejno (enkrat).
  const autoContinue = searchParams.get("nadaljuj") === "1"
  const autoContinueRef = useRef(false)
  useEffect(() => {
    if (
      autoContinue &&
      !autoContinueRef.current &&
      status === "authenticated" &&
      items.length > 0 &&
      !isCheckingOut
    ) {
      autoContinueRef.current = true
      // Odstrani zastavico iz URL-ja, da refresh ne ponovi nakupa.
      router.replace(cartPath, { scroll: false })
      void handleCheckout()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoContinue, status, items.length])

  const handleClearCart = () => {
    clearCart()
    toast.success("Košarica je bila izpraznjena!")
    setShowClearDialog(false)
  }

  const handleCheckout = async () => {
    // The button is disabled while the session is loading (see JSX below);
    // this guard remains as a belt-and-braces fallback for programmatic calls.
    if (status === "loading") return

    // P1 #65: guests check out with contact details — no login wall. The
    // login links remain as an offer ("Že imate račun?") inside the form.
    if (status === "unauthenticated") {
      if (contact.name.trim().length < 2) {
        toast.error("Vnesite ime in priimek.")
        return
      }
      if (!contact.email.trim() && !contact.phone.trim()) {
        toast.error("Vnesite e-pošto ali telefonsko številko.")
        return
      }
    }

    setIsCheckingOut(true)

    try {
      const result = await createProductCheckoutSession(
        items,
        status === "unauthenticated"
          ? {
              name: contact.name,
              email: contact.email || undefined,
              phone: contact.phone || undefined,
              address: contact.address || undefined,
            }
          : undefined,
        giftCardCode.trim() || undefined
      )

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

      if (result.offline || result.giftCardPaid) {
        // P1 #65: a real confirmation screen with an order number — not a
        // toast that disappears. The demand is recorded; the owner sees it.
        // #80: giftCardPaid — plačano z bonom, isti zaslon z oznako.
        setConfirmation({
          orderNumber: result.orderNumber ?? "",
          contactPhone: result.contactPhone ?? null,
          contactEmail: result.contactEmail ?? null,
          giftCardPaid: result.giftCardPaid,
        })
        clearCart()
        window.scrollTo({ top: 0, behavior: "smooth" })
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

  const loginUrl = `/login?callbackUrl=${encodeURIComponent(`${cartPath}?nadaljuj=1`)}`
  const registerUrl = `/register?callbackUrl=${encodeURIComponent(`${cartPath}?nadaljuj=1`)}`

  // P1 #65: full-page confirmation after an offline order — the customer
  // gets an order number and the tenant's real contact channels.
  if (confirmation) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="text-center">
            <div className="bg-emerald-100 dark:bg-emerald-950 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
              <CheckCircle
                size={40}
                weight="regular"
                className="text-emerald-700 dark:text-emerald-300"
              />
            </div>
            <CardTitle className="text-2xl">Hvala za naročilo!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Naročilo je bilo zabeleženo — salon vas bo kontaktiral za
              prevzem/dostavo in plačilo.
            </p>
            <div className="bg-muted/40 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">Številka naročila</p>
              <p className="font-mono text-lg font-bold">
                {confirmation.orderNumber}
              </p>
            </div>
            {(confirmation.contactPhone || confirmation.contactEmail) && (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Za hitro sporazumevanje:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {confirmation.contactPhone && (
                    <a
                      href={`tel:${confirmation.contactPhone.replace(/[^+\d]/g, "")}`}
                      className="text-primary-text inline-flex items-center gap-1.5 font-medium hover:underline"
                    >
                      <Phone size={16} aria-hidden="true" />
                      {confirmation.contactPhone}
                    </a>
                  )}
                  {confirmation.contactEmail && (
                    <a
                      href={`mailto:${confirmation.contactEmail}`}
                      className="text-primary-text inline-flex items-center gap-1.5 font-medium hover:underline"
                    >
                      <EnvelopeSimple size={16} aria-hidden="true" />
                      {confirmation.contactEmail}
                    </a>
                  )}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild size="lg">
              <Link href={`${orgPrefix}/shop`}>Nadaljuj z nakupovanjem</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
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
        {/* Cart Items + guest contact */}
        <div className="space-y-6 lg:col-span-2">
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
                  {/* P3 #51: h2 neposredno pod h1 — pravi vrstni red naslovov
                      (axe heading-order; prej h3 brez vmesnega h2). */}
                  <h2 className="mb-2 text-xl font-semibold">
                    Vaša košarica je prazna
                  </h2>
                  <p className="text-muted-foreground mx-auto mb-6 max-w-sm">
                    Videti je, da še niste dodali nobenih izdelkov. Začnite z
                    nakupovanjem in napolnite košarico!
                  </p>
                  {/* P1 #45: najemniški prefiks — goli "/shop" bi preusmeril
                      kupca v trgovino PRIVZETEGA najemnika. */}
                  <Button asChild size="lg" className="shadow-md">
                    <Link href={`${orgPrefix}/shop`}>
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

          {/* P1 #65: guest checkout — kontakt kot enakovredna pot, prijava
              ostane ponujena (ne zahtevana). Vidno SAMO v košarici s
              predmeti; prijavljeni kupec ne vidi obrazca. */}
          {status === "unauthenticated" && items.length > 0 && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-border/50 bg-muted/30 border-b">
                <CardTitle className="text-lg">Vaši kontaktni podatki</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Račun ni obvezen — naročilo oddate z imenom in e-pošto ali
                  telefonom.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="guest-name">Ime in priimek *</Label>
                  <Input
                    id="guest-name"
                    autoComplete="name"
                    value={contact.name}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-email">E-pošta</Label>
                  <Input
                    id="guest-email"
                    type="email"
                    autoComplete="email"
                    placeholder="ime@primer.si"
                    value={contact.email}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, email: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-phone">Telefon</Label>
                  <Input
                    id="guest-phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+386 40 123 456"
                    value={contact.phone}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, phone: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-address">Dostavni naslov (neobvezno)</Label>
                  <Input
                    id="guest-address"
                    autoComplete="street-address"
                    value={contact.address}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, address: e.target.value }))
                    }
                  />
                </div>
                <p className="text-muted-foreground text-sm sm:col-span-2">
                  Že imate račun?{" "}
                  <Link
                    href={loginUrl}
                    className="text-primary-text font-medium hover:underline"
                  >
                    Prijava
                  </Link>{" "}
                  ali{" "}
                  <Link
                    href={registerUrl}
                    className="text-primary-text font-medium hover:underline"
                  >
                    Registracija
                  </Link>
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="border-border/50 sticky top-24 shadow-sm">
            <CardHeader className="border-border/50 bg-muted/30 border-b">
              <CardTitle>Povzetek naročila</CardTitle>
            </CardHeader>
            {/* P1 #37: spreminjanje količine se napove bralnikom zaslona. */}
            <CardContent
              className="space-y-4 p-6"
              aria-live="polite"
              aria-atomic="false"
            >
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vmesna vsota</span>
                <span className="font-medium">{fmt(totalPrice)}</span>
              </div>
              {/* #80: darilni bon — preveri kodo pred zaključkom. */}
              <div className="space-y-2 rounded-lg border p-3">
                <Label htmlFor="gift-card-code" className="text-sm">
                  🎁 Darilni bon
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="gift-card-code"
                    value={giftCardCode}
                    onChange={(e) => {
                      setGiftCardCode(e.target.value)
                      setGiftCardState(null)
                    }}
                    placeholder="RC-XXXX-XXXX"
                    className="uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCheckGiftCard}
                    disabled={isCheckingCard || !giftCardCode.trim()}
                  >
                    {isCheckingCard ? "…" : "Preveri"}
                  </Button>
                </div>
                {giftCardState && (
                  <p
                    className={`text-xs ${
                      giftCardState.ok
                        ? "text-green-600 dark:text-green-400"
                        : "text-destructive"
                    }`}
                    role="status"
                  >
                    {giftCardState.message}
                  </p>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dostava</span>
                {shipping === 0 ? (
                  <span className="font-medium text-green-700 dark:text-green-400">Brezplačno</span>
                ) : (
                  <span className="font-medium">{fmt(shipping)}</span>
                )}
              </div>
              {shipping > 0 && totalPrice > 0 && (
                <p className="text-muted-foreground bg-accent/10 rounded-lg p-2 text-center text-xs">
                  Dodajte še {fmt((50 - totalPrice))} za brezplačno dostavo!
                </p>
              )}
              {/* P1 #33: informativni razpad DDV iz bruto cene (22 %) —
                  skupaj = vmesna vsota + dostava, brez prištevanja. */}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{vatLabel()}</span>
                <span className="font-medium">{fmt(vatIncluded)}</span>
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
              {/* P1 #45: najemniški prefiks — glej zgoraj. */}
              <Button variant="outline" className="w-full" asChild>
                <Link href={`${orgPrefix}/shop`}>Nadaljuj z nakupovanjem</Link>
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
