// ============================================================
// F5.5.4.6.2 — SOLUGA E-RAČUNOV (server akcije).
//
// Generiranje e-računov (INVOICE/ADVANCE prek Document, CREDIT prek
// CreditNote), validacija, NESPREMENLJIV arhiv (SHA-256), prenos in
// POŠILJANJE na ponudnika e-poti (direct HTTP / SaaS posrednik).
// Prejemanje (povratna sporočila UJP/PEPPOL) je nadgrajeno prek
// EInvoiceReceipt in EInvoiceDeliveryEvent.
// ============================================================

"use server"

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"
import { createHash } from "node:crypto"
import { EInvoiceFormat, EInvoiceKind } from "@/lib/einvoice/model"
import { buildEInvoiceModel } from "@/lib/einvoice/exporter"
import { buildUbl21Xml } from "@/lib/einvoice/ubl21"
import { buildEslog20Xml } from "@/lib/einvoice/eslog20"
import { validateEInvoice, EInvoiceValidationResult } from "@/lib/einvoice/validate"
import { validateOfficial } from "@/lib/einvoice/official"
import { encryptSecret, redact } from "@/lib/einvoice/secrets"
import { decryptChannelCredentialsOrg } from "@/lib/einvoice/channel-credentials"
import { formatLabel } from "@/lib/einvoice/format"
import { buildEinvoiceArchive } from "@/lib/einvoice/archive"
import { buildProvider } from "@/lib/einvoice/providers"
import { assertPublicHttpsUrl } from "@/lib/einvoice/endpoint-validation"
import type { SubmitPayload, ChannelCfg, DeliveryState } from "@/lib/einvoice/channel"
import { writeFile, mkdir } from "node:fs/promises"
import * as path from "node:path"

function sha256hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex")
}

const VAL_TMP = path.join(process.cwd(), "docs", "einvoicing", "artifacts", "validator", "tmp")
let tmpSeen = false
async function ensureTmp() {
  if (!tmpSeen) { await mkdir(VAL_TMP, { recursive: true }); tmpSeen = true }
}

export interface GenerateEInvoiceResult {
  ok: boolean
  error?: string
  id?: string
  sha256?: string
  format?: string
  kind?: string
  docCode?: string
  validated?: boolean
  validation?: EInvoiceValidationResult | null
  alreadyExists?: boolean
}

function kindFromDocumentType(type: string, isCredit: boolean): EInvoiceKind {
  if (isCredit) return "CREDIT"
  return type === "ADVANCE" ? "ADVANCE" : "INVOICE"
}

/**
 * Generira e-račun za izdan dokument (INVOICE/ADVANCE) ali dobropis (CreditNote)
 * v izbranem formatu, ga validira in nespremenljivo arhivira. Idempotentna:
 * ponovni klic istega (document, format, kind) vrne obstoječi arhiv (istovetni SHA-256).
 */
