import { ImageResponse } from "next/og"

// ============================================================
// P1 #39-6 (re-audit 2026-11) — DINAMIČNE OG SLIKE
//
// Prej je VSAK deljeni URL (tudi posamezna storitev/izdelek) v
// družabnih omrežjih pokazal isto generično /og-default.png. Ta
// route generira OG kartico na podlagi ?title= & ?subtitle= —
// strani storitev/izdelkov jo uporabijo, ko nimajo fotografije.
// ============================================================

export const runtime = "nodejs"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = (searchParams.get("title") ?? "Salon Platform").slice(0, 120)
  const subtitle = (searchParams.get("subtitle") ?? "").slice(0, 120)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1c0d12 0%, #4a1f2e 55%, #8a3549 100%)",
          color: "#ffffff",
          padding: "72px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.15,
            maxWidth: 1080,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              display: "flex",
              fontSize: 36,
              marginTop: 28,
              opacity: 0.85,
              maxWidth: 900,
            }}
          >
            {subtitle}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 24,
            letterSpacing: 4,
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          Salon Platform
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
