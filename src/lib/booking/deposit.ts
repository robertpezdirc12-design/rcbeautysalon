// ============================================================
// DEPOSIT RULES (#79) — EN VIRO RESNICE za polog.
//
// Prej je bil polog ENA globalna številka (SalonConfig.bookingDeposit),
// kopirana v termine iz treh neodvisnih tokov (booking, Stripe checkout,
// webhook). Simptom: 50 € polog na 15 € manikuro — rezervacija, ki jo
// stranka opusti. Zdaj je polog PRAVILO:
//   • service.depositType INHERIT → sledi org pravilu;
//   • NONE → storitev je oproščena pologa;
//   • FIXED → fiksni znesek (vendar NIKOLI več kot cena storitve);
//   • PERCENT → 0–100 % cene storitve.
//
// Ta modul je ČIST (brez Prismy/Reacta) in namenoma client-safe: isti
// izračun teče na strani gosta (booking forma), na strežniku (akcija)
// in v Stripe checkoutu — rezervacija, plačilo in zapis se ne morejo
// razlikovati.
// ============================================================

export type DepositTypeValue = "INHERIT" | "NONE" | "FIXED" | "PERCENT"

/** Ena storitev z njenim pravilom pologa (vse cene so že številke). */
export interface DepositRuleService {
  price: number
  depositType: DepositTypeValue
  depositValue: number | null
}

/** Org nastavitve (iz SalonConfig, že konvertirane v številke). */
export interface DepositOrgConfig {
  bookingDeposit: number
  bookingDepositType: DepositTypeValue
}

/** Zaokroži na 2 decimalki (EUR centi) brez float šuma. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Razreši polog za ENO storitev.
 * Vrne znesek v EUR (0 = brez pologa). Znesek NIKOLI ne preseže cene
 * storitve — to je popravek simptoma "polog večji od storitve" tudi za
 * obstoječe najemnike, ki obdržijo fiksni 50.
 */
export function resolveDeposit(
  service: DepositRuleService,
  org: DepositOrgConfig
): number {
  const type = service.depositType === "INHERIT" ? org.bookingDepositType : service.depositType

  if (type === "NONE") return 0

  if (type === "PERCENT") {
    const percent =
      service.depositType === "INHERIT"
        ? org.bookingDeposit // org PERCENT: vrednost je v bookingDeposit
        : (service.depositValue ?? 0)
    if (!Number.isFinite(percent) || percent <= 0) return 0
    return round2(Math.min((service.price * percent) / 100, service.price))
  }

  // FIXED — org nivo uporabi bookingDeposit kot znesek.
  const value =
    service.depositType === "INHERIT" ? org.bookingDeposit : (service.depositValue ?? 0)
  if (!Number.isFinite(value) || value <= 0) return 0
  return round2(Math.min(value, service.price))
}

/**
 * Razreši polog za celoten termin (več storitev).
 * Vsota posameznih pravil, omejena na skupno ceno — polog ni mehanizem
 * za zaračunavanje več, kot stori termin.
 */
export function resolveDepositForServices(
  services: DepositRuleService[],
  org: DepositOrgConfig
): number {
  if (services.length === 0) return 0
  const total = services.reduce((sum, s) => sum + s.price, 0)
  const deposit = services.reduce((sum, s) => sum + resolveDeposit(s, org), 0)
  return round2(Math.min(deposit, total))
}

// ============================================================
// COMMISSIONS (#79) — izračun enkrat, zgodovina se ne prepiše.
// Izračun teče KO se termin označi kot COMPLETED in se zapiše na
// appointment.commissionAmount (null = še ne izračunano). Kasnejša
// sprememba pravila ne spremeni starih terminov.
// ============================================================

export type CommissionTypeValue = "NONE" | "PERCENT" | "FIXED"

export interface CommissionRule {
  commissionType: CommissionTypeValue
  commissionValue: number | null
}

/**
 * Provizija za en termin. `basis` je osnova za odstotek (storitveni
 * promet osebe). FIXED je fiksni znesek na termin; NONE je 0.
 */
export function computeCommission(
  staff: CommissionRule,
  basisAmount: number
): number {
  if (staff.commissionType === "PERCENT") {
    const percent = staff.commissionValue ?? 0
    if (!Number.isFinite(percent) || percent <= 0) return 0
    return round2((basisAmount * percent) / 100)
  }
  if (staff.commissionType === "FIXED") {
    const value = staff.commissionValue ?? 0
    if (!Number.isFinite(value) || value <= 0) return 0
    return round2(value)
  }
  return 0
}
