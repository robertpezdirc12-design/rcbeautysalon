import { EnvelopeIcon } from "@/components/icons"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"
import { getMarketingOverview } from "@/app/actions/marketing"
import { MarketingClient } from "@/components/dashboard/marketing-client"

// ============================================================
// #95 — MARKETING AVTOMATIKA (admin)
// Dve avtomatski e-poštni kampanji (reaktivacija, no-show follow-up)
// na segmentih strank. Pošteno: dnevnik poslanih, dedup, odjava z
// odgovorom; kampanja kontaktira samo obstoječe stranke.
// ============================================================

export default async function MarketingPage() {
  await requirePagePermission("customers.manage")
  const [, overview] = await Promise.all([getServerI18n(), getMarketingOverview()])

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <EnvelopeIcon size={24} className="mr-2 inline text-primary-text" />
            Marketing
          </h1>
          <p className="text-muted-foreground">
            Avtomatska e-pošta vašim strankam — reaktivacija in sledenje po ne-prihodu.
            Vsako sporočilo nosi povezavo za odjavo (funkcionalna, AD-03).
          </p>
        </div>
        <p className="text-muted-foreground text-sm shrink-0">
          Odjavljenih naslovov:{" "}
          <span className="text-foreground font-medium">{overview.unsubscribedCount}</span>
        </p>
      </div>

      <MarketingClient
        campaigns={overview.campaigns}
        bookingLink={overview.bookingLink}
      />
    </div>
  )
}
