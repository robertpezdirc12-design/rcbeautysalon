"use server"

import { getStripeForOrg } from "@/lib/stripe"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { validateCartStock } from "./cart"
import { getPublicOrg } from "@/lib/tenant"
import { getPlan } from "@/lib/plans/registry"
import { checkPlanLimit, monthStartUtc } from "@/lib/plans/types"
import { SI_VAT_RATE, vatFromGross } from "@/lib/vat"
import { guestIdentityMatches } from "@/lib/checkout/guest-identity"
import type { CartItem } from "@/store/cart-store"
// #80: unovčitev darilnega bona (deljena z webhookom — idempotentna).
import { redeemGiftCardForOrder } from "./prepaid"

const FREE_SHIPPING_THRESHOLD = 50
const SHIPPING_COST = 5.99

/**
 * P1 #65 — guest checkout contact. An account is an OFFER, not a
 * precondition: a buyer of a €9 honey jar must not have to register.
 * Name + (email OR phone) required; address optional (delivery notes).
 */
export interface CheckoutContact {
  name: string
  email?: string
  phone?: string
  address?: string
}

interface CheckoutResult {
  success: boolean
  checkoutUrl?: string
  /** P1 #65: true when the order was recorded WITHOUT online payment. */
  offline?: boolean
  /** Short human-readable code the customer sees on the confirmation. */
  orderNumber?: string
  /** Tenant contact for the "salon will contact you" screen (clickable). */
  contactPhone?: string | null
  contactEmail?: string | null
  // #80: order fully paid with a gift card (no Stripe needed).
  giftCardPaid?: boolean
  error?: string
  stockErrors?: Array<{
    productId: string
    name: string
    available: number
    requested: number
  }>
}

