import { DEFAULT_EMAIL_LOGO } from "@/lib/default-assets"
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components"

interface DailyDigestTemplateProps {
  /** Sestavljen povzetek (buildDigestEmail — čisto jedro #99). */
  body: string
  businessName: string
  todayLabel: string
}

// #99 — dnevni digest lastniku (cron): povzetek dneva pošteno iz podatkov,
// brez trditev, ki jih številke ne podpirajo. Brez odjavne povezave —
// to ni marketinška e-pošta, ampak operativni povzetek lastnikovega dneva.
export function DailyDigestTemplate({
  body,
  businessName,
  todayLabel,
}: DailyDigestTemplateProps) {
  const paragraphs = body.split(/\n{2,}/).filter((p) => p.trim().length > 0)

  return (
    <Html>
      <Head />
      <Preview>Povzetek dneva — {todayLabel}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={DEFAULT_EMAIL_LOGO} width="140" height="140" alt={businessName} style={logo} />
          </Section>
          <Section style={content}>
            <Heading style={title}>
              Povzetek dneva — {todayLabel}
            </Heading>
            {paragraphs.map((p, i) => (
              <Text key={i} style={text} data-testid="digest-paragraph">
                {p}
              </Text>
            ))}
          </Section>
          <Section style={footer}>
            <Text style={footerNote}>
              Operativni povzetek za {businessName} (dnevni digest).
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
  fontSize: "20px",
  margin: "0 0 20px 0",
  textAlign: "center" as const,
}

const text = {
  color: "#5c5c5c",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 14px 0",
  whiteSpace: "pre-wrap" as const,
}

const footer = {
  backgroundColor: "#342A2C",
  borderRadius: "0 0 16px 16px",
  padding: "25px 30px",
  textAlign: "center" as const,
}

const footerNote = {
  color: "#8B7176",
  fontSize: "11px",
  lineHeight: "1.5",
  margin: "0",
}
