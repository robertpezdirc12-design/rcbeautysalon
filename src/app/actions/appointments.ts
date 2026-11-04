"use server"

import { cache } from "react"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { ORG_HEADER } from "@/lib/tenant"
import { auth } from "@/lib/auth/auth"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import {
  AvailableStaffMember,
  TimeSlot,
  CreateAppointmentData,
  AppointmentCreationResult,
} from "@/lib/interfaces"
import { addMinutes, format } from "date-fns"
import {
  toDateKey,
  dayOfWeekFor,
  dayBounds,
  instantFromParts,
  minutesToTime,
  safeTimezone,
  formatSalonTime,
  DEFAULT_SALON_TIMEZONE,
} from "@/lib/booking-time"
import { sendAppointmentConfirmationEmail } from "@/lib/email/appointment-confirmation"
import { Prisma } from "@prisma/client"
import { AppointmentStatus } from "@/lib/types"
import { AdminAppointmentsFilter } from "@/lib/interfaces"
import { sendNoShowNotificationEmail } from "@/lib/email/no-show-notification"
import { sendAppointmentCompletedEmail } from "@/lib/email/appointment-completed"
import { sendAppointmentCancelledEmail } from "@/lib/email/appointment-cancelled"
import { sendAppointmentRescheduledEmail } from "@/lib/email/appointment-rescheduled"
import { sendAppointmentExpiredEmail } from "@/lib/email/appointment-expired"
import { getSessionOrg, getResolvedOrg } from "@/lib/tenant"
import { requirePermissionOrg, UnauthorizedError } from "@/lib/auth/guards"
import { hasPermission } from "@/lib/permissions/roles"
import { getEffectivePermissions } from "@/lib/permissions/effective"
import { isAdminForOrg } from "@/lib/permissions/guard-rules"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import {
  WORKSPACE_ENTITY_KEY,
  WORKSPACE_RESOURCES_EXTENSION_ID,
  hasResourceConflict,
  canUseWorkspaceResources,
} from "@/lib/booking/resources"

/**
 * Resolve the organization for the current request: admins/staff act within
 * their session org, everyone else (guests, customers) within the public
 * tenant org. Returns null when no org can be determined.
 */
async function resolveRequestOrg() {
  // Tenant header (/s/[slug]) always wins over the session to avoid
  // cross-tenant leakage when a signed-in admin browses another salon.
  return getResolvedOrg()
}

// ------------------------------------------------------------
// Workspace resources (E2-7, G7) — optional physical differentiator
// for bookings. Only exposed when the org's effective profile enables
// the `workspace-resources` extension AND `appointments`.
// ------------------------------------------------------------

export interface BookingResource {
  id: string
  name: string
  kind: string | null
}

/**
 * Workspace resources of the current (request) org, for the booking and
 * admin appointment forms. Empty list for non-capable orgs — the UI then
 * renders NO selector (non-booking/resource-less profiles see no change).
 */
export async function listBookingResources(): Promise<BookingResource[]> {
  try {
    const org = await resolveRequestOrg()
    if (!org) return []
    const profile = resolveEffectiveProfile({
      vertical: org.vertical,
      secondaryVertical: org.secondaryVertical,
      profileOverrides: org.profileOverrides,
    })
    if (!canUseWorkspaceResources(profile)) return []

    const records = await prisma.extensionRecord.findMany({
      where: {
        organizationId: org.id,
        extensionId: WORKSPACE_RESOURCES_EXTENSION_ID,
        entityKey: WORKSPACE_ENTITY_KEY,
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, data: true },
    })
    return records.map((r) => {
      const data = (r.data ?? {}) as Record<string, unknown>
      return {
        id: r.id,
        name: typeof data.name === "string" ? data.name : "(vir)",
        kind: typeof data.kind === "string" ? data.kind : null,
      }
    })
  } catch (error) {
    console.error("listBookingResources error:", error)
    return []
  }
}

/** Salon timezone for an organization (falls back to the platform default). */
export async function getOrgTimezone(organizationId: string): Promise<string> {
  const config = await prisma.salonConfig.findUnique({
    where: { organizationId },
    select: { timezone: true },
  })
  return safeTimezone(config?.timezone)
}

// Get current user's staff ID (if they are a staff member)
// Used to prevent staff from booking appointments with themselves
export async function getCurrentUserStaffId(): Promise<string | null> {
  const session = await auth()

  if (!session?.user || !["STAFF", "ADMIN"].includes(session.user.role)) {
    return null
  }

  const staff = await prisma.staff.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  return staff?.id || null
}