export async function generateEinvoice(
  documentId: string,
  format: EInvoiceFormat,
  opts: { isCredit?: boolean } = {}
): Promise<GenerateEInvoiceResult> {
  const { org, session } = await requirePermissionOrg("finances.view")

  const isCredit = opts.isCredit === true
  const doc = await prisma.document.findFirst({
    where: { id: documentId, organizationId: org.id },
    include: { items: { orderBy: { position: "asc" } }, customer: true },
  })
  if (!doc) return { ok: false, error: "NOT_FOUND" }
  if (doc.status === "DRAFT") return { ok: false, error: "NOT_ISSUED" }

  const kind: EInvoiceKind = kindFromDocumentType(doc.type, isCredit)

  let creditNote = null as Prisma.CreditNoteGetPayload<true> | null
  if (isCredit) {
    creditNote = await prisma.creditNote.findFirst({
      where: { organizationId: org.id, invoiceId: doc.id, status: "ISSUED" },
      orderBy: { issuedAt: "desc" },
    })
    if (!creditNote) return { ok: false, error: "CREDIT_NOT_FOUND" }
  }

  // Idempotency: že arhivirano? Vrni obstoječi (nespremenljiv).
  const existing = await prisma.eInvoice.findUnique({
    where: {
      organizationId_documentId_format_kind: { organizationId: org.id, documentId: doc.id, format, kind },
    },
  })
  if (existing) {
    return {
      ok: true,
      alreadyExists: true,
      id: existing.id,
      sha256: existing.sha256,
      format: existing.format,
      kind: existing.kind,
      docCode: existing.docCode,
      validated: existing.xmlValidatedXsd && existing.xmlValidatedBusiness,
    }
  }

  // Nevtralni model + izbrani adapter.
  const { model, warnings } = await buildEInvoiceModel(
    org.id,
    isCredit ? { kind: "CREDIT", document: doc, creditNote: creditNote! } : { kind: doc.type === "ADVANCE" ? "ADVANCE" : "INVOICE", document: doc }
  )
  const xml = format === "ESLOG_2" ? buildEslog20Xml(model) : buildUbl21Xml(model)
  const validation = validateEInvoice(xml, model)
  const allMessages = [...warnings, ...validation.errors, ...validation.warnings]

  // F5.5.4.6.3 — uradna validacija (XSD + PEPPOL/CEN Schematron / e-SLOG) lokalno.
  // Pošteno: NO lažni PASS — kadar Java/artefakti niso dosegljivi → NOT_VERIFIED.
  await ensureTmp()
  const tmpPath = path.join(VAL_TMP, `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.xml`)
  await writeFile(tmpPath, xml, "utf8")
  let official
  try {
    official = await validateOfficial({
      xml,
      xmlPath: tmpPath,
      isCreditNote: kind === "CREDIT",
      standard: format === "ESLOG_2" ? "eSLOG-2.0" : "PEPPOL-BIS-3.0.21",
    })
  } catch {
    official = await setNotVerified()
  }

  // Poslovna + matematična skladnost (vedno localno).
  const businessOk = validation.mathConsistent && validation.businessOk

  // Če poslovna validacija ni uspela, kljub temu arhiviramo (nespremenljiv
  // izhod) vendar z `validated=false` in messages — uporabnik vidi, da XML
  // še ni VALIDADO. Ne blokiramo arhiviranja (shranimo original).
  const archived = await prisma.$transaction(async (tx) => {
    const row = await tx.eInvoice.create({
      data: {
        organizationId: org.id,
        documentId: doc.id,
        kind,
        format,
        docCode: model.docCode,
        xml: Buffer.from(xml, "utf8").toString("base64"),
        sha256: sha256hex(xml),
        size: Buffer.byteLength(xml, "utf8"),
        xmlValidatedXsd: official.status === "VALIDATED" || official.xsdStatus === "PASS",
        xmlValidatedBusiness: businessOk,
        validationMessages: JSON.stringify([...allMessages, ...official.xsdErrors, ...official.peppolErrors]),
        status:
          official.status === "VALIDATED" && businessOk
            ? "VALIDATED"
            : official.status === "NOT_VERIFIED"
              ? "PREPARED"
              : "INVALID",
        standardVersion: official.standard,
        validatorVersion: official.validatorVersion,
        xsdApplied: official.xsdStatus !== "NOT_VERIFIED",
        peppolSchematronApplied: official.peppolStatus !== "NOT_VERIFIED",
        generatedById: session?.user?.id ?? null,
      },
    })
    await tx.eInvoiceDeliveryEvent.create({
      data: {
        organizationId: org.id,
        einvoiceId: row.id,
        kind: "GENERATED",
        message: `E-račun generiran (${formatLabel(format)})`,
        actorUserId: session?.user?.id ?? null,
      },
    })
    await tx.eInvoiceReceipt.create({
      data: {
        organizationId: org.id,
        einvoiceId: row.id,
        kind: "LOCAL_GENERATED",
        status: official.status === "VALIDATED" && businessOk ? "VALID" : official.status === "NOT_VERIFIED" ? "UNVERIFIED" : "INVALID",
        message: allMessages.length ? JSON.stringify(allMessages) : null,
      },
    })
    return row
  })

  revalidatePath("/dashboard/einvoices")
  return {
    ok: true,
    id: archived.id,
    sha256: archived.sha256,
    format: archived.format,
    kind: archived.kind,
    docCode: archived.docCode,
    validated: archived.xmlValidatedXsd && archived.xmlValidatedBusiness,
    validation,
  }
}

/** Pošten fallback, ko uradnega validatorja ni mogoče izvesti. */
async function setNotVerified(): Promise<Awaited<ReturnType<typeof validateOfficial>>> {
  return {
    available: false,
    ok: false,
    standard: "unknown",
    xsdStatus: "NOT_VERIFIED",
    peppolStatus: "NOT_VERIFIED",
    status: "NOT_VERIFIED",
    xsdErrors: ["Uradni validator ni bilo mogoče izvesti."],
    peppolErrors: [],
    cenErrors: [],
    validatorVersion: "none",
  }
}

