import { Resend } from "resend"
import { render } from "@react-email/components"
import { WaitlistNotifyTemplate } from "./templates/waitlist-notify-template"

const resend = new Resend(
  process.env.RESEND_API_KEY || "re_placeholder_not_configured"
)

interface SendWaitlistNotifyParams {
  email: string
  name: string
  businessName: string
  serviceName?: string | null
  bookingUrl: string
}

// #90 — obvestilo enemu čakajočemu gostu (lastnik pošilja iz vodene
// liste; bulk iterira čez ta klic). Brez RESEND_API_KEY vrne pošten
// neuspeh — UI pokaže napako namesto lažnega "uspešno obveščeno".
export async function sendWaitlistNotifyEmail({
  email,
  name,
  businessName,
  serviceName,
  bookingUrl,
}: SendWaitlistNotifyParams) {
  try {
    const html = await render(
      WaitlistNotifyTemplate({ name, businessName, serviceName, bookingUrl })
    )

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject: `A slot just opened up — ${serviceName ?? businessName}`,
      html,
    })

    if (error) {
      console.error("Resend error:", error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error("Email send error:", error)
    return { success: false, error: "Failed to send waitlist notification" }
  }
}
