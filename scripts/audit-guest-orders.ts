import { PrismaClient } from "@prisma/client"

/**
 * P2 #70 — ENKRATNI reviziji podatkov o identiteti gostov.
 *
 * Išče naročila, kjer je identitetno mešanje že lahko nastalo:
 *   - naročilo ima gostova polja (guestEmail) IN povezano stranko
 *     (customerId), pri čemer se e-pošti RAZLIKUJETA — to je obnašanje
 *     starega telefonskega OR-zadetka (product-checkout.ts pred #70):
 *     prikazani kontakt ni tisti, ki ga je kupec vnesel.
 *
 * Revizija NE popravlja podatkov — pove, katere vrstice je treba
 * ročno pregledati, preden trgovina gre k pravemu najemniku (po
 * prijavi #70: novi telefonski zadetki identitete več ne prevzemajo).
 *
 * Uporaba:
 *   DATABASE_URL="postgresql://..." bun scripts/audit-guest-orders.ts
 */

const prisma = new PrismaClient()

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      guestEmail: { not: null },
      customerId: { not: null },
    },
    select: {
      id: true,
      organizationId: true,
      guestName: true,
      guestEmail: true,
      guestPhone: true,
      createdAt: true,
      customer: { select: { name: true, email: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const mismatched = orders.filter((o) => {
    const g = (o.guestEmail ?? "").trim().toLowerCase()
    const c = (o.customer?.email ?? "").trim().toLowerCase()
    return g !== c
  })

  console.log(`Naročil z gostovimi polji + povezano stranko: ${orders.length}`)
  console.log(`Med njimi z RAZLIČNO e-pošto (kandidati za mešanje): ${mismatched.length}`)

  if (mismatched.length === 0) {
    console.log("✓ Ni dokazov o identitetnem mešanju — podatki so čisti.")
    return
  }

  const orgIds = [...new Set(mismatched.map((o) => o.organizationId))]
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds.filter(Boolean) as string[] } },
    select: { id: true, slug: true, name: true },
  })
  const slugOf = new Map(orgs.map((o) => [o.id, o.slug]))

  console.log("\n— Kandidati za ročni pregled —")
  for (const o of mismatched) {
    console.log(
      [
        `\n${o.id}`,
        `  najemnik : ${slugOf.get(o.organizationId ?? "") ?? o.organizationId}`,
        `  ustvarjeno: ${o.createdAt.toISOString()}`,
        `  kupec vnesel : ${o.guestName} <${o.guestEmail}> ${o.guestPhone ?? ""}`,
        `  zapis stranke: ${o.customer?.name ?? "?"} <${o.customer?.email ?? "?"}> ${o.customer?.phone ?? ""}`,
      ].join("\n")
    )
  }
  console.log(
    "\nPriporočilo: vsako vrstico pregledaj z lastnikom — naročilo kaže\n" +
      "kontakt, ki ga kupec ni vnesel. Po #70 novih primerov ne nastaja\n" +
      "(telefon sam ne prevzame identitete; prikaz je gost-prvi)."
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
