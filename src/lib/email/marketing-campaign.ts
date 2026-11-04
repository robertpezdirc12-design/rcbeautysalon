import { Resend } from "resend"
import { render } from "@react-email/components"
import { MarketingCampaignTemplate } from "./templates/marketing-campaign-template"

const resend = new Resend(
  process.env.RESEND_API_KEY || "re_placeholder_not_configured"
)

interface SendMarketingCampaignEmailParams {
  email: string
  subject: string
  /** Lastniško besedilo z že izračunanimi vstavitvami. */
  body: string
  businessName: string
}

// #95 — pošiljanje ene kampanjske e-pošte. Brez RESEND_API_KEY vrne
// pošten neuspeh (job zabeleži in nadaljuje; dedup se NE zapiše, ker
// CampaignSend ustvari poklicatelj ŠELE ob uspehu).
export async function sendMarketingCampaignEmail({
  email,
  subject,
  body,
  businessName,
}: SendMarketingCampaignEmailParams) {
  try {
    const html = await render(MarketingCampaignTemplate({ body, businessName }))

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject,
      html,
    })

    if (error) {
      console.error("Resend error:", error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error("Email send error:", error)
    return { success: false, error: "Failed to send campaign email" }
  }
}