// Get salon configuration (per organization)
export const getSalonConfig = cache(async () => {
  const org = await resolveRequestOrg()

  const config = org
    ? await prisma.salonConfig.findFirst({
        where: { organizationId: org.id },
        select: {
          bookingDeposit: true,
          depositRefundable: true,
          minBookingAdvance: true,
          maxBookingAdvance: true,
          cancellationPolicy: true,
          timezone: true,
          currency: true,
        },
      })
    : null
  if (!config) {
    return {
      bookingDeposit: 50,
      depositRefundable: false,
      minBookingAdvance: 0,
      maxBookingAdvance: 30,
      cancellationPolicy: null,
      timezone: DEFAULT_SALON_TIMEZONE,
      currency: "EUR",
    }
  }
  return {
    ...config,
    bookingDeposit: config.bookingDeposit.toNumber(),
  }
})

//Get available staff for a service
export async function getAvailableStaff(
  serviceId: string
): Promise<AvailableStaffMember[]> {
  const org = await resolveRequestOrg()
  if (!org) return []

  const availableStaff = await prisma.staffService.findMany({
    where: {
      serviceId,
      staff: { isActive: true, organizationId: org.id },
    },
    include: {
      staff: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          bio: true,
          image: true,
          isActive: true,
        },
      },
    },
  })
  return availableStaff.map((s) => s.staff)
}

// Get staff member with their services for booking (staff-first flow)
export async function getStaffForBooking(staffId: string) {
  const org = await resolveRequestOrg()
  if (!org) return null

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, isActive: true, organizationId: org.id },
    include: {
      services: {
        where: {
          service: { isActive: true, organizationId: org.id },
        },
        include: {
          service: {
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
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!staff) return null

  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    phone: staff.phone,
    bio: staff.bio,
    image: staff.image,
    isActive: staff.isActive,
    services: staff.services.map((s) => ({
      ...s.service,
      price: Number(s.service.price),
    })),
  }
}

//Get available time slots for a staff member on a specific date
export async function getAvailableTimeSlots(
  staffId: string,
  date: Date | string,
  serviceDuration: number,
  resourceRecordId?: string | null
): Promise<TimeSlot[]> {
  const org = await resolveRequestOrg()
  if (!org) return []

  const tz = await getOrgTimezone(org.id)

  // Normalize to a salon-local calendar key "yyyy-MM-dd" (never the server clock)
  const dateKey = toDateKey(date, tz)
  if (!dateKey) return []

  // Day of week in the salon timezone (0 = Sunday, 6 = Saturday)
  const dayOfWeek = dayOfWeekFor(dateKey, tz)
  if (dayOfWeek === null) return []

  // Find working hours for this staff on this day
  const workingHours = await prisma.workingHours.findFirst({
    where: {
      staffId,
      dayOfWeek,
      isActive: true,
    },
  })

  if (!workingHours) {
    return [] // Staff doesn't work on this day
  }

  // Existing appointments for that salon-local day (correct UTC boundaries)
  const bounds = dayBounds(dateKey, tz)
  if (!bounds) return []

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      staffId,
      organizationId: org.id,
      startTime: {
        gte: bounds.start,
        lte: bounds.end,
      },
      status: {
        in: ["PENDING", "CONFIRMED"],
      },
    },
    select: {
      startTime: true,
      endTime: true,
    },
  })

  // Generate slots as salon-local wall-clock minutes
  const [sh, sm] = workingHours.startTime.split(":").map(Number)
  const [eh, em] = workingHours.endTime.split(":").map(Number)
  const workStartMin = sh * 60 + sm
  const workEndMin = eh * 60 + em

  // E2-7: when a workspace resource is selected, its busy windows are
  // fetched ONCE (across ALL staff of this org for the day). Fail-safe:
  // an unknown/invalid resource id simply skips the extra check.
  let resourceBusy: { startTime: Date; endTime: Date }[] = []
  if (resourceRecordId) {
    const resourceRecord = await prisma.extensionRecord.findFirst({
      where: {
        id: resourceRecordId,
        organizationId: org.id,
        extensionId: WORKSPACE_RESOURCES_EXTENSION_ID,
        entityKey: WORKSPACE_ENTITY_KEY,
      },
      select: { id: true },
    })
    if (resourceRecord) {
      resourceBusy = await prisma.appointment.findMany({
        where: {
          resourceRecordId: resourceRecord.id,
          organizationId: org.id,
          startTime: { gte: bounds.start, lte: bounds.end },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        select: { startTime: true, endTime: true },
      })
    }
  }

  const slots: TimeSlot[] = []

  // Loop through working hours creating 30-minute slots
  for (
    let startMin = workStartMin;
    startMin + serviceDuration <= workEndMin;
    startMin += 30
  ) {
    const slotStart = instantFromParts(dateKey, minutesToTime(startMin), tz)
    if (!slotStart) continue
    const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60000)

    // Check for conflicts with existing appointments
    // Overlap formula: (startA < endB) && (endA > startB)
    const hasConflict = existingAppointments.some((apt) => {
      const aptStart = new Date(apt.startTime)
      const aptEnd = new Date(apt.endTime)
      return slotStart < aptEnd && slotEnd > aptStart
    })

  // Check if slot is in the past
    const isPast = slotStart.getTime() <= Date.now()

    const time = minutesToTime(startMin)

    // Add slot to array
    slots.push({
      time,
      formattedTime: time, // 24-hour format (Slovenian convention)
      available: !hasConflict && !isPast,
    })
  }

  // E2-7: second pass — mark slots blocked by the chosen resource. Kept as a
  // separate loop so the staff logic above remains byte-identical.
  if (resourceRecordId && resourceBusy.length > 0) {
    for (const slot of slots) {
      if (!slot.available) continue
      const slotStart = instantFromParts(dateKey, slot.time, tz)
      if (!slotStart) continue
      const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60000)
      if (hasResourceConflict(resourceBusy, slotStart, slotEnd)) slot.available = false
    }
  }

  return slots
}

