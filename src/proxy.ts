import { auth } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import { isPlatformAdminEmail, PLATFORM_ADMIN_EMAILS_ENV } from "@/lib/platform/access"
import {
  ORG_HEADER,
  ORG_PROOF_HEADER,
  RESOLVER_PROOF_HEADER,
  proxyResolverOrigin,
  signOrgSlug,
  signResolverQueryForOrigin,
  verifyOrgSlug,
} from "@/lib/tenant-proof"
import { hostFromHostHeader, isPlatformHost } from "@/lib/domains/normalize"
import { getPlatformHostsFromEnv } from "@/lib/domains/platform-hosts"
import {
  PLATFORM_LOCALE_HEADER,
  platformLocaleForPath,
} from "@/lib/i18n/platform-locale"
import {
  PLATFORM_LANDING_HEADER,
  PLATFORM_LANDING_HEADER_VALUE,
  isPlatformLandingPath,
} from "@/lib/platform-shell"

// ------------------------------------------------------------
// P1 #39-5 (re-audit 2026-11): goli javni dostop ("/services", …)
// je VEDNO pripadal najstarejšemu objavljenemu najemniku — dvojniki
// in napačna pozornost.
// P1 #66: goli "/" je izložen — koren platforme je PRODUKTNA izložba.
// P2 #72 (ODLOČITEV, OPCIJA A — platformska nevtralnost): goli
// vsebinske poti (/services, /staff, /shop, /booking, /cart,
// /inquiry) NE gredo več k najstarejšemu najemniku — na gostitelju
// platforme so 404 (pravi status rešuje proxy; Next 16 streaming
// notFound() v strani ga ne zmore, glej #44). Zgodovinske povezave
// (npr. salonove) se ohranijo z DOKUMENTIRANIM dednim pravilom: env
// LEGACY_DEFAULT_SLUG=<slug> — ko je nastavljen, goli dostop 308 na
// /s/<slug>… Eksplicitno, odstranljivo, testno pokrito. /s/<slug>
// in custom domene ostanejo nespremenjene.
// ------------------------------------------------------------
const BARE_PUBLIC_PATH = /^\/(services|staff|shop|booking|cart|inquiry|vrsta)(\/|$)/

// ------------------------------------------------------------
// P0 #24 / P1 #27 (re-audit 2026-11): Next.js 16 streaming pomeni,
// da notFound()/redirect() v layoutih/straneh NE moreta več nastaviti
// HTTP statusa (lupina je že odposlana s 200). Statusne kode zato
// rešuje PROXY prek internih API klicev (krašo cacheiranih):
//  - neznan/suspendiran tenant pod /s/{slug} → prepis na rezervirano
//    404 pot → pravi HTTP 404 z blagovno stranjo (app/not-found.tsx),
//  - manjkajoča storitev/član/izdelek → isto (pravi 404),
//  - neobjavljen tenant (#44) → pravi 404 za vse, razen lastniškega
//    predogleda (session.organizationId == tenant.orgId),
//  - /booking za ne-booking profile → pravi 307 na /inquiry,
//  - /inquiry za booking profile → pravi 307 na domačo stran.
// Fail-open: ob napaki API-ja se strani NE ugasanje — page-level
// notFound() ostane rezervna zaščita.
// ------------------------------------------------------------
const RESERVED_404_PATH = "/__not_found__"

type TenantInfo = {
  exists: boolean
  orgId?: string
  bookingEnabled?: boolean
  /** P2 #44: "PUBLISHED" | "DRAFT" | … — neobjavljen najemnik je privaten. */
  publishState?: string
  /** P2 #46: profil, ki izključuje storitve, ne servira /services. */
  servicesEnabled?: boolean
  /** #105-nadaljevanje (G1): izklopljena trgovina → /shop* pravi 404. */
  shopEnabled?: boolean
  walkInEnabled?: boolean
  /** #105-nadaljevanje (G3): izklopljeni forms → /inquiry pravi 404. */
  formsEnabled?: boolean
}

