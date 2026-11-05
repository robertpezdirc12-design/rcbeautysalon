import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  RESOLVER_PROOF_HEADER,
  resolverExpectedOrigin,
  verifyResolverQueryForOrigin,
} from "@/lib/tenant-proof"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import { isCapabilityEnabled } from "@/lib/profiles/registry"

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

  // issue #102 (V-1/V-4): PROXY-ONLY endpoint. Every legitimate call comes
  // from the proxy (which signs the query). A direct visitor call would
  // confirm the existence of any slug — including DRAFT tenants — so it is
  // rejected 401 (enumeration closed; the proxy flow is unaffected).
  //
  // PR #103 review round 2 (Codex): the proof is BOUND TO THE TRUSTED
  // ORIGIN — a proof harvested via an attacker-controlled `Host` on a
  // self-hosted deployment (proxy fetch steered to a foreign server)
  // cannot be replayed here: this endpoint accepts only proofs minted
  // for THIS deployment's canonical env origin. Production without the
  // env configured rejects EVERY proof (fail-closed).
  const expectedOrigin = resolverExpectedOrigin(request)
  const proof = request.headers.get(RESOLVER_PROOF_HEADER)
  if (
    !expectedOrigin ||
    !(await verifyResolverQueryForOrigin(expectedOrigin, `slug=${slug}`, proof))
  ) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        vertical: true,
        secondaryVertical: true,
        profileOverrides: true,
        status: true,
        publishState: true,
        // #100 8.C (F2): modulna vrata tudi v proxy (zadnja beseda).
        moduleStates: { select: { moduleId: true, state: true } },
      },
    })

    // Neznan ALI suspendiran najemnik: za proxy je to "ne obstaja"
    // (spletna stran je OFF — pravi 404, ne soft 404).
    // P3 #64: negativen odgovor se NE cacheira — to je edini odgovor,
    // ki ga naslednja uporabnikova akcija (OBJAVA) lahko razveljavi.
    // Cacheiran exists:false je povzročil ~20 s 404 po uspešni objavi
    // (lastnik je mislil, da je objava spodletela). Ponovni izračun je
    // poceni (findUnique po indeksiranem slugu), napaka pa draga.
    if (!org || org.status !== "ACTIVE") {
      return NextResponse.json(
        { exists: false },
        { headers: { "Cache-Control": "no-store" } }
      )
    }

    return NextResponse.json(
      {
        exists: true,
        orgId: org.id,
        publishState: org.publishState,
        // #100 8.C (F2): polni resolve (vertikala → sekundarna → overrides →
        // moduleStates) — modulna vrata veljajo tudi za proxy (pravi 404).
        bookingEnabled:
          resolveEffectiveProfile(org).website.ctaMode === "booking" &&
          isCapabilityEnabled(resolveEffectiveProfile(org), "appointments"),
        // P2 #46: profil, ki izključuje storitve (npr. čebelarstvo), ne
        // objavlja /services — proxy lahko tedaj vrne PRAVI 404 (statusne
        // kode zmore samo proxy, glej komentar zgoraj).
        servicesEnabled: isCapabilityEnabled(
          resolveEffectiveProfile(org),
          "services"
        ),
      },
      // PR #103 review round 2: PROXY-ONLY endpoint — responses must not
      // be stored/served by shared caches. The proxy keeps its own 15 s
      // in-memory cache, so no-store costs nothing and removes the risk
      // of a middle cache handing a proof-gated answer to anyone else.
      { headers: { "Cache-Control": "private, no-store" } }
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
