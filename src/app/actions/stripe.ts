"use server"

import { getStripeForOrg } from "@/lib/stripe"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { addMinutes } from "date-fns"
import { after } from "next/server"
import { getServicesForBooking, getSalonConfig, getOrgTimezone } from "./appointments"
// #79: polog kot pravilo — isti helper kot booking in webhook.
import { resolveDepositForServices } from "@/lib/booking/deposit"
import { instantFromParts, formatSalonTime } from "@/lib/booking-time"
import { getPublicOrg, getSessionOrg, getOrgById } from "@/lib/tenant"
import { CreateCheckoutSessionData, CreateCheckoutSessionResult } from "@/lib/interfaces"
import { hasResourceConflict } from "@/lib/booking/resources"
import { sendAppointmentConfirmationEmail } from "@/lib/email/appointment-confirmation"
import Stripe from "stripe"

export async function createCheckoutSession(
  data: CreateCheckoutSessionData
): Promise<CreateCheckoutSessionResult> {
  try {
    // Get current session
    const session = await auth()

    // Resolve the tenant organization for this booking (employees act within
    // their session org, everyone else within the public tenant org)
    const org =
      session?.user && ["ADMIN", "STAFF"].includes(session.user.role)
        ? await getSessionOrg()
        : await getPublicOrg()
    if (!org) {
      return {
        success: false,
        error: "Spletna rezervacija trenutno ni na voljo. Poskusite znova kasneje.",
      }
    }

    // Payments are an optional, salon-owned integration — the key comes
    // ONLY from the organization (Settings → Plačila). The platform never
    // holds a key (E4-3b): no env fallback exists.
    const stripeClient = getStripeForOrg(org)
    if (!stripeClient) {
      return {
        success: false,
        // Structured flag: the salon has no Stripe key. The client falls
        // back to a PENDING appointment (no deposit collected) instead of
        // blocking the booking entirely.
        paymentRequired: true,
        error:
          "Spletna plačila še niso nastavljena. Za dokončanje rezervacije kontaktirajte salon.",
      }
    }

    // Validate required fields (date+time strings or a prebuilt ISO startTime)
    if (
      !data.staffId ||
      !data.serviceIds.length ||
      (!data.startTime && !(data.bookingDate && data.bookingTime))
    ) {
      return { success: false, error: "Manjkajo obvezni podatki" }
    }

    // Validate customer information
    if (!session?.user && (!data.guestName || !data.guestEmail)) {
      return { success: false, error: "Potrebni so kontakt podatki" }
    }

    // Build the exact start instant in the SALON timezone from date+time
    // strings (preferred contract) — avoids any client/server tz mismatch.
    const tz = await getOrgTimezone(org.id)
    const startInstant =
      data.bookingDate && data.bookingTime
        ? instantFromParts(data.bookingDate, data.bookingTime, tz)
        : data.startTime
          ? new Date(data.startTime)
          : null

    if (!startInstant || isNaN(startInstant.getTime())) {
      return { success: false, error: "Neveljaven datum ali ura termina" }
    }

    // Fetch services to get names and calculate totals
    const services = await getServicesForBooking(data.serviceIds)
    if (services.length === 0) {
      return { success: false, error: "Neveljavna izbira storitev" }
    }

    // Get salon config for deposit amount
    const config = await getSalonConfig()
    // #79: FIX — getSalonConfig reads the SESSION/request org; this action
    // resolves org explicitly (staff may pay inside their session org, guests
    // inside the public tenant). Fetch the deposit rule for THAT org.
    const orgRule = await prisma.salonConfig.findFirst({
      where: { organizationId: org.id },
      select: { bookingDeposit: true, bookingDepositType: true },
    })
    const depositRule = {
      bookingDeposit: orgRule?.bookingDeposit.toNumber() ?? config.bookingDeposit,
      bookingDepositType: orgRule?.bookingDepositType ?? "FIXED",
    } as const

    // Create service names string
    const serviceNames = services.map((s) => s.name).join(", ")

    // Customer email for Stripe
    const customerEmail = session?.user?.email || data.guestEmail
    const customerName = session?.user?.name || data.guestName || "Customer"

    // Get base URL for redirects
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    // SECURITY: employee discount is derived server-side from the session role,
    // never trusted from client arguments. Same rule as createAppointment:
    // an ADMIN creating for a GUEST (guestName present) is NOT an employee
    // booking — prej bi dobil zaposlenski popust (#79 ugotovljena
    // inkonsistentnost z appointments.ts, tukaj poravnana).
    const isEmployeeBooking =
      !!session?.user &&
      ["STAFF", "ADMIN"].includes(session.user.role) &&
      !data.guestName

    // #79: polog je PRAVILO iz istega helperja kot booking in zapis —
    // 15 € storitev z org pologom 50 € plača 15 €, ne 50 %. Employee
    // booking obdrži 20 % popust na izračunani polog.
    const resolvedDeposit = resolveDepositForServices(services, depositRule)
    const employeeDiscountRate = 0.20
    const depositAmount = isEmployeeBooking
      ? Math.round(resolvedDeposit * (1 - employeeDiscountRate) * 100) / 100
      : resolvedDeposit

    // Build product description
    const depositDescription = isEmployeeBooking
      ? `Nepovratni polog za vaš termin (20 % popust za zaposlene)`
      : `Nepovratni polog za vaš termin`

    // Create Stripe Checkout session
    const checkoutSession = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: (config.currency || "EUR").toLowerCase(),
            product_data: {
              name: `Polog za termin - ${serviceNames}`,
              description: depositDescription,
            },
            unit_amount: Math.round(depositAmount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        // Store booking data in metadata for webhook
        orgId: org.id,
        serviceIds: JSON.stringify(data.serviceIds),
        staffId: data.staffId,
        startTime: startInstant.toISOString(),
        guestName: data.guestName || "",
        guestEmail: data.guestEmail || "",
        guestPhone: data.guestPhone || "",
        notes: data.notes || "",
        userId: session?.user?.id || "",
        customerName,
        isEmployee: isEmployeeBooking ? "true" : "false",
        // #79: izračunani polog potuje s sejo — verify in webhook zapišeta
        // TOČNO ta znesek, ne ponovno izračunan (en helper, en rezultat,
        // ni drifta med plačilom in zapisom).
        depositAmount: depositAmount.toFixed(2),
        // E2-7 (G7): optional workspace resource — validated + conflict-
        // checked again in the webhook before the appointment is created.
        resourceRecordId: data.resourceRecordId || "",
      },
      success_url: `${baseUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/booking/cancel`,
    })

    return {
      success: true,
      checkoutUrl: checkoutSession.url ?? undefined,
    }
  } catch (error) {
    console.error("Error creating checkout session:", error)
    return {
      success: false,
      error: "Ustvarjanje plačilne seje ni uspelo. Poskusite znova.",
    }
  }
}

