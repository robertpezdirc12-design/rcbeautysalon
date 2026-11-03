"use client"

import { Button } from "@/components/ui/button"
import { useCartStore } from "@/store/cart-store"
import { ShoppingCartIcon } from "@/components/icons"

interface AddToCartButtonProps {
  product: {
    id: string
    name: string
    image: string | null
    price: number
  }
  inStock?: boolean
  /** P1 #37 (re-audit 2026-11): zaloga se shrani v košarico, da UI lahko
   * omeji količino (max) in javi \"Na zalogi je le še X kos\". */
  stockQuantity?: number | null
}
export function AddToCartButton({
  product,
  inStock = true,
  stockQuantity = null,
}: AddToCartButtonProps) {
  const { addItem } = useCartStore()


  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      stockQuantity,
    })
  }
  return (
    <Button onClick={handleAddToCart} variant={inStock ? "default" : "secondary"}  disabled={!inStock} className="w-full">
      <ShoppingCartIcon className="mr-2 h-4 w-4" />
      {inStock ? "Dodaj v košarico" : "Ni na zalogi"}
    </Button>
  )
}
