"use server"

import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { ServiceFilters } from "@/lib/interfaces"
import { revalidatePath } from "next/cache"
import { CreateServiceInput } from "@/lib/interfaces"
import { UnauthorizedError, requirePermissionOrg } from "@/lib/auth/guards"
import { getPublicOrg, getResolvedOrg } from "@/lib/tenant"
import { enforcePlanLimit } from "@/lib/plans/resolve"
import { getLocaleFromCookies } from "@/lib/i18n/server"

export type UpdateServiceInput = Partial<CreateServiceInput>

/**
 * Resolve the organization for functions used by BOTH the public site and the
 * admin dashboard: admins/staff get their session org, everyone else gets the
 * public (tenant) org.
 */
async function resolveRequestOrg() {
  // Tenant header (/s/[slug]) always wins over the session to avoid
  // cross-tenant leakage when a signed-in admin browses another salon.
  return getResolvedOrg()
}

// Get featured services for homepage display
export const getFeaturedServices = cache(async () => {
  const org = await getPublicOrg()
  if (!org) return []

  const featuredServices = await prisma.service.findMany({
    where: {
      isFeatured: true,
      isActive: true,
      organizationId: org.id,
    },
    orderBy: {
      order: "asc",
    },
    take: 5,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      duration: true,
      imageUrl: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  })

  // Convert Decimal to number for client components
  return featuredServices.map((service) => ({
    ...service,
    price: service.price.toNumber(),
  }))
})

// Get all active services grouped by category for /services page
export async function getAllServicesGroupedByCategory() {
  const org = await getPublicOrg()
  if (!org) return {}

  const servicesGrouped = await prisma.service.findMany({
    where: { isActive: true, organizationId: org.id },
    include: { category: true },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  })

  const grouped = servicesGrouped.reduce(
    (acc, service) => {
      const categoryName = service.category?.name || "Uncategorized"
      if (!acc[categoryName]) acc[categoryName] = []
      acc[categoryName].push(service)
      return acc
    },
    {} as Record<string, typeof servicesGrouped>
  )

  return grouped
}

// Get detailed service info by slug for /services/[slug] page
// Cached to avoid duplicate fetches in generateMetadata + page component
export const getServiceBySlug = cache(async (slug: string) => {
  const org = await getPublicOrg()
  if (!org) return null

  return await prisma.service.findFirst({
    where: {
      slug,
      isActive: true,
      organizationId: org.id,
    },
    include: {
      category: true,
      staffServices: {
        where: {
          staff: { isActive: true, organizationId: org.id },
        },
        include: {
          staff: true,
        },
      },
      reviews: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
      gallery: {
        orderBy: {
          order: "asc",
        },
      },
      faqs: {
        orderBy: {
          order: "asc",
        },
      },
    },
  })
})

// Get all active service slugs for generateStaticParams
export async function getAllServiceSlugs() {
  const org = await getPublicOrg()
  if (!org) return []

  const services = await prisma.service.findMany({
    where: { isActive: true, organizationId: org.id },
    select: { slug: true },
  })

  return services.map((s) => s.slug)
}

// Get categories with count of active services for sidebar display
export const getCategoriesWithCount = cache(async () => {
  const org = await getPublicOrg()
  if (!org) return []

  return await prisma.category.findMany({
    where: { organizationId: org.id },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          services: {
            where: { isActive: true },
          },
        },
      },
    },
  })
})

