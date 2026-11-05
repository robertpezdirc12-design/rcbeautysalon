import { Resend } from "resend"
import { render } from "@react-email/components"
import { DailyDigestTemplate } from "./templates/daily-digest-template"

const resend = new Resend(
  process.env.RESEND_API_KEY || "re_placeholder_not_configured"
)

interface SendDailyDigestParams {
  email: string
  subject: string
  /** Sestavljen povzetek (buildDigestEmail). */
  body: string
  businessName: string
  todayLabel: string
}

// #99 — dnevni digest lastniku (cron job send-daily-digest). Brez
// RESEND_API_KEY vrne pošten neuspeh (job to zabeleži v JobRun).
export async function sendDailyDigestEmail({
  email,
  subject,
  body,
  businessName,
  todayLabel,
}: SendDailyDigestParams) {
  try {
    const html = await render(
      DailyDigestTemplate({ body, businessName, todayLabel })
    )

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
    return { success: false, error: "Failed to send digest email" }
  }
}
