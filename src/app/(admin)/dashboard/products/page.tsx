import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PackageIcon,
  PlusIcon,
  PencilIcon,
} from "@/components/icons"
import {
  getAdminProducts,
  getProductStats,
  type AdminProductSort,
} from "@/app/actions/products"
import { getStockLinkOptions } from "@/app/actions/inventory"
import { getAllCategories } from "@/app/actions/services"
import { prisma } from "@/lib/prisma"
import { getSessionOrg } from "@/lib/tenant"
import { ProductSearch } from "@/components/dashboard/product-search"
import { DeliveryDialogButton } from "@/components/dashboard/delivery-dialog-button"
import { DeleteProductButton } from "@/components/dashboard/delete-product-button"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"
import { formatCurrency } from "@/lib/utils/format"
import { stockTone } from "@/lib/inventory/low-stock"

// #78: the products list is now a QUERY, not a dump — filtri (search,
// kategorija, stanje zaloge), sortiranje in paginacija (25 na stran)
// tečejo čez URL parametre, tako da je stanje deljivo in server-rendered.
const STOCK_FILTERS = ["all", "low", "out", "inactive"] as const
type StockFilter = (typeof STOCK_FILTERS)[number]

const SORTS = ["createdAt", "name", "price", "stock"] as const

interface ProductsPageProps {
  searchParams: Promise<{
    search?: string
    categoryId?: string
    stock?: string
    sort?: string
    page?: string
  }>
}

function parseStock(value?: string): StockFilter {
  return STOCK_FILTERS.includes(value as StockFilter)
    ? (value as StockFilter)
    : "all"
}

function parseSort(value?: string): AdminProductSort {
  return SORTS.includes(value as AdminProductSort)
    ? (value as AdminProductSort)
    : "createdAt"
}

