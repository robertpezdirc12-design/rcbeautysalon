// ============================================================
// #97 (AD-07) — Bremenitev pologa ob no-show (off-session)
// Varnost: samo ko veljajo vsi pogoji (shouldChargeOnNoShow); Stripe
// ključ IZKLJUČNO najemnika (E4-3b); aplikacija ne vidi kartic —
// bremenitev uporablja plačilno metodo iz SetupIntenta. Izid se zapiše
// (noShowChargeId unique = idempotenca na ravni baze).
// ============================================================

import { prisma } from "@/lib/prisma"
import { shouldChargeOnNoShow } from "./no-show-policy"

export async function chargeNoShowFee(appointmentId: string): Promise<{
  charged: boolean
  skipped?: string
  error?: string
}> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      organizationId: true,
      depositAmount: true,
      noShowConsent: true,
      noShowSetupStatus: true,
      noShowChargeStatus: true,
      noShowChargeId: true,
      depositPaid: true,
      stripeSetupIntentId: true,
      stripeCustomerId: true,
    },
  })
  if (!appointment) return { charged: false, skipped: "not-found" }
  if (!appointment.organizationId) return { charged: false, skipped: "no-org" }
  if (!shouldChargeOnNoShow(appointment)) {
    return { charged: false, skipped: "not-eligible" }
  }

  const org = await prisma.organization.findUnique({
    where: { id: appointment.organizationId },
    select: { stripeSecretKey: true },
  })
  if (!org?.stripeSecretKey) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { noShowChargeStatus: "SKIPPED" },
    })
    return { charged: false, skipped: "no-stripe-key" }
  }

  const { Stripe } = await import("stripe")
  const client = new Stripe(org.stripeSecretKey)

  try {
    // Plačilna metoda živi na SetupIntentu (kartica je vezana nanj).
    const setupIntent = await client.setupIntents.retrieve(
      appointment.stripeSetupIntentId!
    )
    const paymentMethod = setupIntent.payment_method
    if (!paymentMethod) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { noShowChargeStatus: "SKIPPED" },
      })
      return { charged: false, skipped: "no-payment-method" }
    }

    const intent = await client.paymentIntents.create({
      amount: Math.round(Number(appointment.depositAmount) * 100),
      currency: "eur",
      customer: appointment.stripeCustomerId!,
      payment_method: paymentMethod as string,
      off_session: true,
      confirm: true,
      metadata: {
        type: "no_show_fee",
        appointmentId: appointment.id,
      },
    })

    // Zapiši izid — unique noShowChargeId naredi ponovitev varno odstopljivo.
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        noShowChargeStatus: "CHARGED",
        noShowChargeId: intent.id,
        depositPaid: true,
      },
    })
    return { charged: true }
  } catch (error) {
    // Kartica zavrnjena / off_session zavrnitev — zapiši FAILED; lastnik
    // vidi status v detajlu termina (ročna nadaljnja obravnava).
    await prisma.appointment
      .update({
        where: { id: appointment.id },
        data: { noShowChargeStatus: "FAILED" },
      })
      .catch(() => undefined)
    return {
      charged: false,
      error:
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: string }).message)
          : "Stripe charge failed",
    }
  }
}
