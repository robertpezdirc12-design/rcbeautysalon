"use client"

// Client wrapper so the settings page can render all forms inside
// shadcn Tabs. Contents are force-mounted so unsaved state survives
// switching between tabs.

import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/lib/i18n/provider"

interface SettingsTabsProps {
  basic: ReactNode
  modules?: ReactNode
  branding: ReactNode
  payments?: ReactNode
  domains?: ReactNode
  /** P2 #43: globinska povezava (npr. /dashboard/settings?tab=branding)
   * iz vodenega vstopa — privzeti zavihek. Neznana vrednost pade na osnovni. */
  defaultTab?: string
}

const TAB_IDS = ["basic", "modules", "branding", "payments", "domains"] as const

export function SettingsTabs({ basic, modules, branding, payments, domains, defaultTab }: SettingsTabsProps) {
  const { t } = useI18n()

  const initial = TAB_IDS.includes((defaultTab ?? "") as (typeof TAB_IDS)[number])
    ? (defaultTab as string)
    : "basic"

  return (
    <Tabs defaultValue={initial}>
      <TabsList>
        <TabsTrigger value="basic">{t.settings.tabs.basic}</TabsTrigger>
        {modules && <TabsTrigger value="modules">{t.settings.tabs.modules}</TabsTrigger>}
        <TabsTrigger value="branding">{t.settings.tabs.branding}</TabsTrigger>
        {payments && (
          <TabsTrigger value="payments">{t.settings.tabs.payments}</TabsTrigger>
        )}
        {domains && <TabsTrigger value="domains">{t.settings.tabs.domains}</TabsTrigger>}
      </TabsList>
      <TabsContent value="basic" forceMount className="mt-6 data-[state=inactive]:hidden">
        {basic}
      </TabsContent>
      {modules && (
        <TabsContent value="modules" forceMount className="mt-6 data-[state=inactive]:hidden">
          {modules}
        </TabsContent>
      )}
      <TabsContent value="branding" forceMount className="mt-6 data-[state=inactive]:hidden">
        {branding}
      </TabsContent>
      {payments && (
        <TabsContent
          value="payments"
          forceMount
          className="mt-6 data-[state=inactive]:hidden"
        >
          {payments}
        </TabsContent>
      )}
      {domains && (
        <TabsContent value="domains" forceMount className="mt-6 data-[state=inactive]:hidden">
          {domains}
        </TabsContent>
      )}
    </Tabs>
  )
}
