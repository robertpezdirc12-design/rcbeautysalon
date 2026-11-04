-- #80: PREPAID VALUE — one primitive for gift cards + session packages.
-- PrepaidProduct EVOLVES the existing Package model: @@map("Package") keeps
-- the table name, so every existing row/id survives with ZERO data migration
-- (new columns only, defaults backfill existing rows as kind=PACKAGE).
-- Prisma migrate diff cannot see model renames — this migration is
-- hand-written to match the @@map contract exactly.

-- CreateEnum
CREATE TYPE "PrepaidKind" AS ENUM ('GIFT_CARD', 'PACKAGE', 'MEMBERSHIP');

-- AlterTable: evolve "Package" IN PLACE (the PrepaidProduct table)
ALTER TABLE "Package" ADD COLUMN "kind" "PrepaidKind" NOT NULL DEFAULT 'PACKAGE',
ADD COLUMN "faceValue" DECIMAL(10,2),
ADD COLUMN "sessionCount" INTEGER,
ADD COLUMN "validityDays" INTEGER,
ADD COLUMN "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex (names follow the MODEL, the table stays "Package")
CREATE INDEX "PrepaidProduct_organizationId_idx" ON "Package"("organizationId");
CREATE INDEX "PrepaidProduct_organizationId_kind_idx" ON "Package"("organizationId", "kind");
CREATE INDEX "PrepaidProduct_isActive_idx" ON "Package"("isActive");

-- CreateTable: one SOLD instance of a prepaid product
CREATE TABLE "PrepaidPurchase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "prepaidProductId" TEXT NOT NULL,
    "customerId" TEXT,
    "guestEmail" TEXT,
    "code" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sessionsLeft" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stripeSessionId" TEXT,
    "note" TEXT,

    CONSTRAINT "PrepaidPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable: one redemption event (money off an order / one visit)
CREATE TABLE "PrepaidRedemption" (
    "id" TEXT NOT NULL,
    "prepaidPurchaseId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "orderId" TEXT,
    "amount" DECIMAL(10,2),
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepaidRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrepaidPurchase_code_key" ON "PrepaidPurchase"("code");
CREATE INDEX "PrepaidPurchase_organizationId_idx" ON "PrepaidPurchase"("organizationId");
CREATE INDEX "PrepaidPurchase_organizationId_status_idx" ON "PrepaidPurchase"("organizationId", "status");
CREATE INDEX "PrepaidPurchase_prepaidProductId_idx" ON "PrepaidPurchase"("prepaidProductId");
CREATE INDEX "PrepaidPurchase_customerId_idx" ON "PrepaidPurchase"("customerId");
CREATE INDEX "PrepaidRedemption_prepaidPurchaseId_idx" ON "PrepaidRedemption"("prepaidPurchaseId");
CREATE INDEX "PrepaidRedemption_orderId_idx" ON "PrepaidRedemption"("orderId");
CREATE INDEX "PrepaidRedemption_appointmentId_idx" ON "PrepaidRedemption"("appointmentId");
CREATE UNIQUE INDEX "PrepaidRedemption_prepaidPurchaseId_orderId_key" ON "PrepaidRedemption"("prepaidPurchaseId", "orderId");
CREATE UNIQUE INDEX "PrepaidRedemption_prepaidPurchaseId_appointmentId_key" ON "PrepaidRedemption"("prepaidPurchaseId", "appointmentId");

-- AddForeignKey (PrepaidProduct maps to the "Package" table — FK targets it)
ALTER TABLE "PrepaidPurchase" ADD CONSTRAINT "PrepaidPurchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrepaidPurchase" ADD CONSTRAINT "PrepaidPurchase_prepaidProductId_fkey" FOREIGN KEY ("prepaidProductId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrepaidPurchase" ADD CONSTRAINT "PrepaidPurchase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrepaidRedemption" ADD CONSTRAINT "PrepaidRedemption_prepaidPurchaseId_fkey" FOREIGN KEY ("prepaidPurchaseId") REFERENCES "PrepaidPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrepaidRedemption" ADD CONSTRAINT "PrepaidRedemption_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrepaidRedemption" ADD CONSTRAINT "PrepaidRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
