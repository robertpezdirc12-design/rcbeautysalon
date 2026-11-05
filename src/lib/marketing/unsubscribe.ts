// ============================================================
// #95 (AD-03) — FUNKCIONALNA ODAVA: podpisani žetoni
// Odjavna povezava je HMAC-podpisan (org, e-pošta) žeton — brez
// stanja v bazi, brez ugibanja: brez tajne se povezava ne izda,
// tamperiran žeton ne potrdi odjave. E-pošta se normalizira na
// male črke (isti naslov = isti žeton ne glede na velikost).
// ============================================================

import { createHmac, timingSafeEqual } from "crypto"

/** Tajna za podpis — namenska, s padom na CRON_SECRET (isti upravljalec). */
export function unsubscribeSecret(): string | null {
  const secret = process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET ?? ""
  return secret.length >= 16 ? secret : null
}

function b64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function fromB64url(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8")
  } catch {
    return null
  }
}

function signature(orgId: string, email: string, secret: string): string {
  return createHmac("sha256", secret).update(`${orgId}:${email}`).digest("hex")
}

/** Žeton za odjavno povezavo; brez veljavne tajne → null (brez lažnih povezav). */
export function signUnsubscribeToken(
  organizationId: string,
  email: string,
  secret: string | null = unsubscribeSecret()
): string | null {
  if (!secret || secret.length < 16) return null
  const normalizedEmail = email.trim().toLowerCase()
  if (!organizationId || !normalizedEmail) return null
  return `v1.${b64url(organizationId)}.${b64url(normalizedEmail)}.${signature(organizationId, normalizedEmail, secret)}`
}

/** Preverba žetona — vrne (org, e-pošta) ali null (tamper/neveljaven). */
export function verifyUnsubscribeToken(
  token: string,
  secret: string | null = unsubscribeSecret()
): { organizationId: string; email: string } | null {
  if (!secret || typeof token !== "string") return null
  const parts = token.split(".")
  if (parts.length !== 4 || parts[0] !== "v1") return null
  const organizationId = fromB64url(parts[1])
  const email = fromB64url(parts[2])
  if (!organizationId || !email) return null
  const expected = Buffer.from(signature(organizationId, email, secret), "hex")
  const actual = Buffer.from(parts[3], "hex")
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null
  }
  return { organizationId, email }
}

/** Javna pot odjave (pogojna — brez tajne je null). */
export function unsubscribePath(
  organizationId: string,
  email: string,
  secret: string | null = unsubscribeSecret()
): string | null {
  const token = signUnsubscribeToken(organizationId, email, secret)
  return token ? `/unsubscribe/${token}` : null
}
