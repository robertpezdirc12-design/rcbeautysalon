"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PlusIcon } from "@/components/icons"
import { DeliveryDialog } from "@/components/dashboard/delivery-dialog"
import type { ProductsDict } from "@/lib/i18n/dict/products"

// #78: gumb "Prejem blaga" — odpre dialog nad tabelo izdelkov.
// Server strani dostavi samo sledene izdelke (za izbirnik) in
// dobavitelje (kadar profil omogoča suppliers extensijo).
interface DeliveryDialogButtonProps {
  products: { id: string; name: string; stockQuantity: number }[]
  suppliers: { id: string; title: string }[]
  labels: ProductsDict
}

export function DeliveryDialogButton({
  products,
  suppliers,
  labels,
}: DeliveryDialogButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon size={16} className="mr-2" />
        {labels.receiveDelivery}
      </Button>
      <DeliveryDialog
        open={open}
        onOpenChange={setOpen}
        products={products}
        suppliers={suppliers}
        labels={labels}
      />
    </>
  )
}