// Get related services by category (for "You might also like" section)
export async function getRelatedServices(
  categoryId: string | null,
  excludeServiceId: string
) {
  if (!categoryId) return []

  const org = await getPublicOrg()
  if (!org) return []

  const services = await prisma.service.findMany({
    where: {
      categoryId,
      isActive: true,
      organizationId: org.id,
      id: { not: excludeServiceId }, // Exclude current service
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
    take: 3, // Limit to 3 related services
    orderBy: {
      order: "asc", // Show featured services first
    },
  })

  // Convert Decimal to number for client components
  return services.map((service) => ({
    ...service,
    price: service.price.toNumber(),
  }))
}

// Filter services with search, price, duration, staff, and sorting
export async function filterServices(filters: ServiceFilters) {
  const {
    search,
    categoryId,
    minPrice,
    maxPrice,
    minDuration,
    maxDuration,
    staffId,
    sortBy,
  } = filters

  const org = await getPublicOrg()
  if (!org) return []

  // Build where clause
  const where: Prisma.ServiceWhereInput = {
    isActive: true,
    organizationId: org.id,
  }

  // Text search in name and description
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ]
  }

  // Category filter
  if (categoryId) {
    where.categoryId = categoryId
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {}
    if (minPrice !== undefined) where.price.gte = minPrice
    if (maxPrice !== undefined) where.price.lte = maxPrice
  }

  // Duration range filter
  if (minDuration !== undefined || maxDuration !== undefined) {
    where.duration = {}
    if (minDuration !== undefined) where.duration.gte = minDuration
    if (maxDuration !== undefined) where.duration.lte = maxDuration
  }

  // Staff filter
  if (staffId) {
    where.staffServices = {
      some: {
        staffId,
        staff: { isActive: true, organizationId: org.id },
      },
    }
  }

  // Build orderBy clause.
  // P1 #29 (re-audit 2026-11): vrstni red je GLOBALEN (flat seznam) —
  // Prej je primerjavec deloval znotraj kategorij (glej klicevalca),
  // tako da je "Cena naraščajoče" pomenila 35, 50, 55, 75, 150, 180,
  // 250, 90, 130 … po skupinah, ne eno monotono zaporedje.
  // Brez sortBy ("Priporočeno") ohranimo privzeti katalog vrstni red
  // (kategorija naraščajoče + ime), ki se ujema z začetnim stanjem strani.
  let orderBy: Prisma.ServiceOrderByWithRelationInput[] = [
    { category: { name: "asc" } },
    { name: "asc" },
  ]

  switch (sortBy) {
    case "price_asc":
      orderBy = [{ price: "asc" }]
      break
    case "price_desc":
      orderBy = [{ price: "desc" }]
      break
    case "duration_asc":
      orderBy = [{ duration: "asc" }]
      break
    case "duration_desc":
      orderBy = [{ duration: "desc" }]
      break
    case "name_asc":
      orderBy = [{ name: "asc" }]
      break
    case "rating_desc":
    case "popularity_desc":
      // Will handle sorting after fetching
      orderBy = [{ name: "asc" }]
      break
  }

  const services = await prisma.service.findMany({
    where,
    include: {
      category: true,
      _count: {
        select: {
          reviews: { where: { isActive: true } },
          appointmentServices: true,
        },
      },
      reviews: {
        where: { isActive: true },
        select: { rating: true },
      },
    },
    orderBy,
  })

  // Calculate average rating and sort by rating or popularity if needed
  const servicesWithStats = services.map((service) => {
    const avgRating =
      service.reviews.length > 0
        ? service.reviews.reduce((sum, r) => sum + r.rating, 0) /
          service.reviews.length
        : 0

    return {
      ...service,
      avgRating,
      reviewCount: service._count.reviews,
      appointmentCount: service._count.appointmentServices,
    }
  })

  // Sort by rating or popularity if requested
  if (sortBy === "rating_desc") {
    servicesWithStats.sort((a, b) => b.avgRating - a.avgRating)
  } else if (sortBy === "popularity_desc") {
    servicesWithStats.sort((a, b) => b.appointmentCount - a.appointmentCount)
  }

  // P1 #29: FLAT, globalno sortiran seznam (brez združevanja). Klient
  // (ServicesList) si kategorije razporedi sam — zato "Vse" tab vedno
  // prikaže ENO monotono zaporedje za vsako izbrano sortiranje.
  return servicesWithStats.map((service) => ({
    id: service.id,
    name: service.name,
    slug: service.slug,
    description: service.description,
    duration: service.duration,
    price: service.price.toNumber(),
    imageUrl: service.imageUrl,
    category: service.category,
  }))
}