/** Odgovor /api/public/resolve-host — VERIFIED custom domain najemnik. */
type HostTenantInfo = TenantInfo & {
  /** Ta gostitelj je sploh preverjena custom domena (VERIFIED vrstica). */
  matched: boolean
  /** Slug najemnika, ki mu domena pripada (samo pri matched: true). */
  slug?: string
}

const tenantCache = new Map<string, { info: TenantInfo; exp: number }>()
const entityCache = new Map<string, { exists: boolean; exp: number }>()
const hostCache = new Map<string, { info: HostTenantInfo | null; exp: number }>()

/**
 * PR #103 review round 2 (Codex — dokaz resolverja vezan na izvor):
 * vsi INTERNI fetchi proxyja gredo na ZAUPANJA VREDEN izvor iz env
 * (NEXT_PUBLIC_APP_URL / NEXTAUTH_URL — isti vir kot seznam platformskih
 * gostiteljev), NIKOLI na req.nextUrl.origin. Pri self-hosted postavitvi,
 * ki je dosegljiva pod napadalčevim ali IP Host, bi interni fetch sicer
 * ODPOSLAL podpisan dokaz na tuj strežnik (ta ga nato lahko replika proti
 * pravi aplikaciji). Vezava HMAC na izvor naredi pobran dokaz neuporabnega
 * kjerkoli drugje.
 *
 * PR #103 review round 4 (lastnik): izvor iz ZAHTEVE je dovoljen SAMO
 * izven produkcije (lokalni peskovniki brez env). V PRODUKCIJI brez
 * zaupanja vrednega env izvora proxy NE izvede internega fetch-a SPLOH
 * (null) — podpisan dokaz nikoli ne odide na naslov, izpeljan iz
 * vhodne zahteve, tudi če bi resolver dokaz vseeno zavrnul.
 */
function resolverOrigin(req: { nextUrl: URL }): string | null {
  return proxyResolverOrigin(req)
}

async function resolveTenant(
  origin: string | null,
  slug: string
): Promise<TenantInfo | null> {
  // PR #103 review round 4: produkcija brez zaupanja vrednega izvora —
  // brez internega fetch-a (dokaz nikoli ne odide na izvor iz zahteve).
  if (!origin) return null
  const hit = tenantCache.get(slug)
  if (hit && hit.exp > Date.now()) return hit.info
  try {
    // issue #102 (V-1/V-4): the resolver is proxy-only — every internal
    // fetch carries an HMAC proof bound to the TRUSTED origin; direct
    // visitor calls are rejected 401.
    const res = await fetch(`${origin}/api/public/resolve-tenant?slug=${encodeURIComponent(slug)}`, {
      cache: "no-store",
      headers: {
        [RESOLVER_PROOF_HEADER]: await signResolverQueryForOrigin(origin, `slug=${slug}`),
      },
    })
    if (!res.ok) return null
    const info = (await res.json()) as TenantInfo
    // P0 #24 (reopen): 15 s — usklajeno z Cache-Control resolverja;
    // spremembe vertikale/objave so vidne najkasneje ~1,25 min.
    // P3 #64: negativen odgovor (exists:false) je edini, ki ga naslednja
    // akcija lastnika (objava) takoj razveljavi — dobi le 1 s TTL, da
    // še vedno duši 404 burke za nezane sluge, objava pa je vidna takoj.
    // Pozitivni odgovor ostane na 15 s (usklajen z resolverjem).
    tenantCache.set(slug, {
      info,
      exp: Date.now() + (info.exists ? 15_000 : 1_000),
    })
    return info
  } catch {
    return null
  }
}

/**
 * PR #103 review round 2 (Codex — lastne domene): razreši preverjeno
 * custom domeno v najemnika SERVER-SIDE (CustomDomain tabela, status
 * VERIFIED). Obiskovalec nastavi samo Host — kot pri DNS usmerjanju;
 * podpisan najemniški glavi se ne more nastaviti za poljuben slug,
 * ker ga proxy podpiše SAMO za gostitelja, ki v bazi res pripada
 * temu najemniku.
 */
