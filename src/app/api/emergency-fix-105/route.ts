// ============================================================
// #105 — ZAČASNA incidentna ruta (evidence-first, fail-closed).
// Isto delo kot scripts/cleanup-suspicious-product.mjs, vendar
// strežniško (produkcija DATABASE_URL). Zaščita: FIX_KEY header
// (naključen 32-hex, samo incidentni tek). Ruta se IZBRIŠE takoj
// po uporabi (vzorec 938f94f). NIKOLI ne izpiše vsebine vrstic —
// samo števce in id-je. BRISANJA NI (isActive=false + popravek).
// ============================================================

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const NEEDLES = ["defacer.id", "raxor404"]
const FIX_NAME = "Anti-Aging Facial Serum"
const FIX_SKU = "SRM-001"

const INSENSITIVE_OR = NEEDLES.map((n) => ({ contains: n, mode: "insensitive" as const }))

function isAuthorized(req: Request): boolean {
  const key = process.env.FIX_KEY
  if (!key || key.length < 16) return false
  const header = req.headers.get("x-fix-key") ?? ""
  // timing-safe primerjava
  if (header.length !== key.length) return false
  let diff = 0
  for (let i = 0; i < key.length; i += 1) diff |= header.charCodeAt(i) ^ key.charCodeAt(i)
  return diff === 0
}

async function scanProducts() {
  const rows = await prisma.product.findMany({
    where: { OR: INSENSITIVE_OR.flatMap((c) => [{ name: c }, { sku: c }, { description: c }]) },
    select: {
      id: true,
      organizationId: true,
      name: true,
      sku: true,
      isActive: true,
      presetSeed: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return rows.map((row) => {
    const fields: string[] = []
    const blob = `${row.name} ${row.sku ?? ""} ${row.description ?? ""}`.toLowerCase()
    for (const n of NEEDLES) if (blob.includes(n.toLowerCase())) fields.push(n)
    return { ...row, matchedNeedles: fields }
  })
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return new NextResponse(null, { status: 404 })
  }
  const url = new URL(req.url)
  const apply = url.searchParams.get("apply") === "1"

  const products = await scanProducts()
  const evidence = products.map((p) => ({
    id: p.id,
    organizationId: p.organizationId,
    isActive: p.isActive,
    presetSeed: p.presetSeed,
    matchedNeedles: p.matchedNeedles,
  }))

  if (!apply) {
    return NextResponse.json({
      mode: "DRY-RUN",
      affectedProducts: evidence.length,
      evidence,
      note: "APPLY z ?apply=1: isActive=false + name/sku popravek. Brisanja ni.",
    })
  }

  let fixed = 0
  for (const p of products) {
    await prisma.product.update({
      where: { id: p.id },
      data: { isActive: false, name: FIX_NAME, sku: FIX_SKU },
    })
    fixed += 1
  }

  // Ponovni scan po popravljanju (mora biti 0)
  const after = await scanProducts()

  return NextResponse.json({
    mode: "APPLY",
    fixed,
    afterScanCount: after.length,
    done: after.length === 0,
  })
}
