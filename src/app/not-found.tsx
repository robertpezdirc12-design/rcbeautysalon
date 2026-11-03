import Link from "next/link"
import { Button } from "@/components/ui/button"

// ============================================================
// P1 #27 (re-audit 2026-11) — ENOTNA, BLAGOVNA 404 STRAN
//
// Prej so neobstoječe vsebine vračale HTTP 200 z vsebino "ni
// najdena" (soft 404 → indeksiranje napačnih URL-jev), prave
// 404 pa gole angleške Next.js strani brez navigacije. Zdaj:
//  - page/layout kliče notFound(), takoj ko vsebine ni (status 404),
//  - ta enotna slovenska stran se upodobi povsod (root meja).
// ============================================================

export const metadata = {
  title: "Stran ni najdena",
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-24 text-center">
      <p
        aria-hidden="true"
        className="font-heading from-primary to-accent bg-linear-to-r bg-clip-text text-8xl font-bold text-transparent md:text-9xl"
      >
        404
      </p>
      <h1 className="mt-4 text-2xl font-bold md:text-3xl">
        Stran ni najdena
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md">
        Naslov, ki ga iščete, ne obstaja ali pa je bil premaknjen. Preverite
        naslov ali nadaljujte na eno od spodnjih strani.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" asChild>
          <Link href="/">Nazaj na domačo stran</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/services">Poglej storitve</Link>
        </Button>
      </div>
    </div>
  )
}
