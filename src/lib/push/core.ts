// ============================================================
// #99 — PUSH + PWA (čista jedra)
// VAPID Web Push za lastnika: nov termin, odpoved. Dnevni digest
// gre po e-pošti (Resend, cron). Brez VAPID ključev je push pošteno
// izklopljen (nikoli lažni gumb — UI pokaže "ni nastavljeno").
// ============================================================

export type PushKind = "new_appointment" | "cancellation"

export interface PushPayload {
  kind: PushKind
  /** Naslov obvestila (kratko). */
  title: string
  /** Telo obvestila. */
  body: string
  /** Relativna ruta, ki jo ob klik odpre. */
  url: string
}

/** Sestavi payload iz vrste + podatkov — testabilno, enoten oblikovni jezik. */
export function buildPushPayload(
  kind: PushKind,
  data: { customerName?: string; date?: string }
): PushPayload {
  if (kind === "new_appointment") {
    return {
      kind,
      title: "Nov termin",
      body: data.customerName
        ? `${data.customerName} je rezerviral nov termin${data.date ? ` za ${data.date}` : ""}.`
        : "Nov termin je bil rezerviran.",
      url: "/dashboard/appointments",
    }
  }
  return {
    kind: "cancellation",
    title: "Termin odpovedan",
    body: data.customerName
      ? `${data.customerName} je odpovedal termin${data.date ? ` za ${data.date}` : ""}.`
      : "Termin je bil odpovedan.",
    url: "/dashboard/appointments",
  }
}

/** Push je konfiguriran samo z obema ključema (VAPID par). */
export function isPushConfigured(
  vapidPublicKey: string | undefined,
  vapidPrivateKey: string | undefined
): boolean {
  return (
    typeof vapidPublicKey === "string" &&
    vapidPublicKey.length > 0 &&
    typeof vapidPrivateKey === "string" &&
    vapidPrivateKey.length > 0
  )
}

export interface DigestStats {
  /** Salon-lokalen datum, za katerega digest govor ("danes"). */
  todayLabel: string
  /** Termin danes: število + kratki seznami (ura — storitev — stranka). */
  todayCount: number
  todayLines: string[]
  /** Nove rezervacije (zadnjih 24 h). */
  newBookings: number
  /** Odpovedi (zadnjih 24 h). */
  cancellations: number
  /** Termin jutri. */
  tomorrowCount: number
}

/** Dnevni digest e-pošta: poštena vsebina, samo dejstva iz podatkov. */
export function buildDigestEmail(stats: DigestStats): { subject: string; body: string } {
  const subject =
    stats.todayCount > 0
      ? `Povzetek dneva — ${stats.todayCount} terminov (${stats.todayLabel})`
      : `Povzetek dneva — brez terminov (${stats.todayLabel})`

  const lines: string[] = []
  if (stats.todayLines.length > 0) {
    lines.push("DANES:", ...stats.todayLines.map((l) => ` • ${l}`), "")
  } else {
    lines.push("Danes ni terminov.", "")
  }
  lines.push(`Nove rezervacije (24 h): ${stats.newBookings}`)
  lines.push(`Odpovedi (24 h): ${stats.cancellations}`)
  lines.push(`Termini jutri: ${stats.tomorrowCount}`)

  return { subject, body: lines.join("\n") }
}

/** Digest se pošlje samo, ko se je kaj zgodilo (brez vsakodnevnega šuma). */
export function digestWorthSending(stats: DigestStats): boolean {
  return (
    stats.todayCount > 0 ||
    stats.newBookings > 0 ||
    stats.cancellations > 0 ||
    stats.tomorrowCount > 0
  )
}
