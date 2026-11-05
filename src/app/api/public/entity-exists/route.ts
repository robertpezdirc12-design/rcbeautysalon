import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// ============================================================
// P1 #27 (re-audit 2026-11) — OBSTOJ ENTITETE ZA PROXY
//
// Manjkajoče storitve/člani ekipe/izdelki so prej vrnili HTTP 200
// (soft 404), ker notFound() v strani pride po streaming splaku.
// Proxy s tem endpointom preveri obstoj PRED prepisom poti in pri
// odsotnosti prepiše na rezervirano 404 pot → pravi HTTP 404.
// ============================================================

export const dynamic = "force-dynamic"

const staffSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get("orgId")?.trim()
  const type = searchParams.get("type")
  const slug = searchParams.get("slug")?.trim()

  if (!orgId || !slug || !["service", "staff", "product"].includes(type ?? "")) {
    return NextResponse.json({ error: "orgId, type, slug required" }, { status: 400 })
  }

  try {
    let exists = false
    if (type === "service") {
      exists = !!(await prisma.service.findFirst({
        where: { organizationId: orgId, slug, isActive: true },
        select: { id: true },
      }))
    } else if (type === "product") {
      // #105: forSale joins the gate (detail page must match the shop LIST
      // filter) — a tracked-but-not-sellable product is not publicly
      // openable either, so the proxy serves a real 404 for it too.
      exists = !!(await prisma.product.findFirst({
        where: { organizationId: orgId, id: slug, isActive: true, forSale: true },
        select: { id: true },
      }))
    } else {
      const members = await prisma.staff.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { name: true },
      })
      exists = members.some((m) => staffSlug(m.name) === slug)
    }

    return NextResponse.json(
      { exists },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    )
  } catch {
    // Fail-open — glej resolve-tenant.
    return NextResponse.json(
      { exists: true, unknown: true },
      { headers: { "Cache-Control": "no-store" } }
    )
  }
}