/** Tolerant contact validation (server-side — the client form is a hint). */
function validateContact(
  contact: CheckoutContact | undefined
): { ok: false; error: string } | { ok: true } {
  if (!contact) {
    return { ok: false, error: "Za zaključek nakupa izpolnite svoje kontaktne podatke." }
  }
  const name = contact.name?.trim() ?? ""
  const email = contact.email?.trim() ?? ""
  const phone = contact.phone?.trim() ?? ""
  if (name.length < 2) {
    return { ok: false, error: "Vnesite ime in priimek." }
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
  if (!email && !phone) {
    return { ok: false, error: "Vnesite e-pošto ali telefonsko številko." }
  }
  if (email && !emailOk) {
    return { ok: false, error: "E-poštni naslov ni veljaven." }
  }
  return { ok: true }
}

/**
 * P2 #70 — poveži gostovo naročilo z obstoječo stranko SAMO, kadar je
 * ujemanje nedvoumno; sicer je naročilo ČISTO gostovo (customerId = null).
 *
 *  1. E-pošta je identitetni signal, ki ga kupec upravlja — natančno
 *     (neobčutljivo na velike črke) ujemanje poveže naročilo s stranko
 *     (brez duplikatov).
 *  2. Telefon SAM NI DOVOLJ za prevzem identitete: skupni gospodinjski
 *     telefon ali trgovinska številka bi lastnika usmerila k napačni
 *     osebi (QIGC3TJU je bil prikazan kot »Gost Test Srna«, čeprav je
 *     kupec vnesel drugo ime/e-pošto). Telefonski zadetek velja le, če
 *     je tudi ime isto IN stranka nima e-pošte ali se e-pošti ujemata
 *     (guestIdentityMatches, čista logika v lib/checkout/guest-identity).
 *  3. Sicer: brez tihoge spajanja identitet, brez duplikatov strank in
 *     brez PISANJA v obstoječi zapis (ime/e-pošta/telefon stranke se ne
 *     spreminjata iz gostovega obrazca). Kontakt naročila ostane na
 *     gostovih poljih (guestName/guestEmail/guestPhone) in je vir
 *     resnice za prikaz (prioriteta: gost pred stranko).
 */
async function resolveGuestCustomerId(
  orgId: string,
  contact: CheckoutContact
): Promise<string | null> {
  const email = contact.email?.trim().toLowerCase() || null
  const phone = contact.phone?.trim() || null
  if (!email && !phone) return null

  // 1) e-pošta — nedvoumna identiteta
  if (email) {
    const byEmail = await prisma.customer.findFirst({
      where: {
        organizationId: orgId,
        email: { equals: email, mode: "insensitive" },
      },
      select: { id: true },
    })
    if (byEmail) return byEmail.id
  }

  // 2) telefon + enaka identiteta (ime [+ e-pošta])
  if (phone) {
    const byPhone = await prisma.customer.findFirst({
      where: { organizationId: orgId, phone },
      select: { id: true, name: true, email: true },
    })
    if (byPhone && guestIdentityMatches(byPhone, contact)) {
      return byPhone.id
    }
  }

  // 3) čisto gostovo naročilo — brez tihoge združitve oseb
  return null
}

export async function createProductCheckoutSession(
  items: CartItem[],
  contact?: CheckoutContact,
  giftCardCode?: string
): Promise<CheckoutResult> {
  try {
    // Get current session — OPTIONAL since #65: guests can order with
    // contact details; an account is offered, never required.
    const session = await auth()

    const guest = !session?.user
    if (guest && !contact) {
      return {
        success: false,
        error: "Za zaključek nakupa izpolnite svoje kontaktne podatke.",
      }
    }
    if (guest) {
      const check = validateContact(contact)
      if (!check.ok) return { success: false, error: check.error }
    }

    // Resolve the tenant organization for this checkout
    const org = await getPublicOrg()
    if (!org) {
      return {
        success: false,
        error: "Trgovina trenutno ni na voljo. Poskusite znova kasneje.",
      }
    }

    if (items.length === 0) {
      return {
        success: false,
        error: "Vaša košarica je prazna",
      }
    }

    // Validate stock (tenant resolved from the request inside the action)
    const stockValidation = await validateCartStock(items)
    if (!stockValidation.valid) {
      return {
        success: false,
        error: "Nekateri izdelki niso na zalogi",
        stockErrors: stockValidation.errors,
      }
    }

    // SECURITY: re-price everything from the database. Client-supplied prices
    // (from the Zustand cart) are never trusted for payment amounts.
    // Products MUST belong to the current organization — their price is only
    // used when organizationId matches.
    const productIds = items.map((item) => item.productId)
    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
        // #78: checkout sprejema SAMO prodajne izdelke (forSale) —
        // back-bar se ne da kupiti, niti s staljenim cart-om.
        forSale: true,
        organizationId: org.id,
      },
      // #78: per-izdelek DDV stopnja za točen informativni razpad.
      select: { id: true, name: true, images: true, price: true, vatRate: true },
    })

    const productMap = new Map(dbProducts.map((p) => [p.id, p]))

    if (dbProducts.length !== new Set(productIds).size) {
      return {
        success: false,
        error: "Nekateri izdelki v košarici niso več na voljo",
      }
    }

    const pricedItems = items.map((item) => {
      const product = productMap.get(item.productId)! // existence guaranteed above
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price.toNumber(),
        name: product.name,
        image: product.images[0] || null,
      }
    })

    // Calculate totals from trusted prices.
    // P1 #33 (re-audit 2026-11): BRUTO cenik — cene že vsebujejo DDV, zato
    // checkout NE prišteva davka (prej magični 8 % → napačen skupni znesek
    // na naročilu računu). DDV se izkaže iz bruto zneska kot informativni
    // razpad (istega funkcije kot v košarici — en vir resnice, src/lib/vat).
    // #78: stopnja je PER IZDELEK (product.vatRate), privzeto 22 % —
    // redukcija po vrsticah, ker lahko ima salono izdelek z 9,5 %.
    const subtotal = pricedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
    const tax = pricedItems.reduce((sum, item) => {
      const product = productMap.get(item.productId)! // existence guaranteed above
      const rate =
        product.vatRate && product.vatRate.toNumber() > 0
          ? product.vatRate.toNumber() / 100
          : SI_VAT_RATE
      return sum + vatFromGross(item.price * item.quantity, rate)
    }, vatFromGross(shipping, SI_VAT_RATE))
    const total = subtotal + shipping

    // ------------------------------------------------------------
    // #80: DARILNI BON pri checkoutu. Validacija je strogo org-scoped
    // (koda je globalno unikatna → tuj bon je zavrnjen kot
    // FOREIGN_TENANT, ne tiho sprejet). Dve poti:
    //   A) balance >= total → naročilo PLAČANO z bonom (brez Stripe):
    //      order PAID + unovčitev + zaloge v ENI transakciji.
    //   B) balance < total → Stripe zaračuna OSTANEK (ena vrstica);
    //      unovčitev se zgodi ob potrditvi plačila (webhook/verify).
    // ------------------------------------------------------------
    let giftCard: {
      code: string
      purchaseId: string
      balance: number
      applied: number
      fullCoverage: boolean
    } | null = null

    if (giftCardCode && giftCardCode.trim()) {
      const code = giftCardCode.trim().toUpperCase()
      const purchase = await prisma.prepaidPurchase.findUnique({
        where: { code },
        include: { prepaidProduct: { select: { kind: true } } },
      })
      if (!purchase || purchase.prepaidProduct.kind !== "GIFT_CARD") {
        return { success: false, error: "Darilni bon s to kodo ne obstaja." }
      }
      if (purchase.organizationId !== org.id) {
        // Bon iz DRUGEGA salona — zavrnjen z jasnim sporočilom.
        return {
          success: false,
          error:
            "Ta darilni bon ni iz te trgovine in ga tukaj ni mogoče unovčiti.",
        }
      }
      if (purchase.status === "PENDING") {
        return {
          success: false,
          error:
            "Ta darilni bon še ni plačan. Plačilo mora biti zaključeno, preden bon unovčite.",
        }
      }
      if (purchase.status === "EXHAUSTED") {
        return {
          success: false,
          error: "Ta darilni bon je že porabljen (stanje 0 €).",
        }
      }
      if (purchase.status === "REFUNDED") {
        return { success: false, error: "Ta darilni bon je preklican." }
      }
      if (purchase.expiresAt && purchase.expiresAt.getTime() < Date.now()) {
        return {
          success: false,
          error: "Ta darilni bon je potekel in ga ni več mogoče unovčiti.",
        }
      }
      const balance = purchase.balance.toNumber()
      if (balance <= 0) {
        return { success: false, error: "Ta darilni bon je že porabljen." }
      }

      giftCard = {
        code,
        purchaseId: purchase.id,
        balance,
        applied: Math.min(balance, total),
        fullCoverage: balance >= total,
      }
    }

    // Get or create customer
    let customerId: string | null = null
    if (!guest && session) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { customer: true },
      })

      if (user?.customer) {
        customerId = user.customer.id
      } else if (user) {
        const customer = await prisma.customer.create({
          data: {
            name: user.name || "Customer",
            email: user.email,
            userId: user.id,
            organizationId: org.id,
          },
        })
        customerId = customer.id
      }
    } else if (contact) {
      customerId = await resolveGuestCustomerId(org.id, contact)
    }

    // MONTHLY ORDERS LIMIT (E3-7): entitlements are enforced server-side
    // (issue §7) — a tenant at/over its plan's monthly orders limit cannot
    // receive NEW orders. The buyer sees a NEUTRAL message: end customers
    // must never see the tenant's plan name or internal quota details.
    // The tenant owner sees the real counter in Settings → Paket.
    const monthOrders = await prisma.order.count({
      where: { organizationId: org.id, createdAt: { gte: monthStartUtc() } },
    })
    const ordersGate = checkPlanLimit(getPlan(org.plan), "orders", monthOrders)
    if (!ordersGate.ok) {
      return {
        success: false,
        error:
          "Trgovina trenutno ne sprejema novih naročil. Kontaktirajte salon in poskusite znova kasneje.",
      }
    }

    // Payments are an optional, tenant-owned integration — the key comes
    // ONLY from the organization (Settings → Plačila). The platform never
    // holds a key (E4-3b): no env fallback exists.
    const stripeClient = getStripeForOrg(org)

    // ------------------------------------------------------------
    // #80: FULL GIFT-CARD COVERAGE — the order is PAID by the gift card,
    // no Stripe involved. One transaction: order PAID + redemption +
    // balance decrement (+ EXHAUSTED at 0) + stock decrement +
    // StockMovement OUT rows (the same guarantees as the webhook path).
    // Runs BEFORE the Stripe check: a salon without Stripe can honor
    // gift cards, and full coverage never needs the key.
    // ------------------------------------------------------------
    if (giftCard?.fullCoverage) {
      // Naravnanost za TS (closure ne ohrani narrowinga `let`).
      const gc = giftCard
      const guestContact = guest && contact ? contact : null
      const paidOrder = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            organizationId: org.id,
            customerId,
            subtotal,
            tax,
            total,
            status: "PAID",
            paymentMethod: "giftcard",
            notes: `Plačilo z darilnim bonom ${gc.code} (pokritih ${gc.applied.toFixed(2)} €).${guestContact?.address?.trim() ? ` Dostavni naslov: ${guestContact.address.trim()}` : ""}`,
            ...(guestContact
              ? {
                  guestName: guestContact.name.trim(),
                  guestEmail: guestContact.email?.trim().toLowerCase() || null,
                  guestPhone: guestContact.phone?.trim() || null,
                }
              : {}),
            items: {
              create: pricedItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
              })),
            },
          },
        })

        // Redemption — unique [purchaseId, orderId] makes double-submit safe.
        await tx.prepaidRedemption.create({
          data: {
            prepaidPurchaseId: gc.purchaseId,
            orderId: order.id,
            amount: gc.applied.toFixed(2),
          },
        })
        const nextBalance =
          Math.round((gc.balance - gc.applied) * 100) / 100
        await tx.prepaidPurchase.update({
          where: { id: gc.purchaseId },
          data: {
            balance: nextBalance.toFixed(2),
            ...(nextBalance <= 0 ? { status: "EXHAUSTED" } : {}),
          },
        })

        // Stock: the same ledger guarantees as the paid webhook path.
        for (const item of pricedItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { decrement: item.quantity } },
          })
          await tx.stockMovement.create({
            data: {
              organizationId: org.id,
              productId: item.productId,
              direction: "OUT",
              quantity: item.quantity,
              source: "ORDER",
              orderId: order.id,
            },
          })
        }

        return order
      })

      const shopConfig2 = await prisma.salonConfig.findFirst({
        where: { organizationId: org.id },
        select: { phone: true, email: true },
      })

      return {
        success: true,
        giftCardPaid: true,
        orderNumber: paidOrder.id.slice(-8).toUpperCase(),
        contactPhone: shopConfig2?.phone ?? null,
        contactEmail: shopConfig2?.email ?? null,
      }
    }

    // ------------------------------------------------------------
    // P1 #65 — NO STRIPE: the demand is still RECORDED. The old behavior
    // returned a toast and created NOTHING — a tenant without Stripe
    // (the default state of every new shop) could not sell, and lost
    // demand was invisible. Now: order with paymentMethod "offline"
    // (owner collects on pickup/delivery), visible in the dashboard.
    // ------------------------------------------------------------
    if (!stripeClient) {
      const guestContact = guest && contact ? contact : null
      const order = await prisma.order.create({
        data: {
          organizationId: org.id,
          customerId,
          subtotal,
          tax,
          total,
          status: "PENDING",
          paymentMethod: "offline",
          notes: guestContact?.address?.trim()
            ? `Naročilo brez spletnega plačila — plačilo ob prevzemu. Dostavni naslov: ${guestContact.address.trim()}`
            : "Naročilo brez spletnega plačila — plačilo ob prevzemu.",
          ...(guestContact
            ? {
                guestName: guestContact.name.trim(),
                guestEmail: guestContact.email?.trim().toLowerCase() || null,
                guestPhone: guestContact.phone?.trim() || null,
              }
            : {}),
          items: {
            create: pricedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
      })

      const shopConfig = await prisma.salonConfig.findFirst({
        where: { organizationId: org.id },
        select: { phone: true, email: true },
      })

      return {
        success: true,
        offline: true,
        // Short code the customer can quote; the dashboard shows the order.
        orderNumber: order.id.slice(-8).toUpperCase(),
        contactPhone: shopConfig?.phone ?? null,
        contactEmail: shopConfig?.email ?? null,
      }
    }

    // Create order in database with PENDING status
    const order = await prisma.order.create({
      data: {
        organizationId: org.id,
        customerId,
        subtotal,
        tax,
        total,
        status: "PENDING",
        items: {
          create: pricedItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
    })

    // Get base URL for redirects
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    // Tenant prefix for post-payment redirects: success/cancel MUST return
    // to the SAME tenant site (/s/[slug]) — verifyProductOrder resolves the
    // org from the request, so a bare /checkout/success would compare the
    // order against the DEFAULT tenant and fail ("Naročila ni mogoče najti").
    // Defensive: org is guaranteed non-null above; keep bare URLs if not.
    const tenantPrefix = org ? `/s/${org.slug}` : ""

    // Salon currency — charges follow the salon's configured currency
    const shopConfig = await prisma.salonConfig.findFirst({
      where: { organizationId: org.id },
      select: { currency: true },
    })
    const currency = (shopConfig?.currency || "EUR").toLowerCase()

    // Create Stripe line items from trusted prices.
    // #80: z delno pokritostjo darilnega bona Stripe NE sme zaračunati
    // polnega zneska — košara se strne v ENO vrstico za OSTANEK
    // (Stripe ne podpira negativnih vrstic za popust).
    const lineItems =
      giftCard
        ? [
            {
              price_data: {
                currency,
                product_data: {
                  name: `Naročilo (darilni bon ${giftCard.code} pokrije ${giftCard.applied.toFixed(2)} €)`,
                  images: [],
                },
                unit_amount: Math.round((total - giftCard.applied) * 100),
              },
              quantity: 1 as const,
            },
          ]
        : pricedItems.map((item) => ({
            price_data: {
              currency,
              product_data: {
                name: item.name,
                images: item.image ? [item.image] : [],
              },
              unit_amount: Math.round(item.price * 100), // Convert to cents
            },
            quantity: item.quantity,
          }))

    // Add shipping as line item if applicable
    if (shipping > 0 && !giftCard) {
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: "Dostava",
            images: [],
          },
          unit_amount: Math.round(shipping * 100), // Convert to cents
        },
        quantity: 1,
      })
    }

    // P1 #65: guests with Stripe go through the SAME hosted payment page —
    // registration is never a precondition for paying.
    const customerEmail = guest
      ? contact?.email?.trim() || undefined
      : session?.user?.email || undefined

    // Create Stripe Checkout session
    const checkoutSession = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: customerEmail,
      line_items: lineItems,
      automatic_tax: { enabled: false }, // We calculate tax ourselves
      metadata: {
        orderId: order.id,
        userId: session?.user?.id ?? "guest",
        type: "product_order",
        orgId: org.id,
        // #80: darilni bon se unovči ŠELE ob potrjenem plačilu
        // (webhook/verify) — nikoli pred tem.
        ...(giftCard
          ? {
              giftCardCode: giftCard.code,
              giftCardRedemption: giftCard.applied.toFixed(2),
            }
          : {}),
      },
      success_url: `${baseUrl}${tenantPrefix}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${tenantPrefix}/checkout/cancel`,
    })

    return {
      success: true,
      checkoutUrl: checkoutSession.url || undefined,
    }
  } catch (error) {
    console.error("Error creating product checkout session:", error)
    return {
      success: false,
      error: "Ustvarjanje plačilne seje ni uspelo. Poskusite znova.",
    }
  }
}

