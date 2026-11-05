"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/auth"
import { isPushConfigured } from "@/lib/push/core"

// ============================================================
// #99 — PUSH naročnina (akcije)
// Seja obvezna: naročnina pripada prijavljenemu uporabniku (+ njegov
// najemnik). Endpoint je naravni dedup ključ (upsert — prenova naprave
// ne podvoji vrstice). Brez VAPID ključev je naročnina zavrnjena
// (pošteno: UI že prej pokaže "ni nastavljeno").
// ============================================================

export async function getPushConfig(): Promise<{
  configured: boolean
  vapidPublicKey: string | null
  subscribed: boolean
}> {
  const session = await auth()
  if (!session?.user?.id) {
    return { configured: false, vapidPublicKey: null, subscribed: false }
  }
  const configured = isPushConfigured(
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  const subscribed = configured
    ? (await prisma.pushSubscription.count({ where: { userId: session.user.id } })) > 0
    : false
  return {
    configured,
    vapidPublicKey: configured ? process.env.VAPID_PUBLIC_KEY! : null,
    subscribed,
  }
}

export async function subscribePush(input: {
  endpoint: unknown
  keys: unknown
  userAgent?: unknown
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Za naročnino morate biti prijavljeni." }
  }
  if (!isPushConfigured(process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)) {
    return { success: false, error: "Push ni nastavljen na strežniku." }
  }

  const endpoint = typeof input.endpoint === "string" ? input.endpoint : ""
  const keys = (input.keys ?? {}) as { p256dh?: unknown; auth?: unknown }
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : ""
  const keyAuth = typeof keys.auth === "string" ? keys.auth : ""
  if (!endpoint.startsWith("https://") || !p256dh || !keyAuth) {
    return { success: false, error: "Neveljavna naročnina." }
  }

  const userAgent =
    typeof input.userAgent === "string" ? input.userAgent.slice(0, 300) : null

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: session.user.id,
      organizationId: session.user.organizationId ?? null,
      endpoint,
      p256dh,
      auth: keyAuth,
      userAgent,
    },
    update: {
      userId: session.user.id,
      organizationId: session.user.organizationId ?? null,
      p256dh,
      auth: keyAuth,
      userAgent,
    },
  })
  return { success: true }
}

export async function unsubscribePush(endpoint: unknown): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id || typeof endpoint !== "string" || !endpoint) {
    return { success: false }
  }
  // Lastnik vrstice jo sme pobrisati (org-scoped na uporabnika).
  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  })
  return { success: true }
}
