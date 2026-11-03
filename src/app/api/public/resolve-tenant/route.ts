import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isBookingEnabled } from "@/lib/public-cta"

// ============================================================
// P0 #24 / P1 #27 (re-audit 2026-11) — REZOLUCIJA TENANTA ZA PROXY
//
// Next.js 16 App Router STREAMA vse odgovore: notFound()/redirect()
// v layoutih/straneh ne moreta več spremeniti HTTP statusa (lupina je
// že odposlana s 200). Edino zanesljivo mesto za statusne kode je
// PROXY (middleware), ta pa ne doseže baze neposredno — zato ta
// endpoint: obstoj najemnika + booking zmogljivost v enem klicu.
//
// Odgovor je javen (samo obstoj/slug/vertikala — brez občutljivih
// podatkov) in kratek čas cacheiran. P0 #24 (reopen): dolgo cache okno
// (prej max-age=60 + swr=300) pomeni do ~6 min zastarelih odgovorov po
// spremembi podatkov — preverjanje popravka je lahko zavajajoče in
// proxy preusmeritve zaostajajo. Zdaj 15 s + swr 60 s (~1,25 min zgornja
// meja); proxy in-memory cache je usklajen (15 s).
// ============================================================

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get("slug")?.trim()
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 })
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        vertical: true,
        profileOverrides: true,
        status: true,
        publishState: true,
      },
    })

    // Neznan ALI suspendiran najemnik: za proxy je to "ne obstaja"
    // (spletna stran je OFF — pravi 404, ne soft 404).
    if (!org || org.status !== "ACTIVE") {
      return NextResponse.json(
        { exists: false },
        { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } }
      )
    }

    return NextResponse.json(
      {
        exists: true,
        orgId: org.id,
        publishState: org.publishState,
        bookingEnabled: isBookingEnabled(org.vertical, org.profileOverrides),
      },
      { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } }
    )
  } catch {
    // Fail-open: proxy pri napaki NE ugasne najemniških strani;
    // page-level notFound() ostane rezervna zaščita (soft 404).
    return NextResponse.json(
      { exists: true, unknown: true },
      { headers: { "Cache-Control": "no-store" } }
    )
  }
}
