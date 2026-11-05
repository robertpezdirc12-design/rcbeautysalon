import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  RESOLVER_PROOF_HEADER,
  resolverExpectedOrigin,
  verifyResolverQueryForOrigin,
} from "@/lib/tenant-proof"
import { hostFromHostHeader } from "@/lib/domains/normalize"
import { isBookingEnabled } from "@/lib/public-cta"
import { getProfile, isCapabilityEnabled } from "@/lib/profiles/registry"
import { applyOverrides, parseOverrides } from "@/lib/profiles/overrides"

// ============================================================
// PR #103 review round 2 (Codex — najdba "lastne domene") —
// RAZREŠITEV PREVERJENE CUSTOM DOMENE ZA PROXY
//
// Na lastni domeni proxy prej ni imel najemniškega konteksta (glavo je
// odstranil in nadaljeval brez nje): anonimni obiskovalec je na golih
// javnih poteh dobil 404, "/" pa je padel na najstarejšega ACTIVE
// najemnika (napačna blagovna znamka). Ta endpoint vrne najemnika, ki
// mu pripada preverjena (VERIFIED) CustomDomain vrstica za zahtevani
// gostitelj — proxy iz odgovora podpiše ISTO najemniško glavo, kot jo
// ustvari za /s/<slug>, zato je celotna aplikacijska površina na
// lastni domeni enakovredna poti /s/<slug>.
//
// Varnost (issue #102 V-1/V-4, enaka pravila kot resolve-tenant):
//  - PROXY-ONLY: vsak klic brez veljavnega, ZA IZVOR vezanega dokaza
//    je zavrnjen 401 (obiskovalec ne more raziskovati domen → orgId).
//  - Gostitelj normalizira hostFromHostHeader (isto pravilo na obeh
//    straneh) — payload dokaza je točno normalizirana vrednost.
//  - matched:false za nepreverjene/neobstoječe domene (brez razkrivanja
//    tega, KATERE domene so v bazi).
// ============================================================

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  // Normalizacija na OBEH straneh (proxy pošlje že normaliziran Host;
  // tukaj ga preverimo enako) — payload dokaza je točno ta vrednost.
  const host = hostFromHostHeader(searchParams.get("host"))
  if (!host) {
    return NextResponse.json({ error: "host required" }, { status: 400 })
  }

  const expectedOrigin = resolverExpectedOrigin(request)
  const proof = request.headers.get(RESOLVER_PROOF_HEADER)
  if (
    !expectedOrigin ||
    !(await verifyResolverQueryForOrigin(expectedOrigin, `host=${host}`, proof))
  ) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  }

  try {
    const matched = await prisma.customDomain.findFirst({
      where: { domain: host, status: "VERIFIED" },
      select: {
        organization: {
          select: {
            id: true,
            slug: true,
            vertical: true,
            profileOverrides: true,
            status: true,
            publishState: true,
          },
        },
      },
    })

    // Nepreverjena ali neznana domena: proxy nadaljuje BREZ najemniške
    // glave (pass-through — Vercel preview/dev gostitelji ostanejo
    // delujoči; platforma ne razkriva, katere domene so v bazi).
    if (!matched) {
      return NextResponse.json(
        { matched: false },
        { headers: { "Cache-Control": "private, no-store" } }
      )
    }

    const org = matched.organization
    // Neznan ALI suspendiran najemnik: za proxy je to "ne obstaja"
    // (spletna stran je OFF — pravi 404, ne soft 404). 1 s negativni
    // TTL v proxy cache (usklajeno z resolve-tenant).
    if (!org || org.status !== "ACTIVE") {
      return NextResponse.json(
        { matched: true, exists: false },
        { headers: { "Cache-Control": "private, no-store" } }
      )
    }

    return NextResponse.json(
      {
        matched: true,
        exists: true,
        slug: org.slug,
        orgId: org.id,
        publishState: org.publishState,
        bookingEnabled: isBookingEnabled(org.vertical, org.profileOverrides),
        servicesEnabled: isCapabilityEnabled(
          applyOverrides(
            getProfile(org.vertical),
            parseOverrides(org.profileOverrides)
          ),
          "services"
        ),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    )
  } catch {
    // Napaka baze: proxy nadaljuje brez glave (pass-through) —
    // aplikacijska razrešitev custom domene (tenant.ts) je druga linija.
    return NextResponse.json(
      { matched: false },
      { headers: { "Cache-Control": "private, no-store" } }
    )
  }
}
