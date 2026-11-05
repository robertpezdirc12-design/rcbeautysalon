-- #100 8.A (M1) + 8.C (F2) — članstva (več podjetij na enem računu) in
-- samostojni moduli: tabeli OrganizationMember in OrganizationModuleState.
--
-- Hand-written migration: oba modela sta prišla v schema.prisma (commit
-- 2772911 in 06248ab) BREZ migracije, zato je Vercel build (prisma
-- migrate deploy) tabel nikoli ne ustvaril v produkcijski bazi — vsak
-- klic prisma.organizationMember.findMany() je padel s P2021
-- ("The table public.OrganizationMember does not exist").
-- DDL spodaj je iz `prisma migrate diff` (shema brez modelov → trenutna
-- shema) in je stavke za stavko enak generiranimu SQL-ju.
--
-- Idempotenten v celoti (guard: resolve-failed-migrations.mjs sme
-- migracijo po neuspelem mid-apply ponoviti; varno tudi proti schema
-- driftu ročnega `prisma db push` na katerem koli okolju).

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "customRoleId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrganizationModuleState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationModuleState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrganizationModuleState_organizationId_idx" ON "OrganizationModuleState"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationModuleState_organizationId_moduleId_key" ON "OrganizationModuleState"("organizationId", "moduleId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationMember_organizationId_fkey') THEN
    ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationMember_userId_fkey') THEN
    ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationModuleState_organizationId_fkey') THEN
    ALTER TABLE "OrganizationModuleState" ADD CONSTRAINT "OrganizationModuleState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
