"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth, unstable_update } from "@/lib/auth/auth"
import { getMembershipsForUser } from "@/lib/auth/memberships"

// ============================================================
// #100 8.A (M3) — PREKLOP AKTIVNEGA PODJETJA
// Lastnik z več dejavnostmi v enem računu preklaplja med njimi:
//  - članstvo je OBVEZNO (ni preklopa na tuje org — varnost),
//  - seja (JWT organizationId) in legacy kazalec User.organizationId
//    se uskladita (drugi naprave vidijo isti aktivni org),
//  - revalidate celotne plošče (nav, terminologija, podatki).
// Vloga per org se bere sveže iz članstva (guards M2) — JWT ne šteje.
// ============================================================

export async function switchActiveOrganization(
  organizationId: string
): Promise<{ success: boolean; organizationName?: string; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Za preklop morate biti prijavljeni." }
  }

  const memberships = await getMembershipsForUser(session.user.id)
  const target = memberships.find((m) => m.organizationId === organizationId)
  if (!target) {
    // Not your company — indistinguishable from missing (no probing).
    return { success: false, error: "Podjetje ni na voljo na tem računu." }
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, status: true },
  })
  if (!org || org.status !== "ACTIVE") {
    return { success: false, error: "To podjetje ni aktivno." }
  }

  // Legacy kazalec + seja usklajena (drugi naprave / svež JWT).
  await prisma.user.update({
    where: { id: session.user.id },
    data: { organizationId: organizationId },
  })
  await unstable_update({
    user: { organizationId: organizationId } as { organizationId: string },
  })

  // Celotna plošča se preračuna (sidebar, terminologija, podatki).
  revalidatePath("/", "layout")
  return { success: true, organizationName: org.name }
}
