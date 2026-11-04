import { DEFAULT_EMAIL_LOGO } from "@/lib/default-assets"
import {
  Body,
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

// ============================================================
// DARILNI BON (#80) — e-pošta s kodo. Prva pošta sploh, ki nosi
// "izdelek" (kodo), zato je koda velika in kopirabilna.
// ============================================================

interface GiftCardTemplateProps {
  code: string
  faceValue: number
  productName: string
  salonName: string
  expiresAt?: string | null
}

export function GiftCardTemplate({
  code,
  faceValue,
  productName,
  salonName,
  expiresAt,
}: GiftCardTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>Darilni bon {faceValue.toFixed(2)} € — {salonName}</Preview>
      <Body style={{ backgroundColor: "#f6f6f6", fontFamily: "Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: "12px", margin: "0 auto", maxWidth: "520px", padding: "32px" }}>
          {DEFAULT_EMAIL_LOGO ? (
            <Img
              src={DEFAULT_EMAIL_LOGO}
              alt={salonName}
              width={120}
              style={{ margin: "0 auto 16px", display: "block" }}
            />
          ) : null}
          <Heading style={{ fontSize: "22px", margin: "0 0 8px", textAlign: "center" }}>
            🎁 Darilni bon je pripravljen
          </Heading>
          <Text style={{ color: "#555", fontSize: "14px", textAlign: "center", margin: "0 0 24px" }}>
            {productName} od {salonName}
          </Text>

          <Section
            style={{
              backgroundColor: "#111111",
              borderRadius: "10px",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: "13px", margin: "0 0 8px" }}>
              Vrednost bona
            </Text>
            <Text
              style={{
                color: "#ffffff",
                fontSize: "30px",
                fontWeight: "bold",
                margin: "0 0 16px",
              }}
            >
              {faceValue.toFixed(2)} €
            </Text>
            <Text style={{ color: "#aaaaaa", fontSize: "12px", margin: "0 0 8px" }}>
              Koda bona
            </Text>
            <Text
              style={{
                color: "#ffffff",
                fontSize: "24px",
                fontWeight: "bold",
                letterSpacing: "2px",
                margin: 0,
              }}
            >
              {code}
            </Text>
          </Section>

          <Text style={{ color: "#555", fontSize: "14px", marginTop: "24px" }}>
            Kodo vnesite v košarico pri nakupu v trgovini salona {salonName}
            {" "}ali jo pokažite ob obisku. Bon velja za vse izdelke v trgovini.
          </Text>
          {expiresAt ? (
            <Text style={{ color: "#888", fontSize: "12px" }}>
              Bon velja do {expiresAt}.
            </Text>
          ) : (
            <Text style={{ color: "#888", fontSize: "12px" }}>
              Bon ne poteče.
            </Text>
          )}

          <Hr style={{ borderColor: "#eeeeee", margin: "24px 0" }} />
          <Text style={{ color: "#aaaaaa", fontSize: "11px", textAlign: "center" }}>
            To sporočilo je bilo poslano, ker je nekdo z vašim e-poštnim naslovom kupil darilni bon. Če to niste vi, prezrite sporočilo.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
