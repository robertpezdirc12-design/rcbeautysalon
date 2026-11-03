"use client"

// ============================================================
// P0 #25 (re-audit 2026-11) — ROUTE ERROR BOUNDARY
//
// Prej je vsaka neujeta napaka v javnem segmentu razbila celo
// stran ("Application error: a client-side exception …") in
// obiskovalec je izgubil vnesene podatke. Ta meja ujame napake
// iz vseh segmentov pod root layoutom in prikaže blagovno
// znamko spoštujoče, slovenske sporočilo z možnostjo ponovnega
// poskusa — brez belega zaslona.
// ============================================================

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Napaka gre v strežniške dnevnike/Vercel logs (digest poveže
    // odjemalski prikaz s strežniškim zapisom). Ne pošiljamo PII.
    console.error("[app-error]", error.digest ?? "", error.message)
  }, [error])

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-24 text-center">
      <div className="bg-muted text-muted-foreground mb-6 flex size-16 items-center justify-center rounded-full">
        <svg
          className="size-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-bold md:text-3xl">
        Prišlo je do napake
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md">
        Vaši podatki ostanejo ohranjeni. Poskusite znova — če napaka ne
        izgine, nas pokličite ali pišite, odgovorili vam bomo v najkrajšem
        možnem času.
      </p>
      {error.digest && (
        <p className="text-muted-foreground/70 mt-2 text-xs">
          Referenca napake: {error.digest}
        </p>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={reset}>
          Poskusite znova
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/">Nazaj na domačo stran</Link>
        </Button>
      </div>
    </div>
  )
}
