"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/auth"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { getPublicOrg, getResolvedOrg } from "@/lib/tenant"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { getStripeForOrg } from "@/lib/stripe"
import { z } from "zod"
import { randomBytes } from "node:crypto"
import { sendGiftCardEmail } from "@/lib/email/gift-card"

// ============================================================
// PREPAID VALUE (#80) — darilni boni + paketi seans.
//
// EN primitiv: PrepaidProduct (katalog) → PrepaidPurchase (prodana
// instanca = obveznost) → PrepaidRedemption (unovčitev). Koda bona
// je globalno unikatna (bon salona A ni nikoli dvoumen pri salona B).
// Status PENDING = čaka spletno plačilo; ACTIVE = unovčljiv.
//
// varovalke:
//   • vse akcije so org-scoped (najemnik nikoli ne vidi tujih vrstic);
//   • aktivacija po plačilu je IDEMPOTENTNA (updateMany status PENDING);
//   • unovčitev istega naročila/termina je nemogoča na ravni baze
//     (unikatni indeksi na [prepaidPurchaseId, orderId/appointmentId]).
// ============================================================

/** Koda darilnega bona: RC-XXXX-XXXX (brez zmedljivih znakov). */
function generateGiftCardCode(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
  const bytes = randomBytes(8)
  const pick = (i: number) => alphabet[bytes[i] % alphabet.length]
  const part = (o: number) =>
    `${pick(o)}${pick(o + 1)}${pick(o + 2)}${pick(o + 3)}`
  return `RC-${part(0)}-${part(4)}`
}

function computeExpiresAt(validityDays: number | null | undefined): Date | null {
  if (!validityDays || validityDays <= 0) return null
  return new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
}

// ------------------------------------------------------------
// JAVNA STRAN — darilni boni kot sekcija trgovine
// ------------------------------------------------------------

export interface PublicGiftCard {
  id: string
  name: string
  description: string | null
  price: number
  faceValue: number
  validityDays: number | null
}

/** Aktiveni darilni boni najemnika za javno stran (org-scoped). */
export async function getPublicGiftCards(): Promise<PublicGiftCard[]> {
  const org = await getPublicOrg()
  if (!org) return []

  const rows = await prisma.prepaidProduct.findMany({
    where: { organizationId: org.id, kind: "GIFT_CARD", isActive: true },
    orderBy: { price: "asc" },
    take: 24,
  })

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price.toNumber(),
    faceValue: p.faceValue ? p.faceValue.toNumber() : p.price.toNumber(),
    validityDays: p.validityDays,
  }))
}

// ------------------------------------------------------------
// NAKUP — Stripe (PENDING → ACTIVE ob plačilu) ali offline (takoj ACTIVE)
// ------------------------------------------------------------

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
})

export interface GiftCardBuyResult {
  success: boolean
  error?: string
  checkoutUrl?: string
  // Offline sale: purchase created ACTIVE immediately — show the code.
  immediate?: { code: string; faceValue: number }
}

