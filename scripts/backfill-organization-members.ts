/**
 * ============================================================
 * #100 8.A (M1) — BACKFILL članstev (idempotentno, brez brisanja).
 *
 * Iz legacy polj User.organizationId + User.role ustvari po eno
 * OrganizationMember vrstico na uporabnika (isDefault=true). Uporabniki
 * brez organizationId (CLIENTE računi brez podjetja) se preskočijo.
 * Ponovni tek je varen: skip obstoječih parov (organizationId, userId).
 *
 * SAFETY: samo createMany skipDuplicates — nič ne prepiše, nič ne zbriše.
 *
 * Run: DATABASE_URL=… npx tsx scripts/backfill-organization-members.ts
 * ============================================================
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "" } },
})

async function main(): Promise<void> {
  const legacy = await prisma.user.findMany({
    where: { organizationId: { not: null } },
    select: { id: true, organizationId: true, role: true },
  })

  const existing = new Set(
    (
      await prisma.organizationMember.findMany({
        select: { organizationId: true, userId: true },
      })
    ).map((m) => `${m.organizationId}:${m.userId}`)
  )

  const toCreate = legacy
    .filter(
      (u) =>
        u.organizationId &&
        !existing.has(`${u.organizationId}:${u.id}`)
    )
    .map((u) => ({
      organizationId: u.organizationId!,
      userId: u.id,
      role: u.role,
      isDefault: true,
    }))

  const result = await prisma.organizationMember.createMany({
    data: toCreate,
    skipDuplicates: true,
  })

  console.log(
    `#100 M1 backfill: legacy=${legacy.length}, ustvarjenih=${result.count}, obstoječih preskočenih=${legacy.length - toCreate.length}`
  )
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error("Napaka:", error)
  await prisma.$disconnect()
  process.exit(1)
})
