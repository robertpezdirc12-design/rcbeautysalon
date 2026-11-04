import { DEFAULT_EMAIL_LOGO } from "@/lib/default-assets"
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components"

interface WaitlistNotifyTemplateProps {
  name: string
  businessName: string
  serviceName?: string | null
  bookingUrl: string
}

// #90 — obvestilo čakajoči stranki, da se je prostor odprl.
// Pošteno: povezava vodi v rezervacijski čarovnik (termin si izbere
// sama), nikoli ne trdi, da je termin rezerviran.
export function WaitlistNotifyTemplate({
  name,
  businessName,
  serviceName,
  bookingUrl,
}: WaitlistNotifyTemplateProps) {
  const logoUrl = DEFAULT_EMAIL_LOGO

  return (
    <Html>
      <Head />
      <Preview>A slot just opened up at {businessName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={logoUrl} width="200" height="200" alt={businessName} style={logo} />
          </Section>

          <Section style={content}>
            <Heading style={title}>A slot just opened up!</Heading>
            <Text style={text}>Hi {name},</Text>
            <Text style={text}>
              Good news — {businessName} just had a cancellation
              {serviceName ? (
                <>
                  {" "}
                  for <strong>{serviceName}</strong>
                </>
              ) : null}
              . You are on the waitlist, so you get first notice.
            </Text>

            <Section style={infoBox}>
              <Text style={infoText}>
                The freed time is not held for you — book it while it lasts.
                Pick the time that suits you below.
              </Text>
            </Section>

            <Section style={buttonContainer}>
              <Button style={button} href={bookingUrl}>
                Choose a time
              </Button>
            </Section>

            <Hr style={hr} />

            <Text style={contactText}>
              If the button does not work, copy this address into your
              browser:
              <br />
              <span style={urlText}>{bookingUrl}</span>
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerBrand}>{businessName}</Text>
            <Text style={footerNote}>
              You received this because you joined the waitlist. If you no
              longer wish to be notified, simply ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: "#faf7f5",
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
}

const container = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "40px 20px",
}

const header = {
  background: "linear-gradient(135deg, #E76D89 0%, #F4C430 100%)",
  borderRadius: "16px 16px 0 0",
  padding: "30px",
  textAlign: "center" as const,
}

const logo = {
  display: "block",
  margin: "0 auto",
}

const content = {
  backgroundColor: "#ffffff",
  padding: "40px 30px",
  borderLeft: "1px solid #e8ddd9",
  borderRight: "1px solid #e8ddd9",
}

const title = {
  color: "#4A5568",
  fontSize: "24px",
  margin: "0 0 20px 0",
  textAlign: "center" as const,
}

const text = {
  color: "#5c5c5c",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 15px 0",
}

const infoBox = {
  backgroundColor: "#FFF8E7",
  border: "1px solid #F4C430",
  borderRadius: "8px",
  padding: "15px 20px",
  margin: "20px 0",
}

const infoText = {
  color: "#7a6520",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0",
}

const buttonContainer = {
  textAlign: "center" as const,
  margin: "30px 0",
}

const button = {
  background: "linear-gradient(135deg, #E76D89 0%, #F4C430 100%)",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  padding: "16px 40px",
  borderRadius: "50px",
  textDecoration: "none",
  display: "inline-block",
}

const hr = {
  border: "none",
  borderTop: "1px solid #e8ddd9",
  margin: "25px 0",
}

const contactText = {
  color: "#5c5c5c",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0",
  textAlign: "center" as const,
}

const urlText = {
  color: "#E76D89",
  wordBreak: "break-all" as const,
}

const footer = {
  backgroundColor: "#342A2C",
  borderRadius: "0 0 16px 16px",
  padding: "25px 30px",
  textAlign: "center" as const,
}

const footerBrand = {
  color: "#F4C430",
  fontSize: "16px",
  margin: "0 0 8px 0",
  fontWeight: "600",
}

const footerNote = {
  color: "#8B7176",
  fontSize: "11px",
  lineHeight: "1.5",
  margin: "0",
}