// Verify and create appointment from checkout session (fallback for webhook)
export async function verifyAndCreateAppointment(sessionId: string) {
  try {
    // The checkout session can only be retrieved from the Stripe account that
    // created it. Try candidates in order: session org key, public org key,
    // then every org with its own key. There is NO platform/env fallback —
    // the platform never holds a tenant key (E4-3b).
    const [publicOrg, sessionOrg, keyedOrgs] = await Promise.all([
      getPublicOrg(),
      getSessionOrg(),
      prisma.organization.findMany({
        where: { stripeSecretKey: { not: null } },
      }),
    ])

    const candidates = [
      sessionOrg,
      publicOrg,
      ...keyedOrgs,
    ].filter((candidate): candidate is NonNullable<typeof candidate> =>
      Boolean(candidate?.stripeSecretKey)
    )

    const seen = new Set<string>()
    let checkoutSession: Stripe.Checkout.Session | null = null

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
        error: "Plačila niso nastavljena ali plačila ni mogoče preveriti.",
      }
    }

    // Verify payment was successful
    if (checkoutSession.payment_status !== "paid") {
      return {
        success: false,
        error: "Plačilo ni bilo zaključeno",
      }
    }

    // payment_intent can be string or object depending on expand
    const paymentIntentId = typeof checkoutSession.payment_intent === 'string'
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id

    if (!paymentIntentId) {
      return {
        success: false,
        error: "Ni mogoče najti podatkov o plačilu",
      }
    }

    const metadata = checkoutSession.metadata

    if (!metadata) {
      return {
        success: false,
        error: "Ni mogoče najti podatkov o rezervaciji",
      }
    }

    // Resolve the tenant organization: from checkout metadata, falling back
    // to the first ACTIVE organization (getPublicOrg behavior)
    const org = metadata.orgId
      ? await getOrgById(metadata.orgId)
      : await getPublicOrg()

    if (!org) {
      return {
        success: false,
        error: "Salon ni na voljo",
      }
    }

    // Check if appointment already exists (webhook might have created it)
    const existingAppointment = await prisma.appointment.findFirst({
      where: { stripePaymentId: paymentIntentId },
    })

    if (existingAppointment) {
      // Appointment already created by webhook
      return {
        success: true,
        appointmentId: existingAppointment.id,
        alreadyExists: true,
        customerEmail: checkoutSession.customer_email,
      }
    }

    // Parse metadata
    const serviceIds = JSON.parse(metadata.serviceIds || "[]")
    const staffId = metadata.staffId
    const startTime = new Date(metadata.startTime)
    const guestName = metadata.guestName || null
    const guestEmail = metadata.guestEmail || null
    const guestPhone = metadata.guestPhone || null
    const notes = metadata.notes || null
    const userId = metadata.userId || null
    const customerName = metadata.customerName || "Customer"
    // E2-7 (G7): optional workspace resource from checkout metadata —
    // validated org-scoped; conflicts make the fallback refuse creation.
    const rawResourceId = metadata.resourceRecordId || ""
    let resourceRecordId: string | null = null
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
      if (resourceRecord) resourceRecordId = resourceRecord.id
    }

    // Get services for duration calculation (scoped to this organization)
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, organizationId: org.id },
      select: { id: true, name: true, duration: true, price: true },
    })

    if (services.length !== new Set(serviceIds).size) {
      return {
        success: false,
        error: "Neveljavni podatki za rezervacijo",
      }
    }

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0)
    const totalPrice = services.reduce(
      (sum, s) => sum + s.price.toNumber(),
      0
    )
    const endTime = addMinutes(startTime, totalDuration)

    // SECURITY: re-check slot availability before creating the appointment.
    // Prevents double-booking when the webhook and this fallback race,
    // and blocks maliciously crafted checkout sessions for occupied slots.
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
      return {
        success: false,
        error:
          "Ta termin ni več prost. Kontaktirajte salon za prestavitev rezervacije ali vračilo plačila.",
      }
    }

    // E2-7 (G7): re-check the resource conflict too (same race protection
    // as the staff slot check above).
    if (resourceRecordId) {
      const resourceBusy = await prisma.appointment.findMany({
        where: {
          resourceRecordId,
          organizationId: org.id,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        select: { startTime: true, endTime: true },
      })
      if (hasResourceConflict(resourceBusy, startTime, endTime)) {
        return {
          success: false,
          error:
            "Izbrani prostor/vir je v tem času že zaseden. Kontaktirajte salon za prestavitev ali vračilo plačila.",
        }
      }
    }

    // Get salon config for this organization
    const config = await prisma.salonConfig.findFirst({
      where: { organizationId: org.id },
    })
    // #79: polog potuje s sejo (metadata.depositAmount, izračunan v
    // createCheckoutSession iz per-storitvenih pravil). Fallback na org
    // konfiguracijo pokrije stare seje, ustvarjene pred #79.
    const metaDeposit =
      typeof metadata.depositAmount === "string" && metadata.depositAmount
        ? parseFloat(metadata.depositAmount)
        : null
    const bookingDeposit =
      metaDeposit !== null && Number.isFinite(metaDeposit) && metaDeposit >= 0
        ? metaDeposit
        : (config?.bookingDeposit.toNumber() ?? 50)

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
    } else if (guestEmail) {
      // Guest booking - check if customer exists (within this organization)
      const existingCustomer = await prisma.customer.findFirst({
        where: { email: guestEmail, organizationId: org.id },
      })

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else if (guestName) {
        // Create new customer
        const customer = await prisma.customer.create({
          data: {
            name: guestName,
            email: guestEmail,
            phone: guestPhone,
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
      return {
        success: false,
        error: "Neveljavni podatki za rezervacijo",
      }
    }

    // Create the appointment
    const appointment = await prisma.appointment.create({
      data: {
        organizationId: org.id,
        staffId,
          resourceRecordId,
        customerId,
        guestName: !customerId ? guestName : null,
        guestEmail: !customerId ? guestEmail : null,
        guestPhone: !customerId ? guestPhone : null,
        startTime,
        endTime,
        status: "CONFIRMED",
        notes,
        totalPrice,
        depositAmount: bookingDeposit,
        depositPaid: true,
        stripePaymentId: paymentIntentId,
        services: {
          create: serviceIds.map((serviceId: string) => ({
            serviceId,
          })),
        },
      },
    })

    // Send confirmation email in background (non-blocking)
    const customerEmail = guestEmail || checkoutSession.customer_email
    if (customerEmail) {
      const serviceNames = services.map((s) => s.name).join(", ")
      const salonTz = await getOrgTimezone(org.id)

      after(async () => {
        const result = await sendAppointmentConfirmationEmail({
          email: customerEmail,
          customerName,
          serviceName: serviceNames,
          staffName: staff?.name || "Our Staff",
          appointmentDate: startTime,
          appointmentTime: formatSalonTime(startTime, salonTz),
          duration: totalDuration,
          totalPrice,
          depositAmount: bookingDeposit,
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
      })
    }

    return {
      success: true,
      appointmentId: appointment.id,
      alreadyExists: false,
      customerEmail: customerEmail,
    }
  } catch (error) {
    console.error("Error creating appointment from checkout:", error)
    return {
      success: false,
      error: "Ustvarjanje termina ni uspelo",
    }
  }
}

// Create checkout session for existing unpaid appointment
export async function createDepositCheckoutForAppointment(appointmentId: string) {
  try {
    const session = await auth()

    if (!session?.user) {
      return { success: false, error: "Nepooblaščen dostop" }
    }

    // Fetch the appointment with services (scoped to the current organization)
    const org = await getPublicOrg()

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        services: { include: { service: true } },
        customer: true,
      },
    })

    // Validate appointment exists
    if (!appointment) {
      return { success: false, error: "Termina ni mogoče najti" }
    }

    // Tenant check: the appointment must belong to the current organization
    // (legacy appointments without organizationId are still honored)
    if (org && appointment.organizationId && appointment.organizationId !== org.id) {
      return { success: false, error: "Termina ni mogoče najti" }
    }

    // Validate appointment belongs to current user
    if (appointment.customer?.userId !== session.user.id) {
      return { success: false, error: "Nepooblaščen dostop" }
    }

    // Validate deposit not already paid
    if (appointment.depositPaid) {
      return { success: false, error: "Polog je že plačan" }
    }

    // Payments are optional — the key comes ONLY from the appointment's org
    // (owner-entered); the platform never holds a key (E4-3b).
    const orgForPayments = appointment.organizationId
      ? await getOrgById(appointment.organizationId)
      : org
    const stripeClient = getStripeForOrg(orgForPayments)
    if (!stripeClient) {
      return {
        success: false,
        error:
          "Spletna plačila še niso nastavljena. Kontaktirajte salon.",
      }
    }

    // Get service names for description
    const serviceNames = appointment.services.map((s) => s.service.name).join(", ")
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    // Salon currency for the deposit checkout
    const depositConfig = await prisma.salonConfig.findFirst({
      where: { organizationId: appointment.organizationId || org?.id || "" },
      select: { currency: true },
    })

    // Create Stripe checkout session
    const checkoutSession = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: session.user.email || undefined,
      line_items: [
        {
          price_data: {
            currency: (depositConfig?.currency || "EUR").toLowerCase(),
            product_data: {
              name: `Polog za termin - ${serviceNames}`,
              description: "Nepovratni polog za vaš termin",
            },
            unit_amount: Math.round(appointment.depositAmount.toNumber() * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "existing_appointment",
        appointmentId: appointment.id,
        orgId: appointment.organizationId || org?.id || "",
      },
      success_url: `${baseUrl}/my-appointments?paid=${appointment.id}`,
      cancel_url: `${baseUrl}/my-appointments`,
    })

    return {
      success: true,
      checkoutUrl: checkoutSession.url ?? undefined,
    }
  } catch (error) {
    console.error("Error creating checkout for existing appointment:", error)
    return {
      success: false,
      error: "Ustvarjanje plačilne seje ni uspelo",
    }
  }
}
