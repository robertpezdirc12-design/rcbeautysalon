"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircleIcon, ClockIcon } from "@/components/icons"
import { joinWaitlist } from "@/app/actions/waitlist"

// #90 — javna prijava na čakalno listo (gost, brez računa).
// Poštena v1: vstop + obvestilo lastniku; NIKOLI ne trdi, da je
// termin rezerviran. Insert-point: stran rezervacije, ko je storitev
// izbrana (anchor #waitlist iz "zasedeno" stanja koledarskega koraka).
export function WaitlistCard({
  serviceId,
  serviceName,
}: {
  serviceId?: string | null
  serviceName?: string | null
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [preferredDate, setPreferredDate] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [joined, setJoined] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await joinWaitlist({
        name,
        email,
        phone: phone || null,
        serviceId: serviceId ?? null,
        preferredDate: preferredDate || null,
        notes: notes || null,
      })
      if (!res.success) {
        toast.error(res.error ?? "Prijava ni uspela. Poskusite znova.")
        setSubmitting(false)
        return
      }
      setJoined(true)
    } catch {
      toast.error("Prijava ni uspela. Poskusite znova.")
    } finally {
      setSubmitting(false)
    }
  }

  if (joined) {
    return (
      <section
        id="waitlist"
        className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/30"
      >
        <CheckCircleIcon size={32} weight="fill" className="mx-auto text-emerald-600 dark:text-emerald-400" />
        <h2 className="mt-3 text-lg font-semibold">Vpisani ste na čakalno listo.</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Takoj, ko se prostor odpre, vas bomo obvestili po e-pošti. Termin si nato izberete sami —
          obvestilo ne pomeni avtomatske rezervacije.
        </p>
      </section>
    )
  }

  return (
    <section id="waitlist" className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <ClockIcon size={22} className="mt-0.5 shrink-0 text-primary-text" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Termin zaseden? Prijavite se na čakalno listo.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ob odprtju prostora vas bomo po e-pošti takoj obvestili
            {serviceName ? <> — za storitev <span className="font-medium">{serviceName}</span></> : null}.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="waitlist-name">Ime in priimek</Label>
          <Input
            id="waitlist-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="npr. Ana Novak"
            maxLength={80}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="waitlist-email">E-pošta</Label>
          <Input
            id="waitlist-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="npr. ana@primer.si"
            maxLength={120}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="waitlist-phone">Telefon (neobvezno)</Label>
          <Input
            id="waitlist-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="npr. 040 123 456"
            maxLength={30}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="waitlist-date">Željeni datum (neobvezno)</Label>
          <Input
            id="waitlist-date"
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="waitlist-notes">Opomba (neobvezno)</Label>
          <Input
            id="waitlist-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="npr. Najraje popoldne"
            maxLength={500}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? "Prijavljam …" : "Prijavi se na listo"}
          </Button>
        </div>
      </form>
    </section>
  )
}
