import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { notFound, permanentRedirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ORG_HEADER, getOrgBySlug, getSessionOrg } from "@/lib/tenant"
import { mergeSiteContent, type SiteContent } from "@/lib/site-content"
import { parsePublishState } from "@/lib/publication"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import { sectionsForProfile, type HomeSectionFlags } from "@/lib/home-sections"
import type { Organization, SalonConfig } from "@prisma/client"

// ============================================================
// PUBLIC SITE DATA — resolves the organization for the current
// request and builds the tenant-aware content used by the whole
// public surface (landing, navbar, footer, services, shop, ...).
//
// Resolution order:
//   1. header org     (x-org-slug set by proxy for /s/[slug]/*)
//   2. session org    (admin/staff viewing bare routes)
//   3. default org    (first ACTIVE organization)
// ============================================================

export interface PublicSiteData {
  org: Organization
  config: SalonConfig | null
  content: SiteContent
}

async function resolveOrg(): Promise<Organization | null> {
  const h = await headers()
  const slug = h.get(ORG_HEADER)
  if (slug) {
    const org = await getOrgBySlug(slug)
    if (org) {
      if (org.status === "ACTIVE") return org
      // SUSPENDED tenant (EPIC #3 E3-5): its site is OFF — return null so
      // the maintenance screen renders. NEVER fall back to another
      // tenant's content under this URL.
      return null
    }
    // Unknown slug → bare-domain default below.
  }
  const sessionOrg = await getSessionOrg()
  if (sessionOrg) return sessionOrg
  return prisma.organization.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  })
}

/** Org + config + merged content for the current request (null when no org exists). */
export const getPublicSiteData = cache(
  async (): Promise<PublicSiteData | null> => {
    const org = await resolveOrg()
    if (!org) return null
    const config = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
    })
    // Content source (EPIC #3 E3-2):
    // - PUBLISHED tenant WITH a snapshot renders the snapshot — the content
    //   exactly as it was at the last publish, so draft edits stay private.
    // - Tenant WITHOUT a snapshot (pre-E3-2 data, or never published) renders
    //   the live siteContent — the original behavior, unchanged.
    const published =
      parsePublishState(org.publishState) === "PUBLISHED" &&
      config?.publishedSiteContent != null
    const rawContent = published ? config.publishedSiteContent : config?.siteContent
    const content = mergeSiteContent(rawContent, org.vertical)
    return { org, config, content }
  }
)

/**
 * P2 #72 (ODLOČITEV — OPCIJA A, platformska nevtralnost): goli javni
 * dostop ("/shop", "/services", …) NE pade več na najstarejšega
 * objavljenega najemnika. Privzeto:
 *   - pod najemnikom (x-org-slug) / custom domeni → nič (stran rendra),
 *   - prijavljen lastnik → kanonična pot NJEGOVEGA org,
 *   - sicer → notFound() (fail-closed; pravi HTTP 404 na gostitelju
 *     platforme rešuje PROXY, ta klic je obrambna druga linija za
 *     dosegi, ki proxyja ne gredo — glej #44 glej statusov v Next 16).
 *
 * allowDefaultTenant (privzeto FALSE) je eksplicitno odprto dedno
 * pravilo: klicatelj, ki GA izrecno poda, sprejme 308 na najstarejšega
 * najemnika. Noben klicatelj ga danes ne poda — vsak novi goli route
 * NE more podedovati padca po nesreči (test to zagotavlja).
 */
export async function redirectBareToTenant(
  path: string,
  opts: { allowDefaultTenant?: boolean } = {}
): Promise<void> {
  const h = await headers()
  // Pod najemnikom (/s/{slug}) ali na custom domeni: nič.
  if (h.get(ORG_HEADER)) return

  const sessionOrg = await getSessionOrg()
  const org =
    sessionOrg ??
    (opts.allowDefaultTenant
      ? await prisma.organization.findFirst({
          where: { status: "ACTIVE", publishState: "PUBLISHED" },
          orderBy: { createdAt: "asc" },
          select: { slug: true },
        })
      : null)
  if (!org) notFound()

  permanentRedirect(`/s/${org.slug}${path}`)
}

// ------------------------------------------------------------
// Org-scoped public queries (tenant-safe replacements for the
// shared action helpers, which are not organization-scoped).
// ------------------------------------------------------------

/** Featured services for the landing page. */
export async function getPublicFeaturedServices(orgId: string) {
  const services = await prisma.service.findMany({
    where: {
      organizationId: orgId,
      isFeatured: true,
      isActive: true,
    },
    orderBy: { order: "asc" },
    take: 5,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      duration: true,
      imageUrl: true,
    },
  })
  return services.map((service) => ({
    ...service,
    price: service.price.toNumber(),
  }))
}

/** Featured products for the landing page. */
export async function getPublicFeaturedProducts(orgId: string) {
  const products = await prisma.product.findMany({
    where: { organizationId: orgId, isActive: true, isFeatured: true },
    include: { category: { select: { name: true } } },
    take: 4,
    orderBy: { name: "asc" },
  })
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price.toNumber(),
    images: p.images,
    category: p.category ? { name: p.category.name } : null,
  }))
}

/** Featured staff for the landing page. */
export async function getPublicFeaturedStaff(orgId: string) {
  return prisma.staff.findMany({
    where: { organizationId: orgId, isActive: true },
    take: 4,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      bio: true,
      image: true,
    },
  })
}

