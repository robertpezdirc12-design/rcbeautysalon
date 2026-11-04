import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/icons"
import { StocktakeClient } from "@/components/dashboard/stocktake-client"
import { prisma } from "@/lib/prisma"
import { getSessionOrg } from "@/lib/tenant"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"

// #78: INVENTURA — tabela vseh sledenih izdelkov z "prešteto" poljem
// poleg sistemskega števila, razlika se vidi živo. Print-friendly
// (uporablja se stoje v zalogi): list brez dodatnega UI-šuma.
export default async function StocktakePage() {
  await requirePagePermission("products.manage")
  const [{ t }, org] = await Promise.all([getServerI18n(), getSessionOrg()])

  const products = org
    ? await prisma.product.findMany({
        where: { organizationId: org.id, trackInventory: true, isActive: true },
        select: { id: true, name: true, sku: true, unit: true, stockQuantity: true },
        orderBy: { name: "asc" },
        take: 500,
      })
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/products">
          <Button variant="ghost" size="icon">
            <ArrowLeftIcon size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{t.products.stocktakeTitle}</h1>
          <p className="text-muted-foreground">{t.products.stocktakeSubtitle}</p>
        </div>
      </div>

      <StocktakeClient
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          stockQuantity: p.stockQuantity,
        }))}
        labels={t.products}
      />
    </div>
  )
}