async function resolveTenantByHost(
  origin: string | null,
  host: string
): Promise<HostTenantInfo | null> {
  // PR #103 review round 4: glej resolveTenant — brez zaupanja vrednega
  // izvora v produkciji NI internega fetch-a (pass-through, aplikacijska
  // razrešitev custom domene v tenant.ts je druga linija).
  if (!origin) return null
  const hit = hostCache.get(host)
  if (hit && hit.exp > Date.now()) return hit.info
  try {
    const res = await fetch(`${origin}/api/public/resolve-host?host=${encodeURIComponent(host)}`, {
      cache: "no-store",
      headers: {
        [RESOLVER_PROOF_HEADER]: await signResolverQueryForOrigin(origin, `host=${host}`),
      },
    })
    if (!res.ok) return null
    const info = (await res.json()) as HostTenantInfo
    // Pozitiven odgovor 15 s (usklajeno z resolve-tenant); "ni preverjena
    // domena" / "najemnik ni živ" dobi 1 s — preverjanje domene oz. objava
    // so vidni takoj, brez zastrupljenega okna.
    const positive = info.matched && info.exists
    hostCache.set(host, { info, exp: Date.now() + (positive ? 15_000 : 1_000) })
    return info
  } catch {
    return null
  }
}

async function entityExists(
  origin: string | null,
  orgId: string,
  type: "service" | "staff" | "product",
  slug: string
): Promise<boolean> {
  // PR #103 review round 4: brez zaupanja vrednega izvora v produkciji NI
  // internega fetch-a; enak fail-open kot pri nedosegljivem resolverju.
  if (!origin) return true
  const key = `${type}:${orgId}:${slug}`
  const hit = entityCache.get(key)
  if (hit && hit.exp > Date.now()) return hit.exists
  try {
    const res = await fetch(
      `${origin}/api/public/entity-exists?orgId=${encodeURIComponent(orgId)}&type=${type}&slug=${encodeURIComponent(slug)}`,
      {
        cache: "no-store",
        headers: {
          [RESOLVER_PROOF_HEADER]: await signResolverQueryForOrigin(
            origin,
            `${orgId}:${type}:${slug}`
          ),
        },
      }
    )
    if (!res.ok) return true // fail-open
    const data = (await res.json()) as { exists: boolean; unknown?: boolean }
    if (data.unknown) return true
    // 30 s: dovolj čvrsto za zaščito pred 404 stormi, dovolj kratko,
    // da nov ustvarjen/izbrisan entiteta hitro postane (ne)obstojeca.
    entityCache.set(key, { exists: data.exists, exp: Date.now() + 30_000 })
    return data.exists
  } catch {
    return true // fail-open
  }
}

/** Rezervirana 404 pot: neujeta z nobeno smero → pravi HTTP 404 + blagovna stran. */
function rewriteTo404(req: { nextUrl: URL }, requestHeaders?: Headers) {
  const url = new URL(RESERVED_404_PATH, req.nextUrl.origin)
  // issue #102 (V-1): the 404 page runs the root layout — the (stripped)
  // request headers MUST propagate so a forged header cannot brand even
  // the not-found page with a foreign tenant.
  return requestHeaders
    ? NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    : NextResponse.rewrite(url)
}

type GateRequest = {
  url: string
  nextUrl: URL
  auth?: { user?: { organizationId?: string | null } | null } | null
}

/**
 * Skupna VRATA najemnika za OBE najemniški površini: /s/<slug>/* (na
 * gostitelju platforme) in preverjene custom domene (gola pot). Vrne
 * Response, ko vrata sprožijo (404/307), sicer null — klicatelj nadaljuje.
 *
 * Cilji preusiritev so na /s/<slug> v obliki /s/<slug>/…, na custom
 * domenah pa GOLI (tam je /s/<slug> vedno 404 — domena servira samo svoj
 * najemnik na golih poteh).
 */
async function runTenantGates(opts: {
  req: GateRequest
  slug: string
  tenant: TenantInfo | null
  sub: string
  requestHeaders: Headers
  origin: string | null
  isCustomHost: boolean
}): Promise<Response | null> {
  const { req, tenant, sub, requestHeaders, origin, isCustomHost } = opts

  // P2 #44 (audit-2026-11): neobjavljen najemnik (DRAFT/…) je privaten
  // — prej je layout vrnil vzdrževalni zaslon kot HTTP 200 (soft 404,
  // indeksirajo ga iskalniki; naslov je padel na generični "Salon
  // Platform"). Statusne kode zmore SAMO proxy (Next 16 streaming),
  // zato 404 tukaj. Lastnik/staff TEGA najemnika (pregled pred objavo)
  // gre naprej — layout servira predogled z rumeno vrstico.
  if (
    tenant?.exists &&
    tenant.publishState &&
    tenant.publishState !== "PUBLISHED" &&
    req.auth?.user?.organizationId !== tenant.orgId
  ) {
    return rewriteTo404(req, requestHeaders)
  }

  if (tenant?.orgId) {
    // Manjkajoče entitete → pravi HTTP 404.
    let missing = false
    const serviceMatch = sub.match(/^\/services\/([^/]+)/)
    const staffMatch = sub.match(/^\/staff\/([^/]+)/)
    const shopMatch = sub.match(/^\/shop\/([^/]+)/)
    if (serviceMatch) {
      missing = !(await entityExists(origin, tenant.orgId, "service", serviceMatch[1]))
    } else if (staffMatch) {
      missing = !(await entityExists(origin, tenant.orgId, "staff", staffMatch[1]))
    } else if (shopMatch) {
      missing = !(await entityExists(origin, tenant.orgId, "product", shopMatch[1]))
    }
    if (missing) return rewriteTo404(req, requestHeaders)

    // P0 #24: booking/inquiry po profilu — pravi 307 (prej 200 + client-nav).
    // Na custom domeni cilj ostane GOL (domena NE streže /s/<slug> poti).
    const inTenant = (path: string) =>
      NextResponse.redirect(
        new URL(isCustomHost ? path : `/s/${opts.slug}${path}`, req.url),
        307
      )
    if (sub === "/booking" && tenant.bookingEnabled === false) {
      return inTenant("/inquiry")
    }
    if (sub === "/inquiry" && tenant.bookingEnabled === true) {
      return inTenant("/")
    }

    // P2 #46: profil brez storitev → PRAVI 404 (prej 200 s praznim
    // seznamom — soft 404, indeksiran; notFound() v layoutu v Next 16
    // streamingu ne more spremeniti statusa). Fail-open: ko proxy ne
    // dobi podatka, pusti stran naprej (layout vrata ostanejo rezerva).
    if (sub === "/services" && tenant.servicesEnabled === false) {
      return rewriteTo404(req, requestHeaders)
    }

    // #105-nadaljevanje (G1): izklopljena trgovina → /shop (katalog) IN
    // /shop/<id> (izdelek) sta PRAVA 404 — prej se je samo povezava na
    // domači strani skrila, URL pa je še vedno deloval. Fail-open, ko
    // proxy ne dobi podatka (page-level notFound() ostaja rezerva).
    if (
      (sub === "/shop" || sub.startsWith("/shop/")) &&
      tenant.shopEnabled === false
    ) {
      return rewriteTo404(req, requestHeaders)
    }

    // #105-nadaljevanje (G3): izklopljeni forms → /inquiry pravi 404.
    // (Veja bookingEnabled===true zgoraj gre prva — tam je /inquiry
    // napačna stran za booking profile in se preusmeri na domačo.)
    if (sub === "/inquiry" && tenant.formsEnabled === false) {
      return rewriteTo404(req, requestHeaders)
    }

    // #100 F5: HIDDEN ali izklopljen walk-in → /vrsta PRAVI 404 (ne
    // soft 404 iz page-level notFound — isti razred kot P2 #46).
    if (sub === "/vrsta" && tenant.walkInEnabled === false) {
      return rewriteTo404(req, requestHeaders)
    }
  }

  return null
}

