import Link from "next/link"
import { ArrowLeftIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { getServerI18n } from "@/lib/i18n/server"

// P2 #71 — nadzorna not-found meja. notFound() v podstraneh
// /dashboard (npr. naročilo tujega najemnika ali neobstoječi ID) rendra
// TA list NOTRI v nadzorni lupini (AdminSidebar/AdminHeader ostanejo),
// nikoli v javni 404 strani — lastnik ne izgubi konteksta, kamor je
// zadel.
export default async function DashboardNotFound() {
  const { t } = await getServerI18n()
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground text-6xl font-bold">404</p>
      <h1 className="text-2xl font-bold tracking-tight">
        {t.common.notFound.title}
      </h1>
      <p className="text-muted-foreground max-w-md">
        {t.common.notFound.description}
      </p>
      <Button asChild variant="outline">
        <Link href="/dashboard">
          <ArrowLeftIcon size={14} className="mr-1.5" />
          {t.common.notFound.backToDashboard}
        </Link>
      </Button>
    </div>
  )
}
