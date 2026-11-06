import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/icons"
import { ProductForm } from "@/components/dashboard/product-form"
import { ProductVariantsCard } from "@/components/dashboard/product-variants-card"
import { StockMovementsCard } from "@/components/dashboard/stock-movements-card"
import { getProductById } from "@/app/actions/products"
import { getAllCategories } from "@/app/actions/services"
import { getServerI18n } from "@/lib/i18n/server"
import { getSessionEffectiveProfile } from "@/lib/profiles/session"
import { requirePagePermission } from "@/lib/auth/guards"

interface EditProductPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("products.manage")
  const { id } = await params

  // Fetch product and categories in parallel
  const [product, categories, { t }, profile] = await Promise.all([
    getProductById(id),
    getAllCategories(),
    getServerI18n(),
    getSessionEffectiveProfile(),
  ])

  if (!product) {
    notFound()
  }

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
          <h1 className="text-3xl font-bold">{t.products.editTitle}</h1>
          <p className="text-muted-foreground">{product.name}</p>
        </div>
      </div>

      {/* Form */}
      <ProductForm
        categories={categories}
        product={product}
        mode="edit"
      />

      {/* Variants (EPIC #1 Phase 4b, §11) */}
      <ProductVariantsCard
        productId={product.id}
        productPrice={product.price}
        labels={t.catalogDocs.variants}
      />

      {/* Stock movement ledger (EPIC #2 E2-2) — manual receipts/issues.
          §21: hidden when the owner disables the inventory capability. */}
      {profile.capabilities.inventory !== "disabled" && (
        <StockMovementsCard
          productId={product.id}
          productStock={product.stockQuantity}
          trackInventory={product.trackInventory}
          variants={product.variants.map((v) => ({
            id: v.id,
            name: v.name,
            stockQuantity: v.stockQuantity,
          }))}
          labels={t.inventory}
        />
      )}
    </div>
  )
}