//Get single service details for booking
export async function getServiceForBooking(serviceSlug: string) {
  const org = await resolveRequestOrg()
  if (!org) return null

  // Fetch service details for booking page by slug
  const service = await prisma.service.findFirst({
    where: {
      slug: serviceSlug,
      isActive: true,
      organizationId: org.id,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      duration: true,
      imageUrl: true,
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
  })

  // Return null if service doesn't exist or is inactive
  if (!service) {
    return null
  }

  // Convert Prisma Decimal to number for price
  return {
    ...service,
    price: service.price.toNumber(),
  }
}

//Get multiple services for multi-service booking
export async function getServicesForBooking(serviceIds: string[]) {
  const org = await resolveRequestOrg()
  if (!org) return []

  // Fetch multiple services for multi-service appointments
  const services = await prisma.service.findMany({
    where: {
      id: { in: serviceIds },
      isActive: true,
      organizationId: org.id,
    },
    select: {
      id: true,
      name: true,
      price: true,
      duration: true,
    },
  })

  // Convert Prisma Decimal prices to numbers
  return services.map((s) => ({
    ...s,
    price: s.price.toNumber(),
  }))
}

// Create appointment
export async function createAppointment(
  data: CreateAppointmentData
): Promise<AppointmentCreationResult> {
  try {
    // Get current session to identify if user is authenticated
    const session = await auth()

    // Resolve the tenant organization for this booking
    const org = await resolveRequestOrg()
    if (!org) {
      return { success: false, error: "Rezervacija trenutno ni na voljo" }
    }

    // Validate required fields (date+time strings or a prebuilt startTime)
    if (
      !data.staffId ||
      !data.serviceIds.length ||
      (!data.startTime && !(data.bookingDate && data.bookingTime))
    ) {
      return { success: false, error: "Manjkajo obvezni podatki" }
    }

    // Validate customer information (either authenticated user OR guest info)
    if (!session?.user && (!data.guestName || !data.guestEmail)) {
      return { success: false, error: "Potrebni so kontakt podatki" }
    }

    // Prevent employees from booking appointments with themselves
    if (session?.user && ["STAFF", "ADMIN"].includes(session.user.role)) {
      const currentUserStaff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      if (currentUserStaff && currentUserStaff.id === data.staffId) {
        return { success: false, error: "Pri sebi ne morete rezervirati termina" }
      }
    }

    // Fetch selected services and calculate totals (scoped to this organization)
    const services = await getServicesForBooking(data.serviceIds)
    if (
      services.length === 0 ||
      services.length !== new Set(data.serviceIds).size
    ) {
      return { success: false, error: "Neveljavna izbira storitev" }
    }

    const baseTotalPrice = services.reduce((sum, s) => sum + s.price, 0)
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0)

    // Check if admin is creating appointment for a customer
    const isAdminCreating = session?.user?.role === "ADMIN" && data.guestName

    // SECURITY: employee discount is derived server-side from the session role,
    // never trusted from client arguments. It only applies when an authenticated
    // STAFF/ADMIN user books for themselves (not when creating for a customer).
    const isEmployeeBooking =
      !!session?.user &&
      ["STAFF", "ADMIN"].includes(session.user.role) &&
      !isAdminCreating

    // Apply 20% employee discount if applicable
    const employeeDiscountRate = 0.20
    const totalPrice = isEmployeeBooking
      ? baseTotalPrice * (1 - employeeDiscountRate)
      : baseTotalPrice

    // Calculate appointment end time based on total duration
    // Build the exact start instant in the SALON timezone from date+time
    // strings (preferred contract) — never from the client/server local clock.
    const tz = await getOrgTimezone(org.id)
    const startInstant =
      data.bookingDate && data.bookingTime
        ? instantFromParts(data.bookingDate, data.bookingTime, tz)
        : data.startTime
          ? new Date(data.startTime)
          : null

    if (!startInstant || isNaN(startInstant.getTime())) {
      return { success: false, error: "Neveljaven datum ali ura termina" }
    }

    const endTime = addMinutes(startInstant, totalDuration)

    // Get salon configuration for deposit amount
    const config = await getSalonConfig()

    // Employee bookings don't require deposit
    const depositAmount = isEmployeeBooking ? 0 : config.bookingDeposit
    const depositPaid = isEmployeeBooking ? true : false // Employees don't need to pay deposit
    const appointmentStatus = isEmployeeBooking ? "CONFIRMED" : "PENDING"

    // Verify the requested time slot is available
    const slots = await getAvailableTimeSlots(
      data.staffId,
      data.bookingDate ?? startInstant,
      totalDuration
    )
    const requestedTime = data.bookingTime ?? format(startInstant, "HH:mm")
    const slotAvailable = slots.find(
      (slot) => slot.time === requestedTime && slot.available
    )

    if (!slotAvailable) {
      return {
        success: false,
        error: "Izbrani termin ni več prost. Izberite drugi termin.",
      }
    }

    // E2-7 (G7): optional workspace resource — validate org-scoped record and
    // re-check the resource conflict server-side (one booking per resource).
    let resourceRecordId: string | null = null
    if (data.resourceRecordId) {
      // Gate against the REQUEST org's effective profile (guest bookings have
      // no session — the public tenant must decide, not the signer).
      const profile = resolveEffectiveProfile({
        vertical: org.vertical,
        secondaryVertical: org.secondaryVertical,
        profileOverrides: org.profileOverrides,
      })
      const capable = canUseWorkspaceResources(profile)
      if (capable) {
        const resourceRecord = await prisma.extensionRecord.findFirst({
          where: {
            id: data.resourceRecordId,
            organizationId: org.id,
            extensionId: WORKSPACE_RESOURCES_EXTENSION_ID,
            entityKey: WORKSPACE_ENTITY_KEY,
          },
          select: { id: true },
        })
        if (!resourceRecord) {
          return { success: false, error: "Izbrani prostor/vir ni več na voljo." }
        }
        const resourceBusy = await prisma.appointment.findMany({
          where: {
            resourceRecordId: resourceRecord.id,
            organizationId: org.id,
            startTime: { lt: endTime },
            endTime: { gt: startInstant },
            status: { in: ["PENDING", "CONFIRMED"] },
          },
          select: { startTime: true, endTime: true },
        })
        if (hasResourceConflict(resourceBusy, startInstant, endTime)) {
          return {
            success: false,
            error:
              "Izbrani prostor/vir je v tem času že zaseden. Izberite drugi termin ali prostor.",
          }
        }
        resourceRecordId = resourceRecord.id
      }
      // Not capable → the id is silently dropped (fail-safe, no crash).
    }

    // Handle customer creation/retrieval
    let customerId: string | null = null

    if (session?.user && !isAdminCreating) {
      // Regular customer booking for themselves
      const userWithCustomer = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { customer: true },
      })

      if (userWithCustomer?.customer) {
        // Use existing customer profile
        customerId = userWithCustomer.customer.id
      } else {
        // Create new customer profile for authenticated user
        const customer = await prisma.customer.create({
          data: {
            name: session.user.name || data.guestName || "Customer",
            email: session.user.email || data.guestEmail,
            phone: data.guestPhone,
            userId: session.user.id,
            organizationId: org.id,
          },
        })
        customerId = customer.id
      }
    } else if (data.guestEmail) {
      // Admin creating for a customer OR guest booking
      // Check if customer already exists by email (within this organization)
      const existingCustomer = await prisma.customer.findFirst({
        where: { email: data.guestEmail, organizationId: org.id },
      })

      if (existingCustomer) {
        customerId = existingCustomer.id
        // Update customer info if needed
        await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            name: data.guestName || existingCustomer.name,
            phone: data.guestPhone || existingCustomer.phone,
          },
        })
      } else if (data.guestName) {
        // Create new customer without linking to any user
        const customer = await prisma.customer.create({
          data: {
            name: data.guestName,
            email: data.guestEmail,
            phone: data.guestPhone,
            organizationId: org.id,
          },
        })
        customerId = customer.id
      }
    }

    // Get staff info for the email (must belong to this organization)
    const staff = await prisma.staff.findFirst({
      where: { id: data.staffId, organizationId: org.id },
      select: { id: true, name: true },
    })

    if (!staff) {
      return { success: false, error: "Neveljavna izbira specialista" }
    }

    // Create the appointment with associated services
    const appointment = await prisma.appointment.create({
      data: {
        organizationId: org.id,
        staffId: data.staffId,
        customerId,
        resourceRecordId,
        // Guest info only used for non-authenticated bookings
        guestName: !customerId ? data.guestName : null,
        guestEmail: !customerId ? data.guestEmail : null,
        guestPhone: !customerId ? data.guestPhone : null,
        startTime: startInstant,
        endTime,
        status: appointmentStatus,
        notes: data.notes,
        totalPrice,
        depositAmount,
        depositPaid,
        // Create appointment-service relationships
        services: {
          create: data.serviceIds.map((serviceId) => ({
            serviceId,
          })),
        },
      },
      include: {
        services: {
          include: { service: true },
        },
      },
    })

    // Send confirmation email to customer
    // If admin is creating for a customer, use guest info; otherwise use session user info
    const customerEmail = isAdminCreating
      ? data.guestEmail
      : session?.user?.email || data.guestEmail
    const customerName = isAdminCreating
      ? data.guestName
      : session?.user?.name || data.guestName || "Customer"

    if (customerEmail && customerName) {
      const serviceNames = services.map((s) => s.name).join(", ")

      // Send email in background (non-blocking)
      after(async () => {
        const result = await sendAppointmentConfirmationEmail({
          email: customerEmail as string,
          customerName: customerName as string,
          serviceName: serviceNames,
          staffName: staff?.name || "Our Staff",
          appointmentDate: startInstant,
          appointmentTime: formatSalonTime(startInstant, tz),
          duration: totalDuration,
          totalPrice,
          depositAmount: config.bookingDeposit,
          appointmentId: appointment.id,
        })
        // P1 #76 — evidence: napiši confirmationSentAt PO uspešnem pošiljanju
        // (naredi vsak prihodnji job varnega idempotentnost).
        if (result?.success !== false) {
          await prisma.appointment
            .update({
              where: { id: appointment.id },
              data: { confirmationSentAt: new Date() },
            })
            .catch(() => undefined)
        }
      })
    }

    // Revalidate paths to update UI with new appointment
    revalidatePath("/my-appointments")
    revalidatePath("/dashboard")

    // Return success with appointment ID
    return {
      success: true,
      appointmentId: appointment.id,
    }
  } catch (error) {
    console.error("Error creating appointment:", error)
    return {
      success: false,
      error: "Ustvarjanje termina ni uspelo. Poskusite znova.",
    }
  }
}

