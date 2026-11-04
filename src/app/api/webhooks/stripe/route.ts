import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { constructWebhookEvent } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { addMinutes } from "date-fns"
import { after } from "next/server"
import { sendAppointmentConfirmationEmail } from "@/lib/email/appointment-confirmation"
import { getOrgById, getPublicOrg } from "@/lib/tenant"
import { formatSalonTime, safeTimezone } from "@/lib/booking-time"
import Stripe from "stripe"

/**
 * Multi-tenant webhook signature verification (E4-3b): each salon registers
 * the SAME endpoint URL in its OWN Stripe account, so every organization has
 * its own signing secret. We try every organization's stored webhook secret —
 * there is deliberately NO platform/env secret: the platform cannot hold the
 * key. constructEvent never calls the API, so trying candidates is cheap.
 */
async function verifyStripeEvent(
  body: string,
  signature: string
): Promise<Stripe.Event | null> {
  const candidates: string[] = []

  const orgsWithWebhook = await prisma.organization.findMany({
    where: { stripeWebhookSecret: { not: null } },
    select: { stripeWebhookSecret: true },
  })
  for (const org of orgsWithWebhook) {
    if (org.stripeWebhookSecret) candidates.push(org.stripeWebhookSecret)
  }

  for (const secret of candidates) {
    try {
      return constructWebhookEvent(body, signature, secret)
    } catch {
      continue
    }
  }
  return null
}

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    const verified = await verifyStripeEvent(body, signature)
    if (!verified) {
      console.error("Webhook signature verification failed")
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      )
    }
    event = verified
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    )
  }

  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    // Only process if payment was successful
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true })
    }

    const metadata = session.metadata

    if (!metadata) {
      console.error("Webhook: no metadata in checkout session", session.id)
      // Acknowledge — retrying won't fix bad metadata
      return NextResponse.json({ received: true })
    }

    // Handle product orders (e-commerce checkout)
    if (metadata.type === "product_order" && metadata.orderId) {
      try {
        const order = await prisma.order.findUnique({
          where: { id: metadata.orderId },
          include: { items: true },
        })

        if (!order) {
          console.error(
            `Webhook: order ${metadata.orderId} not found (session ${session.id})`
          )
          return NextResponse.json({ received: true })
        }

        // Idempotency — skip if already processed (webhook retries, or the
        // client-side success page got there first)
        if (order.status !== "PENDING") {
          return NextResponse.json({ received: true })
        }

        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null

        await prisma.$transaction(async (tx) => {
          // Conditional update guards against racing with verifyProductOrder.
          // Backfill organizationId for legacy orders missing it.
          const updated = await tx.order.updateMany({
            where: { id: order.id, status: "PENDING" },
            data: {
              status: "PAID",
              stripePaymentIntentId: paymentIntentId,
              ...(metadata.orgId && !order.organizationId
                ? { organizationId: metadata.orgId }
                : {}),
            },
          })

          if (updated.count === 0) return

          for (const item of order.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { decrement: item.quantity } },
            })
          }
        })

        // NOTE: no order confirmation email template exists in the codebase yet
        console.log(`Webhook: order ${order.id} marked as PAID`)
        return NextResponse.json({ received: true })
      } catch (error) {
        console.error("Webhook: error processing product order:", error)
        // Acknowledge to avoid infinite retries; order can be reconciled manually
        return NextResponse.json({ received: true })
      }
    }

    try {
      // Resolve the tenant organization for this checkout:
      // from metadata.orgId, falling back to the first ACTIVE organization.
      const org = metadata.orgId
        ? await getOrgById(metadata.orgId)
        : await getPublicOrg()

      if (!org) {
        console.error("Webhook: no organization available", session.id)
        return NextResponse.json({ received: true })
      }

      // Handle existing appointment payment (from "Pay Now" button)
      if (metadata.type === "existing_appointment" && metadata.appointmentId) {
        const existingAppointment = await prisma.appointment.findUnique({
          where: { id: metadata.appointmentId },
          select: { id: true, organizationId: true },
        })

        if (!existingAppointment) {
          console.error(
            `Webhook: appointment ${metadata.appointmentId} not found (session ${session.id})`
          )
          return NextResponse.json({ received: true })
        }

        // Tenant check: the appointment must belong to the resolved organization
        if (
          existingAppointment.organizationId &&
          existingAppointment.organizationId !== org.id
        ) {
          console.error(
            `Webhook: appointment ${existingAppointment.id} does not belong to org ${org.id}`
          )
          return NextResponse.json({ received: true })
        }

        await prisma.appointment.update({
          where: { id: metadata.appointmentId },
          data: {
            depositPaid: true,
            status: "CONFIRMED",
            stripePaymentId: session.payment_intent as string,
            ...(existingAppointment.organizationId
              ? {}
              : { organizationId: org.id }),
          },
        })
        console.log(`Webhook: existing appointment paid ${metadata.appointmentId}`)
        return NextResponse.json({ received: true })
      }

      // Parse metadata for new appointment
      const serviceIds = JSON.parse(metadata.serviceIds || "[]")
      const staffId = metadata.staffId
      const startTime = new Date(metadata.startTime)
      const guestName = metadata.guestName || null
      const guestEmail = metadata.guestEmail || null
      const guestPhone = metadata.guestPhone || null
      const notes = metadata.notes || null
      const userId = metadata.userId || null
      const customerName = metadata.customerName || "Customer"

      if (!staffId || !metadata.startTime || serviceIds.length === 0) {
        console.error("Webhook: incomplete appointment metadata", session.id)
        return NextResponse.json({ received: true })
      }

      const paymentIntentId = session.payment_intent as string

      // IDEMPOTENCY — the webhook can be retried by Stripe, and the
      // /booking/success fallback may have created the appointment already.
      const existing = await prisma.appointment.findFirst({
        where: { stripePaymentId: paymentIntentId },
        select: { id: true },
      })

      if (existing) {
        console.log(`Webhook: appointment already exists for payment ${paymentIntentId}`)
        return NextResponse.json({ received: true })
      }

      // Get services for duration calculation (scoped to this organization)
      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds }, organizationId: org.id },
        select: { id: true, name: true, duration: true, price: true },
      })

      if (services.length !== new Set(serviceIds).size) {
        console.error(
          `Webhook: services not found in org ${org.id} (session ${session.id})`
        )
        return NextResponse.json({ received: true })
      }

      const totalDuration = services.reduce((sum, s) => sum + s.duration, 0)
      const totalPrice = services.reduce(
        (sum, s) => sum + s.price.toNumber(),
        0
      )
      const endTime = addMinutes(startTime, totalDuration)

      // DOUBLE-BOOKING GUARD — re-check that the slot is still free before
      // confirming. Payment received for a taken slot is logged for manual refund.
      const overlapping = await prisma.appointment.count({
        where: {
          staffId,
          organizationId: org.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      })

      if (overlapping > 0) {
        console.error(
          `Webhook: PAID booking for an occupied slot! staff=${staffId} start=${startTime.toISOString()} payment=${paymentIntentId} — manual refund required`
        )
        return NextResponse.json({ received: true })
      }

      // Get salon config for this organization
      const config = await prisma.salonConfig.findFirst({
        where: { organizationId: org.id },
      })
      const depositAmount = config?.bookingDeposit.toNumber() || 50

      // Handle customer creation/retrieval
      let customerId: string | null = null

      if (userId) {
        // Check if user has a customer profile
        const userWithCustomer = await prisma.user.findUnique({
          where: { id: userId },
          include: { customer: true },
        })

        if (userWithCustomer?.customer) {
          customerId = userWithCustomer.customer.id
        } else if (userWithCustomer) {
          // Create customer profile
          const customer = await prisma.customer.create({
            data: {
              name: customerName,
              email: userWithCustomer.email,
              phone: guestPhone,
              userId: userId,
              organizationId: org.id,
            },
          })
          customerId = customer.id
        }
      }

      // Get staff info (must belong to this organization)
      const staff = await prisma.staff.findFirst({
        where: { id: staffId, organizationId: org.id },
        select: { name: true },
      })

      if (!staff) {
        console.error(
          `Webhook: staff ${staffId} not found in org ${org.id} (session ${session.id})`
        )
        return NextResponse.json({ received: true })
      }

      // E2-7 (G7): optional workspace resource from checkout metadata —
      // validated org-scoped; the conflict was checked at checkout time and
      // is re-checked here (webhook may arrive after other bookings).
      let resourceRecordId: string | null = null
      const rawResourceId = metadata.resourceRecordId || ""
      if (rawResourceId) {
        const resourceRecord = await prisma.extensionRecord.findFirst({
          where: {
            id: rawResourceId,
            organizationId: org.id,
            extensionId: "workspace-resources",
            entityKey: "workspace",
          },
          select: { id: true },
        })
        if (resourceRecord) {
          const resourceBusy = await prisma.appointment.findMany({
            where: {
              resourceRecordId: resourceRecord.id,
              organizationId: org.id,
              startTime: { lt: endTime },
              endTime: { gt: startTime },
              status: { in: ["PENDING", "CONFIRMED"] },
            },
            select: { startTime: true, endTime: true },
          })
          const conflict = resourceBusy.some(
            (w) => startTime < new Date(w.endTime) && endTime > new Date(w.startTime)
          )
          // On conflict the paid booking still gets created — WITHOUT the
          // resource (never lose the payment record; the salon sees the
          // missing resource in the dashboard and resolves it).
          if (!conflict) resourceRecordId = resourceRecord.id
        }
      }

      // Create the appointment
      const appointment = await prisma.appointment.create({
        data: {
          organizationId: org.id,
          staffId,
          customerId,
          resourceRecordId,
          guestName: !customerId ? guestName : null,
          guestEmail: !customerId ? guestEmail : null,
          guestPhone: !customerId ? guestPhone : null,
          startTime,
          endTime,
          status: "CONFIRMED", // Confirmed because payment was successful
          notes,
          totalPrice,
          depositAmount,
          depositPaid: true, // Payment was successful
          stripePaymentId: paymentIntentId,
          services: {
            create: serviceIds.map((serviceId: string) => ({
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

      // Send confirmation email (non-blocking, never fails the webhook)
      const customerEmail = guestEmail || session.customer_email
      if (customerEmail) {
        const serviceNames = services.map((s) => s.name).join(", ")

        // Salon timezone for a correct local display time in the email
        const salonConfigTz = await prisma.salonConfig.findFirst({
          where: { organizationId: org.id },
          select: { timezone: true },
        })
        const salonTz = safeTimezone(salonConfigTz?.timezone)

        after(async () => {
          try {
            const result = await sendAppointmentConfirmationEmail({
              email: customerEmail,
              customerName,
              serviceName: serviceNames,
              staffName: staff?.name || "Our Staff",
              appointmentDate: startTime,
              appointmentTime: formatSalonTime(startTime, salonTz),
              duration: totalDuration,
              totalPrice,
              depositAmount,
              appointmentId: appointment.id,
            })
            // P1 #76 — evidence: confirmationSentAt PO uspešnem pošiljanju.
            if (result?.success !== false) {
              await prisma.appointment
                .update({
                  where: { id: appointment.id },
                  data: { confirmationSentAt: new Date() },
                })
                .catch(() => undefined)
            }
          } catch (emailError) {
            console.error("Webhook: confirmation email failed:", emailError)
          }
        })
      }

      console.log(`Webhook: appointment created ${appointment.id}`)
    } catch (error) {
      console.error("Webhook: error processing checkout session:", error)
      // Acknowledge — payment intent id dedupe makes a manual replay safe
      return NextResponse.json({ received: true })
    }
  }

  return NextResponse.json({ received: true })
}
