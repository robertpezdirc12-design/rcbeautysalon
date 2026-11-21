// ============================================================
// VARNOSTNI SERVIS: dešifriranje e-računskih poverilnic (#1318)
//
// NAMEN: dešifriranje poverilnic za interni strežniški postopek oddaje
// (submitEinvoice) NIKOLI ni izvožena kot javno dostopna "use server" akcija.
// Ta modul je OBIČAJEN strežniški modul (brez direktive "use server"), zato
// ga odjemalec ne more klicati neposredno in ne vrača dešifriranih skrivnosti
// kot odgovor stranki.
// Deklarativna zaščita: preverjanje org-scopea opravi klicatelj
// (submitEinvoice prek requirePermissionOrg), destinacija ni nikoli odjemalec.
// ============================================================

import { prisma } from "@/lib/prisma"
import { decryptSecret } from "./secrets"

/**
 * Notranja pomoč: preberi in dešifriraj poverilnice kanala znotraj ENE org.
 * NI namenjena odjemalcu in NI izvožena prek "use server". Klicatelj je
 * odgovoren za predhodno preverjanje članstva/pravic (requirePermissionOrg).
 *
 * @returns dešifriran objekt poverilnic ali `null`, če kanala ni / ni skrivnosti.
 */
export async function decryptChannelCredentialsOrg(
  organizationId: string,
  channel: string
): Promise<Record<string, string> | null> {
  const row = await prisma.eInvoiceChannelConfig.findFirst({
    where: { organizationId, channel },
    select: { encryptedSecret: true },
  })
  const dec = decryptSecret(row?.encryptedSecret ?? null)
  if (!dec) return null
  try {
    const parsed = JSON.parse(dec)
    return typeof parsed === "object" && parsed !== null ? parsed : null
  } catch {
    return null
  }
}