//Get user appointments
export async function getUserAppointments() {
  // Get current session
  const session = await auth()
  if (!session?.user) {
    return [] // User not authenticated
  }

  // Find user with customer profile
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { customer: true },
  })

  if (!user?.customer) {
    return [] // User doesn't have a customer profile
  }

  // TENANT ISOLATION (EPIC #4 visual pass): when this action runs under a
  // tenant site (/s/[slug]/my-appointments — the proxy sets x-org-slug),
  // the list is scoped to THAT tenant only. Rendering another tenant's
  // appointments under this tenant's brand would leak both business
  // relations and personal data across tenants. On the platform root
  // (/my-appointments, no org header) the user sees their own global list
  // — their own data, platform domain, not a tenant surface.
  let organizationId: string | null = null
  let unknownTenant = false
  const slug = (await headers()).get(ORG_HEADER)
  if (slug) {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (org) {
      organizationId = org.id
    } else {
      // Unknown slug (the layout would render the maintenance screen, but
      // the page still executes in parallel) — resolve to an EMPTY list,
      // never to the global one.
      unknownTenant = true
    }
  }

  if (unknownTenant) {
    return []
  }

  // Fetch appointments for this customer — org-scoped when applicable.
  const appointments = await prisma.appointment.findMany({
    where: {
      customerId: user.customer.id,
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      staff: {
        select: { name: true, image: true, id: true },
      },
      services: {
        include: {
          service: {
            select: { slug: true, name: true, duration: true, imageUrl: true },
          },
        },
      },
    },
    orderBy: { startTime: "desc" }, // Most recent first
  })

  // Convert Prisma Decimals to numbers for price fields
  return appointments.map((apt) => ({
    ...apt,
    totalPrice: apt.totalPrice.toNumber(),
    depositAmount: apt.depositAmount.toNumber(),
  }))
}