// Get all active staff for filter dropdown (public + admin)
export const getAllActiveStaff = cache(async () => {
  const org = await resolveRequestOrg()
  if (!org) return []

  return await prisma.staff.findMany({
    where: { isActive: true, organizationId: org.id },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  })
})

// Get all categories for filter dropdown (public + admin)
export const getAllCategories = cache(async () => {
  const org = await resolveRequestOrg()
  if (!org) return []

  const categories = await prisma.category.findMany({
    where: { organizationId: org.id },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  })
  return categories
})

// Get Active Services for Booking (public + admin)
export async function getActiveServicesForBooking() {
  const org = await resolveRequestOrg()
  if (!org) return []

  const services = await prisma.service.findMany({
    where: { isActive: true, organizationId: org.id },
    select: {
      id: true,
      name: true,
      duration: true,
      price: true,
    },
    orderBy: { name: "asc" },
  })

  return services.map((service) => ({
    ...service,
    price: service.price.toNumber(),
  }))
}

// Admin: Get all services with counts for management
export async function getAdminServices(search?: string) {
  const { org } = await requirePermissionOrg("services.manage")

  const services = await prisma.service.findMany({
    where: {
      organizationId: org.id,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { category: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      category: {
        select: { name: true },
      },
      _count: {
        select: {
          appointmentServices: true,
          staffServices: true,
          reviews: true,
        },
      },
    },
    orderBy: { name: "asc" },
  })

  return services.map((service) => ({
    ...service,
    price: service.price.toNumber(),
  }))
}

// Admin: Get service statistics
export async function getServiceStats() {
  const { org } = await requirePermissionOrg("services.manage")

  const [totalServices, activeServices, featuredServices, categoriesCount] =
    await Promise.all([
      prisma.service.count({ where: { organizationId: org.id } }),
      prisma.service.count({ where: { isActive: true, organizationId: org.id } }),
      prisma.service.count({ where: { isFeatured: true, organizationId: org.id } }),
      prisma.category.count({ where: { organizationId: org.id } }),
    ])

  return {
    totalServices,
    activeServices,
    featuredServices,
    categoriesCount,
  }
}

// Admin: Get service by ID with detailed info
export async function getServiceById(id: string) {
  const { org } = await requirePermissionOrg("services.manage")

  const service = await prisma.service.findFirst({
    where: { id, organizationId: org.id },
    include: {
      category: true,
      staffServices: {
        include: {
          staff: true,
        },
      },
    },
  })

  if (!service) {
    return null
  }

  return {
    ...service,
    price: service.price.toNumber(),
    // #79: deposit rule za formo (Decimal → number)
    depositValue: service.depositValue ? service.depositValue.toNumber() : null,
  }
}

//Create Service

// ============================================================
// #92 — DODATKI STORITVE (admin)
// Replace-all semantika: shranjevanje prepiše celoten seznam
// dodatkov storitve (enostavno in idempotentno). Termin_snapshoti
// ostanejo nedotaknjeni — zgodovina termina ne sledi katalogu.
// ============================================================
export interface ServiceAddonInput {
  name: string
  price: number
  durationMin: number
}

/** Aktivni dodatki storitve za urejevalnik (org-scoped, fail-closed). */
export async function getServiceAddonsForEdit(serviceId: string) {
  const { org } = await requirePermissionOrg("services.manage")
  const service = await prisma.service.findFirst({
    where: { id: serviceId, organizationId: org.id },
    select: { id: true },
  })
  if (!service) return []

  const addons = await prisma.serviceAddon.findMany({
    where: { serviceId: service.id },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  })
  return addons.map((a) => ({
    id: a.id,
    name: a.name,
    price: a.price.toNumber(),
    durationMin: a.durationMin,
  }))
}

export async function upsertServiceAddons(
  serviceId: string,
  addons: ServiceAddonInput[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { org } = await requirePermissionOrg("services.manage")

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: org.id },
      select: { id: true },
    })
    if (!service) {
      return { success: false, error: "Storitev ni najdena ali ni vaša." }
    }

    // Sanitizacija: samo veljavne vrstice (ime ≥ 2, cena ≥ 0, trajanje ≥ 0).
    const clean = (Array.isArray(addons) ? addons : [])
      .filter(
        (a): a is ServiceAddonInput =>
          !!a && typeof a === "object" &&
          typeof a.name === "string" && a.name.trim().length >= 2 &&
          Number.isFinite(a.price) && a.price >= 0 &&
          Number.isFinite(a.durationMin) && a.durationMin >= 0
      )
      .slice(0, 12)
      .map((a, i) => ({
        name: a.name.trim().slice(0, 60),
        price: Math.round(a.price * 100) / 100,
        durationMin: Math.max(0, Math.round(a.durationMin)),
        position: i,
      }))

    await prisma.$transaction([
      prisma.serviceAddon.deleteMany({ where: { serviceId: service.id } }),
      ...(clean.length > 0
        ? [prisma.serviceAddon.createMany({ data: clean.map((a) => ({ ...a, serviceId: service.id })) })]
        : []),
    ])

    revalidatePath("/dashboard/services")
    return { success: true }
  } catch (error) {
    console.error("upsertServiceAddons failed:", error)
    return { success: false, error: "Shranjevanje dodatkov ni uspelo. Poskusite znova." }
  }
}

