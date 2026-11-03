import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { reconcileProfileAssets } from "@/lib/profiles/backfill"

// ============================================================
// ZAČASNI POPRAVNI ENDPOINT (P0 #23 / #24 — re-audit 2026-11)
//
// Produkcijska baza ni dosegljiva lokalno, popravki PODATKOV pa
// so nujni (vertikala najemnika + prišleške definicije obrazcev).
// Vzorec kot pri #18 (migrate-default-media):
//  - POST samo, z glavo x-migration-token,
//  - timing-safe primerjava, token unset → 404 (fail-closed),
//  - dryRun=true (privzeto) samo POROČA, nič ne piše.
//
// ⚠️ PO IZVEDBI POPRAVKOV IZBRIŠI TA ROUTE + VERCEL ENV
//    MIGRATION_TOKEN (naslednji commit).
// ============================================================

const TOKEN_ENV = "MIGRATION_TOKEN"

function tokenMatches(provided: string | null): boolean {
  const expected = process.env[TOKEN_ENV]
  if (!expected || !provided) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

interface RepairBody {
  dryRun?: boolean
  /** Slug najemnika, kiemu se popravi vertikala (npr. "rc-beauty"). */
  slug?: string
  /** Novi activity profile id (npr. "beauty"). Mora obstajati v registry. */
  vertical?: string
  /** P1 #39-4: v komentarjih mnenj najemnika popravi omembe "Lara" → "Laura"
   * (oseba ne obstaja v ekipi — očitna napaka sejanja). */
  fixSeedReviews?: boolean
}

export async function POST(request: Request) {
  if (!tokenMatches(request.headers.get("x-migration-token"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: RepairBody = {}
  try {
    body = (await request.json()) as RepairBody
  } catch {
    body = {}
  }

  const dryRun = body.dryRun !== false
  const actions: string[] = []

  // ---- 1) Vertikala najemnika (P0 #24) ----
  let verticalChanged = false
  if (body.slug && body.vertical) {
    const org = await prisma.organization.findUnique({
      where: { slug: body.slug },
      select: { id: true, slug: true, vertical: true },
    })
    if (!org) {
      return NextResponse.json(
        { error: `Organization "${body.slug}" not found` },
        { status: 400 }
      )
    }
    const { PROFILES } = await import("@/lib/profiles/registry")
    if (!PROFILES[body.vertical]) {
      return NextResponse.json(
        { error: `Unknown vertical "${body.vertical}"` },
        { status: 400 }
      )
    }
    if (org.vertical !== body.vertical) {
      verticalChanged = true
      actions.push(
        `${org.slug}: vertical "${org.vertical}" → "${body.vertical}"`
      )
      if (!dryRun) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { vertical: body.vertical },
        })
      }
    } else {
      actions.push(`${org.slug}: vertical already "${org.vertical}" (no change)`)
    }
  }

  // ---- 2) Usklajevanje profilnih definicij (P0 #23) ----
  // (za dryRun poročamo stanje; reconcile je idempotenten, zato lahko
  //  poročamo na podlagi trenutnih vrstic)
  let reconcile: Awaited<ReturnType<typeof reconcileProfileAssets>> | null = null
  if (!dryRun) {
    reconcile = await reconcileProfileAssets(prisma)
    for (const org of reconcile.orgs) {
      if (
        org.createdForms > 0 ||
        org.deactivatedForms.length > 0 ||
        org.createdWorkflows > 0 ||
        org.deactivatedWorkflows.length > 0
      ) {
        actions.push(
          `${org.slug}: +${org.createdForms}/-${org.deactivatedForms.length} forms, +${org.createdWorkflows}/-${org.deactivatedWorkflows.length} workflows`
        )
      }
    }
  }

  // ---- 3) P1 #39-4: omemba "Lara" → "Laura" v mnenjih najemnika ----
  let reviewsFixed = 0
  if (body.fixSeedReviews && body.slug) {
    const org = await prisma.organization.findUnique({
      where: { slug: body.slug },
      select: { id: true },
    })
    if (org) {
      const reviews = await prisma.review.findMany({
        where: { service: { organizationId: org.id }, comment: { contains: "Lara" } },
        select: { id: true, comment: true },
      })
      for (const review of reviews) {
        const fixed = review.comment.replaceAll(/\bLara\b/g, "Laura")
        reviewsFixed++
        actions.push(`review ${review.id}: "Lara" → "Laura"`)
        if (!dryRun) {
          await prisma.review.update({
            where: { id: review.id },
            data: { comment: fixed },
          })
        }
      }
    }
  }

  // ---- Poročilo o TRENUTNEM stanju (tudi za dryRun) ----
  const orgReport = await prisma.organization.findMany({
    select: {
      slug: true,
      vertical: true,
      publishState: true,
      status: true,
      _count: {
        select: {
          formDefinitions: { where: { isActive: true } },
          workflowDefinitions: { where: { isActive: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json({
    dryRun,
    actions: actions.length > 0 ? actions : ["(no changes needed)"],
    verticalChanged,
    reviewsFixed,
    ...(reconcile ? { reconcile: reconcile.totals } : {}),
    orgs: orgReport.map((o) => ({
      slug: o.slug,
      vertical: o.vertical,
      publishState: o.publishState,
      status: o.status,
      activeForms: o._count.formDefinitions,
      activeWorkflows: o._count.workflowDefinitions,
    })),
  })
}