export async function createGiftCardCheckoutSession(
  prepaidProductId: string,
  contact: { name: string; email: string }
): Promise<GiftCardBuyResult> {
  const parsed = contactSchema.safeParse(contact)
  if (!parsed.success) {
    return { success: false, error: "Vnesite ime in veljaven e-poštni naslov." }
  }

  const org = await getPublicOrg()
  if (!org) {
    return { success: false, error: "Trgovina trenutno ni na voljo." }
  }

  // Org-scoped + samo aktivni GIFT_CARD — id tujega najemnika ne uspe.
  const product = await prisma.prepaidProduct.findFirst({
    where: {
      id: prepaidProductId,
      organizationId: org.id,
      kind: "GIFT_CARD",
      isActive: true,
    },
  })
  if (!product) {
    return { success: false, error: "Darilni bon ni več na voljo." }
  }

  const faceValue = product.faceValue
    ? product.faceValue.toNumber()
    : product.price.toNumber()

  // Brez Stripe ključa = offline prodaja (kot pri offline naročilih):
  // bon nastane takoj ACTIVE — zabeležen kot prodaja v salonu.
  const stripeClient = getStripeForOrg(org)
  if (!stripeClient) {
    const purchase = await prisma.prepaidPurchase.create({
      data: {
        organizationId: org.id,
        prepaidProductId: product.id,
        code: generateGiftCardCode(),
        status: "ACTIVE",
        purchasedAt: new Date(),
        expiresAt: computeExpiresAt(product.validityDays),
        balance: faceValue.toFixed(2),
        note: `Offline prodaja: ${parsed.data.name} <${parsed.data.email}>`,
      },
    })
    const email = parsed.data.email
    const code = purchase.code
    after(async () => {
      await sendGiftCardEmail({
        email,
        code,
        faceValue,
        productName: product.name,
        salonName: org.name,
        expiresAt: purchase.expiresAt?.toISOString() ?? null,
      }).catch(() => undefined)
    })
    return {
      success: true,
      immediate: { code: purchase.code, faceValue },
    }
  }

  // Spletna prodaja: PENDING purchase čaka na plačilo; webhook/verify
  // ga IDEMPOTENTNO aktivira (updateMany status PENDING).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  try {
    const purchase = await prisma.prepaidPurchase.create({
      data: {
        organizationId: org.id,
        prepaidProductId: product.id,
        guestEmail: parsed.data.email,
        code: generateGiftCardCode(),
        status: "PENDING",
        expiresAt: computeExpiresAt(product.validityDays),
        balance: faceValue.toFixed(2),
        note: `Spletni nakup: ${parsed.data.name}`,
      },
    })

    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: parsed.data.email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: product.name,
              description: `Darilni bon za ${org.name} (vrednost ${faceValue.toFixed(2)} €)`,
            },
            unit_amount: Math.round(product.price.toNumber() * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "prepaid_purchase",
        orgId: org.id,
        purchaseId: purchase.id,
      },
      success_url: `${baseUrl}/shop/gift/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/shop`,
    })

    await prisma.prepaidPurchase.update({
      where: { id: purchase.id },
      data: { stripeSessionId: session.id },
    })

    return { success: true, checkoutUrl: session.url ?? undefined }
  } catch (error) {
    console.error("Error creating gift card checkout:", error)
    return { success: false, error: "Ustvarjanje plačilne seje ni uspelo." }
  }
}

/** Verbose status porabe/expiracije za javno sporočilo v jeziku stranke. */
export type GiftCardRejection =
  | "NOT_FOUND"
  | "FOREIGN_TENANT"
  | "PENDING"
  | "EXPIRED"
  | "EXHAUSTED"
  | "REFUNDED"

export interface GiftCardValidation {
  ok: boolean
  rejection?: GiftCardRejection
  balance?: number
  code?: string
}

/**
 * Validacija darilnega bona za checkout. Org-scoped: koda se poišče
 * GLOBALLY (koda je unikatna), potem pa se preveri, da pripada TE
 * trgovini — bon salona A je zavrnjen pri salona B (FOREIGN_TENANT).
 */
export async function validateGiftCard(
  rawCode: string
): Promise<GiftCardValidation> {
  const org = await getPublicOrg()
  if (!org) return { ok: false, rejection: "NOT_FOUND" }

  const code = rawCode.trim().toUpperCase()
  if (!/^RC-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/.test(code)) {
    return { ok: false, rejection: "NOT_FOUND" }
  }

  const purchase = await prisma.prepaidPurchase.findUnique({
    where: { code },
    include: { prepaidProduct: { select: { kind: true } } },
  })
  if (!purchase) return { ok: false, rejection: "NOT_FOUND" }
  if (purchase.organizationId !== org.id) {
    return { ok: false, rejection: "FOREIGN_TENANT" }
  }
  if (purchase.prepaidProduct.kind !== "GIFT_CARD") {
    return { ok: false, rejection: "NOT_FOUND" }
  }
  if (purchase.status === "PENDING") {
    return { ok: false, rejection: "PENDING" }
  }
  if (purchase.status === "EXHAUSTED") {
    return { ok: false, rejection: "EXHAUSTED" }
  }
  if (purchase.status === "REFUNDED") {
    return { ok: false, rejection: "REFUNDED" }
  }
  if (purchase.expiresAt && purchase.expiresAt.getTime() < Date.now()) {
    return { ok: false, rejection: "EXPIRED" }
  }
  const balance = purchase.balance.toNumber()
  if (balance <= 0) return { ok: false, rejection: "EXHAUSTED" }

  return { ok: true, balance, code: purchase.code }
}

