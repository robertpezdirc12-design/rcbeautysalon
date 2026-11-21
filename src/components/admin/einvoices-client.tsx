"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { downloadEinvoice, submitEinvoice, saveEinvoiceChannel, exportEinvoiceArchive } from "@/app/actions/einvoices"

type Row = {
  id: string
  docCode: string
  kindLabel: string
  format: string
  status: string
  validated: boolean
  businessOk: boolean
  xsdApplied: boolean
  peppolApplied: boolean
  standardVersion: string
  size: number
  sha256: string
  createdAt: string
  validationMessages: string | null
}

/** Redakcijirano zstanje kanala (brez polnih poverilnic v klientu). */
type ChannelInfo = {
  channel: string
  label: string
  status: string
  providerEndpoint: string | null
  hasCredentials: boolean
  mode?: string
}

type Labels = {
  empty: string
  emptyHint: string
  docCode: string
  kind: string
  format: string
  status: string
  validation: string
  downloadXml: string
  downloadArchive: string
  sha256: string
  createdAt: string
  sentHint: string
  validated: string
  notValidated: string
  // F5.5.4.6.3 §5
  stageCreated: string
  stageBasic: string
  stageXsd: string
  stageBusiness: string
  stageProfile: string
  stageReady: string
  stageNotVerified: string
  noXsd: string
  noPeppol: string
  xsdPass: string
  peppolPass: string
  xsdFail: string
  peppolFail: string
  // F5.5.4.6.4 — pošiljanje
  send: string
  sendTo: string
  sending: string
  sentState: string
  failedSend: string
  alreadySent: string
  submittedWait: string
  needsChannel: string
  chooseChannel: string
  noChannelConfigured: string
  // F5.5.4.6.4 — kanalska konfiguracija (direct/ujp/peppol)
  channelSetup: string
  channelSetupHint: string
  channelType: string
  channelTypeDirect: string
  channelTypeUjp: string
  channelTypePeppol: string
  channelEndpoint: string
  channelEndpointHint: string
  channelCert: string
  channelKey: string
  channelCa: string
  channelPassphrase: string
  channelConfigMode: string
  channelConfigModeRaw: string
  channelConfigModeJoint: string
  channelSign: string
  channelSignHint: string
  channelInsecure: string
  channelSave: string
  channelSaving: string
  channelSaved: string
  channelSaveFailed: string
  channelEndpointInvalid: string
  channelTypeRequired: string
  channelExisting: string
  channelNone: string
  closeSetup: string
}

function shortHash(h: string): string {
  return h.length > 16 ? h.slice(0, 12) + "…" + h.slice(-8) : h
}

/** Izvede (pošteni) 5-stopenjski status iz shranjenih polj. */
function stages(r: Row, l: Labels): { label: string; ok: boolean | null }[] {
  // 1) XML ustvarjen
  const s: { label: string; ok: boolean | null }[] = [{ label: l.stageCreated, ok: true }]
  // 2) osnovno preverjen (dobro oblikovan + matematika)
  s.push({ label: l.stageBasic, ok: r.businessOk })
  // 3) XSD
  s.push({ label: r.xsdApplied ? l.stageXsd : l.noXsd, ok: r.xsdApplied })
  // 4) poslovno
  s.push({ label: l.stageBusiness, ok: r.businessOk })
  // 5) PEPPOL/e-SLOG profil
  s.push({ label: r.peppolApplied ? l.stageProfile : l.noPeppol, ok: r.peppolApplied })
  return s
}

function validatePill(r: Row, l: Labels): { text: string; cls: string } {
  if (!r.businessOk) return { text: l.notValidated, cls: "bg-amber-500/15 text-amber-600" }
  if (r.peppolApplied && r.xsdApplied && r.validated) {
    return { text: l.stageProfile, cls: "bg-emerald-500/15 text-emerald-600" }
  }
  if (r.xsdApplied && !r.peppolApplied) return { text: l.noPeppol, cls: "bg-amber-500/15 text-amber-600" }
  if (!r.xsdApplied && r.peppolApplied) return { text: l.noXsd, cls: "bg-amber-500/15 text-amber-600" }
  if (!r.xsdApplied && !r.peppolApplied) return { text: l.stageNotVerified, cls: "bg-slate-500/15 text-slate-600" }
  return { text: l.notValidated, cls: "bg-amber-500/15 text-amber-600" }
}

