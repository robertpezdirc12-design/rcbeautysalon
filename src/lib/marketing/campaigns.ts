// ============================================================
// #95 — MARKETING AVTOMATIKA (čista jedra)
// Eligibilnost, vstavitve in privzeta besedila — brez DB, testabilna.
// Poštenost: kampanja kontaktira SAMO obstoječe stranke z e-pošto,
// vsaka sprožitev se unovči ENKRAT (triggerKey), telo vsebuje
// opombo za odjavo (v1: odgovor na e-pošto — brez lažnih povezav).
// ============================================================

export const CAMPAIGN_KINDS = ["REACTIVATION", "NO_SHOW"] as const
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number]

/** Vstavitve, ki jih lastnik lahko uporabi v subject/body. */
export const PLACEHOLDERS = ["{name}", "{business}", "{days}", "{date}", "{bookingLink}"] as const

export interface VisitRef {
  /** Id zaključenega termina — hkrati dedup triggerKey. */
  id: string
  email: string
  name: string
  /** Salon-lokalni datum zaključka, oblika "yyyy-MM-dd". */
  completedOn: string
}

export interface NoShowRef {
  /** Id ne-prihoda — dedup triggerKey. */
  id: string
  email: string
  name: string
  /** Salon-lokalni datum ne-prihoda ("yyyy-MM-dd"). */
  missedOn: string
}

export interface CampaignTarget {
  email: string
  name: string
  triggerKey: string
  /** Vstavitve za to sporočilo. */
  vars: { name: string; business: string; days?: number; date?: string; bookingLink: string }
}

/** Številski ključ "yyyy-MM-dd" (leksikografsko = kronološko). */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * REACTIVATION: cilj = stranka, katere ZADNJI zaključeni obisk je
 * točno `thresholdDays` dni pred `today` IN ki nima PRIHODNJEGO
 * zaključenega/prihajajočega obiska. TriggerKey = id tega obiska —
 * naslednja reaktivacija je možna šele po novem obisku.
 */
export function pickReactivationTargets(
  visits: VisitRef[],
  opts: { thresholdDays: number; today: Date; business: string; bookingLink: string }
): CampaignTarget[] {
  // Zadnji obisk na stranko (po e-pošti — ena oseba, en sporočilni kanal).
  const lastByEmail = new Map<string, VisitRef>()
  const hasFuture = new Set<string>()
  const todayKey = dayKey(opts.today)
  const thresholdCutoff = new Date(opts.today)
  thresholdCutoff.setDate(thresholdCutoff.getDate() - opts.thresholdDays)
  const cutoffKey = dayKey(thresholdCutoff)

  for (const v of visits) {
    if (v.completedOn > todayKey) {
      // Prihodnji zaključen vpis ali nov zapis — stranka je aktivna.
      hasFuture.add(v.email.toLowerCase())
    }
    const prev = lastByEmail.get(v.email.toLowerCase())
    if (!prev || v.completedOn > prev.completedOn) lastByEmail.set(v.email.toLowerCase(), v)
  }

  const targets: CampaignTarget[] = []
  for (const [email, visit] of lastByEmail) {
    if (hasFuture.has(email)) continue
    if (visit.completedOn !== cutoffKey) continue // točno na dan — brez prekoračitev, brez duplikatov
    targets.push({
      email: visit.email,
      name: visit.name,
      triggerKey: visit.id,
      vars: {
        name: visit.name,
        business: opts.business,
        days: opts.thresholdDays,
        bookingLink: opts.bookingLink,
      },
    })
  }
  return targets
}

/**
 * NO_SHOW: cilj = ne-prihod VČERAJ (glede na `today`) z znano e-pošto.
 * TriggerKey = id ne-prihoda (en sledilni email na ne-prihod).
 */
export function pickNoShowTargets(
  noShows: NoShowRef[],
  opts: { today: Date; business: string; bookingLink: string }
): CampaignTarget[] {
  const yesterdayKey = dayKey(new Date(opts.today.getTime() - 24 * 60 * 60 * 1000))
  return noShows
    .filter((n) => n.missedOn === yesterdayKey)
    .map((n) => ({
      email: n.email,
      name: n.name,
      triggerKey: n.id,
      vars: {
        name: n.name,
        business: opts.business,
        date: n.missedOn,
        bookingLink: opts.bookingLink,
      },
    }))
}

/** Zamenjava {name}/{business}/{days}/{date}/{bookingLink} — neznane vstavitve pustijo. */
export function interpolate(
  template: string,
  vars: { name: string; business: string; days?: number; date?: string; bookingLink: string }
): string {
  return template
    .replaceAll("{name}", vars.name)
    .replaceAll("{business}", vars.business)
    .replaceAll("{days}", String(vars.days ?? ""))
    .replaceAll("{date}", vars.date ?? "")
    .replaceAll("{bookingLink}", vars.bookingLink)
}

/** Privzeto pošteno besedilo (SL) — lastnik ga lahko preglasi.
 * #95 (AD-03): noga vsake e-pošte nosi DEJANSKO odjavno povezavo
 * (doda jo predloga), zato besedilo ne obljublja odjave "z odgovorom".
 * Vstavitve ({name}, {bookingLink}, …) se vstavijo ob pošiljanju. */
export function defaultCampaignCopy(
  kind: CampaignKind,
  business: string
): { subject: string; body: string } {
  if (kind === "REACTIVATION") {
    return {
      subject: `Že nekaj časa vas ni bilo — ${business}`,
      body: `Pozdravljeni {name},\n\nže {days} dni vas nismo videli. Vaša ponudba se je morda spremenila — si oglejte in rezervirajte nov termin:\n{bookingLink}\n\nSe vidimo kmalu,\nekipo ${business}`,
    }
  }
  return {
    subject: `Vidimo se naslednjič — ${business}`,
    body: `Pozdravljeni {name},\n\nna žalost ste {date} zamudili obisk. Če si želite nov termin, ga rezervirajte, ko vam ustreza:\n{bookingLink}\n\nLepo pozdravljeni,\nekipo ${business}`,
  }
}
