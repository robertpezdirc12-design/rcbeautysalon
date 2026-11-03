"use client"

// P0 #25 (re-audit 2026-11) — GLOBAL ERROR BOUNDARY
// Zadnja linija obrambe: če napaka povzroči padec samega root
// layouta, Next.js uporabi to komponento (vključno z <html>/<body>,
// ker root layouta ni več v drevesu). Slovensko, blagovno nevtralno.

import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="sl">
      <body
        style={{
          minHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
          textAlign: "center",
          backgroundColor: "#fafafa",
          color: "#171717",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>
          Prišlo je do napake
        </h1>
        <p style={{ maxWidth: "28rem", color: "#525252" }}>
        Vaši podatki ostanejo ohranjeni. Poskusite znova ali osvežite stran.
        </p>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#737373" }}>
            Referenca napake: {error.digest}
          </p>
        )}
        <Button size="lg" onClick={reset}>
          Poskusite znova
        </Button>
      </body>
    </html>
  )
}
