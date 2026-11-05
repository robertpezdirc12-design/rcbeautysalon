import { UsersIcon } from "@/components/icons"
import { requirePagePermission } from "@/lib/auth/guards"
import { getSessionOrg } from "@/lib/tenant"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import { isCapabilityEnabled } from "@/lib/profiles/registry"
import { WalkInClient } from "@/components/dashboard/walk-in-client"

// ============================================================
// #98 (AD-02) — WALK-IN VRSTA (dashboard, živa vrsta)
// Samostojen izbirni modul za vse dejavnosti: prijava brez računa,
// javna stran "ste X. na vrsti" (/s/[slug]/vrsta), tukaj obdelava.
// Izklop capabilityja = nav skrije vhod, akcije javijo izklop.
// ============================================================

export default async function WalkInPage() {
  await requirePagePermission("appointments.view")
  const org = await getSessionOrg()

  const enabled = org
    ? isCapabilityEnabled(resolveEffectiveProfile(org), "walkIn")
    : false

  if (!enabled) {
    return (
      <div className="space-y-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <UsersIcon size={24} className="text-primary-text" />
          Walk-in vrsta
        </h1>
        <p className="text-muted-foreground">
          Modul walk-in vrste je izklopljen. Vklopite ga v Nastavitve →
          Moduli — podatki prijav ostanejo ohranjeni.
        </p>
      </div>
    )
  }

  const publicPath = org ? `/s/${org.slug}/vrsta` : null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <UsersIcon size={24} className="text-primary-text" />
          Walk-in vrsta
        </h1>
        <p className="text-muted-foreground">
          Živa vrsta brez računa — gost se prijavi na vaši strani, vi ga
          pokličete na potez. Povezava za goste:{" "}
          {publicPath ? (
            <a href={publicPath} className="text-primary underline">
              {publicPath}
            </a>
          ) : (
            "ni na voljo"
          )}
        </p>
      </div>

      <WalkInClient />
    </div>
  )
}