// Cancel appointment
export async function cancelAppointment(appointmentId: string) {
  try {
    // Verify user is authenticated
    const session = await auth()
    if (!session?.user) {
      return {
        success: false,
        error: "Za odpoved termina morate biti prijavljeni",
      }
    }

    // Find appointment and verify ownership
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        customer: {
          include: { user: true },
        },
      },
    })

    // Validate appointment exists
    if (!appointment) {
      return { success: false, error: "Termina ni mogoče najti" }
    }

    // Validate user owns this appointment
    if (appointment.customer?.userId !== session.user.id) {
      return {
        success: false,
        error: "Nimate dovoljenja za odpoved tega termina",
      }
    }

    // Update appointment status to CANCELLED
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CANCELLED" },
    })

    // Revalidate paths to update UI
    revalidatePath("/my-appointments")
    revalidatePath("/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error cancelling appointment:", error)
    return {
      success: false,
      error: "Odpoved termina ni uspela. Poskusite znova.",
    }
  }
}

//Get admin appointments with filters
export async function getAdminAppointments(filters?: AdminAppointmentsFilter) {
  const { org } = await requirePermissionOrg("appointments.view")
  const salonTz = await getOrgTimezone(org.id)

  // Automatically handle past appointments before fetching
  const now = new Date()

  // 1. Handle PENDING (unpaid) appointments - cancel and notify
  const pendingToCancel = await prisma.appointment.findMany({
    where: {
      organizationId: org.id,
      status: "PENDING",
      endTime: { lt: now },
    },
    include: {
      customer: { select: { name: true, email: true } },
      staff: { select: { name: true } },
      services: { include: { service: { select: { name: true } } } },
    },
  })

  for (const apt of pendingToCancel) {
    const customerEmail = apt.customer?.email || apt.guestEmail
    const customerName = apt.customer?.name || apt.guestName || "Customer"

    if (customerEmail) {
      // Send email in background (non-blocking)
      after(async () => {
        await sendAppointmentExpiredEmail({
          email: customerEmail,
          customerName,
          serviceName: apt.services.map((s) => s.service.name).join(", "),
          staffName: apt.staff?.name || "Our Staff",
          appointmentDate: apt.startTime,
          appointmentTime: formatSalonTime(apt.startTime, salonTz),
          depositAmount: apt.depositAmount.toNumber(),
        })
      })
    }
  }

  await prisma.appointment.updateMany({
    where: {
      organizationId: org.id,
      status: "PENDING",
      endTime: { lt: now },
    },
    data: { status: "CANCELLED" },
  })

  // 2. Handle CONFIRMED (paid) appointments - mark as NO_SHOW
  const confirmedToNoShow = await prisma.appointment.findMany({
    where: {
      organizationId: org.id,
      status: "CONFIRMED",
      endTime: { lt: now },
    },
    include: {
      customer: { select: { name: true, email: true } },
      staff: { select: { name: true } },
      services: { include: { service: { select: { name: true } } } },
    },
  })

  for (const apt of confirmedToNoShow) {
    const customerEmail = apt.customer?.email || apt.guestEmail
    const customerName = apt.customer?.name || apt.guestName || "Customer"

    if (customerEmail) {
      // Send email in background (non-blocking)
      after(async () => {
        await sendNoShowNotificationEmail({
          email: customerEmail,
          customerName,
          serviceName: apt.services.map((s) => s.service.name).join(", "),
          staffName: apt.staff?.name || "Our Staff",
          appointmentDate: apt.startTime,
          appointmentTime: formatSalonTime(apt.startTime, salonTz),
          depositAmount: apt.depositAmount.toNumber(),
          appointmentId: apt.id,
        })
      })
    }
  }

  await prisma.appointment.updateMany({
    where: {
      organizationId: org.id,
      status: "CONFIRMED",
      endTime: { lt: now },
    },
    data: { status: "NO_SHOW" },
  })

  // Build where clause based on filters
  const where: Prisma.AppointmentWhereInput = {
    organizationId: org.id,
  }

  // Apply status filter
  if (filters?.status) {
    where.status = filters.status
  }

  // Apply staff filter
  if (filters?.staffId) {
    where.staffId = filters.staffId
  }

  // Apply date range filter
  if (filters?.dateFrom || filters?.dateTo) {
    where.startTime = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    }
  }

  // Apply search filter (by customer name)
  if (filters?.search) {
    where.OR = [
      { customer: { name: { contains: filters.search, mode: "insensitive" } } },
      { guestName: { contains: filters.search, mode: "insensitive" } },
    ]
  }

  // Fetch appointments with applied filters
  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      staff: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
      services: {
        include: {
          service: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { startTime: "desc" },
  })

  // Convert Prisma Decimals to numbers for price fields
  return appointments.map((apt) => ({
    ...apt,
    totalPrice: apt.totalPrice.toNumber(),
    depositAmount: apt.depositAmount.toNumber(),
  }))
}