/** Seznam nespremenljivo arhiviranih e-računov organizacije (za UI). */
export async function listEinvoices() {
  const { org } = await requirePermissionOrg("finances.view")
  const rows = await prisma.eInvoice.findMany({
    where: { organizationId: org.id },
    include: { events: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: { createdAt: "desc" },
  })
  return rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    kind: r.kind,
    format: r.format,
    docCode: r.docCode,
    sha256: r.sha256,
    size: r.size,
    xmlValidatedXsd: r.xmlValidatedXsd,
    xmlValidatedBusiness: r.xmlValidatedBusiness,
    xsdApplied: r.xsdApplied,
    peppolSchematronApplied: r.peppolSchematronApplied,
    standardVersion: r.standardVersion,
    validatorVersion: r.validatorVersion,
    validationMessages: r.validationMessages,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    events: r.events.map((e) => ({ kind: e.kind, message: e.message, createdAt: e.createdAt.toISOString() })),
  }))
}

/** Prenos originalnega XML (org-scoped, IDOR-varano). */
export async function downloadEinvoice(einvoiceId: string): Promise<{ xml: string; sha256: string; filename: string } | null> {
  const { org } = await requirePermissionOrg("finances.view")
  const row = await prisma.eInvoice.findFirst({
    where: { id: einvoiceId, organizationId: org.id },
  })
  if (!row) return null
  const xml = Buffer.from(row.xml, "base64").toString("utf8")
  // Preveri integriteto: SHA-256 mora sovpadati.
  if (sha256hex(xml) !== row.sha256) return null
  return { xml, sha256: row.sha256, filename: `${row.docCode}.${row.kind === "CREDIT" ? "credit" : "invoice"}.xml` }
}

/**
 * F5.5.4.6.6 — izvozi e-račun kot samostojen arhivski paket (.earc),
 * primeren za zakonsko hrambo (FURS e-arhiv, B2B 2027/2028). Vsebuje
 * original XML + manifest (izdajatelj, standard, validacijski statusi) +
 * SHA-256 kontrolno vsoto cele datoteke. Prene dobržuje integriteto shranjenega
 * XML, preden ga zapakira.
 */
export async function exportEinvoiceArchive(
  einvoiceId: string
): Promise<{ filename: string; content: string; sha256: string } | null> {
  const { org } = await requirePermissionOrg("finances.view")
  const row = await prisma.eInvoice.findFirst({
    where: { id: einvoiceId, organizationId: org.id },
  })
  if (!row) return null
  const xml = Buffer.from(row.xml, "base64").toString("utf8")
  // Preveri integriteto shranjenega XML pred pakiranjem.
  if (sha256hex(xml) !== row.sha256) return null

  const file = buildEinvoiceArchive({
    docCode: row.docCode,
    kind: row.kind,
    format: row.format,
    standardVersion: row.standardVersion,
    validatorVersion: row.validatorVersion,
    xmlValidatedXsd: row.xmlValidatedXsd,
    xmlValidatedBusiness: row.xmlValidatedBusiness,
    status: row.status,
    sha256: row.sha256,
    size: row.size,
    issuedAt: null,
    generatedAt: row.createdAt.toISOString(),
    orgName: org.name,
    xml,
  })
  return { filename: file.filename, content: file.content, sha256: file.sha256 }
}

/**
 * F5.5.4.6.4 — shrani (ali posodobi) org-scoped ponudniški kanal. Poverilnice so
 * ŠIFRIRANE (AES-256-GCM); v DB nikoli ne shranimo čistih in jih ne vračamo naprej.
 * #1318: upravljanje kanalov zahteva `einvoices.channels.manage` (ne zgolj
 * `finances.view`), endpoint preverimo SSRF-varne in pri posodobitvi brez
 * ponovno poslanih poverilnic obdržimo obstoječe (ne izbrišemo po nesreči).
 */