// ------------------------------------------------------------
// DASHBOARD — prodaja paketa + obveznosti (liability)
// ------------------------------------------------------------

const sellSchema = z.object({
  prepaidProductId: z.string().min(1).max(64),
  customerId: z.string().min(1).max(64).nullable().optional(),
  guestEmail: z.string().email().max(200).nullable().optional(),
  note: z.string().max(300).optional(),
})

export interface SellPrepaidResult {
  ok: boolean
  error?: string
  code?: string
}

/**
 * Prodaja VNAPREJ v salonu (offline — gotovina/kartica pri blagajni).
 * GIFT_CARD: nastane ACTIVE z balansom; PACKAGE: nastane ACTIVE s
 * sessionsLeft = sessionCount.
 */
export async function sellPrepaid(
  input: z.input<typeof sellSchema>
): Promise<SellPrepaidResult> {
  const parsed = sellSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "VALIDATION" }
  const data = parsed.data

  const { org } = await requirePermissionOrg("products.manage")

  const product = await prisma.prepaidProduct.findFirst({
    where: { id: data.prepaidProductId, organizationId: org.id, isActive: true },
  })
  if (!product) return { ok: false, error: "NOT_FOUND" }
  if (product.kind === "MEMBERSHIP") return { ok: false, error: "MEMBERSHIP_NOT_AVAILABLE" }
  if (!data.customerId && !data.guestEmail) {
    return { ok: false, error: "BUYER_REQUIRED" }
  }

  // Kupec mora pripadati temu najemniku.
  if (data.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, organizationId: org.id },
      select: { id: true },
    })
    if (!customer) return { ok: false, error: "BUYER_REQUIRED" }
  }

  const faceValue = product.faceValue
    ? product.faceValue.toNumber()
    : product.price.toNumber()

  const purchase = await prisma.prepaidPurchase.create({
    data: {
      organizationId: org.id,
      prepaidProductId: product.id,
      customerId: data.customerId ?? null,
      guestEmail: data.guestEmail ?? null,
      code: generateGiftCardCode(),
      status: "ACTIVE",
      purchasedAt: new Date(),
      expiresAt: computeExpiresAt(product.validityDays),
      balance: product.kind === "GIFT_CARD" ? faceValue.toFixed(2) : "0",
      sessionsLeft:
        product.kind === "PACKAGE" ? (product.sessionCount ?? 0) : null,
      note: data.note?.trim() || "Prodaja v salonu",
    },
  })

  revalidatePath("/dashboard/packages")
  revalidatePath("/dashboard")
  return { ok: true, code: purchase.code }
}

export interface PrepaidLiability {
  /** Active gift cards: money the salon still owes in goods/services. */
  giftCardBalance: number
  giftCardCount: number
  /** Active packages: sessions not yet redeemed. */
  packageSessions: number
  packageCount: number
  /** Estimated value of the remaining sessions (avg price of covered services). */
  estimatedSessionValue: number
}

/**
 * ODGOVORNOST (liability) — ena številka, ki jo lastnik MORA videti:
 * vnaprej prejeti denar NI dobiček na dan prodaje.
 *   giftCardBalance  = Σ balance (ACTIVE GIFT_CARD)
 *   packageSessions  = Σ sessionsLeft (ACTIVE PACKAGE)
 *   estimatedSessionValue = Σ sessionsLeft × avg cena pokritih storitev
 */
