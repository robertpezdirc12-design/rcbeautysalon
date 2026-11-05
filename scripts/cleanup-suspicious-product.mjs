/**
 * ============================================================
 * #105 (P0 incident): evidence-first čiščenje sumljivih vsebin.
 *
 * V produkcijski bazi je bilo v poljih `name` IN `sku` izdelka
 * shranjen XSS payload (`defacer.id` / `raxor404`). Payload je
 * renderiran vedno ubežan (RSC flight escaping) — ni dokaza o
 * živem XSS, ampak zapis je javno viden in ga je treba odstraniti.
 *
 * NAČELO (issue #105 — runbook):
 *   1. NARROW ujemanje: dobesedno "defacer.id" ALI "raxor404"
 *      (brez širokega regexa — nameravamo samo dokazane nizе).
 *   2. DRY-RUN (privzeto): samo IZPIS polne evidence prizadetih
 *      vrstic (id, org, časovni žigi, isActive, presetSeed) čez
 *      Product + ostale javno vidne tekstovne tabele.
 *   3. APPLY=1: deaktivacija izdelka (isActive=false) + popravek
 *      name/sku na vrednosti preset vzorca. BRISANJA NI —
 *      ohranimo povezane podatke (naročila) in dokaze.
 *   4. Ostale tabele: samo evidence (V-2 preverba), popravki po
 *      posebnem odločanju lastnika.
 *
 * SAFETY: brez APPLY je skript strogo READ-ONLY. Z APPLY menja
 * SAMO Products.name/sku/isActive prizadetih vrstic — nič drugega.
 * Brisanje ne obstaja v tej kodi (ni deleteMany / delete).
 *
 * Run: DATABASE_URL=… node scripts/cleanup-suspicious-product.mjs
 *      APPLY=1 DATABASE_URL=… node scripts/cleanup-suspicious-product.mjs
 * ============================================================
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "" },
  },
})

const APPLY = process.env.APPLY === "1"
/** Ožji vzorec (issue #105): dobesedna niza, ne širok regex. */
const NEEDLES = ["defacer.id", "raxor404"]
/** Vrednosti vzorca preset izdelka (issue #105 runbook, korak 3). */
const FIX_NAME = "Anti-Aging Facial Serum"
const FIX_SKU = "SRM-001"

const INSENSITIVE_OR = NEEDLES.map((n) => ({ contains: n, mode: "insensitive" }))

function flag(text) {
  if (typeof text !== "string") return []
  return NEEDLES.filter((n) => text.toLowerCase().includes(n.toLowerCase()))
}

/** Evidence vrstica — polni kontekst za incidentno evidenco (#105). */
function evidence(row, fields, extra = {}) {
  return {
    id: row.id,
    organizationId: row.organizationId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extra,
    matchedFields: fields,
  }
}

async function scanProducts() {
  const rows = await prisma.product.findMany({
    where: { OR: INSENSITIVE_OR.flatMap((c) => [{ name: c }, { sku: c }, { description: c }]) },
  })
  return rows.map((row) => {
    const fields = [
      flag(row.name).length > 0 && ["name"],
      flag(row.sku).length > 0 && ["sku"],
      flag(row.description).length > 0 && ["description"],
    ]
      .filter(Boolean)
      .flat()
    return {
      row,
      fields,
      evidence: evidence(row, fields, {
        isActive: row.isActive,
        presetSeed: row.presetSeed,
        sku: row.sku,
      }),
    }
  })
}

/** Ostale javno vidne tekstovne tabele — samo evidence (korak 4). */
async function scanOthers() {
  const out = {}

  const services = await prisma.service.findMany({
    where: { OR: INSENSITIVE_OR.flatMap((c) => [{ name: c }, { description: c }]) },
    select: { id: true, organizationId: true, name: true, createdAt: true, updatedAt: true },
  })
  out.services = services.map((r) =>
    evidence(
      r,
      [
        flag(r.name).length > 0 && ["name"],
        flag(r.description).length > 0 && ["description"],
      ]
        .filter(Boolean)
        .flat()
    )
  )

  const categories = await prisma.category.findMany({
    where: { OR: INSENSITIVE_OR.map((c) => ({ name: c })) },
    select: { id: true, organizationId: true, name: true, createdAt: true, updatedAt: true },
  })
  out.categories = categories.map((r) => evidence(r, ["name"]))

  const staff = await prisma.staff.findMany({
    where: { OR: INSENSITIVE_OR.map((c) => ({ name: c })) },
    select: { id: true, organizationId: true, name: true, createdAt: true, updatedAt: true },
  })
  out.staff = staff.map((r) => evidence(r, ["name"]))

  const orgs = await prisma.organization.findMany({
    where: { OR: INSENSITIVE_OR.map((c) => ({ name: c })) },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  })
  out.organizations = orgs.map((r) => evidence(r, ["name"]))

  const forms = await prisma.formDefinition.findMany({
    where: { OR: INSENSITIVE_OR.map((c) => ({ name: c })) },
    select: { id: true, organizationId: true, name: true, createdAt: true, updatedAt: true },
  })
  out.formDefinitions = forms.map((r) => evidence(r, ["name"]))

  const reviews = await prisma.review.findMany({
    where: { OR: INSENSITIVE_OR.map((c) => ({ comment: c })) },
    select: { id: true, organizationId: true, comment: true, createdAt: true, updatedAt: true },
  })
  out.reviews = reviews.map((r) => evidence(r, ["comment"]))

  return out
}

async function main() {
  console.log(`#105 čiščenje — način: ${APPLY ? "APPLY (popravlja name/sku/isActive prizadetih izdelkov)" : "DRY-RUN (samo evidence)"}`)
  console.log(`Vzorec: ${NEEDLES.join(" | ")}\n`)

  const products = await scanProducts()
  console.log(`── Products: ${products.length} prizadetih ──`)
  for (const p of products) {
    console.log(JSON.stringify(p.evidence, null, 2))
  }

  const others = await scanOthers()
  for (const [table, rows] of Object.entries(others)) {
    if (rows.length > 0) {
      console.log(`\n── ${table}: ${rows.length} prizadetih (samo evidence) ──`)
      for (const r of rows) console.log(JSON.stringify(r, null, 2))
    }
  }
  const othersTotal = Object.values(others).reduce((s, r) => s + r.length, 0)

  if (!APPLY) {
    console.log(
      `\nDRY-RUN: nič ni bilo spremenjeno. Zagon z APPLY=1 deaktivira in popravi ` +
        `${products.length} Products (isActive=false, name="${FIX_NAME}", sku="${FIX_SKU}"). Ostale tabele (${othersTotal}) ostanejo za odločitev lastnika.`
    )
    await prisma.$disconnect()
    return
  }

  if (products.length === 0) {
    console.log("\nAPPLY: nič za popraviti (0 prizadetih Products).")
    await prisma.$disconnect()
    return
  }

  // Korak 3 runbooka: deaktivacija + popravek name/sku. BRISANJA NI.
  let fixed = 0
  for (const p of products) {
    const updated = await prisma.product.update({
      where: { id: p.row.id },
      data: { isActive: false, name: FIX_NAME, sku: FIX_SKU },
    })
    fixed += 1
    console.log(`APPLY: Product ${updated.id} — isActive=false, name/sku popravljen.`)
  }
  console.log(`\nAPPLY končan: ${fixed} izdelkov deaktiviranih in popravljenih. Preveri javno stran /shop in detail stran.`)
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error("Napaka:", error)
  await prisma.$disconnect()
  process.exit(1)
})
