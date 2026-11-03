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
// podatkov) in krašo cacheiran (60 s, stale-while-revalidate).
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
        { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } }
      )
    }

    return NextResponse.json(
      {
        exists: true,
        orgId: org.id,
        publishState: org.publishState,
        bookingEnabled: isBookingEnabled(org.vertical, org.profileOverrides),
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
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
