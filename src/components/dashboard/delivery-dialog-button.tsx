"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PlusIcon } from "@/components/icons"
import { DeliveryDialog } from "@/components/dashboard/delivery-dialog"
import { useI18n } from "@/lib/i18n/provider"

// #78: gumb "Prejem blaga" — odpre dialog nad tabelo izdelkov.
// Server strani dostavi samo sledene izdelke (za izbirnik) in
// dobavitelje (kadar profil omogoča suppliers extensijo).
// Oznake: useI18n() (client bundle) — funkcije v slovarju niso
// serijalizabilne čez RSC mejo.
interface DeliveryDialogButtonProps {
  products: { id: string; name: string; stockQuantity: number }[]
  suppliers: { id: string; title: string }[]
}

export function DeliveryDialogButton({
  products,
  suppliers,
}: DeliveryDialogButtonProps) {
  const [open, setOpen] = useState(false)
  const { t } = useI18n()

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon size={16} className="mr-2" />
        {t.products.receiveDelivery}
      </Button>
      <DeliveryDialog
        open={open}
        onOpenChange={setOpen}
        products={products}
        suppliers={suppliers}
      />
    </>
  )
}