export async function getPrepaidLiability(): Promise<PrepaidLiability> {
  const { org } = await requirePermissionOrg("products.manage")

  const now = new Date()
  const [giftCards, packages] = await Promise.all([
    prisma.prepaidPurchase.findMany({
      where: {
        organizationId: org.id,
        status: "ACTIVE",
        prepaidProduct: { kind: "GIFT_CARD" },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { balance: true },
    }),
    prisma.prepaidPurchase.findMany({
      where: {
        organizationId: org.id,
        status: "ACTIVE",
        sessionsLeft: { gt: 0 },
        prepaidProduct: { kind: "PACKAGE" },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { sessionsLeft: true, prepaidProduct: { select: { serviceIds: true, items: { select: { serviceId: true } } } } },
    }),
  ])

  const giftCardBalance = giftCards.reduce(
    (sum, p) => sum + p.balance.toNumber(),
    0
  )

  let packageSessions = 0
  let estimatedSessionValue = 0

  const serviceIds = new Set<string>()
  for (const p of packages) {
    const left = p.sessionsLeft ?? 0
    packageSessions += left
    for (const sid of p.prepaidProduct.serviceIds) serviceIds.add(sid)
    for (const item of p.prepaidProduct.items) {
      if (item.serviceId) serviceIds.add(item.serviceId)
    }
  }
  if (serviceIds.size > 0) {
    const services = await prisma.service.findMany({
      where: { id: { in: [...serviceIds] }, organizationId: org.id },
      select: { price: true },
    })
    const avg =
      services.length > 0
        ? services.reduce((sum, s) => sum + s.price.toNumber(), 0) /
          services.length
        : 0
    estimatedSessionValue = Math.round(packageSessions * avg * 100) / 100
  }

  return {
    giftCardBalance: Math.round(giftCardBalance * 100) / 100,
    giftCardCount: giftCards.length,
    packageSessions,
    packageCount: packages.length,
    estimatedSessionValue,
  }
}

export interface PrepaidPurchaseRow {
  id: string
  productName: string
  kind: string
  buyer: string | null
  code: string
  status: string
  balance: number | null
  sessionsLeft: number | null
  purchasedAt: string
  expiresAt: string | null
}

/** Zadnje prodaje vnaprej — za pregled na paketi strani. */
export async function listPrepaidPurchases(): Promise<PrepaidPurchaseRow[]> {
  const { org } = await requirePermissionOrg("products.manage")

  const rows = await prisma.prepaidPurchase.findMany({
    where: { organizationId: org.id },
    include: {
      prepaidProduct: { select: { name: true, kind: true } },
      customer: { select: { name: true, email: true } },
    },
    orderBy: { purchasedAt: "desc" },
    take: 50,
  })

  return rows.map((p) => ({
    id: p.id,
    productName: p.prepaidProduct.name,
    kind: p.prepaidProduct.kind,
    buyer: p.customer?.name ?? p.guestEmail ?? p.note ?? null,
    code: p.code,
    status: p.status,
    balance: p.prepaidProduct.kind === "GIFT_CARD" ? p.balance.toNumber() : null,
    sessionsLeft: p.sessionsLeft,
    purchasedAt: p.purchasedAt.toISOString(),
    expiresAt: p.expiresAt?.toISOString() ?? null,
  }))
}

// ------------------------------------------------------------
// BOOKING — pokritost storitev z aktivnim paketom (za UI namig)
// ------------------------------------------------------------

export interface PrepaidCoverage {
  covered: boolean
  purchaseId?: string
  productName?: string
  sessionsLeft?: number
}

/**
 * Pokritost za PRIJAVLJENEGA kupca (customer match). Gostje se
 * preverijo strežniško ob kreaciji termina (po e-pošti).
 */
export async function checkPrepaidCoverage(
  serviceIds: string[]
): Promise<PrepaidCoverage> {
  const org = await getResolvedOrg()
  if (!org || serviceIds.length === 0) return { covered: false }

  const session = await auth()
  if (!session?.user) return { covered: false }

  const customer = await prisma.customer.findFirst({
    where: { userId: session.user.id, organizationId: org.id },
    select: { id: true },
  })
  if (!customer) return { covered: false }

  const now = new Date()
  const purchase = await prisma.prepaidPurchase.findFirst({
    where: {
      organizationId: org.id,
      customerId: customer.id,
      status: "ACTIVE",
      sessionsLeft: { gt: 0 },
      prepaidProduct: { kind: "PACKAGE" },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: {
      prepaidProduct: {
        select: {
          name: true,
          items: { select: { serviceId: true } },
        },
      },
    },
    orderBy: { purchasedAt: "asc" },
  })
  if (!purchase) return { covered: false }

  const covered = purchase.prepaidProduct.items.some(
    (item) => item.serviceId && serviceIds.includes(item.serviceId)
  )
  if (!covered) return { covered: false }

  return {
    covered: true,
    purchaseId: purchase.id,
    productName: purchase.prepaidProduct.name,
    sessionsLeft: purchase.sessionsLeft ?? 0,
  }
}

// ------------------------------------------------------------
// UNOVČITEV darilnega bona na naročilu — deljena z webhookom in
// verifyProductOrder (oba lahko prva označita plačilo). IDEMPOTENTNA:
// unikatni indeks [prepaidPurchaseId, orderId] prepreči dvojno
// unovčitev ISTEGA naročila na ravni baze; drugi prihod vidi P2002
// in vrne uspeh (ničesar več ne odšteje).
// ------------------------------------------------------------
export interface RedeemGiftCardResult {
  ok: boolean
  redeemed?: number
  exhausted?: boolean
}

export async function redeemGiftCardForOrder(
  orgId: string,
  code: string,
  orderId: string,
  amount: number
): Promise<RedeemGiftCardResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false }
  }

  const purchase = await prisma.prepaidPurchase.findUnique({
    where: { code },
    select: {
      id: true,
      organizationId: true,
      status: true,
      balance: true,
      redemptions: { where: { orderId }, select: { id: true } },
    },
  })
  if (!purchase || purchase.organizationId !== orgId) {
    return { ok: false }
  }
  // Idempotenca: ta naročilo je že unovčilo ta bon.
  if (purchase.redemptions.length > 0) {
    return { ok: true, redeemed: 0 }
  }
  if (purchase.status !== "ACTIVE") return { ok: false }

  const balance = purchase.balance.toNumber()
  const use = Math.min(balance, amount)
  if (use <= 0) return { ok: false }
  const nextBalance = Math.round((balance - use) * 100) / 100

  try {
    await prisma.$transaction(async (tx) => {
      await tx.prepaidPurchase.update({
        where: { id: purchase.id },
        data: {
          balance: nextBalance.toFixed(2),
          ...(nextBalance <= 0 ? { status: "EXHAUSTED" } : {}),
        },
      })
      await tx.prepaidRedemption.create({
        data: {
          prepaidPurchaseId: purchase.id,
          orderId,
          amount: use.toFixed(2),
        },
      })
    })
  } catch (error) {
    // P2002 na [prepaidPurchaseId, orderId] = drugi proces je bil hitrejši
    // (isti order) — to je uspeh idempotentnosti, ne napaka.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { ok: true, redeemed: 0 }
    }
    throw error
  }

  return { ok: true, redeemed: use, exhausted: nextBalance <= 0 }
}

