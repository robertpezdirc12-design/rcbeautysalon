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
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set(ORG_HEADER, slug)
      const url = req.nextUrl.clone()
      url.pathname = orgMatch[2] || "/"
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    }
  }

  // ---- P1 #39-5: gola javna pot → kanonična najemniška pot (308) ----
  // Samo za anonimne/prijavljene obiske GOLIH vsebinskih poti; /api,
  // /dashboard, /login, /sitemap.xml, pravne strani idr. ostanejo goli.
  if (!orgMatch && BARE_PUBLIC_PATH.test(pathname)) {
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
