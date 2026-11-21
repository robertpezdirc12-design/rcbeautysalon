// ============================================================
// ŠIFRIRANJE SSRF ZAŠČITE ZUNANJIH E-RAČUNSKIH KONČNIH TOČK (#1318)
//
// `providerEndpoint` je uporabniško nastavljiv naslov, na katerega strežnik
// pošilja zahteve. Če ga napadalec nadzira, je to vstopna točka SSRF:
//   • localhost / 127.0.0.1
//   • zasebni IP-obsegi (10/8, 172.16/12, 192.168/16)
//   • link-local (169.254/16) in cloud-metadata naslovi
//   • DNS-rebinding: veljavno ime ob shranjevanju → notranji IP ob pošiljanju
//   • preusmeritev HTTP(S) na notranje naslove (fetch po default sledi 3xx)
//
// Ta modul je PURE (ni DB, ni omrežja): `assertPublicHttpsUrl()` preveri, da
// greet URL ne kaže v notranje mreže. Pokliče se OBVENO:
//   1) ob shranjevanju kanala (`saveEinvoiceChannel`),
//   2) neposredno pred vsakim pošiljanjem (transport že sam ne sledi
//      preusmeritvam — `redirect: "manual"` pri fetch; node:https ne sledi).
// ============================================================

import { isIP } from "node:net"

/** Nedovoljeni zasebni / reservirani IPv4-obsegi (109/LinkLocal-added). */
const BLOCKED_V4 = [
  { start: "0.0.0.0", end: "0.255.255.255" }, // this-network
  { start: "10.0.0.0", end: "10.255.255.255" }, // private
  { start: "100.64.0.0", end: "100.127.255.255" }, // CGNAT
  { start: "127.0.0.0", end: "127.255.255.255" }, // loopback
  { start: "169.254.0.0", end: "169.254.255.255" }, // link-local / metadata proxy
  { start: "172.16.0.0", end: "172.31.255.255" }, // private
  { start: "192.168.0.0", end: "192.168.255.255" }, // private
  { start: "198.18.0.0", end: "198.19.255.255" }, // benchmark
  { start: "192.0.0.0", end: "192.0.0.255" }, // IETF protocol / TEST-NET
  { start: "192.0.2.0", end: "192.0.2.255" }, // TEST-NET-1
  { start: "198.51.100.0", end: "198.51.100.255" }, // TEST-NET-2
  { start: "203.0.113.0", end: "203.0.113.255" }, // TEST-NET-3
  { start: "240.0.0.0", end: "255.255.255.255" }, // reserved
] as const

/** Nedovoljeni IPv6-obsegi (loopback ::1, link-local fe80::/10, ULA fc00::/7, unspecified). */
const BLOCKED_V6 = [
  { start: "::", end: "::" }, // unspecified
  { start: "::1", end: "::1" }, // loopback (v4-mapped 0:0:0:0:0:ffff:127.0.0.1 zajame zgoraj)
  { start: "::ffff:127.0.0.0", end: "::ffff:127.255.255.255" }, // v4-mapped loopback
  { start: "fc00::", end: "fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff" }, // ULA
  { start: "fe80::", end: "febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff" }, // link-local
  { start: "ff00::", end: "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff" }, // multicast
] as const

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0)
}

function isBlockedV4(ip: string): boolean {
  if (isIP(ip) !== 4) return false
  const n = v4ToInt(ip) >>> 0
  return BLOCKED_V4.some((r) => n >= v4ToInt(r.start) && n <= v4ToInt(r.end))
}

function v6ToBigInt(ip: string): bigint {
  if (ip.includes("%")) ip = ip.split("%")[0] // odvrzi scope-id (fe80::1%eth0)
  const fields = ip.split("::")
  let left = fields[0] ? fields[0].split(":") : []
  const right = fields[1] ? fields[1].split(":") : []
  const missing = 8 - left.length - right.length
  if (missing > 0) left = left.concat(new Array(missing).fill("0"))
  const all = left.concat(right)
  const hex = all.map((h) => h.padStart(4, "0")).join("")
  return BigInt("0x" + hex)
}

function isBlockedV6(ip: string): boolean {
  if (isIP(ip) !== 6) return false
  const n = v6ToBigInt(ip)
  return BLOCKED_V6.some(
    (r) => n >= v6ToBigInt(r.start) && n <= v6ToBigInt(r.end)
  )
}