export async function saveEinvoiceChannel(input: {
  channel: string
  label: string
  providerEndpoint?: string | null
  credentials?: Record<string, string>
  config?: Record<string, unknown>
}): Promise<{ ok: boolean; id?: string; channel?: string; label?: string; error?: string }> {
  if (!input.channel || !["direct", "ujp", "peppol"].includes(input.channel)) {
    return { ok: false, error: "INVALID_CHANNEL: dovoljeni so direct, ujp ali peppol." }
  }
  if (input.providerEndpoint) {
    // #1318 SSRF-zaščita ob shranjevanju (ne samo regex HTTPS).
    const v = assertPublicHttpsUrl(input.providerEndpoint)
    if (!v.ok) {
      return { ok: false, error: `INVALID_ENDPOINT: ${v.error}` }
    }
  }
  if (input.channel !== "direct" && input.providerEndpoint && !input.credentials) {
    // UJP/PEPPOL brez certifikata lahko shraniš (mTLS pripravi pozneje),
    // ampak brez certifikata pošiljanje ne bo uspelo — opozori prek statusa PENDING.
  }

  const { org } = await requirePermissionOrg("einvoices.channels.manage")

  try {
    // Šifriraj vsako neobčutljivo poverilnico posebej v en JSON payload.
    const secretPayload = input.credentials && Object.keys(input.credentials).length
      ? encryptSecret(JSON.stringify(input.credentials))
      : null

    const config = input.config ?? {}
    // Kanala je pošiljiv (ENABLED) le, ko ima endpoint in (pri UJP/PEPPOL) certifikat.
    const hasEndpoint = Boolean(input.providerEndpoint)
    const hasCert = Boolean(input.credentials && (input.credentials.cert || input.credentials.key))
    const ready = hasEndpoint && (input.channel === "direct" ? true : hasCert)
    const row = await prisma.eInvoiceChannelConfig.upsert({
      where: { organizationId_channel: { organizationId: org.id, channel: input.channel } },
      create: {
        organizationId: org.id,
        channel: input.channel,
        label: input.label,
        status: ready ? "ENABLED" : "PENDING",
        providerEndpoint: input.providerEndpoint ?? null,
        encryptedSecret: secretPayload,
        encryptedKeyRef: input.channel, // ločen ref ključa (identifikator v DB, ne sam secret)
        config: config as Prisma.InputJsonValue,
      },
      update: {
        label: input.label,
        providerEndpoint: input.providerEndpoint ?? null,
        ...(secretPayload ? { encryptedSecret: secretPayload, encryptedKeyRef: input.channel } : {}),
        status: ready ? "ENABLED" : "PENDING",
        config: config as Prisma.InputJsonValue,
      },
    })
    revalidatePath("/dashboard/einvoices")
    return { ok: true, id: row.id, channel: row.channel, label: row.label }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "CHANNEL_SAVE_FAILED" }
  }
}

/** Vrni kanale z redakcijo poverilnic (nikoli poln secret; samo tag za prikaz). */
export async function listEinvoiceChannelsRedacted() {
  const { org } = await requirePermissionOrg("finances.view")
  const rows = await prisma.eInvoiceChannelConfig.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "asc" } })
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    label: r.label,
    status: r.status,
    providerEndpoint: r.providerEndpoint,
    // nikoli polne poverilnice; samo ali je nastavljena
    hasCredentials: Boolean(r.encryptedSecret),
    redactedCredential: r.encryptedSecret ? redact(String(r.encryptedSecret)) : "",
    config: r.config,
    createdAt: r.createdAt.toISOString(),
  }))
}

/** Dešifriranje poverilnic je izključno interna (ne-"use server") servisna funkcija
 *  v src/lib/einvoice/channel-credentials.ts — stranka dešifriranih skrivnosti
 *  NE dobiva; `submitEinvoice` pokliče decryptChannelCredentialsOrg po lastnem
 *  requirePermissionOrg("finances.documents.manage"). (#1318) */

/**
 * F5.5.4.6.4 — POŠLJI NESPREMENLJIVO ARHIVIRAN e-račun na ponudnika e-poti.
 *
 * Bere arhiv iz eInvoice (SHA-256 preverjen), izgradi SubmitPayload, pokliče
 * provider.submit() (direct HTTP, idempotentno prek Idempotency-Key) in zapiše:
 *   • EInvoiceDeliveryEvent — SUBMITTED / DELIVERED / FAILED z opisom
 *   • EInvoiceReceipt       — DELIVERY_ACK ob 2xx, sicer FAILURE
 *
 * Pošiljanje zahteva `finances.documents.manage` (močnejša od branja) in kanal
 * z nastavljeno `providerEndpoint`. Ponovni poskus istega e-računa je
 * IDEMPOTENTEN — vrača obstoječe stanje brez novega omrežnega klica.
 */
