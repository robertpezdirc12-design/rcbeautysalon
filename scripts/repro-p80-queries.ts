// #80 — lokalna reprodukcija produkcijskih poizvedb (poišče, katera meče).
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // minimalni seed
  const org = await prisma.organization.create({
    data: {
      slug: "qa-servis-test",
      name: "QA Servis Test",
      status: "ACTIVE",
      publishState: "PUBLISHED",
    },
  }).catch(() => prisma.organization.findFirst({ where: { slug: "qa-servis-test" } }))!

  const product = await prisma.product.create({
    data: {
      name: "Test izdelek",
      price: 15,
      organizationId: org!.id,
      barcode: "3838900000001",
      brand: "Test",
      unit: "kos",
      vatRate: 22,
      forSale: true,
      reorderPoint: 3,
      stockQuantity: 5,
    },
  }).catch(async () => {
    const p = await prisma.product.findFirst({ where: { organizationId: org!.id } })
    return p!
  })

  await prisma.salonConfig.upsert({
    where: { organizationId: org!.id },
    create: { organizationId: org!.id, defaultReorderPoint: 10 },
    update: {},
  })

  const pkg = await prisma.prepaidProduct.create({
    data: {
      organizationId: org!.id,
      kind: "GIFT_CARD",
      name: "Bon 50 €",
      price: 50,
      faceValue: 50,
    },
  }).catch(() => null)

  const purchase = await prisma.prepaidPurchase.create({
    data: {
      organizationId: org!.id,
      prepaidProductId: pkg!.id,
      code: "RC-TEST-TEST",
      status: "ACTIVE",
      balance: 50,
    },
  }).catch(() => null)

  console.log("seed ok:", { org: org!.id, product: product.id, purchase: purchase?.code })

  // --- ZDaj reprodukcija poizvedb po straneh ---

  console.log("\n== getAdminProducts (products page) ==")
  const rows = await prisma.product.findMany({
    where: { organizationId: org!.id },
    include: {
      category: { select: { name: true } },
      _count: { select: { orderItems: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    skip: 0,
  })
  console.log("rows:", rows.map((r) => ({
    vatRate: r.vatRate ? r.vatRate.toNumber() : null,
    forSale: r.forSale,
    barcode: r.barcode,
  })))

  console.log("\n== getProductStats ==")
  const trackedRows = await prisma.product.findMany({
    where: { organizationId: org!.id, stockQuantity: { gt: 0 } },
    select: { stockQuantity: true, reorderPoint: true },
  })
  const config = await prisma.salonConfig.findUnique({
    where: { organizationId: org!.id },
    select: { defaultReorderPoint: true },
  })
  console.log("trackedRows:", trackedRows.length, "defaultReorderPoint:", config?.defaultReorderPoint)

  console.log("\n== stocktake page query ==")
  const st = await prisma.product.findMany({
    where: { organizationId: org!.id, trackInventory: true, isActive: true },
    select: { id: true, name: true, sku: true, unit: true, stockQuantity: true },
    orderBy: { name: "asc" },
    take: 500,
  })
  console.log("stocktake rows:", st.length, st.map((r) => r.unit))

  console.log("\n== getPackagesOverview (prepaidProduct) ==")
  const packages = await prisma.prepaidProduct.findMany({
    where: { organizationId: org!.id },
    include: {
      items: {
        include: {
          service: { select: { name: true, price: true } },
          product: { select: { name: true, price: true } },
        },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })
  console.log("packages:", packages.map((p) => ({ kind: p.kind, faceValue: p.faceValue?.toNumber() })))

  console.log("\n== getPrepaidLiability ==")
  const giftCards = await prisma.prepaidPurchase.findMany({
    where: {
      organizationId: org!.id,
      status: "ACTIVE",
      prepaidProduct: { kind: "GIFT_CARD" },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { balance: true },
  })
  console.log("giftCards:", giftCards.length)

  console.log("\n== listPrepaidPurchases ==")
  const purchases = await prisma.prepaidPurchase.findMany({
    where: { organizationId: org!.id },
    include: {
      prepaidProduct: { select: { name: true, kind: true } },
      customer: { select: { name: true, email: true } },
    },
    orderBy: { purchasedAt: "desc" },
    take: 50,
  })
  console.log("purchases:", purchases.length)

  console.log("\n== analytics prepaid ==")
  const prepaidSales = await prisma.prepaidPurchase.findMany({
    where: {
      organizationId: org!.id,
      status: { in: ["ACTIVE", "EXHAUSTED"] },
      purchasedAt: { gte: new Date(Date.now() - 86400000) },
      prepaidProduct: { kind: { in: ["GIFT_CARD", "PACKAGE"] } },
    },
    select: { purchasedAt: true, prepaidProduct: { select: { price: true } } },
  })
  const redemptions = await prisma.prepaidRedemption.findMany({
    where: { prepaidPurchase: { organizationId: org!.id } },
    select: { createdAt: true, amount: true, sessions: true },
  })
  console.log("prepaidSales:", prepaidSales.length, "redemptions:", redemptions.length)

  console.log("\n== appointments prepaid candidate query ==")
  const candidates = await prisma.prepaidPurchase.findMany({
    where: {
      organizationId: org!.id,
      status: "ACTIVE",
      sessionsLeft: { gt: 0 },
      prepaidProduct: { kind: "PACKAGE" },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      prepaidProduct: {
        select: { name: true, items: { select: { serviceId: true } } },
      },
    },
    orderBy: { purchasedAt: "asc" },
    take: 5,
  })
  console.log("candidates:", candidates.length)

  console.log("\nVSE POIZVEDBE OK")
}

main()
  .catch((e) => {
    console.error("FAILURE:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
