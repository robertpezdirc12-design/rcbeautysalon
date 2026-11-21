// ============================================================
// ONBOARDING SEEDING — INTERNI SERVIS (NI "use server" akcija, #1318)
//
// `seedNewOrgModuleStates` je bila izvožena iz "use server" modula brez
// lastnega preverjanja identitete/članstva/pravic in je sprejemala
// `organizationId` kot parameter — potencialno klicljiva s strani katerega
// koli strežniškega vmesnika, da bi posegala v stanje modulov katere koli
// organizacije.
//
// Sem je prestavljena kot OBIČAJNA strežniška funkcija (brez "use server").
// Odjemalec je ne more klicati neposredno. Kliče jo izključno varni
// onboarding tok (src/app/actions/onboarding.ts) v svoji transakciji.
// ============================================================

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { baseCapabilitiesOf } from "./activation"
import { buildSeedRows } from "./activation"
import type { ModuleState } from "./catalog"

/**
 * Za novo organizacijo zapiše začetna stanja modulov po TOČNO določeni
 * politiki (buildSeedRows) — required=ACTIVE, optional=DEACTIVATED (opt-in).
 * Idempotentno: `skipDuplicates` prepreči podvajanje ob ponovitvi postopka.
 * Klicev se ne sme izvesti zunaj varnega onboarding transakcijskega toka.
 */
export async function seedNewOrgModuleStates(
  organizationId: string,
  vertical: string | null,
  secondaryVertical?: string | null,
  profileOverrides?: unknown,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const base = baseCapabilitiesOf({
    vertical,
    secondaryVertical,
    profileOverrides,
  })
  const rows = buildSeedRows(base).map(
    (r: { moduleId: string; state: ModuleState }) => ({
      organizationId,
      moduleId: r.moduleId,
      state: r.state,
    })
  )
  if (rows.length > 0) {
    const client = tx ?? prisma
    await client.organizationModuleState.createMany({
      data: rows,
      skipDuplicates: true,
    })
  }
}