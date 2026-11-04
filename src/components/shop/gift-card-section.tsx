"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { createGiftCardCheckoutSession } from "@/app/actions/prepaid"
import { formatCurrency } from "@/lib/utils/format"

// ============================================================
// DARILNI BONI (#80) — javna sekcija trgovine. Kupi → Stripe (koda
// po e-pošti) ali offline salon (koda takoj na ekranu). Code email
// nosi kodo; uspešna stran jo pokaže tudi ob neposrednem nakupu.
// ============================================================

interface GiftCard {
  id: string
  name: string
  description: string | null
  price: number
  faceValue: number
  validityDays: number | null
}

interface GiftCardSectionProps {
  giftCards: GiftCard[]
}

export function GiftCardSection({ giftCards }: GiftCardSectionProps) {
  const router = useRouter()
  const [buying, setBuying] = useState<GiftCard | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [pending, startTransition] = useTransition()
  const [immediateCode, setImmediateCode] = useState<string | null>(null)

  const handleBuy = () => {
    if (!buying) return
    if (name.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast.error("Vnesite ime in veljaven e-poštni naslov.")
      return
    }
    startTransition(async () => {
      const result = await createGiftCardCheckoutSession(buying.id, {
        name: name.trim(),
        email: email.trim(),
      })
      if (!result.success) {
        toast.error(result.error || "Nakup ni uspel.")
        return
      }
      if (result.immediate) {
        // Offline salon: koda takoj vidna (in poslana po e-pošti).
        setImmediateCode(result.immediate.code)
        setBuying(null)
        setName("")
        setEmail("")
        return
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return
      }
      toast.error("Nakup ni uspel.")
    })
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {giftCards.map((gc) => (
          <Card key={gc.id} className="flex flex-col">
            <CardContent className="flex-1 p-5">
              <div className="mb-2 text-3xl">🎁</div>
              <h3 className="text-lg font-semibold">{gc.name}</h3>
              {gc.description && (
                <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                  {gc.description}
                </p>
              )}
              <div className="mt-3">
                <span className="text-2xl font-bold">
                  {formatCurrency(gc.price)}
                </span>
                {gc.faceValue > gc.price && (
                  <span className="text-muted-foreground ml-2 text-sm">
                    vrednost {formatCurrency(gc.faceValue)}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {gc.validityDays
                  ? `Velja ${gc.validityDays} dni od nakupa`
                  : "Ne poteče"}
              </p>
            </CardContent>
            <CardFooter className="p-4 pt-0">
              <Button
                className="w-full"
                onClick={() => {
                  setBuying(gc)
                  setImmediateCode(null)
                }}
              >
                Kupi darilni bon
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Kupi — dialog */}
      <Dialog open={!!buying} onOpenChange={(o) => !o && setBuying(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{buying?.name}</DialogTitle>
            <DialogDescription>
              {buying
                ? `Cena ${formatCurrency(buying.price)} · vrednost ${formatCurrency(buying.faceValue)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="gc-name">Ime prejemnika *</Label>
              <Input
                id="gc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ana Novak"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-email">E-pošta *</Label>
              <Input
                id="gc-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ana@example.com"
              />
              <p className="text-muted-foreground text-xs">
                Kodo bona pošljemo na ta naslov po plačilu.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuying(null)} disabled={pending}>
              Prekliči
            </Button>
            <Button onClick={handleBuy} disabled={pending}>
              {pending && <SpinnerIcon size={16} className="mr-2 animate-spin" />}
              Nadaljuj na plačilo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offline prodaja — koda takoj na ekranu */}
      <Dialog open={!!immediateCode} onOpenChange={(o) => !o && setImmediateCode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>🎁 Darilni bon je pripravljen</DialogTitle>
            <DialogDescription>
              Poslali smo ga tudi po e-pošti. To je koda bona:
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-6 text-center">
            <div
              className="text-2xl font-bold tracking-widest"
              role="text"
              aria-label="Koda darilnega bona"
            >
              {immediateCode}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (immediateCode) {
                  void navigator.clipboard.writeText(immediateCode)
                  toast.success("Koda kopirana.")
                }
              }}
            >
              Kopiraj kodo
            </Button>
            <Button
              onClick={() => {
                setImmediateCode(null)
                router.refresh()
              }}
            >
              Zapri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
