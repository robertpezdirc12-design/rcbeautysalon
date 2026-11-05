"use server"

import { prisma } from "@/lib/prisma"
import { verifyUnsubscribeToken } from "@/lib/marketing/unsubscribe"

// ============================================================
// #95 (AD-03) — potrditev odjave: žeton se ponovno preveri na
// strežniku, vrstica se ustvari idempotentno (upsert). Odjava je
// per pošiljatelj (org) — druge najemnike ne vpliva.
// ============================================================

export async function confirmUnsubscribe(token: string): Promise<{
  success: boolean
  error?: string
}> {
  const verified = verifyUnsubscribeToken(token)
  if (!verified) {
    return { success: false, error: "Povezava ni veljavna ali je potekla." }
  }

  const org = await prisma.organization.findUnique({
    where: { id: verified.organizationId },
    select: { id: true, status: true },
  })
  if (!org) {
    return { success: false, error: "Pošiljatelj ne obstaja več." }
  }

  // Idempotentno: ponovni klik ne podvoji vrstice in ne "odjavljanja od odjave".
  await prisma.marketingUnsubscribe.upsert({
    where: {
      organizationId_email: {
        organizationId: verified.organizationId,
        email: verified.email,
      },
    },
    create: {
      organizationId: verified.organizationId,
      email: verified.email,
    },
    update: {},
  })

  return { success: true }
}

/** Pogled pred potrditvijo: ali žeton velja in kdo je pošiljatelj. */
export async function getUnsubscribePreview(token: string): Promise<{
  valid: boolean
  businessName?: string
  email?: string
}> {
  const verified = verifyUnsubscribeToken(token)
  if (!verified) return { valid: false }
  const org = await prisma.organization.findUnique({
    where: { id: verified.organizationId },
    select: { name: true },
  })
  if (!org) return { valid: false }
  return { valid: true, businessName: org.name, email: verified.email }
}
