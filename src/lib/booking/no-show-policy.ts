// ============================================================
// #97 (AD-07) — NO-SHOW ZAŠČITA: pravilnik + pravila bremenitve
// SLO pravne formulacije so na enem mestu (privolitev v wizardu,
// checkout, e-pošta). Kartice SE NIKOLI ne shranjujejo v aplikacijo —
// samo Stripe reference (SetupIntent/Customer); bremenitev off-session
// izvede Stripe (web-push varni poti, PCI SAQ-A obseg).
// ============================================================

import type { Prisma } from "@prisma/client"

/** Eksplicitna privolitev (checkbox v rezervaciji) — pravna formulacija. */
export const NO_SHOW_CONSENT_LABEL =
  "No-show zaščita: razumem, da bo moja kartica shranjena pri Stripe-u izključno kot garancija in da pri ne-prihodu brez odjave zaračunamo polog za rezervirano storitev."

/** Kratek pravilnik (razširljiv obrazec v wizardu). */
export const NO_SHOW_POLICY_TEXT = [
  "Polog ne bo bremenjen ob rezervaciji — kartica služi kot garancija.",
  "Pojavite se ob terminu: ničesar ne zaračunamo (polog poravnate ob obisku).",
  "Ne-prihod brez odjave: zaračunamo polog v višini, ki je navedena ob rezervaciji.",
  "Odpoved vnaprej: glej pravilnik odpovedi ponudnika — pravočasna odpoved ni bremenjena.",
  "Kartico shrani Stripe (PCI DSS); v aplikaciji ostanejo samo reference, ne številke.",
].join("\n")

/** Metadata tip v Checkout setup seji (webhook vrata). */
export const GUARANTEE_METADATA_TYPE = "no_show_guarantee"

/** Pogoji za bremenitev pologa ob no-show (čista jedra — truth-table testirano). */
export interface NoShowChargeCandidate {
  noShowConsent: boolean
  noShowSetupStatus: string
  noShowChargeStatus: string
  depositPaid: boolean
  depositAmount: Prisma.Decimal | number | string
  stripeSetupIntentId: string | null
  stripeCustomerId: string | null
}

export function shouldChargeOnNoShow(a: NoShowChargeCandidate): boolean {
  const amount = Number(a.depositAmount ?? 0)
  return (
    a.noShowConsent === true &&
    a.noShowSetupStatus === "SAVED" &&
    a.noShowChargeStatus === "NONE" &&
    a.depositPaid === false &&
    amount > 0 &&
    !!a.stripeSetupIntentId &&
    !!a.stripeCustomerId
  )
}