export async function createService(data: CreateServiceInput) {
  try {
    const { org } = await requirePermissionOrg("services.manage")

    // Plan entitlements (EPIC #3 E3-3): block NEW services at the plan
    // limit — never touches existing content (downgrade tolerance).
    const limit = await enforcePlanLimit(org, "services", await getLocaleFromCookies())
    if (!limit.ok) {
      return { success: false, error: limit.message, code: limit.code }
    }

    // Extract staffIds and categoryId from data
    const { staffIds, categoryId, ...serviceData } = data

    // Validate the category belongs to this organization
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, organizationId: org.id },
        select: { id: true },
      })
      if (!category) {
        return { success: false, error: "Invalid category" }
      }
    }

    const service = await prisma.service.create({
      data: {
        ...serviceData,
        organization: { connect: { id: org.id } },
        ...(categoryId && { category: { connect: { id: categoryId } } }),
      },
    })

    if (staffIds?.length) {
      // Only link staff members that belong to this organization
      const orgStaff = await prisma.staff.findMany({
        where: { id: { in: staffIds }, organizationId: org.id },
        select: { id: true },
      })
      if (orgStaff.length) {
        await prisma.staffService.createMany({
          data: orgStaff.map((staff) => ({
            staffId: staff.id,
            serviceId: service.id,
          })),
        })
      }
    }

    revalidatePath("/dashboard/services")
    revalidatePath("/services")

    return {
      success: true,
      service: {
        ...service,
        price: service.price.toNumber(),
      },
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error creating service:", error)
    return { success: false, error: "Failed to create service." }
  }
}

