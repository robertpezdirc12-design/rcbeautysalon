"use server"

import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { UnauthorizedError, requirePermissionOrg } from "@/lib/auth/guards"
import {
  adminSetPasswordSchema,
  type AdminSetPasswordInput,
} from "@/lib/validations/auth"
import {
  canAdminManageTarget,
  type MemberManageBlockReason,
} from "@/lib/permissions/guard-rules"
import { hasAllPermissions } from "@/lib/permissions/roles"
import { getEffectivePermissions } from "@/lib/permissions/effective"
import { buildLeadSearchWhere } from "@/lib/customers/leads"

type UserRole = "ADMIN" | "STAFF" | "CLIENTE"

export interface AdminUpdateUserInput {
  role?: UserRole
  notes?: string
}

// Admin: Get all users with customer data (scoped to the admin's organization)
export async function getAdminUsers(search?: string) {
  const { org } = await requirePermissionOrg("customers.manage")

  // A user belongs to this org directly, or via their customer profile
  const orgMembership = {
    OR: [{ organizationId: org.id }, { customer: { organizationId: org.id } }],
  }

  const users = await prisma.user.findMany({
    where: search
      ? {
          AND: [
            orgMembership,
            {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            },
          ],
        }
      : orgMembership,
    include: {
      customer: {
        include: {
          _count: {
            select: {
              appointments: true,
              orders: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return users
}

// Admin: Get user statistics
// P2 #48: števec odraža STRANKE (Customer vrstice), ne samo registrirane
// račune — javni obrazci ustvarjajo linke brez računa, ki jih je seznam
// uporabnikov prej utišano izpuščal.
export async function getUserStats() {
  const { org } = await requirePermissionOrg("customers.manage")

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const orgMembership = {
    OR: [{ organizationId: org.id }, { customer: { organizationId: org.id } }],
  }

  const [totalUsers, activeThisMonth, newThisMonth, totalCustomers, leadsWithoutAccount] =
    await Promise.all([
      prisma.user.count({ where: orgMembership }),
      prisma.user.count({
        where: {
          AND: [
            orgMembership,
            {
              sessions: {
                some: {
                  expires: { gte: now },
                },
              },
            },
          ],
        },
      }),
      // P2 #48: "novih ta mesec" šteje stranke (baza strank), ne račune.
      prisma.customer.count({
        where: { organizationId: org.id, createdAt: { gte: startOfMonth } },
      }),
      prisma.customer.count({ where: { organizationId: org.id } }),
      prisma.customer.count({
        where: { organizationId: org.id, user: null },
      }),
    ])

  return {
    totalUsers,
    activeThisMonth,
    newThisMonth,
    totalCustomers,
    leadsWithoutAccount,
  }
}

// Admin: Get customers WITHOUT a user account (P2 #48) — public form
// submissions create these leads; they must be visible in the customer
// list, searchable by name, email and phone.
export async function getCustomerLeads(search?: string) {
  const { org } = await requirePermissionOrg("customers.manage")

  return prisma.customer.findMany({
    where: buildLeadSearchWhere(org.id, search),
    include: {
      _count: {
        select: {
          appointments: true,
          orders: true,
          formSubmissions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

// Admin: Get user by ID with full details
// Cached to avoid duplicate fetches in generateMetadata + page component
export const getUserById = cache(async (id: string) => {
  const { org } = await requirePermissionOrg("customers.manage")

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          appointments: {
            include: {
              services: {
                include: {
                  service: true,
                },
              },
              staff: true,
            },
            orderBy: { startTime: "desc" },
            take: 10,
          },
          orders: {
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      },
      staff: true,
    },
  })

  // Tenant check: the user must belong to the admin's organization
  // (directly, via their customer profile, or via their staff profile)
  if (!user) return null
  const belongsToOrg =
    user.organizationId === org.id ||
    user.customer?.organizationId === org.id ||
    user.staff?.organizationId === org.id
  if (!belongsToOrg) return null

  return user
})

// Calculate total spent by customer
export async function getCustomerTotalSpent(customerId: string) {
  const { org } = await requirePermissionOrg("customers.manage")

  // Tenant check: the customer must belong to this organization
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: org.id },
    select: { id: true },
  })
  if (!customer) return 0

  const [appointmentTotal, orderTotal] = await Promise.all([
    prisma.appointment.aggregate({
      where: {
        customerId,
        organizationId: org.id,
        status: "COMPLETED",
        // Count all completed appointments (service was rendered)
      },
      _sum: {
        totalPrice: true,
      },
    }),
    prisma.order.aggregate({
      where: {
        customerId,
        organizationId: org.id,
        status: { in: ["PAID", "COMPLETED"] },
      },
      _sum: {
        total: true,
      },
    }),
  ])

  const appointmentSum = appointmentTotal._sum.totalPrice?.toNumber() || 0
  const orderSum = orderTotal._sum.total?.toNumber() || 0

  return appointmentSum + orderSum
}

// Admin: Update user role
export async function updateUserRole(userId: string, role: UserRole) {
  try {
    const { session, org } = await requirePermissionOrg("staff.manage")

    // SECURITY (E4-6b): the target must be a member of THIS organization.
    // Role management may never touch platform-wide accounts (previously
    // this could promote an arbitrary user AND attach them to this org).
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        organizationId: true,
        staff: { select: { organizationId: true } },
        customer: { select: { organizationId: true } },
      },
    })

    if (!target) {
      return { success: false, error: "Uporabnik ni najden." }
    }

    const decision = canAdminManageTarget(session.user, target, org.id)
    if (!decision.ok) {
      const messages: Record<MemberManageBlockReason, string> = {
        self: "Svoje vloge ne morete spremeniti tukaj.",
        "not-member": "Uporabnik ni član tega salona.",
        "admin-target": "Vloge drugih administratorjev ni mogoče spreminjati.",
      }
      return { success: false, error: messages[decision.reason] }
    }

    // E4-6b: only an UNRESTRICTED admin may create a new ADMIN — a
    // restricted admin ("admin brez financ") must never be able to
    // escalate themselves or others past their own limits.
    if (role === "ADMIN") {
      const perms = await getEffectivePermissions(session.user.id)
      if (!hasAllPermissions(perms)) {
        return {
          success: false,
          error:
            "Nove administratorje lahko ustvari samo administrator brez skrčene vloge.",
        }
      }
    }

    // If changing to STAFF, create staff profile if doesn't exist
    if (role === "STAFF") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { staff: true },
      })

      if (!user) {
        return { success: false, error: "Uporabnik ni najden." }
      }

      // Create staff profile if doesn't exist
      if (!user.staff) {
        await prisma.staff.create({
          data: {
            name: user.name || "Staff Member",
            email: user.email,
            image: user.image, // Copy user's profile image
            isActive: true,
            organization: { connect: { id: org.id } },
            user: { connect: { id: userId } },
          },
        })
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role },
    })

    revalidatePath(`/dashboard/users/${userId}`)
    revalidatePath("/dashboard/users")
    revalidatePath("/dashboard/staff")
    revalidatePath("/staff")

    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating user role:", error)
    return { success: false, error: "Failed to update user role" }
  }
}

