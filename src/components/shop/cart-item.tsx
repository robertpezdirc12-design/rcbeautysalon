"use client"
import { useFormatPrice } from "@/lib/currency"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { MinusIcon, PlusIcon, TrashIcon, PackageIcon } from "@/components/icons"
import type { CartItem as CartItemType } from "@/store/cart-store"
import { useCartStore } from "@/store/cart-store"
import { toast } from "sonner"

interface CartItemProps {
  item: CartItemType
}

export function CartItem({ item }: CartItemProps) {
  const fmt = useFormatPrice()
  const { updateQuantity, removeItem } = useCartStore()
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  const handleConfirmRemove = () => {
    removeItem(item.productId)
    toast.success(`${item.name} je bil odstranjen iz košarice.`)
    setShowRemoveDialog(false)
  }

  //Decrease Quantity
  const handleDecrease = () => {
    if (item.quantity === 1) {
      setShowRemoveDialog(true)
    } else {
      updateQuantity(item.productId, item.quantity - 1)
    }
  }

  //Increase Quantity
  const handleIncrease = () => {
    // P1 #37: upoštevaj zalogo (če je znana) — ne ponujaj več kot je na voljo.
    if (
      item.stockQuantity != null &&
      item.quantity + 1 > item.stockQuantity
    ) {
      toast.error(
        `Na zalogi je le še ${item.stockQuantity} kos izdelka ${item.name}.`
      )
      return
    }
    updateQuantity(item.productId, item.quantity + 1)
  }

  // P1 #37: količino je mogoče TIPATI (tipkovnica/bralniki zaslona),
  // ne samo klikati. Neveljavne vrednosti se pripognejo na dovoljeno.
  const handleQuantityInput = (raw: string) => {
    if (raw === "") {
      // Prazni vnos: pusti uporabniku tipkati — povrnemo na 1 ob zameglitvi.
      return
    }
    const parsed = Number.parseInt(raw, 10)
    if (Number.isNaN(parsed)) return
    const max = item.stockQuantity ?? undefined
    const clamped = Math.min(Math.max(parsed, 1), max ?? Number.MAX_SAFE_INTEGER)
    if (max !== undefined && parsed > max) {
      toast.error(
        `Na zalogi je le še ${max} kos izdelka ${item.name}.`
      )
    }
    updateQuantity(item.productId, clamped)
  }

  return (
    <div className="group bg-muted/30 hover:bg-muted/50 flex gap-4 rounded-xl p-4 transition-all">
      {/* Product Image */}
      <div className="border-border/50 bg-background relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border shadow-sm">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          
              sizes="96px"/>
        ) : (
          <div className="from-muted to-muted/50 flex h-full w-full items-center justify-center bg-linear-to-br">
            <PackageIcon
              size={36}
              weight="light"
              className="text-muted-foreground/40"
            />
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex flex-1 flex-col justify-between py-1">
        <div>
          {/* #56: h2 (was h3) — the item name is the only heading in the cart
              body; h1 → h3 skipped a level (axe heading-order). Visual size
              kept via text-base. */}
          <h2 className="text-foreground group-hover:text-primary-text text-base font-semibold transition-colors">
            {item.name}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {fmt(item.price)} na kos
          </p>
        </div>

        {/* Quantity Controls — P1 #37: vsak gumb ima dostopno ime (prej
            "button, button, button" za bralnike zaslona), količina pa je
            številski vnos (min 1, max zaloga). */}
        <div className="flex items-center gap-1">
          <Button
            onClick={handleDecrease}
            variant="outline"
            size="icon"
            aria-label={`Zmanjšaj količino izdelka ${item.name}`}
            className="border-border/50 hover:bg-primary/10 hover:text-primary-text hover:border-primary/30 h-9 w-9 rounded-lg"
          >
            <MinusIcon size={16} weight="bold" aria-hidden />
          </Button>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={item.stockQuantity ?? undefined}
            value={item.quantity}
            onChange={(e) => handleQuantityInput(e.target.value)}
            onBlur={(e) => {
              if (e.target.value === "") updateQuantity(item.productId, 1)
            }}
            aria-label={`Količina izdelka ${item.name}`}
            className="border-border/50 h-9 w-14 rounded-lg text-center text-lg font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <Button
            onClick={handleIncrease}
            variant="outline"
            size="icon"
            aria-label={`Povečaj količino izdelka ${item.name}`}
            className="border-border/50 hover:bg-primary/10 hover:text-primary-text hover:border-primary/30 h-9 w-9 rounded-lg"
          >
            <PlusIcon size={16} weight="bold" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Price & Remove */}
      <div className="flex flex-col items-end justify-between py-1">
        <div className="text-right">
          <p className="text-foreground text-lg font-bold">
            {fmt((item.price * item.quantity))}
          </p>
          {item.quantity > 1 && (
            <p className="text-muted-foreground text-xs">
              {item.quantity} x {fmt(item.price)}
            </p>
          )}
        </div>
        <Button
          onClick={() => setShowRemoveDialog(true)}
          variant="ghost"
          size="icon"
          aria-label={`Odstrani izdelek ${item.name} iz košarice`}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-9 w-9 rounded-lg"
        >
          <TrashIcon size={18} aria-hidden />
        </Button>
      </div>

      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        open={showRemoveDialog}
        onOpenChange={setShowRemoveDialog}
        title="Odstrani izdelek"
        description={`Ste prepričani, da želite odstraniti "${item.name}" iz košarice?`}
        confirmLabel="Odstrani"
        onConfirm={handleConfirmRemove}
        variant="destructive"
      />
    </div>
  )
}
