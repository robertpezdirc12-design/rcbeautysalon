import { Resend } from "resend"
import { render } from "@react-email/components"
import { GiftCardTemplate } from "./templates/gift-card-template"
import { isEmailServiceConfigured } from "./config"

// ============================================================
// DARILNI BON (#80) — pošiljanje kode po nakupu. Non-blocking:
// klicatelji (webhook/verify/offline sale) pokličejo v after()/catch.
// Brez RESEND_API_KEY pošiljanje tiho odpove (koda ostane v pregledu
// v dashboardu in na uspešni strani — lastnik jo lahko posreduje ročno).
// ============================================================

const resend = new Resend(
  process.env.RESEND_API_KEY || "re_placeholder_not_configured"
)

interface SendGiftCardEmailParams {
  email: string
  code: string
  faceValue: number
  productName: string
  salonName: string
  expiresAt?: string | null
}

export async function sendGiftCardEmail({
  email,
  code,
  faceValue,
  productName,
  salonName,
  expiresAt,
}: SendGiftCardEmailParams) {
  if (!isEmailServiceConfigured()) {
    return { success: false, error: "Email service not configured" }
  }

  try {
    const html = await render(
      GiftCardTemplate({
        code,
        faceValue,
        productName,
        salonName,
        expiresAt,
      })
    )

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject: `Darilni bon ${faceValue.toFixed(2)} € — ${salonName} (koda: ${code})`,
      html,
    })

    if (error) {
      console.error("Resend error:", error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error("Email send error:", error)
    return { success: false, error: "Failed to send gift card email" }
  }
}
