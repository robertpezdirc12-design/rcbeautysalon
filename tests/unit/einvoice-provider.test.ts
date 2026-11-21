// ============================================================
// F5.5.4.6.4 — enotni testi POŠTNO/oddajni sloj (providers.ts).
//
// Dokazuje: DirectHttpProvider 2xx → SUBMITTED (tehnično sprejeto),
// 5xx → retry (do MAX_RETRIES) → FAILED, 4xx → brez retry → FAILED,
// brez providerEndpoint → FAILED, UnconfiguredProvider → FAILED ter
// buildProvider preslikave. Uporabimo vi.stubGlobal za deterministic fetch.
// Brez baze — čista TS.
// ============================================================

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import {
  DirectHttpProvider,
  UnconfiguredProvider,
  CertHttpProvider,
  buildProvider,
  buildHttpsRequestOptions,
  eSlogJointWrapper,
} from "@/lib/einvoice/providers"
import { MAX_RETRIES } from "@/lib/einvoice/channel"
import type { ChannelCfg, SubmitPayload } from "@/lib/einvoice/channel"
import type { HttpsTransport } from "@/lib/einvoice/providers"

const ORG = "org-1"
const cfg: ChannelCfg = {
  id: "cfg-1",
  organizationId: ORG,
  channel: "direct",
  providerEndpoint: "https://provider.example/invoice",
  credentials: { apiKey: "secret" },
  config: {},
}
const payload: SubmitPayload = {
  einvoiceId: "e-inv-1",
  organizationId: ORG,
  docCode: "RAC-1",
  format: "UBL21_PEPPOL_3",
  xml: "<Invoice/>",
  xmlSha256: "a".repeat(64),
  recipientId: "0088:SI12345678",
}

function mockFetch(status: number, headers?: Record<string, string>) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status, headers }) as Response))
}

beforeEach(() => vi.restoreAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe("F5.5.4.6.4 — DirectHttpProvider", () => {
  it("2xx → accepted, SUBMITTED, s providerMessageId iz glave", async () => {
    mockFetch(201, { "x-provider-message-id": "msg-42" })
    const p = new DirectHttpProvider()
    const r = await p.submit(ORG, cfg, payload)
    expect(r.accepted).toBe(true)
    expect(r.state).toBe("SUBMITTED")
    expect(r.providerMessageId).toBe("msg-42")
    expect(r.errors).toEqual([])
  })

  it("pošlje XML kot POST na providerEndpoint z idempotency in integritetnimi glavami", async () => {
    const fn = vi.fn<typeof fetch>(async () => new Response("ok", { status: 200 }))
    vi.stubGlobal("fetch", fn)
    const p = new DirectHttpProvider()
    await p.submit(ORG, cfg, payload)
    expect(fn).toHaveBeenCalledTimes(1)
    const [url, init] = fn.mock.calls[0]
    const reqInit = (init ?? {}) as RequestInit
    expect(url).toBe(cfg.providerEndpoint)
    expect(reqInit.method).toBe("POST")
    expect((reqInit.headers as Record<string, string>)["Idempotency-Key"]).toBe("e-inv-1")
    expect((reqInit.headers as Record<string, string>)["X-EInvoice-Sha256"]).toBe(payload.xmlSha256)
    expect(reqInit.body).toBe("<Invoice/>")
  })

  it("5xx → poskusi retry do MAX_RETRIES, nazadnje FAILED", async () => {
    const fn = vi.fn(async () => new Response("boom", { status: 503 }))
    vi.stubGlobal("fetch", fn)
    const p = new DirectHttpProvider()
    const r = await p.submit(ORG, cfg, payload)
    expect(r.accepted).toBe(false)
    expect(r.state).toBe("FAILED")
    // 3 poskusi: 1 + (MAX_RETRIES-1) retry
    expect(fn).toHaveBeenCalledTimes(MAX_RETRIES)
    expect(r.errors.length).toBeGreaterThan(0)
  })

  it("4xx → brez retryja, takoj FAILED", async () => {
    const fn = vi.fn(async () => new Response("bad request", { status: 400 }))
    vi.stubGlobal("fetch", fn)
    const p = new DirectHttpProvider()
    const r = await p.submit(ORG, cfg, payload)
    expect(r.state).toBe("FAILED")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("prevara mreže → FAILED (retry vključeno)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET") }))
    const p = new DirectHttpProvider()
    const r = await p.submit(ORG, cfg, payload)
    expect(r.state).toBe("FAILED")
    expect(r.accepted).toBe(false)
  })

  it("brez providerEndpoint → FAILED, brez omrežnega klica", async () => {
    const fn = vi.fn()
    vi.stubGlobal("fetch", fn)
    const p = new DirectHttpProvider()
    const r = await p.submit(ORG, { ...cfg, providerEndpoint: null as unknown as string }, payload)
    expect(r.state).toBe("FAILED")
    expect(r.errors[0]).toContain("CHANNEL_NOT_READY")
    expect(fn).not.toHaveBeenCalled()
  })
})

