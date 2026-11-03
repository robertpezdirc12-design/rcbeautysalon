"use server"

// ============================================================
// CATEGORIES (P3 #52) — shared by the product AND service forms.
//
// Prej ni obstajala NOBENA pot do prve kategorije: izbirnik v obrazcu
// je bil pri 0 kategorij prazen popover brez sporočila, upravljanja
// kategorij pa ni bilo nikjer. Ta akcija omogoča ustvarjanje iz
// praznega stanja izbirnika (inline, brez zapuščanja obrazca) in je
// idempotentna glede imen (isti organizationId + ime → obstoječa
// kategorija, ne dvojnik).
// ============================================================

import { prisma } from "@/lib/prisma"
import { UnauthorizedError, requireAnyPermissionOrg } from "@/lib/auth/guards"
import { slugify } from "@/lib/tenant"
import { normalizeCategoryName } from "@/lib/dashboard/category-picker"

export interface CreateCategoryResult {
  success: boolean
  category?: { id: string; name: string }
  /** "duplicate" → vračamo obstoječo (idempotentno, UI jo takoj izbere). */
  reused?: boolean
  error?: string
}

/** Edinstven znotraj najemnika (organizacijski ID + slug). */
async function uniqueSlug(organizationId: string, name: string): Promise<string> {
  const base = slugify(name) || "kategorija"
  let candidate = base
  for (let i = 2; i <= 20; i++) {
    const taken = await prisma.category.findFirst({
      where: { organizationId, slug: candidate },
      select: { id: true },
    })
    if (!taken) return candidate
    candidate = `${base}-${i}`
  }
  return `${base}-${Date.now().toString(36)}`
}

export async function createCategory(
  name: string
): Promise<CreateCategoryResult> {
  try {
    const { org } = await requireAnyPermissionOrg([
      "products.manage",
      "services.manage",
    ])

    const valid = normalizeCategoryName(name)
    if (!valid.ok) {
      return {
        success: false,
        error:
          valid.reason === "too-long"
            ? "Ime kategorije je predolgo (največ 60 znakov)."
            : "Ime kategorije mora imeti vsaj 2 znaka.",
      }
    }

    // Idempotentno: isto ime znotraj najemnika → vrni obstoječo kategorijo.
    const existing = await prisma.category.findFirst({
      where: {
        organizationId: org.id,
        name: { equals: valid.name, mode: "insensitive" },
      },
      select: { id: true, name: true },
    })
    if (existing) {
      return { success: true, category: existing, reused: true }
    }

    const slug = await uniqueSlug(org.id, valid.name)
    const created = await prisma.category.create({
      data: {
        organizationId: org.id,
        name: valid.name,
        slug,
      },
      select: { id: true, name: true },
    })

    return { success: true, category: created }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error creating category:", error)
    return { success: false, error: "Ustvarjanje kategorije ni uspelo." }
  }
}
