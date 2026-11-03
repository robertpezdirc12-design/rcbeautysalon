import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPublicProductById, getPublicSiteData, redirectBareToTenant } from "@/lib/public-site"
import { canonicalMetadata } from "@/lib/seo"
import { orgPath } from "@/lib/org-path"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Package,
  Truck,
  ShieldCheck,
  Star,
  Check,
  X,
} from "@phosphor-icons/react/dist/ssr"
import { AddToCartButton } from "@/components/shop/add-to-cart-button"
import { formatCurrency } from "@/lib/utils/format"

interface ProductDetailsProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ProductDetailsProps): Promise<Metadata> {
  const { slug } = await params
  const site = await getPublicSiteData()
  const orgName = site?.org.name ?? "Salon"
  const product = site ? await getPublicProductById(site.org.id, slug) : null

  if (!product) {
    return {
      title: `Izdelka ni mogoče najti | ${orgName}`,
      description: "Zahtevanega izdelka ni mogoče najti.",
    }
  }

  return canonicalMetadata(site?.org.slug, `/shop/${slug}`, {
    title: `${product.name} | ${orgName}`,
    description:
      product.description ||
      "Profesionalni izdelki za nego lepote v vašem salonu.",
    // P1 #39-6: OG slika izdelka (sicer dinamična s strani imena prek /og).
    openGraph: {
      title: `${product.name} | ${orgName}`,
      description:
        product.description ||
        "Profesionalni izdelki za nego lepote v vašem salonu.",
      images: [
        product.images?.[0]
          ? { url: product.images[0], alt: product.name }
          : {
              url: `/og?title=${encodeURIComponent(product.name)}&subtitle=${encodeURIComponent(orgName)}`,
              alt: product.name,
            },
      ],
    },
  })
}

const ProductDetails = async ({ params }: ProductDetailsProps) => {
  const { slug } = await params
  // P1 #39-5: gola pot → kanonična najemniška pot.
  await redirectBareToTenant(`/shop/${slug}`)
  const site = await getPublicSiteData()
  const product = site ? await getPublicProductById(site.org.id, slug) : null

  if (!product) {
    notFound()
  }

  const orgSlug = site?.org.slug ?? null
  const inStock = product.stockQuantity > 0
  const mainImage = product.images?.[0] || null

  return (
    <div className="min-h-screen bg-linear-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6 -ml-2 hover:bg-primary/10 hover:text-primary-text"
          asChild
        >
          <Link href={orgPath(orgSlug, "/shop")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Nazaj v trgovino
          </Link>
        </Button>

        {/* Product Layout */}
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Image Section */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-border/50 bg-muted shadow-sm">
              {mainImage ? (
                <Image
                  src={mainImage}
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"/>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-muted to-muted/50">
                  <Package
                    size={80}
                    weight="light"
                    className="text-muted-foreground/40"
                  />
                </div>
              )}

              {/* Badges */}
              <div className="absolute left-4 top-4 flex flex-col gap-2">
                {product.isFeatured && (
                  <Badge className="bg-accent text-accent-foreground shadow-md">
                    Izpostavljeno
                  </Badge>
                )}
                {!inStock && (
                  <Badge variant="destructive" className="shadow-md">
                    Ni na zalogi
                  </Badge>
                )}
                {product.compareAtPrice && inStock && (
                  <Badge className="bg-primary text-primary-foreground shadow-md">
                    Akcija
                  </Badge>
                )}
              </div>
            </div>

            {/* Thumbnail Gallery */}
            {product.images && product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((image, index) => (
                  <div
                    key={index}
                    className="relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-border/50 transition-all hover:border-primary"
                  >
                    <Image
                      src={image}
                      alt={`${product.name} - slika ${index + 1}`}
                      fill
                      className="object-cover"
                    
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"/>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Info Section */}
          <div className="flex flex-col">
            {/* Category */}
            {product.category && (
              <p className="mb-2 text-sm font-medium text-primary-text">
                {product.category.name}
              </p>
            )}

            {/* Title */}
            <h1 className="mb-4 text-3xl font-bold lg:text-4xl">
              {product.name}
            </h1>

            {/* Rating Placeholder */}
            <div className="mb-4 flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={18}
                    weight="fill"
                    className="text-accent-text"
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                (0 ocen)
              </span>
            </div>

            {/* Price */}
            <div className="mb-6 flex items-baseline gap-3">
              <span className="text-4xl font-bold text-primary-text">
                {formatCurrency(product.price)}
              </span>
              {product.compareAtPrice && (
                <span className="text-xl text-muted-foreground line-through">
                  {formatCurrency(product.compareAtPrice)}
                </span>
              )}
              {product.compareAtPrice && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Prihranite {formatCurrency(product.compareAtPrice - product.price)}
                </Badge>
              )}
            </div>

            {/* Stock Status */}
            <div className="mb-6 flex items-center gap-2">
              {inStock ? (
                <>
                  <Check size={20} weight="bold" className="text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-400">
                    Na zalogi ({product.stockQuantity} kos)
                  </span>
                </>
              ) : (
                <>
                  <X size={20} weight="bold" className="text-destructive" />
                  <span className="font-medium text-destructive">
                    Ni na zalogi
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mb-6">
                <h3 className="mb-2 font-semibold">Opis</h3>
                <p className="leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              </div>
            )}

            <Separator className="my-6" />

            {/* Add to Cart */}
            <div className="mb-6">
              <AddToCartButton
                product={{
                  id: product.id,
                  name: product.name,
                  image: mainImage,
                  price: product.price,
                }}
                inStock={inStock}
                stockQuantity={product.stockQuantity}
              />
            </div>

            {/* Trust Features */}
            <Card className="border-border/50 bg-muted/30">
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Truck size={20} className="text-primary-text" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Brezplačna dostava</p>
                    <p className="text-xs text-muted-foreground">
                      Za naročila nad 50 €
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <ShieldCheck size={20} className="text-primary-text" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Varen nakup</p>
                    <p className="text-xs text-muted-foreground">
                      100 % zaščiteno
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SKU */}
            {product.sku && (
              <p className="mt-6 text-sm text-muted-foreground">
                SKU: {product.sku}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetails
