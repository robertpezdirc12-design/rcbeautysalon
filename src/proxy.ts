import { auth } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import { isPlatformAdminEmail, PLATFORM_ADMIN_EMAILS_ENV } from "@/lib/platform/access"

const ORG_HEADER = "x-org-slug"

// ------------------------------------------------------------
// P1 #39-5 (re-audit 2026-11): goli javni dostop ("/", "/services", …)
// servira ISEO vsebino kot /s/{prvi-objavljeni}/… — dvojniki. Proxy
// jih trajno preusmeri (308) na kanonično najemniško pot. Privzeti
// slug pride iz /api/public/default-tenant-slug (proxy ne doseže baze)
// in se krajsa drži v pomnilniku (60 s).
// ------------------------------------------------------------
const BARE_PUBLIC_PATH = /^\/$|^\/(services|staff|shop|booking|cart|inquiry)(\/|$)/

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
}
const tenantCache = new Map<string, { info: TenantInfo; exp: number }>()
const entityCache = new Map<string, { exists: boolean; exp: number }>()

async function resolveTenant(
  origin: string,
  slug: string
): Promise<TenantInfo | null> {
  const hit = tenantCache.get(slug)
  if (hit && hit.exp > Date.now()) return hit.info
  try {
    const res = await fetch(`${origin}/api/public/resolve-tenant?slug=${encodeURIComponent(slug)}`, {
      cache: "no-store",
    })
    if (!res.ok) return null
    const info = (await res.json()) as TenantInfo
    // P0 #24 (reopen): 15 s — usklajeno z Cache-Control resolverja;
    // spremembe vertikale/objave so vidne najkasneje ~1,25 min.
    tenantCache.set(slug, { info, exp: Date.now() + 15_000 })
    return info
  } catch {
    return null
  }
}

async function entityExists(
  origin: string,
  orgId: string,
  type: "service" | "staff" | "product",
  slug: string
): Promise<boolean> {
  const key = `${type}:${orgId}:${slug}`
  const hit = entityCache.get(key)
  if (hit && hit.exp > Date.now()) return hit.exists
  try {
    const res = await fetch(
      `${origin}/api/public/entity-exists?orgId=${encodeURIComponent(orgId)}&type=${type}&slug=${encodeURIComponent(slug)}`,
      { cache: "no-store" }
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
function rewriteTo404(req: { nextUrl: URL }) {
  const url = new URL(RESERVED_404_PATH, req.nextUrl.origin)
  return NextResponse.rewrite(url)
}

let defaultSlugCache: { slug: string | null; expires: number } | null = null

async function getDefaultTenantSlug(origin: string): Promise<string | null> {
  if (defaultSlugCache && defaultSlugCache.expires > Date.now()) {
    return defaultSlugCache.slug
  }
  try {
    const res = await fetch(`${origin}/api/public/default-tenant-slug`, {
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { slug: string | null }
    defaultSlugCache = { slug: data.slug, expires: Date.now() + 60_000 }
    return data.slug
  } catch {
    return null
  }
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl

  // ---- TENANT RESOLUTION: /s/[slug]/* -> /* with x-org-slug header ----
  // Must run BEFORE role guards so rewritten public pages resolve the org.
  const orgMatch = pathname.match(/^\/s\/([^/]+)(\/.*)?$/)
  if (orgMatch) {
    const slug = orgMatch[1]
    if (req.headers.get(ORG_HEADER) !== slug) {
      // P0 #24 / P1 #27: statusne kode rešuje proxy (glej komentar zgoraj).
      // Samo na PRVEM prehodu (header še ni nastavljen) — po prepisu gre
      // zahtevek skozi proxy drugič in takoj nadaljuje.
      const tenant = await resolveTenant(req.nextUrl.origin, slug)
      if (tenant && !tenant.exists) {
        // Neznan ali suspendiran najemnik → pravi HTTP 404 (blagovna stran).
        return rewriteTo404(req)
      }

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
        return rewriteTo404(req)
      }

      const sub = orgMatch[2] || "/"
      if (tenant?.orgId) {
        // Manjkajoče entitete → pravi HTTP 404.
        let missing = false
        const serviceMatch = sub.match(/^\/services\/([^/]+)/)
        const staffMatch = sub.match(/^\/staff\/([^/]+)/)
        const shopMatch = sub.match(/^\/shop\/([^/]+)/)
        if (serviceMatch) {
          missing = !(await entityExists(req.nextUrl.origin, tenant.orgId, "service", serviceMatch[1]))
        } else if (staffMatch) {
          missing = !(await entityExists(req.nextUrl.origin, tenant.orgId, "staff", staffMatch[1]))
        } else if (shopMatch) {
          missing = !(await entityExists(req.nextUrl.origin, tenant.orgId, "product", shopMatch[1]))
        }
        if (missing) return rewriteTo404(req)

        // P0 #24: booking/inquiry po profilu — pravi 307 (prej 200 + client-nav).
        if (sub === "/booking" && tenant.bookingEnabled === false) {
          return NextResponse.redirect(new URL(`/s/${slug}/inquiry`, req.url), 307)
        }
        if (sub === "/inquiry" && tenant.bookingEnabled === true) {
          return NextResponse.redirect(new URL(`/s/${slug}`, req.url), 307)
        }

        // P2 #46: profil brez storitev → PRAVI 404 (prej 200 s praznim
        // seznamom — soft 404, indeksiran; notFound() v layoutu v Next 16
        // streamingu ne more spremeniti statusa). Fail-open: ko proxy ne
        // dobi podatka, pusti stran naprej (layout vrata ostanejo rezerva).
        if (sub === "/services" && tenant.servicesEnabled === false) {
          return rewriteTo404(req)
        }
      }

      const requestHeaders = new Headers(req.headers)
      requestHeaders.set(ORG_HEADER, slug)
      const url = req.nextUrl.clone()
      url.pathname = sub
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    }
  }

  // ---- P1 #39-5: gola javna pot → kanonična najemniška pot (308) ----
  // Samo za anonimne/prijavljene obiske GOLIH vsebinskih poti; /api,
  // /dashboard, /login, /sitemap.xml, pravne strani idr. ostanejo goli.
  // POMEMBNO: zahtevki, ki jih je proxy že prepisal pod najemnika (x-org-slug
  // glava), se ne preusmerjajo — sicer bi bila preusmeritvena zanka.
  if (
    !orgMatch &&
    !req.headers.get(ORG_HEADER) &&
    BARE_PUBLIC_PATH.test(pathname)
  ) {
    const slug = await getDefaultTenantSlug(req.nextUrl.origin)
    if (slug) {
      const url = req.nextUrl.clone()
      url.pathname = `/s/${slug}${pathname === "/" ? "" : pathname}`
      url.search = req.nextUrl.search
      return NextResponse.redirect(url, 308)
    }
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

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
