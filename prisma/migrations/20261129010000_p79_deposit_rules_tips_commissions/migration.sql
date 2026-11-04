-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('INHERIT', 'NONE', 'FIXED', 'PERCENT');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('NONE', 'PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "SalonConfig" ADD COLUMN     "bookingDepositType" "DepositType" NOT NULL DEFAULT 'FIXED';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "depositType" "DepositType" NOT NULL DEFAULT 'INHERIT',
ADD COLUMN     "depositValue" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "commissionBasis" TEXT NOT NULL DEFAULT 'service',
ADD COLUMN     "commissionType" "CommissionType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "commissionValue" DECIMAL(10,2),
ADD COLUMN     "defaultTipPercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "commissionAmount" DECIMAL(10,2),
ADD COLUMN     "tipAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tipMethod" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "tipAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tipMethod" TEXT;