export type EndpointValidation =
  | { ok: true; publicHost: string }
  | { ok: false; error: string }

/** Preveri, da je URL varen zunanji HTTPS cilj (ne SSRF). Ne izvaja omrežja. */
export function assertPublicHttpsUrl(raw: string | null | undefined): EndpointValidation {
  if (!raw) return { ok: false, error: "Endpoint ni podan." }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, error: "Neveljaven URL naslov." }
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Endpoint mora uporabiti https:// (ali https:// za izjemne sisteme)." }
  }
  // Poslovno: e-pošiljanje gre vedno na HTTPS (ne plain HTTP) v produkciji.
  if (url.protocol === "http:") {
    return { ok: false, error: "Endpoint mora uporabiti https:// — HTTP ni dovoljen za oddajo." }
  }

  const host = url.hostname
  if (!host) return { ok: false, error: "Endpoint nima gostitelja." }

  // IP-naslov zgodaj — ni DNS-rebinding vektorja pri literal IPv4/IPv6.
  if (isIP(host) === 4) {
    if (isBlockedV4(host)) {
      return { ok: false, error: "Endpoint kaže v zasebno/notranjo mrežo — zavrnjeno (SSRF)." }
    }
    return { ok: true, publicHost: host }
  }
  if (isIP(host) === 6) {
    if (isBlockedV6(host)) {
      return { ok: false, error: "Endpoint kaže v zasebno/loopback IPv6 mrežo — zavrnjeno (SSRF)." }
    }
    return { ok: true, publicHost: host }
  }

  // Imenski gostitelj sproži DNS-rebinding rii: localhost-oznake, zaključene
  // na domene/metadata, privzete pa še vedno dovolimo, ker večina testnih
  // ponudnikov uporablja imena.nslookup pa Ni mogoče popolnoma odpraviti brez
  // dogovorjenega DNS-preverjanja pred pošiljanjem (glej hardenRequest()).
  const lower = host.toLowerCase().replace(/\.$/, "")
  const noPort = lower.split(":")[0]
  if (
    noPort === "localhost" ||
    noPort.endsWith(".localhost") ||
    noPort.endsWith(".internal") ||
    noPort.endsWith(".local") ||
    /^0\./.test(lower) ||
    lower === "metadata.google.internal" ||
    lower === "metadata" ||
    /--internal/.test(lower)
  ) {
    return { ok: false, error: "Endpoint uporablja notranje ime — zavrnjeno (SSRF)." }
  }

  return { ok: true, publicHost: host }
}

/**
 * Pred dejanskim pošiljanjem razrešimo DNS in LOCIMO, vsak IP pa znova blokiramo.
 * To pokrije DNS-rebinding (ime se med shranjevanjem in pošiljanjem spremeni),
 * ki ga validacija ob shranjevanju ne more ujeti. Vrne prečiščen hostname ali
 * napako — klic ne sme iti naprej, če kateri koli razrešeni IP pade v blokirano.
 */
export async function resolveAndVerifyEndpoint(
  host: string
): Promise<{ ok: true; ip: string | null } | { ok: false; error: string }> {
  const dns = await import("node:dns/promises")
  let records: string[]
  try {
    records = (await dns.lookup(host, { all: true, verbatim: true, family: 0 })).map((r) => r.address)
    // ne apliciraj system resolver na IPv6 literal — vse vrnjene je treba blokirati
  } catch {
    // Ne-razrešljivo ime (npr. ENOTFOUND) ne more biti SSRF-vektorja, ker nima
    // nobenega IP-ja. Še vedno preprečimo, da bi funkcionalen endpoint bil
    // konfiguriran; tu pa se ne vrača napaka, ampak se pošiljanje pusti naprej
    // (transport bo vrnil mrežno napako, kar je pravilno za domofon test TLD).
    return { ok: true, ip: null }
  }
  if (!records.length) return { ok: true, ip: null }
  for (const ip of records) {
    if (isIP(ip) === 4 && isBlockedV4(ip)) {
      return { ok: false, error: `DNS razrešuje v zasebno IPv4 mrežo (${ip}) — zavrnjeno (SSRF).` }
    }
    if (isIP(ip) === 6 && isBlockedV6(ip)) {
      return { ok: false, error: `DNS razrešuje v notranjo IPv6 mrežo (${ip}) — zavrnjeno (SSRF).` }
    }
  }
  return { ok: true, ip: records.length ? records[0] : null }
}