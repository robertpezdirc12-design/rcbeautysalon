import Link from "next/link"
import { Button } from "@/components/ui/button"
import { StorefrontIcon } from "@/components/icons"

/**
 * P1 #41 (onboarding audit 2026-11): območje stranke (/my-account) ni
 * imelo NOBENE poti do ustvarjanja podjetja — čarovnik /start je bil
 * dosegljiv le z neposrednim URL-jem. Ta kartica je vidna pot:
 *  - brez organizacije: "Ustvari svoje podjetje" → /start,
 *  - z organizacijo: "Nadzorna plošča" → /dashboard.
 */
export function OwnerAccountCard({
  organizationSlug,
}: {
  organizationSlug: string | null
}) {
  if (organizationSlug) {
    return (
      <section
        aria-label="Poslovni račun"
        className="mt-6 flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary-text mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <StorefrontIcon size={20} weight="fill" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">Vaše podjetje</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Upravljajte rezervacije, katalog in objavo svoje spletne strani.
            </p>
          </div>
        </div>
        <Button asChild className="min-h-11 shrink-0">
          <Link href="/dashboard">Pojdi v nadzorno ploščo</Link>
        </Button>
      </section>
    )
  }

  return (
    <section
      aria-label="Ustvarjanje podjetja"
      className="border-primary/30 from-primary/5 to-accent/5 mt-6 rounded-2xl border bg-linear-to-r p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary-text mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <StorefrontIcon size={20} weight="fill" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">Imate svoje podjetje?</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              V nekaj minutah ustvarite spletno stran s rezervacijami in
              trgovino — brez strokovne pomoči.
            </p>
          </div>
        </div>
        <Button asChild className="min-h-11 shrink-0">
          <Link href="/start">Ustvari svoje podjetje</Link>
        </Button>
      </div>
    </section>
  )
}