// Admin: Set a new password for an organization member (password reset helper)
// - org-scoped: target must belong to the admin's organization
// - self-reset is blocked (admin must use account settings with current password)
// - other ADMINs are protected (no privilege escalation via dashboard)
// - clears any pending self-service reset token
export async function adminSetUserPassword(input: AdminSetPasswordInput) {
  const validated = adminSetPasswordSchema.safeParse(input)

  if (!validated.success) {
    return { success: false, errors: validated.error.issues }
  }

  try {
    const { session, org } = await requirePermissionOrg("staff.manage")
    const { userId, password } = validated.data

    if (session.user.id === userId) {
      return {
        success: false,
        errors: [
          {
            message:
              "Svojega gesla ne morete ponastaviti tukaj — uporabite nastavitve računa.",
          },
        ],
      }
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        staff: { select: { organizationId: true } },
        customer: { select: { organizationId: true } },
      },
    })

    if (!target) {
      return { success: false, errors: [{ message: "Uporabnik ni najden." }] }
    }

    const belongsToOrg =
      target.organizationId === org.id ||
      target.customer?.organizationId === org.id ||
      target.staff?.organizationId === org.id

    if (!belongsToOrg) {
      return {
        success: false,
        errors: [{ message: "Uporabnik ni član tega salona." }],
      }
    }

    if (target.role === "ADMIN") {
      return {
        success: false,
        errors: [
          { message: "Gesla drugih administratorjev ni mogoče ponastaviti." },
        ],
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: target.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    })

    revalidatePath(`/dashboard/users/${target.id}`)
    revalidatePath("/dashboard/users")

    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, errors: [{ message: error.message }] }
    }
    console.error("Error setting user password:", error)
    return {
      success: false,
      errors: [{ message: "Napaka pri nastavljanju gesla." }],
    }
  }
}

// Admin: Update customer notes
export async function updateCustomerNotes(userId: string, notes: string) {
  try {
    const { org } = await requirePermissionOrg("customers.manage")

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true },
    })

    if (!user || user.customer?.organizationId !== org.id) {
      return { success: false, error: "User not found" }
    }

    if (!user.customer) {
      return { success: false, error: "User has no customer profile" }
    }

    await prisma.customer.update({
      where: { id: user.customer.id },
      data: { notes },
    })

    revalidatePath(`/dashboard/users/${userId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating customer notes:", error)
    return { success: false, error: "Failed to update notes" }
  }
}

// Admin: Delete user
export async function deleteUser(userId: string) {
  try {
    const { org } = await requirePermissionOrg("customers.manage")

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        customer: true,
        staff: true,
      },
    })

    // Tenant check: the user must belong to the admin's organization
    if (
      !user ||
      !(
        user.organizationId === org.id ||
        user.customer?.organizationId === org.id ||
        user.staff?.organizationId === org.id
      )
    ) {
      return { success: false, error: "User not found" }
    }

    // Check if user has appointments or orders (within this organization)
    const [customerAppointments, customerOrders, staffAppointments] =
      await Promise.all([
        user.customer
          ? prisma.appointment.count({
              where: { customerId: user.customer.id, organizationId: org.id },
            })
          : Promise.resolve(0),
        user.customer
          ? prisma.order.count({
              where: { customerId: user.customer.id, organizationId: org.id },
            })
          : Promise.resolve(0),
        user.staff
          ? prisma.appointment.count({
              where: { staffId: user.staff.id, organizationId: org.id },
            })
          : Promise.resolve(0),
      ])

    const hasCustomerData = customerAppointments > 0 || customerOrders > 0
    const hasStaffData = staffAppointments > 0

    if (hasCustomerData || hasStaffData) {
      return {
        success: false,
        error:
          "Cannot delete user with existing appointments or orders. Consider deactivating instead.",
      }
    }

    // Delete related records first
    if (user.customer) {
      await prisma.customer.delete({ where: { id: user.customer.id } })
    }
    if (user.staff) {
      await prisma.staff.delete({ where: { id: user.staff.id } })
    }

    // Delete user
    await prisma.user.delete({ where: { id: userId } })

    revalidatePath("/dashboard/users")

    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error deleting user:", error)
    return { success: false, error: "Failed to delete user" }
  }
}