// Update Service
export async function updateService(id: string, data: UpdateServiceInput) {
  try {
    const { org } = await requirePermissionOrg("services.manage")

    // Extract staffIds and categoryId from data
    const { staffIds, categoryId, ...serviceData } = data

    // Verify ownership before mutating
    const existing = await prisma.service.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!existing) {
      return { success: false, error: "Service not found" }
    }

    // Validate the category belongs to this organization
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, organizationId: org.id },
        select: { id: true },
      })
      if (!category) {
        return { success: false, error: "Invalid category" }
      }
    }

    const updatedService = await prisma.service.update({
      where: { id },
      data: {
        ...serviceData,
        ...(categoryId !== undefined && {
          category: categoryId ? { connect: { id: categoryId } } : { disconnect: true },
        }),
      },
    })

    if (staffIds !== undefined) {
      await prisma.staffService.deleteMany({
        where: { serviceId: id },
      })
      if (staffIds.length) {
        // Only link staff members that belong to this organization
        const orgStaff = await prisma.staff.findMany({
          where: { id: { in: staffIds }, organizationId: org.id },
          select: { id: true },
        })
        if (orgStaff.length) {
          await prisma.staffService.createMany({
            data: orgStaff.map((staff) => ({
              staffId: staff.id,
              serviceId: id,
            })),
          })
        }
      }
    }

    revalidatePath("/dashboard/services")
    revalidatePath("/services")

    return {
      success: true,
      service: {
        ...updatedService,
        price: updatedService.price.toNumber(),
      },
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating service:", error)
    return { success: false, error: "Failed to update service." }
  }
}

// Delete Service
export async function deleteService(id: string) {
  try {
    const { org } = await requirePermissionOrg("services.manage")

    // Verify ownership before mutating
    const existing = await prisma.service.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!existing) {
      return { success: false, error: "Service not found" }
    }

    const appointmentCount = await prisma.appointmentService.count({
      where: { serviceId: id },
    })

    if (appointmentCount > 0) {
      return {
        success: false,
        error:
          "Cannot delete service with existing appointments. Deactivate it instead.",
      }
    }
    await prisma.service.delete({
      where: { id },
    })

    revalidatePath("/dashboard/services")
    revalidatePath("/services")

    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error deleting service:", error)
    return { success: false, error: "Failed to delete service." }
  }
}

// Toggle service active status
export async function toggleServiceStatus(id: string) {
  try {
    const { org } = await requirePermissionOrg("services.manage")

    const service = await prisma.service.findFirst({
      where: { id, organizationId: org.id },
      select: { isActive: true },
    })

    if (!service) {
      return { success: false, error: "Service not found" }
    }

    const updated = await prisma.service.update({
      where: { id },
      data: { isActive: !service.isActive },
    })

    revalidatePath("/dashboard/services")
    revalidatePath("/services")

    return { success: true, isActive: updated.isActive }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error toggling service status:", error)
    return { success: false, error: "Failed to toggle service status." }
  }
}

// ============================================================
// #96 — SPREJEMNI OBRAZEC STORITVE (admin)
// Poveže storitev z obstoječim FormDefinition najemnika (ali odveže).
// ============================================================
export async function setServiceIntakeForm(
  serviceId: string,
  formDefinitionId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { org } = await requirePermissionOrg("services.manage")

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: org.id },
      select: { id: true },
    })
    if (!service) {
      return { success: false, error: "Storitev ni najdena ali ni vaša." }
    }

    if (formDefinitionId) {
      const def = await prisma.formDefinition.findFirst({
        where: { id: formDefinitionId, organizationId: org.id, isActive: true },
        select: { id: true },
      })
      if (!def) {
        return { success: false, error: "Obrazec ni najden ali ni vaš." }
      }
    }

    await prisma.service.update({
      where: { id: service.id },
      data: { intakeFormDefinitionId: formDefinitionId },
    })

    revalidatePath("/dashboard/services")
    return { success: true }
  } catch (error) {
    console.error("setServiceIntakeForm failed:", error)
    return { success: false, error: "Shranjevanje ni uspelo. Poskusite znova." }
  }
}

/** Aktivni FormDefinition-i najemnika za izbiro sprejemnega obrazca. */
export async function getIntakeFormOptions() {
  const { org } = await requirePermissionOrg("services.manage")
  return prisma.formDefinition.findMany({
    where: { organizationId: org.id, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}