describe("F5.5.4.6.4 — UnconfiguredProvider + buildProvider", () => {
  it("UnconfiguredProvider vedno FAILED s opisom (ne pošlje omrežja)", async () => {
    const p = new UnconfiguredProvider()
    const r = await p.submit(ORG, cfg, payload)
    expect(r.state).toBe("FAILED")
    expect(r.errors[0]).toContain("CHANNEL_UNCONFIGURED")
  })

  it("buildProvider('direct') → DirectHttpProvider; ujp/peppol → CertHttpProvider; neznani → Unconfigured", () => {
    expect(buildProvider("direct")).toBeInstanceOf(DirectHttpProvider)
    expect(buildProvider("ujp")).toBeInstanceOf(CertHttpProvider)
    expect(buildProvider("peppol")).toBeInstanceOf(CertHttpProvider)
    expect(buildProvider("karkoli")).toBeInstanceOf(UnconfiguredProvider)
  })
})

describe("F5.5.4.6.4 — CertHttpProvider (UJP/PEPPOL mTLS)", () => {
  const certCfg: ChannelCfg = {
    id: "cfg-ujp",
    organizationId: ORG,
    channel: "ujp",
    providerEndpoint: "https://ujp-ppap.example/dostava",
    credentials: { cert: "PEM-CERT", key: "PEM-KEY", ca: "PEM-CA", passphrase: "s3cret" },
    config: {},
  }

  it("buildHttpsRequestOptions prenese cert/key/ca/passphrase in rejectUnauthorized", () => {
    const opts = buildHttpsRequestOptions(certCfg, { "Content-Type": "application/xml" })
    expect(opts.method).toBe("POST")
    expect(opts.cert).toBe("PEM-CERT")
    expect(opts.key).toBe("PEM-KEY")
    expect(opts.ca).toBe("PEM-CA")
    expect(opts.passphrase).toBe("s3cret")
    expect(opts.rejectUnauthorized).toBe(true)
    expect(opts.hostname).toBe("ujp-ppap.example")
  })

  it("insecureSkipVerify je ignoriran — rejectUnauthorized ostane TRUE (preverjanje cert vedno vklopljeno)", () => {
    // Faza 1.3 (#1318): nekdanji `insecureSkipVerify` preklop je bil umaknjen.
    // Tudi če config vsebuje insecureSkipVerify, preverjanje certifikata ne sme
    // biti izklopljeno — produkcija nikoli ne sme imeti mTLS brez verifikacije.
    const opts = buildHttpsRequestOptions(
      { ...certCfg, config: { insecureSkipVerify: true } },
      {}
    )
    expect(opts.rejectUnauthorized).toBe(true)
  })

  it("eSlogJointWrapper ovije UBL XML v vd:JointDokument", () => {
    const wrapped = eSlogJointWrapper("<Invoice/>")
    expect(wrapped).toContain("vd:JointDokument")
    expect(wrapped).toContain("vd:Vsebina")
    expect(wrapped).toContain("<Invoice/>")
  })

  it("ujp + mode eslog-joint pošlje ovojnico", async () => {
    const sent: string[] = []
    const transport: HttpsTransport = async (_opts, xml) => {
      sent.push(xml)
      return { status: 202, headers: { "x-provider-message-id": "ujp-1" }, body: "accepted" }
    }
    const ujp = new CertHttpProvider("UJP", { transport })
    await ujp.submit(ORG, { ...certCfg, config: { mode: "eslog-joint" } }, payload)
    expect(sent[0]).toContain("vd:JointDokument")
    expect(sent[0]).toContain("<Invoice/>")
  })

  it("peppol pošlje AS4 multipart/related z dokumentom (ne golega XML)", async () => {
    const peppolSent: { opts: { headers: unknown }; body: string }[] = []
    const pepTransport: HttpsTransport = async (opts, xml) => {
      peppolSent.push({ opts: opts as { headers: unknown }, body: xml })
      return { status: 202, headers: {}, body: "" }
    }
    const pep = new CertHttpProvider("PEPPOL_AP", { transport: pepTransport })
    await pep.submit(ORG, { ...certCfg, channel: "peppol" }, payload)
    const { opts, body: raw } = peppolSent[0]
    // Content-Type zahtevka je multipart/related z boundary, ne application/xml.
    expect((opts.headers as { "Content-Type": string })["Content-Type"]).toMatch(/^multipart\/related/)
    // PEPPOL kanala NE sme več poslati golega XML — pošlje AS4 multipart/related.
    expect(raw).not.toBe("<Invoice/>")
    expect(raw).toContain("Content-Type: application/soap+xml")
    expect(raw).toContain("eb:UserMessage")
    expect(raw).toContain("Content-ID: <sbh>")
    expect(raw).toContain("Content-ID: <payload>")
    // Dokument je vključen kot zadnja MIME priloga (cid:payload).
    expect(raw).toContain("<Invoice/>")
  })

  it("2xx → accepted SUBMITTED (tehnično), providerMessageId iz glave", async () => {
    const transport: HttpsTransport = async () => ({
      status: 202,
      headers: { "x-provider-message-id": "ap-99" },
      body: "accepted",
    })
    const p = new CertHttpProvider("PEPPOL_AP", { transport })
    const r = await p.submit(ORG, certCfg, payload)
    expect(r.accepted).toBe(true)
    expect(r.state).toBe("SUBMITTED")
    expect(r.providerMessageId).toBe("ap-99")
  })

  it("4xx → FAILED brez retryja (en klic)", async () => {
    const fn = vi.fn<HttpsTransport>(async () => ({ status: 403, headers: {}, body: "denied" }))
    const p = new CertHttpProvider("UJP", { transport: fn })
    const r = await p.submit(ORG, certCfg, payload)
    expect(r.state).toBe("FAILED")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("5xx → retry do MAX_RETRIES, nazadnje FAILED", async () => {
    const fn = vi.fn<HttpsTransport>(async () => ({ status: 503, headers: {}, body: "busy" }))
    const p = new CertHttpProvider("UJP", { transport: fn })
    const r = await p.submit(ORG, certCfg, payload)
    expect(r.state).toBe("FAILED")
    expect(fn).toHaveBeenCalledTimes(MAX_RETRIES)
  })

  it("mrežna napaka → FAILED (retry vključeno)", async () => {
    const fn = vi.fn<HttpsTransport>(async () => {
      throw new Error("UNABLE_TO_VERIFY_LEAF_SIGNATURE")
    })
    const p = new CertHttpProvider("PEPPOL_AP", { transport: fn })
    const r = await p.submit(ORG, certCfg, payload)
    expect(r.state).toBe("FAILED")
    expect(fn).toHaveBeenCalledTimes(MAX_RETRIES)
  })

  it("brez providerEndpoint → FAILED, brez transportnega klica", async () => {
    const fn = vi.fn<HttpsTransport>()
    const p = new CertHttpProvider("UJP", { transport: fn })
    const r = await p.submit(ORG, { ...certCfg, providerEndpoint: null as unknown as string }, payload)
    expect(r.state).toBe("FAILED")
    expect(r.errors[0]).toContain("CHANNEL_NOT_READY")
    expect(fn).not.toHaveBeenCalled()
  })
})