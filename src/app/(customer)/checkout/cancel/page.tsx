import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ShoppingCartIcon, StorefrontIcon } from "@/components/icons"
import { getPublicOrg } from "@/lib/tenant"
import { orgPath } from "@/lib/org-path"

export const metadata: Metadata = {
  title: "Nakup preklican | Poslovna platforma",
  description: "Vaš nakup je bil preklican. Vaša košarica je še vedno shranjena.",
}

export default async function CheckoutCancelPage() {
  // Keep the "continue shopping" link inside the current tenant (/s/{slug}/shop)
  // — a bare "/shop" on a tenant URL would fall back to the default org.
  const org = await getPublicOrg()

  return (
    <div className="from-muted/30 via-background to-muted/20 flex min-h-screen items-center justify-center bg-linear-to-b px-4 py-12">
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardContent className="flex flex-col items-center p-8 text-center">
          {/* Icon */}
          <div className="bg-muted mb-6 flex h-20 w-20 items-center justify-center rounded-full">
            <ShoppingCartIcon size={40} weight="light" className="text-muted-foreground" />
          </div>

          {/* Title */}
          <h1 className="mb-2 text-2xl font-bold">Nakup preklican</h1>

          {/* Message */}
          <p className="text-muted-foreground mb-8">
            Brez skrbi! Vaša košarica je še vedno shranjena in pripravljena, ko boste pripravljeni vi.
          </p>

          {/* Actions */}
          <div className="flex w-full flex-col gap-3">
            <Button asChild className="w-full">
              <Link href={orgPath(org?.slug, "/cart")}>
                <ShoppingCartIcon size={18} className="mr-2" />
                Nazaj v košarico
              </Link>
            </Button>

            <Button variant="outline" asChild className="w-full">
              <Link href={orgPath(org?.slug, "/shop")}>
                <StorefrontIcon size={18} className="mr-2" />
                Nadaljuj z nakupovanjem
              </Link>
            </Button>
          </div>

          {/* Help Link — hash appended after the tenant-prefixed home URL
              (orgPath(org?.slug, "/") → "/s/{slug}") */}
          <p className="text-muted-foreground mt-6 text-sm">
            Imate težave?{" "}
            <Link
              href={`${orgPath(org?.slug, "/")}#contact`}
              className="text-primary-text hover:underline"
            >
              Kontaktirajte nas
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