export async function submitEinvoice(einvoiceId: string, channel: string): Promise<{
  ok: boolean
  error?: string
  state?: string
  alreadySubmitted?: boolean
}> {
  const { org, session } = await requirePermissionOrg("finances.documents.manage")

  const row = await prisma.eInvoice.findFirst({
    where: { id: einvoiceId, organizationId: org.id },
    include: { document: true },
  })
  if (!row) return { ok: false, error: "E-račun ne obstaja." }

  // Idempotenca: že poslan (karkoli po tehničnem sprejemu) → vrni obstoječe,
  // brez novega klica. SUBMITTED = tehnično sprejeto (2xx), še ne vsebinsko
  // potrjeno; DELIVERED = telematsko potrjeno. Nobeno od teh se ne posilja 2×.
  if (row.status === "DELIVERED" || row.status === "SENT" || row.status === "SUBMITTED") {
    return { ok: true, state: row.status, alreadySubmitted: true }
  }

  // Nespremenljivost: preverimo SHA-256 arhivirane vsebine.
  const xml = Buffer.from(row.xml, "base64").toString("utf8")
  if (sha256hex(xml) !== row.sha256) {
    return { ok: false, error: "Arhiv je poškodovan (SHA-256 neskladje)." }
  }

  // Naslov prejemnika (elektronska točka kupca) pride iz živega Customer,
  // vezanega na izvorni dokument — OLJP/PEPPOL naslavljajo po EAS + ID.
  let recipientId: string | undefined
  if (row.document?.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: row.document.customerId, organizationId: org.id },
    })
    recipientId = customer?.electronicId ?? undefined
  }

  const provider = buildProvider(channel)
  const credentials = await decryptChannelCredentialsOrg(org.id, channel)
  const payload: SubmitPayload = {
    einvoiceId: row.id,
    organizationId: org.id,
    docCode: row.docCode,
    format: row.format,
    xml,
    xmlSha256: row.sha256,
    recipientId,
  }
  const channelCfg = await prisma.eInvoiceChannelConfig.findFirst({
    where: { organizationId: org.id, channel },
  })
  const submitCfg: ChannelCfg = {
    id: channelCfg?.id ?? channel,
    organizationId: org.id,
    channel,
    providerEndpoint: channelCfg?.providerEndpoint ?? null,
    credentials: credentials ?? {},
    config: (channelCfg?.config as Record<string, unknown>) ?? {},
  }

  const result = await provider.submit(org.id, submitCfg, payload)

  // #1318-F5.5.4.6.4: NE združujemo tehničnega sprejema s potrditvijo dostave.
  //   SUBMITTED (2xx, technicalOnly) → status SUBMITTED — še NI dostavljeno.
  //   DELIVERED  → status DELIVERED + receipt kind DELIVERY_ACK (pravo potrdilo,
  //                pride z webhooka/pollinga oz. neposredno iz testnega stuba).
  //   REJECTED   → status REJECTED + receipt kind REJECTION (vsebinska zavrnitev).
  //   kar koli drugega → FAILED (tehnična/neprocesirana napaka).
  const mapState = (d: DeliveryState): "SUBMITTED" | "DELIVERED" | "REJECTED" | "FAILED" => {
    if (d === "SUBMITTED") return "SUBMITTED"
    if (d === "DELIVERED") return "DELIVERED"
    if (d === "REJECTED") return "REJECTED"
    return "FAILED"
  }
  const state = mapState(result.state)
  const receiptKind =
    state === "DELIVERED" ? "DELIVERY_ACK" : state === "REJECTED" ? "REJECTION" : state === "SUBMITTED" ? "SUBMITTED" : "FAILURE"

  await prisma.$transaction(async (tx) => {
    await tx.eInvoice.update({ where: { id: row.id }, data: { status: state } })
    await tx.eInvoiceDeliveryEvent.create({
      data: {
        organizationId: org.id,
        einvoiceId: row.id,
        kind: state === "FAILED" ? "FAILED" : state === "DELIVERED" ? "DELIVERED" : state === "REJECTED" ? "REJECTED" : "SUBMITTED",
        message: state === "SUBMITTED"
          ? `E-račun tehnično posredovan prek '${channel}' (${provider.label}) — čaka na potrditev dostave. Provider: ${result.providerMessageId ?? "?"}`
          : result.errors.length > 0
            ? `Pošiljanje prek '${channel}': ${result.errors.join("; ")}`
            : result.providerMessageId
              ? `E-račun poslan prek '${channel}' (${provider.label}). Provider: ${result.providerMessageId}`
              : `E-račun poslan prek '${channel}' (${provider.label}).`,
        actorUserId: session?.user?.id ?? null,
      },
    })
    await tx.eInvoiceReceipt.create({
      data: {
        organizationId: org.id,
        einvoiceId: row.id,
        kind: receiptKind,
        status: state,
        message: result.errors.length ? result.errors.join("; ") : null,
        data: result.providerMessageId ? Buffer.from(result.providerMessageId).toString("base64") : null,
        sha256: result.providerMessageId ? sha256hex(result.providerMessageId) : null,
      },
    })
  })

  revalidatePath("/dashboard/einvoices")
  if (state === "FAILED") {
    return { ok: false, error: result.errors.join("; ") || "Pošiljanje ni uspelo." }
  }
  return { ok: true, state }
}