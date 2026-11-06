import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/icons"
import { CartContent } from "@/components/shop/cart-content"
import { getPublicOrg } from "@/lib/tenant"
import { redirectBareToTenant } from "@/lib/public-site"
import { notFound } from "next/navigation"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import { isCapabilityEnabled } from "@/lib/profiles/registry"
import { noIndexMetadata } from "@/lib/seo"
import { orgPath } from "@/lib/org-path"

export async function generateMetadata(): Promise<Metadata> {
  // Per-tenant title: "Nakupovalna košarica | <Salon>" (P0-3)
  // P1 #26: košarica ni indeksirljiva — noindex, follow (prej je bila
  // kanonizirana na domačo stran, kar je onesnaževalo njen signal).
  const org = await getPublicOrg()
  return noIndexMetadata({
    title: `Nakupovalna košarica | ${org?.name ?? "Poslovna platforma"}`,
    description: "Pregledajte in upravljajte izdelke v svoji košarici.",
  })
}

export default async function CartPage() {
  // P1 #39-5: gola /cart → kanonična najemniška pot (košarica ostane
  // ohranjena, ker je vezana na aktivni org).
  await redirectBareToTenant("/cart")
  // Keep the "back to shop" link inside the current tenant (/s/{slug}/shop)
  // — a bare "/shop" on a tenant URL would fall back to the default org.
  const org = await getPublicOrg()
  // #105-nadaljevanje (G1, 2. linija): izklopljena trgovina → košarica 404.
  if (!org || !isCapabilityEnabled(resolveEffectiveProfile(org), "shop")) notFound()

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

        {/* Cart Content (Client Component) — Suspense: useSearchParams
            (nadaljuj=1 zastavica) zahteva mejo pri prerenderiranju. */}
        <Suspense>
          <CartContent />
        </Suspense>
      </div>
    </div>
  )
}
