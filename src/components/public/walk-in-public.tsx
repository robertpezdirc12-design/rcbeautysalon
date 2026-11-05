"use client"

// #98: javni vhod v vrsto — prijava (ime, opcionalno telefon) ali
// preverba pozicije po kodi vstopnice. Samodejna osvežitev 30 s, ko
// gost sledi svoji vstopnici.

import { useEffect, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getWalkInStatus, joinWalkInQueue } from "@/app/actions/walk-in"

export function WalkInPublicClient() {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [ticket, setTicket] = useState<string | null>(null)
  const [position, setPosition] = useState<number | null>(null)
  const [servingNow, setServingNow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Sledenje: samodejna osvežitev, dokler gost gleda svojo vstopnico.
  useEffect(() => {
    if (!ticket) return
    const timer = setInterval(() => {
      checkStatus(ticket, false)
    }, 30_000)
    return () => clearInterval(timer)
  }, [ticket])

  function join() {
    setError(null)
    startTransition(async () => {
      const res = await joinWalkInQueue({ name, phone })
      if (res.success && res.ticketCode) {
        setTicket(res.ticketCode)
        setName("")
        setPhone("")
        await checkStatus(res.ticketCode, false)
      } else {
        setError(res.error ?? "Prijava ni uspela. Poskusite znova.")
      }
    })
  }

  function checkStatus(code: string, fromInput: boolean) {
    if (fromInput) setError(null)
    startTransition(async () => {
      const res = await getWalkInStatus(code)
      if (res.success) {
        setPosition(res.position ?? null)
        setServingNow(res.servingNow === true)
        if (fromInput) setTicket(code.trim().toUpperCase())
      } else {
        if (fromInput) setError(res.error ?? "Vstopnice ni bilo mogoče najti.")
      }
    })
  }

  if (ticket) {
    return (
      <Card className="mt-6">
        <CardHeader className="text-center">
          <CardTitle className="text-base">Vaša vstopnica</CardTitle>
          <p className="font-mono text-3xl font-bold tracking-widest">{ticket}</p>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          {servingNow ? (
            <p className="text-lg font-semibold" role="status">
              Na potezi ste! Pojdite na vrata. 🎉
            </p>
          ) : position ? (
            <p className="text-lg" role="status">
              Ste <strong>{position}.</strong> v vrsti.
            </p>
          ) : (
            <p className="text-muted-foreground" role="status">
              Vaša vstopnica ni več v vrsti.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Pozicija se samodejno osvežuje. Zapišite si kodo vstopnice.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-6">
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="walkin-name">Ime *</Label>
          <Input
            id="walkin-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="npr. Ana Novak"
            maxLength={60}
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="walkin-phone">Telefon (neobvezno)</Label>
          <Input
            id="walkin-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="npr. 040 123 456"
            maxLength={30}
            inputMode="tel"
            autoComplete="tel"
          />
        </div>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <Button onClick={join} disabled={pending || name.trim().length < 2} className="w-full">
          {pending ? "Prijavljam …" : "Prijavi se v vrsto"}
        </Button>

        <div className="flex items-center gap-2 pt-2">
          <Input
            value={ticket ?? ""}
            onChange={(e) => setTicket(e.target.value.toUpperCase())}
            placeholder="Koda vstopnice (preveri pozicijo)"
            maxLength={6}
            aria-label="Koda vstopnice"
            className="font-mono tracking-widest"
          />
          <Button
            variant="outline"
            onClick={() => ticket && checkStatus(ticket, true)}
            disabled={pending || !ticket}
          >
            Preveri
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