// Verify payment and update order status
export async function verifyProductOrder(sessionId: string) {
  try {
    // Online checkout may now be GUEST checkout (#65) — the verification
    // itself is keyed by the Stripe session, not by a login. The tenant +
    // customer checks below still scope what a caller may mark paid.
    const session = await auth()

    // The checkout session can only be retrieved from the Stripe account that
    // created it. Try candidates: the salon's own key first, then every org
    // with its own key. There is NO platform/env fallback — the platform
    // never holds a tenant key (E4-3b).
    const [publicOrg, keyedOrgs] = await Promise.all([
      getPublicOrg(),
      prisma.organization.findMany({
        where: { stripeSecretKey: { not: null } },
      }),
    ])

    const candidates = [publicOrg, ...keyedOrgs].filter(
      (candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate?.stripeSecretKey)
    )
    const seen = new Set<string>()
    let checkoutSession: import("stripe").Stripe.Checkout.Session | null = null

    for (const candidate of candidates) {
      const dedupeKey = candidate.id
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      try {
        const client = getStripeForOrg(candidate)
        if (!client) continue
        checkoutSession = await client.checkout.sessions.retrieve(sessionId, {
          expand: ["payment_intent"],
        })
        break
      } catch {
        // Wrong account or unreachable — try the next candidate.
        continue
      }
    }

    if (!checkoutSession) {
      return {
        success: false,
        error: "Plačila niso nastavljena ali plačila ni mogoče preveriti",
      }
    }

    // Verify payment was successful
    if (checkoutSession.payment_status !== "paid") {
      return {
        success: false,
        error: "Plačilo ni bilo zaključeno",
      }
    }

    const orderId = checkoutSession.metadata?.orderId
    if (!orderId) {
      return {
        success: false,
        error: "Naročila ni mogoče najti",
      }
    }

    // Get payment intent ID
    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id

    // Check if order is already marked as paid
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })

    if (!existingOrder) {
      return {
        success: false,
        error: "Naročila ni mogoče najti",
      }
    }

    // Tenant check: the order must belong to the current organization
    // (legacy orders without organizationId are still honored)
    const org = await getPublicOrg()
    if (existingOrder.organizationId && org && existingOrder.organizationId !== org.id) {
      return {
        success: false,
        error: "Naročila ni mogoče najti",
      }
    }

    // SECURITY: the order must belong to the current user — OR be a guest
    // order placed from THIS tenant (#65): the Stripe session id is the
    // capability (it can only come from the paying session), and the order
    // carries the guest contact that matches the checkout email.
    if (session?.user) {
      const userWithCustomer = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { customer: { select: { id: true } } },
      })

      const ownsCustomer =
        existingOrder.customerId &&
        existingOrder.customerId !== userWithCustomer?.customer?.id

      const isGuestOrder = !existingOrder.customerId && !!existingOrder.guestEmail

      if (ownsCustomer && !isGuestOrder) {
        return {
          success: false,
          error: "Nimate dovoljenja za ogled tega naročila",
        }
      }
    }

    if (existingOrder.status === "PAID") {
      return {
        success: true,
        orderId: existingOrder.id,
        alreadyProcessed: true,
      }
    }

    // Update order status and reduce stock
    await prisma.$transaction(async (tx) => {
      // Update order (backfill organizationId for legacy orders)
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "PAID",
          stripePaymentIntentId: paymentIntentId,
          ...(org && !existingOrder.organizationId
            ? { organizationId: org.id }
            : {}),
        },
      })

      // Reduce stock for each item + append ledger rows (E2-2):
      // the ledger OBSERVES the issue (source ORDER); state behavior
      // is unchanged (cart guard prevents oversell pre-payment).
      const ledgerOrgId = existingOrder.organizationId ?? org?.id ?? null
      for (const item of existingOrder.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        })
        if (ledgerOrgId) {
          await tx.stockMovement.create({
            data: {
              organizationId: ledgerOrgId,
              productId: item.productId,
              direction: "OUT",
              quantity: item.quantity,
              source: "ORDER",
              orderId: existingOrder.id,
            },
          })
        }
      }
    })

    // #80: darilni bon se unovči ŠELE zdaj (naročilo plačano).
    // Idempotentno — unikatni [purchaseId, orderId] in preverba obstoječe
    // redempcije; webhook in ta fallback si ne moreta delati dvojnosti.
    // Znesek potuje iz checkout metadata (točno toliko, kolikor je bilo
    // prikazano stranki); varovalka = min(znesek, total naročila).
    const gcMeta = checkoutSession.metadata?.giftCardCode
    if (gcMeta && (existingOrder.organizationId ?? org?.id)) {
      const gcAmount =
        parseFloat(checkoutSession.metadata?.giftCardRedemption || "0") ||
        existingOrder.total.toNumber()
      await redeemGiftCardForOrder(
        existingOrder.organizationId ?? org!.id,
        gcMeta,
        existingOrder.id,
        Math.min(gcAmount, existingOrder.total.toNumber())
      ).catch(() => undefined)
    }

    return {
      success: true,
      orderId: orderId,
      alreadyProcessed: false,
    }
  } catch (error) {
    console.error("Error verifying product order:", error)
    return {
      success: false,
      error: "Preverjanje naročila ni uspelo",
    }
  }
}
