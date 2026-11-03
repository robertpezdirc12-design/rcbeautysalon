import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// P1 #39-5 (re-audit 2026-11): privzeti (prvi objavljeni) najemnik za
// preusmerjanje GOLIH javnih poti v proxyju. Ločen API endpoint, ker
// proxy ne more poizvedovati baze neposredno. Kratka cache doba (60 s)
// omeji število strelov; odgovor je javen in neuporaben (samo slug).

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const org = await prisma.organization.findFirst({
      where: { status: "ACTIVE", publishState: "PUBLISHED" },
      orderBy: { createdAt: "asc" },
      select: { slug: true },
    })
    return NextResponse.json(
      { slug: org?.slug ?? null },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    )
  } catch {
    return NextResponse.json(
      { slug: null },
      { headers: { "Cache-Control": "no-store" } }
    )
  }
}