/**
 * Latest moderated reviews for the tenant landing ("Izjave strank").
 * Only isActive (auto-approved) reviews of the tenant's services; the
 * section hides entirely while the tenant has none — no fake social proof.
 */
export async function getPublicTestimonials(orgId: string) {
  return prisma.review.findMany({
    where: { isActive: true, service: { organizationId: orgId } },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      rating: true,
      comment: true,
      user: { select: { name: true, image: true } },
      service: { select: { name: true } },
    },
  })
}

/** All active services grouped by category (services page). */
export async function getPublicServicesGrouped(orgId: string) {
  const services = await prisma.service.findMany({
    where: { organizationId: orgId, isActive: true },
    include: { category: true },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  })
  return services.reduce(
    (acc, service) => {
      const categoryName = service.category?.name || "Uncategorized"
      if (!acc[categoryName]) acc[categoryName] = []
      acc[categoryName].push(service)
      return acc
    },
    {} as Record<string, typeof services>
  )
}

/** Categories for the services filter. */
export async function getPublicCategories(orgId: string) {
  return prisma.category.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

/** Active staff (services filter dropdown). */
export async function getPublicActiveStaffOptions(orgId: string) {
  return prisma.staff.findMany({
    where: { organizationId: orgId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

/** Service detail by slug (tenant-scoped). P1 #27: React-cached — the
 * shell-phase 404 layout and the page share ONE query per request. */
export const getPublicServiceBySlug = cache(
  async (orgId: string, slug: string) => {
    return prisma.service.findFirst({
    where: {
      organizationId: orgId,
      slug,
      isActive: true,
    },
    include: {
      category: true,
      staffServices: {
        where: { staff: { isActive: true } },
        include: { staff: true },
      },
      reviews: {
        where: { isActive: true },
        include: { user: { select: { name: true, image: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      gallery: { orderBy: { order: "asc" } },
      faqs: { orderBy: { order: "asc" } },
    },
  })
  }
)

/** Related services in the same category (tenant-scoped). */
export async function getPublicRelatedServices(
  orgId: string,
  categoryId: string | null,
  excludeServiceId: string
) {
  if (!categoryId) return []
  const services = await prisma.service.findMany({
    where: {
      organizationId: orgId,
      categoryId,
      isActive: true,
      id: { not: excludeServiceId },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      duration: true,
      imageUrl: true,
    },
    take: 3,
    orderBy: { order: "asc" },
  })
  return services.map((service) => ({
    ...service,
    price: service.price.toNumber(),
  }))
}

/** All active shop products (tenant-scoped). */
export async function getPublicShopProducts(orgId: string) {
  const products = await prisma.product.findMany({
    where: { organizationId: orgId, isActive: true },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
  })
  return products.map((product) => ({
    ...product,
    price: product.price.toNumber(),
    compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
  }))
}

/** Product by id (tenant-scoped). */
export async function getPublicProductById(orgId: string, id: string) {
  const product = await prisma.product.findFirst({
    where: { organizationId: orgId, id },
    include: { category: true },
  })
  if (!product) return null
  return {
    ...product,
    price: product.price.toNumber(),
    compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
  }
}

/** Active staff members with services + working hours (tenant-scoped). */
export async function getPublicStaffMembers(orgId: string) {
  const staffMembers = await prisma.staff.findMany({
    where: { organizationId: orgId, isActive: true },
    include: {
      services: {
        include: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              duration: true,
              price: true,
            },
          },
        },
      },
      workingHours: true,
    },
  })
  return staffMembers.map((staff) => ({
    ...staff,
    services: staff.services.map((ss) => ({
      ...ss,
      service: {
        ...ss.service,
        price: Number(ss.service.price),
      },
    })),
  }))
}

const staffSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")

/** Staff member by name-slug (tenant-scoped). P1 #27: React-cached — the
 * shell-phase 404 layout and the page share ONE query per request. */
export const getPublicStaffBySlug = cache(async (orgId: string, slug: string) => {
  const staffMembers = await getPublicStaffMembers(orgId)
  return staffMembers.find((staff) => staffSlug(staff.name) === slug) ?? null
})

// ============================================================
// P2 #46/#47 — header section flags (shared by BOTH public layouts
// so navigation is identical on "/", "/shop", "/services", …).
// Data gate (featured content actually renders) + capability gate
// (profile may disable services/shop/staff entirely — legacy rows
// must not resurrect a section the profile switched off).
// ============================================================
export async function resolveAvailableSections(
  organizationId: string,
  org: { vertical: string | null; secondaryVertical?: string | null; profileOverrides: unknown }
): Promise<HomeSectionFlags> {
  // P3 #62: staff is counted like services/products — the "Ekipa" anchor
  // is dead when the tenant has no active members.
  const [featuredServices, featuredProducts, activeStaff] = await Promise.all([
    prisma.service.count({
      where: { organizationId, isActive: true, isFeatured: true },
    }),
    prisma.product.count({
      where: { organizationId, isActive: true, isFeatured: true },
    }),
    prisma.staff.count({ where: { organizationId, isActive: true } }),
  ])
  return sectionsForProfile(
    {
      services: featuredServices > 0,
      shop: featuredProducts > 0,
      team: activeStaff > 0,
    },
    resolveEffectiveProfile(org)
  )
}