/** Build a /dashboard/products URL that keeps every current filter. */
function buildUrl(
  current: { search?: string; categoryId?: string; stock: StockFilter; sort: AdminProductSort },
  patch: Partial<{ search: string | null; categoryId: string | null; stock: StockFilter; sort: AdminProductSort; page: number | null }>
): string {
  const params = new URLSearchParams()
  const search = patch.search !== undefined ? patch.search : current.search
  const categoryId =
    patch.categoryId !== undefined ? patch.categoryId : current.categoryId
  const stock = patch.stock ?? current.stock
  const sort = patch.sort ?? current.sort
  const page = patch.page ?? 1

  if (search) params.set("search", search)
  if (categoryId) params.set("categoryId", categoryId)
  if (stock !== "all") params.set("stock", stock)
  if (sort !== "createdAt") params.set("sort", sort)
  if (page > 1) params.set("page", String(page))
  const qs = params.toString()
  return qs ? `/dashboard/products?${qs}` : "/dashboard/products"
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("products.manage")
  const sp = await searchParams
  const search = sp.search?.trim() || undefined
  const categoryId = sp.categoryId || undefined
  const stock = parseStock(sp.stock)
  const sort = parseSort(sp.sort)
  const page = Math.max(1, Number(sp.page) || 1)

  const [{ t }, result, stats, categories] = await Promise.all([
    getServerI18n(),
    getAdminProducts({ search, categoryId, stock, sort, page }),
    getProductStats(),
    getAllCategories(),
  ])
  const products = result.products

  // #78: Prejem blaga — sledeni izdelki za izbirnik (ostri take, ker je
  // to picker, ne lista) + dobavitelji, kadar profil omogoča extensijo.
  const [linkOptions, trackedProducts] = await Promise.all([
    getStockLinkOptions(),
    getSessionOrg().then((org) =>
      org
        ? prisma.product.findMany({
            where: { organizationId: org.id, trackInventory: true },
            select: { id: true, name: true, stockQuantity: true },
            orderBy: { name: "asc" },
            take: 200,
          })
        : []
    ),
  ])

  const current = { search, categoryId, stock, sort }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t.products.title}{" "}
            <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
              {t.products.titleAccent}
            </span>
          </h1>
          <p className="text-muted-foreground">
            {t.products.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DeliveryDialogButton
            products={trackedProducts}
            suppliers={linkOptions.suppliers}
            labels={t.products}
          />
          <Link href="/dashboard/products/stocktake">
            <Button variant="outline">{t.products.stocktakeLink}</Button>
          </Link>
          <Link href="/dashboard/products/new">
            <Button>
              <PlusIcon size={16} className="mr-2" />
              {t.products.addProduct}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.products.totalProducts}</CardDescription>
            <CardTitle className="text-3xl">{stats.totalProducts}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.products.inStock}</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.inStock}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.products.lowStock}</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{stats.lowStock}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.products.outOfStock}</CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats.outOfStock}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <ProductSearch />

      {/* #78: filtri (čipi + kategorija) in razvrščanje — server-rendered
          povezave, delujejo brez JS-a, stanje je v URL-ju. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.products.filterAll}>
          {STOCK_FILTERS.map((f) => (
            <Link
              key={f}
              href={buildUrl(current, { stock: f })}
              aria-current={stock === f ? "true" : undefined}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors ${
                stock === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {f === "all"
                ? t.products.filterAll
                : f === "low"
                  ? t.products.filterLow
                  : f === "out"
                    ? t.products.filterOut
                    : t.products.filterInactive}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Kategorija */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.products.filterCategory}>
            <Link
              href={buildUrl(current, { categoryId: null })}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors ${
                !categoryId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {t.products.filterAllCategories}
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={buildUrl(current, { categoryId: c.id })}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors ${
                  categoryId === c.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
          {/* Razvrsti */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-sm">{t.products.sortBy}:</span>
            {SORTS.map((s) => (
              <Link
                key={s}
                href={buildUrl(current, { sort: s })}
                aria-current={sort === s ? "true" : undefined}
                className={`rounded-md px-2 py-1 text-sm transition-colors ${
                  sort === s
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s === "createdAt"
                  ? t.products.sortNewest
                  : s === "name"
                    ? t.products.sortName
                    : s === "price"
                      ? t.products.sortPrice
                      : t.products.sortStock}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{t.products.allProducts}</CardTitle>
            <CardDescription>
              {t.products.totalProductsCount(result.total)}
            </CardDescription>
          </div>
          {result.totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              {result.page > 1 ? (
                <Link href={buildUrl(current, { page: result.page - 1 })}>
                  <Button variant="outline" size="sm">
                    {t.products.prevPage}
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  {t.products.prevPage}
                </Button>
              )}
              <span className="text-muted-foreground">
                {t.products.pageInfo(result.page, result.totalPages)}
              </span>
              {result.page < result.totalPages ? (
                <Link href={buildUrl(current, { page: result.page + 1 })}>
                  <Button variant="outline" size="sm">
                    {t.products.nextPage}
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  {t.products.nextPage}
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t.products.noProductsFound}</p>
              <Link href="/dashboard/products/new" className="mt-4 inline-block">
                <Button>
                  <PlusIcon size={16} className="mr-2" />
                  {t.products.addFirstProduct}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">{t.products.colProduct}</th>
                    <th className="pb-3 font-medium">{t.products.colCategory}</th>
                    <th className="pb-3 font-medium">{t.products.colSku}</th>
                    <th className="pb-3 font-medium">{t.products.colPrice}</th>
                    <th className="pb-3 font-medium">{t.products.colStock}</th>
                    <th className="pb-3 font-medium">{t.products.colStatus}</th>
                    <th className="pb-3 font-medium">{t.products.colActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    // #78: barva zaloge iz ENEGA helperja (isti kot stats
                    // kartica) — prag je per-izdelek, sicer org privzeto.
                    const tone = product.trackInventory
                      ? stockTone(
                          product.stockQuantity,
                          product.reorderPoint ?? stats.defaultReorderPoint
                        )
                      : "ok"
                    return (
                      <tr key={product.id} className="border-b last:border-0">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            {product.images && product.images.length > 0 ? (
                              <div className="relative h-12 w-12 overflow-hidden rounded-lg">
                                <Image
                                  src={product.images[0]}
                                  alt={product.name}
                                  fill
                                  className="object-cover"

                              sizes="64px"/>
                              </div>
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                                <PackageIcon size={20} className="text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{product.name}</p>
                              {product.brand && (
                                <p className="text-muted-foreground text-xs">{product.brand}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-sm">{product.categoryName || t.products.uncategorized}</td>
                        <td className="py-4 text-sm font-mono text-muted-foreground">{product.sku || "-"}</td>
                        <td className="py-4">
                          <div>
                            <p className="font-medium">{formatCurrency(product.price)}</p>
                            {product.compareAtPrice && (
                              <p className="text-sm text-muted-foreground line-through">
                                {formatCurrency(product.compareAtPrice)}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-4">
                          <span className={`font-medium ${
                            tone === "out"
                              ? "text-red-600"
                              : tone === "low"
                                ? "text-yellow-600"
                                : "text-green-600"
                          }`}>
                            {product.trackInventory
                              ? `${product.stockQuantity} ${product.unit}`
                              : "—"}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            product.isActive
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                          }`}>
                            {product.isActive ? t.products.activeBadge : t.products.inactiveBadge}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="flex gap-1">
                            <Link href={`/dashboard/products/${product.id}/edit`}>
                              <Button variant="ghost" size="icon">
                                <PencilIcon size={16} />
                              </Button>
                            </Link>
                            <DeleteProductButton
                              productId={product.id}
                              productName={product.name}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