// ------------------------------------------------------------
// PR #103 review round 2 (Codex — lastne domene): na preverjeni custom
// domeni je glava najemnika dovoljena SAMO na najemniški (javni)
// površini. Auth/admin površine ostanejo SEJSKA — tuj, prijavljen
// upravnik, ki odpre /dashboard na tuj domeni, mora videti SVOJ
// dashboard (glava najemnika bi mu servezala tuje podatke).
// ------------------------------------------------------------
// F1: /en is a PLATFORM marketing route, not a tenant surface — on a
// verified custom domain it must never inherit that tenant's signed
// header, branding or theme.
const CUSTOM_DOMAIN_HEADER_DENYLIST =
  /^\/(?:dashboard|staff-portal|my-account|platform|login|register|start|forgot-password|reset-password|verify-email|en)(\/|$)/

export default auth(async (req) => {
  const { pathname } = req.nextUrl

  // ------------------------------------------------------------
  // V-1 (issue #102) — TENANT HEADER TRUST GATE
  // The visitor-supplied x-org-slug is NEVER trusted. A header pair
  // carrying a VALID HMAC proof was produced by THIS proxy in a
  // previous processing pass (rewrite double-run) and is preserved;
  // anything else (missing proof, tampered value, wrong slug binding)
  // is stripped before anything else runs. The app layer (tenant.ts)
  // verifies the same proof — defense in depth for paths that bypass
  // the proxy (API routes).
  // ------------------------------------------------------------
  const incomingSlug = req.headers.get(ORG_HEADER)
  const trustedIncoming = incomingSlug
    ? await verifyOrgSlug(incomingSlug, req.headers.get(ORG_PROOF_HEADER))
    : false

  const requestHeaders = new Headers(req.headers)

  // F1 — URL LOCALE TRUST GATE. A visitor must not be able to change
  // <html lang> (or the /en metadata) by sending a header: strip any
  // incoming value, then set it ONLY for the explicit English path.
  requestHeaders.delete(PLATFORM_LOCALE_HEADER)
  requestHeaders.delete(PLATFORM_LANDING_HEADER)
  const urlLocale = platformLocaleForPath(pathname)
  if (urlLocale) requestHeaders.set(PLATFORM_LOCALE_HEADER, urlLocale)

  const clearTenantHeader = () => {
    requestHeaders.delete(ORG_HEADER)
    requestHeaders.delete(ORG_PROOF_HEADER)
  }
  if (incomingSlug && !trustedIncoming) clearTenantHeader()

  // V-1 host binding: on a custom-domain host the tenant context is
  // chosen by the VERIFIED HOST only (resolved server-side from the
  // CustomDomain table). No header — not even a proxy-signed one, which
  // can never originate on this host — may override it.
  const requestHost = hostFromHostHeader(req.headers.get("host"))
  const isCustomDomainHost =
    !!requestHost && !isPlatformHost(requestHost, getPlatformHostsFromEnv())

  // ------------------------------------------------------------
  // F2 — PLATFORM LANDING SSR GATE (narrow variant, LANDING-PLAN §10).
  // The root layout omits its client-only CartProvider wrapper ONLY on
  // the two marketing routes, so <h1> and structured data reach crawlers.
  // Exclusions matter: a rewritten /s/<slug> -> / pass already carries
  // the signed ORG_HEADER (a tenant home, not the platform landing), and
  // "/" on a verified custom domain is that tenant's home. "/en" is the
  // exception: it is denylisted on custom domains on purpose (F1), so it
  // stays a platform route. The incoming value was stripped above — a
  // visitor cannot opt a dashboard or cart page out of the wrapper.
  // ------------------------------------------------------------
  const isPlatformLanding =
    isPlatformLandingPath(pathname) &&
    !requestHeaders.has(ORG_HEADER) &&
    (pathname === "/en" || !isCustomDomainHost)
  if (isPlatformLanding) {
    requestHeaders.set(PLATFORM_LANDING_HEADER, PLATFORM_LANDING_HEADER_VALUE)
  }

  if (isCustomDomainHost) {
    clearTenantHeader()
    const cdSlugMatch = pathname.match(/^\/s\/([^/]+)(\/.*)?$/)
    if (cdSlugMatch) {
      // A /s/<slug> path on a custom domain would serve the slug's tenant
      // under someone else's domain — 404. Custom domains serve their own
      // org on bare paths only.
      return rewriteTo404(req, requestHeaders)
    }

    // PR #103 review round 2 (Codex — najdba "lastne domene"): prej je
    // proxy tu samo odstranil glavo in nadaljeval BREZ najemniškega
    // konteksta — anonimni obiskovalec je na golih javnih poteh dobil
    // 404 (redirectBareToTenant), "/" pa je padel na najstarejšega
    // ACTIVE najemnika (napačna blagovna znamka). Zdaj proxy razreši
    // preverjeno domeno SERVER-SIDE in nastavi ISTO podpisano glavo,
    // ki jo uporablja /s/<slug> — celotna aplikacija (landing,
    // /services, /shop, /booking, /cart, /inquiry, akcije) na lastni
    // domeni deluje enako kot pod /s/<slug>. Neznana/nepreverjena
    // domena → brez glave (pass-through, kot doslej — Vercel preview
    // gostitelji in dev naslovi ostanejo delujoči).
    //
    // PR #103 review round 4 (Codex — "administrativne pravice na lastni
    // domeni"): denylist poti (auth/admin površine) NE smejo preskočiti
    // običajnih preverjanj prijave in vlog, zapisanih spodaj. Prej je ta
    // veja za denylist takoj vrnila NextResponse.next() in obšla cela
    // vrata (anonimen obiskovalec je dosegel lupino /dashboard, STAFF ni
    // bil preusmerjen na svojo površino). Zdaj se denylist pot spusti do
    // standardnih vrat spodaj — glava najemnika ostane odstranjena
    // (sejska pravilo), preverjanja pa se izvedejo kot na gostitelju
    // platforme.
    if (!CUSTOM_DOMAIN_HEADER_DENYLIST.test(pathname)) {
      const origin = resolverOrigin(req)
      const hostTenant = await resolveTenantByHost(origin, requestHost!)

      // PR #103 review round 4 (Codex — "začasno onemogočeno podjetje na
      // lastni domeni"): preverjena domena z NEZNANIM ALI SUSPENDIRANIM
      // najemnikom (resolve-host: matched:true, exists:false — brez sluga)
      // se MORA ustaviti s PRAVIM HTTP 404. Prej je zahteva nadaljevala
      // brez najemniškega konteksta in aplikacija padla na privzeto
      // objavljeno podjetje — tuja blagovna znamka pod mrtvo domeno.
      if (hostTenant?.matched && (!hostTenant.exists || !hostTenant.slug)) {
        return rewriteTo404(req, requestHeaders)
      }

      if (hostTenant?.matched && hostTenant.slug) {
        const gates = await runTenantGates({
          req,
          slug: hostTenant.slug,
          tenant: hostTenant,
          sub: pathname || "/",
          requestHeaders,
          origin,
          isCustomHost: true,
        })
        if (gates) return gates

        // Glava je podpisana SAMO za slug, ki v bazi res pripada temu
        // preverjenemu gostitelju (isto zaupanje kot URL-pot /s/<slug>).
        // Brez konfigurirane skrivnosti v produkciji se nič ne podpiše →
        // brez glave (fail-closed, aplikačna razrešitev iz tenant.ts je
        // druga linija).
        const signedProof = await signOrgSlug(hostTenant.slug)
        if (signedProof) {
          requestHeaders.set(ORG_HEADER, hostTenant.slug)
          requestHeaders.set(ORG_PROOF_HEADER, signedProof)
        }
      }
      return NextResponse.next({ request: { headers: requestHeaders } })
    }
    // Denylist pot (auth/admin površina): najemniški kontekst je
    // odstranjen zgoraj; NADALJUJ do običajnih preverjanj prijave in
    // vlog spodaj (ni zgodnjega NextResponse.next()).
  }

  // ---- TENANT RESOLUTION: /s/[slug]/* -> /* with a FRESH signed header ----
  // Must run BEFORE role guards so rewritten public pages resolve the org.
  const orgMatch = pathname.match(/^\/s\/([^/]+)(\/.*)?$/)
  if (orgMatch) {
    const slug = orgMatch[1]

    // P1 #83: /s/<slug>/sitemap.xml in /s/<slug>/robots.txt sta PRAVI ruti,
    // ki opisujeta SAMO tega najemnika — nikoli ju ne prepisuj na globalni
    // /sitemap.xml (izpiše VSE najemnike = kršitev osamljenosti) niti na
    // globalni /robots.txt (oglašuje globalni sitemap). Objavljivost
    // (draft/suspendiran/notranji → 404) uveljavljata sami ruti. Glava jim
    // ni potrebna (params.slug) — strip zgoraj jo je že odstranil.
    const firstHop = orgMatch[2] || "/"
    if (firstHop === "/sitemap.xml" || firstHop === "/robots.txt") {
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    // Gates run on the FIRST pass (no trusted header yet) or whenever the
    // incoming claim does not match the verified URL slug. A preserved
    // double-run pass already passed the gates for this exact slug.
    if (!trustedIncoming || incomingSlug !== slug) {
      // P0 #24 / P1 #27: statusne kode rešuje proxy (glej komentar zgoraj).
      // Samo na PRVEM prehodu (zaupanja vredna glava še ni nastavljena).
      const tenant = await resolveTenant(resolverOrigin(req), slug)
      if (tenant && !tenant.exists) {
        // Neznan ali suspendiran najemnik → pravi HTTP 404 (blagovna stran).
        return rewriteTo404(req, requestHeaders)
      }

      const gates = await runTenantGates({
        req,
        slug,
        tenant,
        sub: orgMatch[2] || "/",
        requestHeaders,
        origin: resolverOrigin(req),
        isCustomHost: false,
      })
      if (gates) return gates

      // V-1: the header is CREATED here from the verified URL slug and
      // SIGNED — a visitor-supplied value never survives into the app.
      // PR #103 review round 2: production WITHOUT a configured secret
      // signs nothing → no trusted header is set at all → tenant pages
      // fail closed to the maintenance screen (never trust an unsigned
      // value, never sign with a guessable constant).
      const signedProof = await signOrgSlug(slug)
      if (signedProof) {
        requestHeaders.set(ORG_HEADER, slug)
        requestHeaders.set(ORG_PROOF_HEADER, signedProof)
      }
      const url = req.nextUrl.clone()
      url.pathname = orgMatch[2] || "/"
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    }

    // Preserved trusted pass (valid proof for THIS exact slug): rewrite
    // again without re-resolving — the gates already passed.
    const sub = orgMatch[2] || "/"
    const url = req.nextUrl.clone()
    url.pathname = sub
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

  // ---- P2 #72 (Opcija A): gola javna pot → platformska nevtralnost ----
  // Brez LEGACY_DEFAULT_SLUG: pravi HTTP 404 (rezervirana pot).
  // Z LEGACY_DEFAULT_SLUG=<slug>: 308 na /s/<slug>… (dokumentirano
  // dedno pravilo za zgodovinske povezave, npr. salonove). Prijavljen
  // lastnik si svojo stran odpre prek /dashboard → "Obišči stran" ali
  // /s/<slug> — goli poti niso lastniški vhod. Zahtevki, ki jih je
  // proxy že prepisal pod najemnika (podpisana glava), ne pridejo sem
  // (orgMatch oz. trustedIncoming varovalka).
  if (
    !orgMatch &&
    !trustedIncoming &&
    BARE_PUBLIC_PATH.test(pathname)
  ) {
    const legacySlug = process.env.LEGACY_DEFAULT_SLUG?.trim()
    if (legacySlug) {
      const url = req.nextUrl.clone()
      url.pathname = `/s/${legacySlug}${pathname}`
      url.search = req.nextUrl.search
      return NextResponse.redirect(url, 308)
    }
    return rewriteTo404(req)
  }

  const isLoggedIn = !!req.auth
  const userRole = req.auth?.user?.role

  // Route definitions
  const isAdminDashboard = pathname.startsWith("/dashboard")
  const isStaffPortal = pathname.startsWith("/staff-portal")
  const isClientArea = pathname.startsWith("/my-account")
  const isAuthPage = pathname === "/login" || pathname === "/register"

  // Platform Operator Console - env allowlist ONLY (EPIC #3 E3-5).
  // This is a UX redirect, not the security boundary: the layout
  // and every action re-check via requirePlatformAdmin().
  if (pathname.startsWith("/platform")) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(pathname)
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
      )
    }
    const operatorAllowed = isPlatformAdminEmail(
      req.auth?.user?.email ?? null,
      process.env[PLATFORM_ADMIN_EMAILS_ENV]
    )
    if (!operatorAllowed) {
      // Never expose the console to tenant users — route them to
      // their own surface instead of leaking that /platform exists.
      if (userRole === "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
      if (userRole === "STAFF") {
        return NextResponse.redirect(new URL("/staff-portal", req.url))
      }
      if (userRole === "CLIENTE") {
        return NextResponse.redirect(new URL("/my-account", req.url))
      }
      return NextResponse.redirect(new URL("/", req.url))
    }
  }

  // Admin Dashboard - ONLY ADMIN
  if (isAdminDashboard) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(pathname)
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
      )
    }
    if (userRole !== "ADMIN") {
      // Staff and clients redirected to their areas
      if (userRole === "STAFF") {
        return NextResponse.redirect(new URL("/staff-portal", req.url))
      }
      if (userRole === "CLIENTE") {
        return NextResponse.redirect(new URL("/my-account", req.url))
      }
      return NextResponse.redirect(new URL("/", req.url))
    }
  }

  // Staff Portal - STAFF and ADMIN
  if (isStaffPortal) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(pathname)
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
      )
    }
    if (userRole !== "STAFF" && userRole !== "ADMIN") {
      // Clients can't access staff portal
      if (userRole === "CLIENTE") {
        return NextResponse.redirect(new URL("/my-account", req.url))
      }
      return NextResponse.redirect(new URL("/", req.url))
    }
  }

  // Client Area - CLIENTE and ADMIN
  if (isClientArea) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(pathname)
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
      )
    }
    if (userRole !== "CLIENTE" && userRole !== "ADMIN") {
      // Staff can't access client area
      if (userRole === "STAFF") {
        return NextResponse.redirect(new URL("/staff-portal", req.url))
      }
      return NextResponse.redirect(new URL("/", req.url))
    }
  }

  // Redirect authenticated users from auth pages to their dashboard
  if (isLoggedIn && isAuthPage) {
    // Respect a SAFE callbackUrl (e.g. the cart checkout round-trip):
    // only same-origin relative paths are honored — reject protocol-relative
    // "//host", backslash variants, and absolute URLs (open-redirect guard).
    const callbackUrl = req.nextUrl.searchParams.get("callbackUrl")
    if (
      callbackUrl?.startsWith("/") &&
      !callbackUrl.startsWith("//") &&
      !callbackUrl.includes("\\")
    ) {
      return NextResponse.redirect(new URL(callbackUrl, req.url))
    }
    if (userRole === "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    if (userRole === "STAFF") {
      return NextResponse.redirect(new URL("/staff-portal", req.url))
    }
    if (userRole === "CLIENTE") {
      return NextResponse.redirect(new URL("/my-account", req.url))
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