export function EinvoicesClient({
  rows,
  labels,
  channels,
  allChannels = [],
}: {
  rows: Row[]
  labels: Labels
  channels: { id: string; label: string }[]
  allChannels?: ChannelInfo[]
}) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [channel, setChannel] = useState<string>("")
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  // Kanalski setup obrazec
  const [setupOpen, setSetupOpen] = useState(false)
  const [savingChannel, setSavingChannel] = useState(false)
  const [chanType, setChanType] = useState<string>("direct")
  const [chanLabel, setChanLabel] = useState<string>("")
  const [chanEndpoint, setChanEndpoint] = useState<string>("")
  const [chanCert, setChanCert] = useState<string>("")
  const [chanKey, setChanKey] = useState<string>("")
  const [chanCa, setChanCa] = useState<string>("")
  const [chanPass, setChanPass] = useState<string>("")
  const [chanMode, setChanMode] = useState<string>("raw")
  const [chanSign, setChanSign] = useState(true)
  const [chanInsecure, setChanInsecure] = useState(false)
  const [chanBusyMsg, setChanBusyMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const labelForType = (t: string) =>
    t === "ujp"
      ? labels.channelTypeUjp
      : t === "peppol"
        ? labels.channelTypePeppol
        : labels.channelTypeDirect

  const saveChannel = async () => {
    if (!chanType) {
      setChanBusyMsg({ kind: "err", text: labels.channelTypeRequired })
      return
    }
    let endpoint: string | null = chanEndpoint.trim() || null
    if (endpoint && !/^https:\/\//i.test(endpoint)) {
      setChanBusyMsg({ kind: "err", text: labels.channelEndpointInvalid })
      return
    }
    endpoint = endpoint ? endpoint.replace(/\/+$/, "") : null
    setSavingChannel(true)
    setChanBusyMsg(null)
    try {
      const creds: Record<string, string> = {}
      if (chanCert.trim()) creds.cert = chanCert.trim()
      if (chanKey.trim()) creds.key = chanKey.trim()
      if (chanCa.trim()) creds.ca = chanCa.trim()
      if (chanPass) creds.passphrase = chanPass
      const res = await saveEinvoiceChannel({
        channel: chanType,
        label: chanLabel.trim() || labelForType(chanType),
        providerEndpoint: endpoint,
        credentials: creds,
        config: {
          mode: chanType === "ujp" && chanMode === "joint" ? "eslog-joint" : undefined,
          sign: chanType === "ujp" && chanMode === "joint" ? chanSign : undefined,
          insecureSkipVerify: chanInsecure ? true : undefined,
        },
      })
      if (res.ok) {
        setChanBusyMsg({ kind: "ok", text: labels.channelSaved })
        setChanLabel("")
        setChanEndpoint("")
        setChanCert("")
        setChanKey("")
        setChanCa("")
        setChanPass("")
        setChanMode("raw")
        setChanSign(true)
        setChanInsecure(false)
      } else {
        setChanBusyMsg({ kind: "err", text: res.error ?? labels.channelSaveFailed })
      }
    } catch {
      setChanBusyMsg({ kind: "err", text: labels.channelSaveFailed })
    } finally {
      setSavingChannel(false)
      // Po shranjevanju osveži stran (revalidate v action) — dropdown vzame dari page.
      window.location.reload()
    }
  }

  const download = async (row: Row) => {
    setDownloading(row.id)
    try {
      const res = await downloadEinvoice(row.id)
      if (!res) return
      const blob = new Blob([res.xml], { type: "application/xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(null)
    }
  }

  const downloadArchive = async (row: Row) => {
    setDownloading(row.id)
    try {
      const res = await exportEinvoiceArchive(row.id)
      if (!res) return
      const blob = new Blob([res.content], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(null)
    }
  }

  const doSend = async (row: Row) => {
    const ch = channel || channels[0]?.id
    if (!ch) {
      setNotice({ kind: "err", text: labels.needsChannel })
      return
    }
    setSendingId(row.id)
    setNotice(null)
    try {
      const res = await submitEinvoice(row.id, ch)
      if (res.ok) {
        setNotice({ kind: "ok", text: res.alreadySubmitted ? labels.alreadySent : labels.sentState })
        // Po osvežitvi statusa preprosto preberi — revalidatePath na strežniku
        // preobrusi podatke; lokalno status pustimo isti, iz strani jo sproži owner.
        row.status = res.state ?? row.status
        if (res.state === "FAILED") setNotice({ kind: "err", text: res.error ?? labels.failedSend })
        else if (res.state === "DELIVERED") setNotice({ kind: "ok", text: labels.sentState }) // potrjena dostava
        else if (res.state === "SUBMITTED") setNotice({ kind: "ok", text: labels.submittedWait }) // tehnično sprejeto, čaka potrditev
        else setNotice({ kind: "ok", text: labels.sentState })
      } else {
        setNotice({ kind: "err", text: res.error ?? labels.failedSend })
      }
    } catch {
      setNotice({ kind: "err", text: labels.failedSend })
    } finally {
      setSendingId(null)
    }
  }

  // Kanalski setup obrazec (dostopen vedno — tudi ni e-računov).
  const channelSetupSection = (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{labels.channelSetup}</h3>
          <p className="text-xs text-muted-foreground">{labels.channelSetupHint}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSetupOpen((v) => !v)}>
          {setupOpen ? labels.closeSetup : labels.channelSetup}
        </Button>
      </div>

      {setupOpen && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">{labels.channelType}</label>
              <select
                value={chanType}
                onChange={(e) => setChanType(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                aria-label={labels.channelType}
              >
                <option value="direct">{labels.channelTypeDirect}</option>
                <option value="ujp">{labels.channelTypeUjp}</option>
                <option value="peppol">{labels.channelTypePeppol}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">{labels.channelEndpoint}</label>
              <input
                value={chanEndpoint}
                onChange={(e) => setChanEndpoint(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                aria-label={labels.channelEndpoint}
              />
              <p className="mt-0.5 text-[11px] text-muted-foreground">{labels.channelEndpointHint}</p>
            </div>
            {chanType === "ujp" && (
              <div>
                <label className="text-xs font-medium">{labels.channelConfigMode}</label>
                <select
                  value={chanMode}
                  onChange={(e) => setChanMode(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  aria-label={labels.channelConfigMode}
                >
                  <option value="raw">{labels.channelConfigModeRaw}</option>
                  <option value="joint">{labels.channelConfigModeJoint}</option>
                </select>
                {chanMode === "joint" && (
                  <div className="mt-2 space-y-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={chanSign}
                        onChange={(e) => setChanSign(e.target.checked)}
                      />
                      <span className="text-xs font-medium">{labels.channelSign}</span>
                    </label>
                    <p className="text-[11px] text-muted-foreground">{labels.channelSignHint}</p>
                  </div>
                )}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={chanInsecure}
                onChange={(e) => setChanInsecure(e.target.checked)}
              />
              <span className="text-xs">{labels.channelInsecure}</span>
            </label>
          </div>

          {(chanType === "ujp" || chanType === "peppol") ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">{labels.channelCert}</label>
                <textarea
                  value={chanCert}
                  onChange={(e) => setChanCert(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border bg-background px-2 py-1.5 font-mono text-[11px]"
                  aria-label={labels.channelCert}
                />
              </div>
              <div>
                <label className="text-xs font-medium">{labels.channelKey}</label>
                <textarea
                  value={chanKey}
                  onChange={(e) => setChanKey(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border bg-background px-2 py-1.5 font-mono text-[11px]"
                  aria-label={labels.channelKey}
                />
              </div>
              <div>
                <label className="text-xs font-medium">{labels.channelCa}</label>
                <textarea
                  value={chanCa}
                  onChange={(e) => setChanCa(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border bg-background px-2 py-1.5 font-mono text-[11px]"
                  aria-label={labels.channelCa}
                />
              </div>
              <div>
                <label className="text-xs font-medium">{labels.channelPassphrase}</label>
                <input
                  type="password"
                  value={chanPass}
                  onChange={(e) => setChanPass(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  aria-label={labels.channelPassphrase}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-medium">{labels.channelEndpoint}</label>
              <p className="text-xs text-muted-foreground">{labels.channelSetupHint}</p>
            </div>
          )}

          <div className="lg:col-span-2 flex items-center gap-3">
            <Button
              type="button"
              onClick={saveChannel}
              disabled={savingChannel}
            >
              {savingChannel ? labels.channelSaving : labels.channelSave}
            </Button>
            {chanBusyMsg && (
              <span className={`text-xs ${chanBusyMsg.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>
                {chanBusyMsg.text}
              </span>
            )}
          </div>

          <div className="lg:col-span-2">
            <p className="mb-1 text-xs font-medium">{labels.channelExisting}</p>
            {allChannels.length === 0 ? (
              <p className="text-xs text-muted-foreground">{labels.channelNone}</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {allChannels.map((c) => (
                  <li key={c.channel} className="flex items-center gap-2">
                    <span className="font-medium">{c.label}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 ${
                        c.status === "ENABLED"
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-amber-500/15 text-amber-700"
                      }`}
                    >
                      {c.status}
                    </span>
                    <span className="text-muted-foreground">{c.channel}</span>
                    {c.providerEndpoint ? <span className="max-w-[220px] truncate">{c.providerEndpoint}</span> : null}
                    {c.hasCredentials ? <span className="text-emerald-600">✓ cert</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        {channelSetupSection}
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <p className="font-medium">{labels.empty}</p>
          <p className="text-sm">{labels.emptyHint}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4">
      {channelSetupSection}
      {notice ? (
        <div
          className={`px-3 py-2 text-sm ${notice.kind === "ok" ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700"}`}
        >
          {notice.text}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="text-xs text-muted-foreground">{labels.sendTo}:</span>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="rounded border bg-background px-2 py-1 text-sm"
          aria-label={labels.chooseChannel}
        >
          {channels.length === 0 ? <option value="">{labels.needsChannel}</option> : null}
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{labels.docCode}</th>
              <th className="hidden px-3 py-2 sm:table-cell">{labels.kind}</th>
              <th className="hidden px-3 py-2 md:table-cell">{labels.format}</th>
              <th className="px-3 py-2">{labels.status}</th>
              <th className="px-3 py-2">{labels.validation}</th>
              <th className="hidden px-3 py-2 lg:table-cell">{labels.sha256}</th>
              <th className="px-3 py-2 text-right">{labels.downloadXml}</th>
              <th className="px-3 py-2 text-right">{labels.sendTo}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const pill = validatePill(r, labels)
              const st = stages(r, labels)
              const sent = r.status === "SENT" || r.status === "DELIVERED"
  const submittedPending = r.status === "SUBMITTED"
              return (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2 font-mono text-xs">{r.docCode}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">{r.kindLabel}</td>
                  <td className="hidden px-3 py-2 md:table-cell text-xs">{r.format}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${sent ? "bg-emerald-500/15 text-emerald-600" : submittedPending ? "bg-sky-500/15 text-sky-600" : r.status === "FAILED" ? "bg-red-500/15 text-red-600" : r.status === "VALIDATED" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
                      {submittedPending ? labels.submittedWait : r.status}
                    </span>
                    {r.standardVersion ? (
                      <span className="block mt-1 text-[10px] text-muted-foreground">{r.standardVersion}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${pill.cls}`}>{pill.text}</span>
                    {!r.businessOk && r.validationMessages ? (
                      <span className="block mt-1 text-[10px] text-amber-600">{r.validationMessages.slice(0, 70)}…</span>
                    ) : null}
                    <div className="mt-2 space-y-1">
                      {st.map((sg) => (
                        <div key={sg.label} className="flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${sg.ok === true ? "bg-emerald-500" : sg.ok === null ? "bg-slate-300" : "bg-amber-500"}`}
                          />
                          <span className="text-[10px] text-muted-foreground">{sg.label}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-xs text-muted-foreground lg:table-cell" title={r.sha256}>
                    {shortHash(r.sha256)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="outline" disabled={downloading === r.id} onClick={() => download(r)}>
                        {downloading === r.id ? "…" : labels.downloadXml}
                      </Button>
                      <Button size="sm" variant="outline" disabled={downloading === r.id} onClick={() => downloadArchive(r)}>
                        {downloading === r.id ? "…" : labels.downloadArchive}
                      </Button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {sent ? (
                      <span className="text-xs text-emerald-600">{labels.sentState}</span>
                    ) : (
                      <Button size="sm" disabled={sendingId === r.id || channels.length === 0} onClick={() => doSend(r)}>
                        {sendingId === r.id ? labels.sending : labels.send}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}