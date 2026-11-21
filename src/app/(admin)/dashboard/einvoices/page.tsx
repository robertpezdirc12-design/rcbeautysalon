import { Card, CardContent } from "@/components/ui/card"
import { requirePagePermission } from "@/lib/auth/guards"
import { getServerI18n } from "@/lib/i18n/server"
import { listEinvoices, listEinvoiceChannelsRedacted } from "@/app/actions/einvoices"
import { formatLabel } from "@/lib/einvoice/format"
import { EinvoicesClient } from "@/components/admin/einvoices-client"

export const metadata = { title: "Elektronski računi" }

export default async function EinvoicesPage() {
  await requirePagePermission("finances.view")
  const [{ t }, rows, channels] = await Promise.all([
    getServerI18n(),
    listEinvoices(),
    listEinvoiceChannelsRedacted(),
  ])
  const d = t.einvoices

  // Za pošiljanje ponudimo SAMO kanale z nastavljeno potjo in omogočene.
  const sendableChannels = channels
    .filter((c) => c.status === "ENABLED" && Boolean(c.providerEndpoint))
    .map((c) => ({ id: c.channel, label: c.label || c.channel }))

  // Za kanalski setup prikažemo vse shranjene kanale (redakcijirano).
  const allChannels = channels.map((c) => ({
    channel: c.channel,
    label: c.label || c.channel,
    status: c.status,
    providerEndpoint: c.providerEndpoint,
    hasCredentials: c.hasCredentials,
    mode: (c.config as { mode?: string } | null)?.mode,
  }))

  const kindLabel = (k: string) =>
    k === "ADVANCE" ? d.kindAdvance : k === "CREDIT" ? d.kindCredit : d.kindInvoice

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{d.title}</h1>
        <p className="text-muted-foreground">{d.subtitle}</p>
      </div>

      <EinvoicesClient
        channels={sendableChannels}
        allChannels={allChannels}
        rows={rows.map((r) => ({
          id: r.id,
          docCode: r.docCode,
          kindLabel: kindLabel(r.kind),
          format: formatLabel(r.format),
          status: r.status,
          validated: r.xmlValidatedXsd && r.xmlValidatedBusiness,
          businessOk: r.xmlValidatedBusiness,
          xsdApplied: r.xsdApplied,
          peppolApplied: r.peppolSchematronApplied,
          standardVersion: r.standardVersion,
          size: r.size,
          sha256: r.sha256,
          createdAt: r.createdAt,
          validationMessages: r.validationMessages ?? null,
        }))}
        labels={{
          empty: d.empty,
          emptyHint: d.emptyHint,
          docCode: d.docCode,
          kind: d.kind,
          format: d.format,
          status: d.status,
          validation: d.validation,
          downloadXml: d.downloadXml,
          downloadArchive: d.downloadArchive,
          sha256: d.sha256,
          createdAt: d.createdAt,
          sentHint: d.sentHint,
          validated: d.validated,
          notValidated: d.notValidated,
          stageCreated: d.stageCreated,
          stageBasic: d.stageBasic,
          stageXsd: d.stageXsd,
          stageBusiness: d.stageBusiness,
          stageProfile: d.stageProfile,
          stageReady: d.stageReady,
          stageNotVerified: d.stageNotVerified,
          noXsd: d.noXsd,
          noPeppol: d.noPeppol,
          xsdPass: d.xsdPass,
          peppolPass: d.peppolPass,
          xsdFail: d.xsdFail,
          peppolFail: d.peppolFail,
          send: d.send,
          sendTo: d.sendTo,
          sending: d.sending,
          sentState: d.sentState,
          failedSend: d.failedSend,
          alreadySent: d.alreadySent,
          submittedWait: d.submittedWait,
          needsChannel: d.needsChannel,
          chooseChannel: d.chooseChannel,
          noChannelConfigured: d.noChannelConfigured,
          channelSetup: d.channelSetup,
          channelSetupHint: d.channelSetupHint,
          channelType: d.channelType,
          channelTypeDirect: d.channelTypeDirect,
          channelTypeUjp: d.channelTypeUjp,
          channelTypePeppol: d.channelTypePeppol,
          channelEndpoint: d.channelEndpoint,
          channelEndpointHint: d.channelEndpointHint,
          channelCert: d.channelCert,
          channelKey: d.channelKey,
          channelCa: d.channelCa,
          channelPassphrase: d.channelPassphrase,
          channelConfigMode: d.channelConfigMode,
          channelConfigModeRaw: d.channelConfigModeRaw,
          channelConfigModeJoint: d.channelConfigModeJoint,
          channelSign: d.channelSign,
          channelSignHint: d.channelSignHint,
          channelInsecure: d.channelInsecure,
          channelSave: d.channelSave,
          channelSaving: d.channelSaving,
          channelSaved: d.channelSaved,
          channelSaveFailed: d.channelSaveFailed,
          channelEndpointInvalid: d.channelEndpointInvalid,
          channelTypeRequired: d.channelTypeRequired,
          channelExisting: d.channelExisting,
          channelNone: d.channelNone,
          closeSetup: d.closeSetup,
        }}
      />
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{d.sentHint}</p>
        </CardContent>
      </Card>
    </div>
  )
}