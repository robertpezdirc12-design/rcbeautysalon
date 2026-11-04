-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementSource" ADD VALUE 'DELIVERY';
ALTER TYPE "StockMovementSource" ADD VALUE 'STOCKTAKE';
ALTER TYPE "StockMovementSource" ADD VALUE 'RETURN';

-- AlterTable
ALTER TABLE "SalonConfig" ADD COLUMN     "defaultReorderPoint" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "forSale" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reorderPoint" INTEGER,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'kos',
ADD COLUMN     "vatRate" DECIMAL(5,2);

-- CreateIndex
CREATE INDEX "Product_organizationId_forSale_idx" ON "Product"("organizationId", "forSale");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_barcode_key" ON "Product"("organizationId", "barcode");

