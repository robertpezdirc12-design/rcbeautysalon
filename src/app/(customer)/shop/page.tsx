import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CartButton } from "@/components/shop/cart-button"
import { SearchInput } from "@/components/shop/search-input"
import { PackageIcon } from "@/components/icons"
import { AddToCartButton } from "@/components/shop/add-to-cart-button"
import { getPublicSiteData, getPublicShopProducts, redirectBareToTenant } from "@/lib/public-site"
import { canonicalMetadata } from "@/lib/seo"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import { orgPath } from "@/lib/org-path"
import { formatCurrency } from "@/lib/utils/format"

export async function generateMetadata(): Promise<Metadata> {
  const site = await getPublicSiteData()
  const orgName = site?.org.name ?? "Salon"
  const locale = await getLocaleFromCookies()
  // P3 #50: naslov kataloga ne_more prevzeti naslova LANDING sekcije
  // ("Izbrani izdelki") — stran izpiše VSE izdelke, ne samo izbrane.
  const pageTitle = locale === "en" ? "Shop" : "Trgovina"
  // P1 #26: samo-referencirajoč canonical (/s/{slug}/shop).
  return canonicalMetadata(site?.org.slug, "/shop", {
    title: `${pageTitle} | ${orgName}`,
    description:
      site?.content.shop.subtitle ??
      "Profesionalni izdelki za nego na dom — nega las, kože in nohtov.",
  })
}

interface ShopPageProps {
  searchParams: Promise<{ search?: string }>
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const { search } = await searchParams
  // P1 #39-5: gola pot → kanonična najemniška pot.
  await redirectBareToTenant(search ? `/shop?search=${encodeURIComponent(search)}` : "/shop")
  const site = await getPublicSiteData()

  if (!site) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4">
        <h1 className="text-2xl font-bold">Salon ni konfiguriran</h1>
      </div>
    )
  }

  const { org, content } = site
  const slug = org.slug
  const locale = await getLocaleFromCookies()
  // P3 #50: posvečen naslov kataloga (landing sekcija obdrži svoj
  // lastniško uredljiv naslov, npr. "Izbrani izdelki").
  const pageTitle = locale === "en" ? "Shop" : "Trgovina"
  const gridTitle = locale === "en" ? "All products" : "Vsi izdelki"
  const allProducts = await getPublicShopProducts(org.id)

  // Filter products based on search query
  const products = search
    ? allProducts.filter(
        (product) =>
          product.name.toLowerCase().includes(search.toLowerCase()) ||
          product.description?.toLowerCase().includes(search.toLowerCase())
      )
    : allProducts

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{pageTitle}</h1>
              <p className="text-muted-foreground">{content.shop.subtitle}</p>
            </div>
            <div className="hidden md:block">
              <CartButton />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-muted/30 border-b py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <SearchInput className="flex-1 md:max-w-md" />
            <Button variant="outline" size="sm" asChild>
              <Link href={orgPath(slug, "/shop")}>Vsi izdelki</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 py-8">
        {/* P3 #51: h2 med h1 in karticami — sicer axe heading-order javi
            preskok (h1 → nadaljnji h2/h3 v nogi brez vmesnega h2). */}
        <h2 className="mb-4 text-xl font-semibold tracking-tight">
          {gridTitle}
          <span className="text-muted-foreground ml-2 text-sm font-normal">
            ({products.length})
          </span>
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => {
            const inStock = product.stockQuantity > 0
            const imageUrl = product.images?.[0] || null

            return (
              <Card
                key={product.id}
                className="group border-primary/10 overflow-hidden transition-all duration-300 hover:shadow-xl"
              >
                <CardHeader className="p-0">
                  {/* Product Image */}
                  <div className="bg-muted relative aspect-square overflow-hidden">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      
              sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"/>
                    ) : (
                      <div className="from-muted to-muted/50 flex h-full w-full items-center justify-center bg-linear-to-br">
                        <PackageIcon
                          size={48}
                          weight="light"
                          className="text-muted-foreground/50"
                        />
                      </div>
                    )}

                    {/* Badges */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      {product.isFeatured && (
                        <Badge className="bg-accent text-accent-foreground">
                          Izpostavljeno
                        </Badge>
                      )}
                      {!inStock && (
                        <Badge variant="destructive">Ni na zalogi</Badge>
                      )}
                      {product.compareAtPrice && inStock && (
                        <Badge
                          variant="secondary"
                          className="bg-primary text-primary-foreground"
                        >
                          Akcija
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <CardTitle className="group-hover:text-accent-text mb-2 text-lg transition-colors">
                    {product.name}
                  </CardTitle>
                  {product.description && (
                    <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">
                      {product.description}
                    </p>
                  )}
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      {formatCurrency(product.price)}
                    </span>
                    {product.compareAtPrice && (
                      <span className="text-muted-foreground text-sm line-through">
                        {formatCurrency(product.compareAtPrice)}
                      </span>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 p-4 pt-0">
                  <AddToCartButton
                    product={{
                      id: product.id,
                      name: product.name,
                      image: imageUrl,
                      price: product.price,
                    }}
                    inStock={inStock}
                    stockQuantity={product.stockQuantity}
                  />
                  <Button
                    variant="outline"
                    className="border-primary/50 hover:bg-primary hover:text-primary-foreground w-full"
                    asChild
                  >
                    <Link href={orgPath(slug, `/shop/${product.id}`)}>
                      Podrobnosti
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Mobile Cart Button */}
      <div className="fixed right-4 bottom-4 md:hidden">
        <CartButton mobile />
      </div>
    </div>
  )
}