/**
 * Aktivacija PENDING nakupa po uspešnem plačilu — IDEMPOTENTNA
 * (updateMany { status: "PENDING" } šteje zadetke; webhoook in
 * verify-product-success si ne moreta delati dvojnosti).
 * Vrne aktivirani nakup, kadar je bil TA klic tisti, ki je aktiviral.
 */
export async function activatePrepaidPurchase(
  sessionId: string
): Promise<{ ok: boolean; activated?: boolean; purchaseId?: string; email?: string | null }> {
  const pending = await prisma.prepaidPurchase.findFirst({
    where: { stripeSessionId: sessionId },
    select: {
      id: true,
      status: true,
      guestEmail: true,
      expiresAt: true,
      organization: { select: { name: true } },
      prepaidProduct: { select: { name: true, faceValue: true, price: true, kind: true } },
    },
  })
  if (!pending) return { ok: false }
  if (pending.status !== "PENDING") {
    return { ok: true, activated: false, purchaseId: pending.id, email: pending.guestEmail }
  }

  const activated = await prisma.prepaidPurchase.updateMany({
    where: { id: pending.id, status: "PENDING" },
    data: { status: "ACTIVE", purchasedAt: new Date() },
  })

  if (activated.count > 0 && pending.guestEmail) {
    const faceValue =
      pending.prepaidProduct.faceValue?.toNumber() ??
      pending.prepaidProduct.price.toNumber()
    const purchase = await prisma.prepaidPurchase.findUnique({
      where: { id: pending.id },
      select: { code: true },
    })
    if (purchase) {
      after(async () => {
        await sendGiftCardEmail({
          email: pending.guestEmail!,
          code: purchase.code,
          faceValue,
          productName: pending.prepaidProduct.name,
          salonName: pending.organization.name,
          expiresAt: pending.expiresAt?.toISOString() ?? null,
        }).catch(() => undefined)
      })
    }
  }

  return { ok: true, activated: activated.count > 0, purchaseId: pending.id, email: pending.guestEmail }
}

