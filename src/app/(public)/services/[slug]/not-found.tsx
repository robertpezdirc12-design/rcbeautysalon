import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { WarningCircleIcon, ArrowLeftIcon, CalendarIcon } from "@/components/icons"
import { getPublicOrg } from "@/lib/tenant"
import { orgPath } from "@/lib/org-path"

export default async function ServiceNotFound() {
  // not-found.tsx is a server component rendered inside the same request as
  // the page that threw notFound() — the org header is still available, so
  // links can stay inside the tenant's site (/s/{slug}/...). Null org
  // (unknown/suspended slug or bare platform route) falls back to bare paths.
  const org = await getPublicOrg()
  const orgSlug = org?.slug ?? null

  return (
    // P2 #12 (audit-2026-11): <main> landmark + <h1>, no <a><button> nesting.
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="container mx-auto px-4">
        <Card className="mx-auto max-w-2xl border-primary/20 text-center">
          <CardHeader className="space-y-4 pb-4">
            {/* Icon */}
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
              <WarningCircleIcon size={40} className="text-destructive" />
            </div>

            {/* Title */}
            <div>
              <h1 className="mb-2 text-3xl font-bold">Storitev ni najdena</h1>
              <CardDescription className="text-base">
                Storitev, ki jo iščete, ne obstaja več ali pa je bila odstranjena.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Suggestions */}
            <div className="rounded-lg bg-muted/50 p-4 text-left">
              <p className="mb-2 font-semibold">Kaj lahko storite:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Preverite napake v URL-naslovu</li>
                <li>• Prebrskajte celoten katalog storitev</li>
                <li>• Poiščite podobno storitev</li>
                <li>• Vrnite se na domačo stran</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                asChild
                size="lg"
                className="from-primary to-accent w-full bg-linear-to-r hover:opacity-90"
              >
                <Link href={orgPath(orgSlug, "/services")}>
                  <CalendarIcon size={20} className="mr-2" aria-hidden />
                  Vse storitve
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary/50 hover:bg-primary/5 w-full"
              >
                <Link href={orgPath(orgSlug, "/")}>
                  <ArrowLeftIcon size={20} className="mr-2" aria-hidden />
                  Nazaj na domačo stran
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
