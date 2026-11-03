import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/icons"
import { CartContent } from "@/components/shop/cart-content"
import { getPublicOrg } from "@/lib/tenant"
import { orgPath } from "@/lib/org-path"

export async function generateMetadata(): Promise<Metadata> {
  // Per-tenant title: "Nakupovalna košarica | <Salon>" (P0-3)
  const org = await getPublicOrg()
  return {
    title: `Nakupovalna košarica | ${org?.name ?? "Poslovna platforma"}`,
    description: "Pregledajte in upravljajte izdelke v svoji košarici.",
  }
}

export default async function CartPage() {
  // Keep the "back to shop" link inside the current tenant (/s/{slug}/shop)
  // — a bare "/shop" on a tenant URL would fall back to the default org.
  const org = await getPublicOrg()

  return (
    <div className="from-background to-muted/20 min-h-screen bg-linear-to-b">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="hover:bg-primary/10 hover:text-primary-text mb-4 -ml-2"
          asChild
        >
          <Link href={orgPath(org?.slug, "/shop")}>
            <ArrowLeftIcon size={16} className="mr-2" />
            Nazaj v trgovino
          </Link>
        </Button>

        {/* Cart Content (Client Component) */}
        <CartContent />
      </div>
    </div>
  )
}
