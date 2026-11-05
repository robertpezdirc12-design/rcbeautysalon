import { getSalonSettings } from "@/app/actions/settings"
import { getPublicationStatus } from "@/app/actions/publication"
import { SettingsForm } from "@/components/dashboard/settings-form"
import { AnalyticsIntegrationCard } from "@/components/dashboard/analytics-integration-card"
import { PushCard } from "@/components/dashboard/push-card"
import { BrandingEditor } from "@/components/dashboard/branding-editor"
import { PaymentsSettings } from "@/components/dashboard/payments-settings"
import { ProfileOverview } from "@/components/dashboard/profile-overview"
import { ModulesConfigurator } from "@/components/dashboard/modules-configurator"
import { ModulesV2Card } from "@/components/dashboard/modules-v2-card"
import { ActivitiesCard } from "@/components/dashboard/activities-card"
import { ConfigHistoryCard } from "@/components/dashboard/config-history-card"
import { PublicationCard } from "@/components/dashboard/publication-card"
import { PlanUsageCard } from "@/components/dashboard/plan-usage-card"
import { DomainsCard } from "@/components/dashboard/domains-card"
import { SettingsTabs } from "@/components/dashboard/settings-tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getServerI18n } from "@/lib/i18n/server"
import { getSessionOrg } from "@/lib/tenant"
import { getSessionPlanContext } from "@/lib/plans/resolve"
import { loadBillingOverview } from "@/lib/payments/billing-overview"
import { getDomainsStatus } from "@/app/actions/domains"
import { requirePagePermission } from "@/lib/auth/guards"
import { isCapabilityEnabled } from "@/lib/profiles/registry"
import { getSessionEffectiveProfile } from "@/lib/profiles/resolve"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string; tab?: string }>
}) {
  // Custom roles (G8): server-side page guard
  await requirePagePermission("settings.manage")
  const [{ t }, params, settings, publication, org, planContext, domains] = await Promise.all([
    getServerI18n(),
    searchParams,
    getSalonSettings(),
    getPublicationStatus(),
    getSessionOrg(),
    getSessionPlanContext(),
    getDomainsStatus(),
  ])

  // Billing read model depends on the resolved tenant — one extra
  // sequential read after the parallel block above.
  const billing = org ? await loadBillingOverview(org.id) : null

  // #54: booking rules are dead UI for profiles without appointments —
  // the same capability gate the public site applies to /booking.
  const appointmentsEnabled = await getSessionEffectiveProfile().then((p) =>
    isCapabilityEnabled(p, "appointments")
  )

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.title}</CardTitle>
          <CardDescription>{t.settings.loadError}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    )
  }

  // P2 #43: globinska povezava iz vodenega vstopa — odpre zavihek
  // "Izgled in vsebina" neposredno (/dashboard/settings?tab=branding).
  return (
    <SettingsTabs defaultTab={params.tab}
      basic={
        <div className="space-y-6">
          <PlanUsageCard
            initial={
              planContext
                ? {
                    planId: planContext.planId,
                    usage: { ...planContext.usage },
                  }
                : null
            }
            billing={
              billing
                ? {
                    paymentsConfigured: billing.paymentsConfigured,
                    subscription: billing.subscription,
                    history: billing.history.map((e) => ({
                      id: e.id,
                      type: e.type,
                      amountCents: e.amountCents,
                      currency: e.currency,
                      createdAt: e.createdAt,
                    })),
                  }
                : null
            }
            billingFlag={params.billing ?? null}
          />
          <PublicationCard
            initial={publication}
            siteHref={org ? `/s/${org.slug}` : null}
          />
          <ProfileOverview />
          <SettingsForm
            initialSettings={settings}
            appointmentsEnabled={appointmentsEnabled}
          />
          {/* E4-2b: owner-supplied analytics (GA4) — optional, honest default = no script. */}
          <AnalyticsIntegrationCard initialValue={settings.analyticsMeasurementId ?? null} />
          {/* #99: push obvestila lastniku (nov termin, odpoved) */}
          <PushCard />
        </div>
      }
      modules={
        <div className="space-y-6">
          {/* #100 8.C (F2): modulni katalog v2 — vklop/izklop neodvisno
              od dejavnosti (podatki ostanejo, javni vhodi se zaprejo). */}
          <ModulesV2Card />
          <ActivitiesCard />
          <ModulesConfigurator />
          <ConfigHistoryCard />
        </div>
      }
      branding={<BrandingEditor />}
      payments={<PaymentsSettings />}
      domains={
        <DomainsCard
          initial={domains}
          sitePath={org ? `/s/${org.slug}` : null}
        />
      }
    />
  )
}
