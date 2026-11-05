import "server-only"

// ============================================================
// DOMAIN PROVIDER SELECTION (EPIC #3 E3-6 — SERVER-ONLY)
// The provider is chosen by CONFIGURATION, never hardcoded at
// call sites. When nothing is configured, a Null provider answers
// honestly with SETUP_REQUIRED — a domain is never marked
// verified/connected/secure without provider confirmation
// (issue #3 §7 honesty rule: no fake success).
// ============================================================

import { vercelDomainProvider } from "./vercel-domains"
import { getPlatformHostsFromEnv } from "./platform-hosts"
import type { DomainProvider } from "./types"

const NULL_PROVIDER_SETUP_REQUIRED = {
  message:
    "Povezovanje lastnih domen ni konfigurirano na platformi. DNS lahko pripravite, preverjanje pa bo mogoče, ko operater konfigurira ponudnika domen.",
  messageEn:
    "Custom domain connecting is not configured on the platform. You can prepare your DNS; verification becomes possible once the operator configures a domain provider.",
} as const

/**
 * Null provider — every attempt returns SETUP_REQUIRED.
 * Deliberately honest: an unconfigured platform must visibly
 * refuse, never silently "verify" a domain.
 */
const nullProvider: DomainProvider = {
  id: "none",
  isConfigured: () => false,
  async addDomain() {
    return {
      ok: false,
      code: "SETUP_REQUIRED" as const,
      ...NULL_PROVIDER_SETUP_REQUIRED,
    }
  },
  async verifyDomain() {
    return {
      ok: false,
      code: "SETUP_REQUIRED" as const,
      ...NULL_PROVIDER_SETUP_REQUIRED,
    }
  },
  async removeDomain() {
    return {
      ok: false,
      code: "SETUP_REQUIRED" as const,
      ...NULL_PROVIDER_SETUP_REQUIRED,
    }
  },
}

/** The configured domain provider (Vercel or honest null). */
export function getDomainProvider(): DomainProvider {
  return vercelDomainProvider.isConfigured() ? vercelDomainProvider : nullProvider
}

/** Convenience flag for UI/server rendering ("setup required" states). */
export function isDomainsProviderConfigured(): boolean {
  return vercelDomainProvider.isConfigured()
}

/**
 * The platform's own hosts (from env), used by tenant resolution to
 * decide whether a request Host is a custom domain candidate or the
 * platform root. Never throws: blank env simply yields fewer hosts.
 *
 * issue #102 (V-1): the pure implementation lives in the client-safe
 * platform-hosts module so the PROXY (edge) enforces the SAME host
 * rule as the server — the host/header decision can never drift.
 */
export function getPlatformHosts(): string[] {
  return getPlatformHostsFromEnv()
}

export { vercelDomainProvider }
export type {
  AddDomainResult,
  CustomDomainView,
  DomainProvider,
  DnsRecord,
  RemoveDomainResult,
  VerifyDomainResult,
} from "./types"
export { DOMAIN_STATUSES } from "./types"
export type { DomainStatus } from "./types"
