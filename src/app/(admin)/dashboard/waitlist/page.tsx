import { Card, CardContent } from "@/components/ui/card"
import { ClockIcon, CheckCircleIcon, UsersIcon } from "@/components/icons"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"
import { getWaitlistEntries } from "@/app/actions/waitlist"
import { WaitlistClient } from "@/components/admin/waitlist-client"

// ============================================================
// #90 — ČAKALNA LISTA (admin)
// Lastnik vidi prijave gostov na zasedene termine in z enim klikom
// pošlje obvestilo s povezavo v rezervacijo. Brez auto-book.
// ============================================================

export default async function WaitlistPage() {
  // Custom roles (E4-6b): page guard — enaka dovoljenja kot termini.
  await requirePagePermission("appointments.view")
  const [{ t }, entries] = await Promise.all([getServerI18n(), getWaitlistEntries()])
  const p = t.appointments.waitlist

  const waiting = entries.filter((e) => e.status === "WAITING").length
  const notified = entries.filter((e) => e.status === "NOTIFIED").length
  const booked = entries.filter((e) => e.status === "BOOKED").length
  const stats = [
    { label: p.statsWaiting, value: String(waiting), icon: ClockIcon, accent: "text-amber-500" },
    { label: p.statsNotified, value: String(notified), icon: CheckCircleIcon, accent: "text-primary-text" },
    { label: p.statsBooked, value: String(booked), icon: UsersIcon, accent: "text-emerald-500" },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {p.title} <span className="text-primary-text">{p.titleAccent}</span>
          </h1>
          <p className="text-muted-foreground">{p.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-lg bg-muted p-2 ${s.accent}`}>
                <s.icon size={18} />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none">{s.value}</div>
                <div className="text-muted-foreground mt-1 text-xs leading-tight">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <WaitlistClient entries={entries} />
    </div>
  )
}
