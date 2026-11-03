import { Resend } from "resend"
import { render } from "@react-email/components"
import { NoShowNotificationTemplate } from "./templates/no-show-notification-template"
import { formatDateStandard } from "@/lib/utils/format"

const resend = new Resend(
  process.env.RESEND_API_KEY || "re_placeholder_not_configured"
)

interface SendNoShowNotificationParams {
  email: string
  customerName: string
  serviceName: string
  staffName: string
  appointmentDate: Date
  appointmentTime: string
  depositAmount: number
  appointmentId: string
}

export async function sendNoShowNotificationEmail({
  email,
  customerName,
  serviceName,
  staffName,
  appointmentDate,
  appointmentTime,
  depositAmount,
  appointmentId,
}: SendNoShowNotificationParams) {
  try {
    const bookingRef = appointmentId.slice(-8).toUpperCase()

    const html = await render(
      NoShowNotificationTemplate({
        customerName,
        serviceName,
        staffName,
        appointmentDate,
        appointmentTime,
        depositAmount,
        bookingRef,
      })
    )

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject: `Missed Appointment - ${serviceName} on ${formatDateStandard(new Date(appointmentDate))}`,
      html,
    })

    if (error) {
      console.error("Resend error:", error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error("Email send error:", error)
    return { success: false, error: "Failed to send no-show notification email" }
  }
}