// Cached version to avoid duplicate fetches in generateMetadata + page component
export const getAppointmentById = cache(async (id: string) => {
  const { org } = await requirePermissionOrg("appointments.view")

  const appointment = await prisma.appointment.findFirst({
    where: { id, organizationId: org.id },
    include: {
      staff: { select: { id: true, name: true, email: true, phone: true } },
      customer: {
        select: {
          id: true,
          userId: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      services: {
        include: {
          service: {
            select: { id: true, name: true, description: true, duration: true },
          },
        },
      },
    },
  })

  if (!appointment) {
    return null
  }

  // Convert Prisma Decimals to numbers for price fields
  return {
    ...appointment,
    totalPrice: appointment.totalPrice.toNumber(),
    depositAmount: appointment.depositAmount.toNumber(),
  }
})

// Mark past appointments as NO_SHOW
export async function markNoShowAppointments() {
  const { org } = await requirePermissionOrg("appointments.manage")

  const now = new Date()

  // Find and update all PENDING or CONFIRMED appointments where endTime has passed
  const result = await prisma.appointment.updateMany({
    where: {
      organizationId: org.id,
      status: {
        in: ["PENDING", "CONFIRMED"],
      },
      endTime: {
        lt: now,
      },
    },
    data: {
      status: "NO_SHOW",
    },
  })

  if (result.count > 0) {
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/appointments")
  }

  return { updated: result.count }
}

// Update appointment status
export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
) {
  // E4-6b: ADMIN callers need `appointments.manage` (a custom role may
  // remove it). STAFF keeps the legacy staff-portal path — the
  // own-appointment restriction below stays unchanged, and staff-portal
  // status updates are core STAFF self-service, never admin surface.
  const session = await auth()
  if (!session?.user || !["ADMIN", "STAFF"].includes(session.user.role)) {
    throw new UnauthorizedError("Unauthorized")
  }
  if (session.user.role === "ADMIN") {
    const perms = await getEffectivePermissions(session.user.id)
    if (!hasPermission(perms, "appointments.manage")) {
      throw new UnauthorizedError(
        "You do not have permission to perform this action"
      )
    }
  }

  const org = await getSessionOrg()
  if (!org) {
    throw new UnauthorizedError("Unauthorized")
  }
  const salonTz = await getOrgTimezone(org.id)

  // Get appointment details before updating (for email) — scoped to the org
  const appointmentDetails = await prisma.appointment.findFirst({
    where: { id, organizationId: org.id },
    include: {
      customer: { select: { name: true, email: true } },
      staff: { select: { name: true } },
      services: {
        include: {
          service: { select: { id: true, name: true, duration: true } },
        },
      },
    },
  })

  if (!appointmentDetails) {
    throw new Error("Appointment not found")
  }

  // SECURITY: STAFF may only update their own appointments (ADMIN can update all)
  if (session.user.role === "STAFF") {
    const ownStaff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (!ownStaff || appointmentDetails.staffId !== ownStaff.id) {
      throw new Error("Unauthorized")
    }
  }

  // Update appointment status
  const appointment = await prisma.appointment.update({
    where: { id },
    data: { status },
  })

  // Send email notification based on new status
  const customerEmail =
    appointmentDetails.customer?.email || appointmentDetails.guestEmail
  const customerName =
    appointmentDetails.customer?.name ||
    appointmentDetails.guestName ||
    "Customer"
  const serviceName = appointmentDetails.services
    .map((s) => s.service.name)
    .join(", ")
  const staffName = appointmentDetails.staff?.name || "Our Staff"

  if (customerEmail) {
    // Calculate total duration from appointment services
    const totalDuration = appointmentDetails.services.reduce(
      (sum, s) => sum + s.service.duration,
      0
    )

    // Send email in background (non-blocking)
    switch (status) {
      case "CONFIRMED":
        after(async () => {
          const result = await sendAppointmentConfirmationEmail({
            email: customerEmail,
            customerName,
            serviceName,
            staffName,
            appointmentDate: appointmentDetails.startTime,
            appointmentTime: formatSalonTime(appointmentDetails.startTime, salonTz),
            duration: totalDuration,
            totalPrice: appointmentDetails.totalPrice.toNumber(),
            depositAmount: appointmentDetails.depositAmount.toNumber(),
            appointmentId: id,
          })
          // P1 #76 — evidence: confirmationSentAt PO uspešnem pošiljanju.
          if (result?.success !== false) {
            await prisma.appointment
              .update({
                where: { id },
                data: { confirmationSentAt: new Date() },
              })
              .catch(() => undefined)
          }
        })
        break

      case "COMPLETED":
        after(async () => {
          await sendAppointmentCompletedEmail({
            email: customerEmail,
            customerName,
            serviceName,
            staffName,
            appointmentDate: appointmentDetails.startTime,
            appointmentTime: formatSalonTime(appointmentDetails.startTime, salonTz),
            totalPrice: appointmentDetails.totalPrice.toNumber(),
            appointmentId: id,
          })
        })
        break

      case "CANCELLED":
        after(async () => {
          await sendAppointmentCancelledEmail({
            email: customerEmail,
            customerName,
            serviceName,
            staffName,
            appointmentDate: appointmentDetails.startTime,
            appointmentTime: formatSalonTime(appointmentDetails.startTime, salonTz),
            appointmentId: id,
            cancelledByAdmin: true,
          })
        })
        break

      case "NO_SHOW":
        after(async () => {
          await sendNoShowNotificationEmail({
            email: customerEmail,
            customerName,
            serviceName,
            staffName,
            appointmentDate: appointmentDetails.startTime,
            appointmentTime: formatSalonTime(appointmentDetails.startTime, salonTz),
            depositAmount: appointmentDetails.depositAmount.toNumber(),
            appointmentId: id,
          })
        })
        break
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/appointments")

  return {
    ...appointment,
    totalPrice: appointment.totalPrice.toNumber(),
    depositAmount: appointment.depositAmount.toNumber(),
  }
}

export async function rescheduleAppointment(
  appointmentId: string,
  newStartTime: Date,
  opts?: { date?: string; time?: string }
) {
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: "Za prestavitev termina morate biti prijavljeni",
    }
  }

  const org = await resolveRequestOrg()
  if (!org) {
    return {
      success: false,
      error: "Termina ni mogoče najti",
    }
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      organizationId: org.id,
    },
    include: {
      customer: {
        include: {
          user: true,
        },
      },
      staff: { select: { name: true, id: true } },
      services: {
        include: {
          service: { select: { name: true, duration: true } },
        },
      },
    },
  })

  if (!appointment) {
    return {
      success: false,
      error: "Termina ni mogoče najti",
    }
  }

  // Check permissions: owner or ADMIN OF THE APPOINTMENT'S ORGANIZATION.
  // SECURITY (E4-6b): previously "any ADMIN" passed — an admin of tenant A
  // browsing /s/tenant-b could reschedule tenant-b appointments by id.
  // The admin check is now bound to the request-resolved org (legacy
  // admins without organizationId keep access only to their default org).
  const sessionOrg = await getSessionOrg()
  const isAdmin = isAdminForOrg(
    session.user,
    org.id,
    sessionOrg?.id ?? null
  )
  const isOwner = appointment.customer?.userId === session.user.id

  if (!isAdmin && !isOwner) {
    return {
      success: false,
      error: "Nimate dovoljenja za prestavitev tega termina",
    }
  }

  // Validate status
  if (appointment.status === "CANCELLED" || appointment.status === "NO_SHOW") {
    return {
      success: false,
      error: "Odpovedanega termina ali termina, ko se stranka ni pojavila, ni mogoče prestaviti",
    }
  }

  // Validate original appointment is not in the past
  if (new Date(appointment.startTime) < new Date()) {
    return {
      success: false,
      error: "Terminov v preteklosti ni mogoče prestavljati",
    }
  }

  // Build the target instant in the SALON timezone when date+time strings are
  // provided — otherwise fall back to the caller-provided instant.
  const tz = await getOrgTimezone(org.id)
  const targetInstant =
    opts?.date && opts?.time
      ? instantFromParts(opts.date, opts.time, tz)
      : newStartTime

  if (!targetInstant || isNaN(targetInstant.getTime())) {
    return {
      success: false,
      error: "Neveljaven datum ali ura termina",
    }
  }

  // Validate new time is not in the past
  if (targetInstant < new Date()) {
    return {
      success: false,
      error: "Termina v preteklosti ni mogoče prestaviti",
    }
  }

  const totalDuration = appointment.services.reduce(
    (sum, s) => sum + s.service.duration,
    0
  )

  const newEndTime = addMinutes(targetInstant, totalDuration)

  const slots = await getAvailableTimeSlots(
    appointment.staffId,
    opts?.date ?? targetInstant,
    totalDuration
  )

  const requestedTime = opts?.time ?? format(targetInstant, "HH:mm")
  const slotAvailable = slots.find(
    (slot) => slot.time === requestedTime && slot.available
  )

  if (!slotAvailable) {
    return {
      success: false,
      error: "Izbrani termin ni več prost. Izberite drugi termin.",
    }
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      startTime: targetInstant,
      endTime: newEndTime,
    },
  })

  revalidatePath("/my-appointments")
  revalidatePath("/dashboard/appointments")

  const customerEmail = appointment.customer?.email || appointment.guestEmail
  const customerName =
    appointment.customer?.name || appointment.guestName || "Customer"
  const serviceName = appointment.services.map((s) => s.service.name).join(", ")
  const staffName = appointment.staff?.name || "Our Staff"

  if (customerEmail) {
    // Send email in background (non-blocking)
    after(async () => {
      await sendAppointmentRescheduledEmail({
        email: customerEmail,
        customerName,
        serviceName,
        staffName,
        oldDate: appointment.startTime,
        oldTime: formatSalonTime(appointment.startTime, tz),
        newDate: targetInstant,
        newTime: formatSalonTime(targetInstant, tz),
        duration: totalDuration,
      })
    })
  }

  return {
    success: true,
  }
}
