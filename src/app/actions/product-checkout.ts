"use server"

import { getStripeForOrg } from "@/lib/stripe"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { validateCartStock } from "./cart"
import { getPublicOrg } from "@/lib/tenant"
import { getPlan } from "@/lib/plans/registry"
import { checkPlanLimit, monthStartUtc } from "@/lib/plans/types"
import { SI_VAT_RATE, vatFromGross } from "@/lib/vat"
import type { CartItem } from "@/store/cart-store"

const FREE_SHIPPING_THRESHOLD = 50
const SHIPPING_COST = 5.99

interface CheckoutResult {
  success: boolean
  checkoutUrl?: string
  error?: string
  stockErrors?: Array<{
    productId: string
    name: string
    available: number
    requested: number
  }>
}

export async function createProductCheckoutSession(
  items: CartItem[]
): Promise<CheckoutResult> {
  try {
    // Get current session
    const session = await auth()

    if (!session?.user) {
      return {
        success: false,
        error: "Za zaključek nakupa morate biti prijavljeni",
      }
    }

    // Resolve the tenant organization for this checkout
    const org = await getPublicOrg()
    if (!org) {
      return {
        success: false,
        error: "Trgovina trenutno ni na voljo. Poskusite znova kasneje.",
      }
    }

    // Payments are an optional, salon-owned integration — the key comes
    // ONLY from the organization (Settings → Plačila). The platform never
    // holds a key (E4-3b): no env fallback exists.
    const stripeClient = getStripeForOrg(org)
    if (!stripeClient) {
      return {
        success: false,
        error:
          "Spletna plačila še niso nastavljena. Za oddajo naročila kontaktirajte salon.",
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
        organizationId: org.id,
      },
      select: { id: true, name: true, images: true, price: true },
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
    const subtotal = pricedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
    const tax = vatFromGross(subtotal + shipping, SI_VAT_RATE)
    const total = subtotal + shipping

    // Get or create customer
    let customerId: string | null = null
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

    // Create Stripe line items from trusted prices
    const lineItems = pricedItems.map((item) => ({
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
    if (shipping > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: "Dostava",
            images: [],
          },
          unit_amount: Math.round(shipping * 100),
        },
        quantity: 1,
      })
    }

    // Create Stripe Checkout session
    const checkoutSession = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: session.user.email || undefined,
      line_items: lineItems,
      automatic_tax: { enabled: false }, // We calculate tax ourselves
      metadata: {
        orderId: order.id,
        userId: session.user.id,
        type: "product_order",
        orgId: org.id,
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
    // Only authenticated users can checkout, so require a session here too
    const session = await auth()

    if (!session?.user) {
      return {
        success: false,
        error: "Za preverjanje naročila morate biti prijavljeni",
      }
    }

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

    // SECURITY: the order must belong to the current user
    const userWithCustomer = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { customer: { select: { id: true } } },
    })

    if (
      existingOrder.customerId &&
      existingOrder.customerId !== userWithCustomer?.customer?.id
    ) {
      return {
        success: false,
        error: "Nimate dovoljenja za ogled tega naročila",
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


