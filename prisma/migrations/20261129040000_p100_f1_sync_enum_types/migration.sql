-- #100 F1 (popravek P2022) — A: sinhronizacija ENUM tipov
--
-- Produkcijska baza je nastala s kombinacijo db push in delno apliciranih
-- migracij (drift), zato ne moremo domnevati, kateri enum tipi/vrednosti
-- obstajajo. Ta migracija zagotovi OBSTOJ vsakega enum tipa (s celotnim
-- seznamom vrednosti) in posamezne vrednosti (ADD VALUE IF NOT EXISTS).
-- Posebna transakcija: ALTER TYPE ADD VALUE ne sme soobstajati z DDL, ki
-- nove vrednosti uporablja (pg omejitev "unsafe use of new value").
-- Struktura tabel sledi v migraciji B.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'UserRole' AND n.nspname = 'public') THEN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF', 'CLIENTE');
  END IF;
END $$;
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CLIENTE';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'WaitlistStatus' AND n.nspname = 'public') THEN
    CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'NOTIFIED', 'BOOKED', 'EXPIRED');
  END IF;
END $$;
ALTER TYPE "WaitlistStatus" ADD VALUE IF NOT EXISTS 'WAITING';
ALTER TYPE "WaitlistStatus" ADD VALUE IF NOT EXISTS 'NOTIFIED';
ALTER TYPE "WaitlistStatus" ADD VALUE IF NOT EXISTS 'BOOKED';
ALTER TYPE "WaitlistStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'CampaignKind' AND n.nspname = 'public') THEN
    CREATE TYPE "CampaignKind" AS ENUM ('REACTIVATION', 'NO_SHOW', 'BIRTHDAY');
  END IF;
END $$;
ALTER TYPE "CampaignKind" ADD VALUE IF NOT EXISTS 'REACTIVATION';
ALTER TYPE "CampaignKind" ADD VALUE IF NOT EXISTS 'NO_SHOW';
ALTER TYPE "CampaignKind" ADD VALUE IF NOT EXISTS 'BIRTHDAY';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'AppointmentStatus' AND n.nspname = 'public') THEN
    CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
  END IF;
END $$;
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'DepositType' AND n.nspname = 'public') THEN
    CREATE TYPE "DepositType" AS ENUM ('INHERIT', 'NONE', 'FIXED', 'PERCENT');
  END IF;
END $$;
ALTER TYPE "DepositType" ADD VALUE IF NOT EXISTS 'INHERIT';
ALTER TYPE "DepositType" ADD VALUE IF NOT EXISTS 'NONE';
ALTER TYPE "DepositType" ADD VALUE IF NOT EXISTS 'FIXED';
ALTER TYPE "DepositType" ADD VALUE IF NOT EXISTS 'PERCENT';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'CommissionType' AND n.nspname = 'public') THEN
    CREATE TYPE "CommissionType" AS ENUM ('NONE', 'PERCENT', 'FIXED');
  END IF;
END $$;
ALTER TYPE "CommissionType" ADD VALUE IF NOT EXISTS 'NONE';
ALTER TYPE "CommissionType" ADD VALUE IF NOT EXISTS 'PERCENT';
ALTER TYPE "CommissionType" ADD VALUE IF NOT EXISTS 'FIXED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'OrderStatus' AND n.nspname = 'public') THEN
    CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'COMPLETED', 'CANCELLED', 'REFUNDED');
  END IF;
END $$;
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'PrepaidKind' AND n.nspname = 'public') THEN
    CREATE TYPE "PrepaidKind" AS ENUM ('GIFT_CARD', 'PACKAGE', 'MEMBERSHIP');
  END IF;
END $$;
ALTER TYPE "PrepaidKind" ADD VALUE IF NOT EXISTS 'GIFT_CARD';
ALTER TYPE "PrepaidKind" ADD VALUE IF NOT EXISTS 'PACKAGE';
ALTER TYPE "PrepaidKind" ADD VALUE IF NOT EXISTS 'MEMBERSHIP';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'StockDirection' AND n.nspname = 'public') THEN
    CREATE TYPE "StockDirection" AS ENUM ('IN', 'OUT');
  END IF;
END $$;
ALTER TYPE "StockDirection" ADD VALUE IF NOT EXISTS 'IN';
ALTER TYPE "StockDirection" ADD VALUE IF NOT EXISTS 'OUT';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'StockMovementSource' AND n.nspname = 'public') THEN
    CREATE TYPE "StockMovementSource" AS ENUM ('MANUAL', 'ORDER', 'DELIVERY', 'STOCKTAKE', 'RETURN');
  END IF;
END $$;
ALTER TYPE "StockMovementSource" ADD VALUE IF NOT EXISTS 'MANUAL';
ALTER TYPE "StockMovementSource" ADD VALUE IF NOT EXISTS 'ORDER';
ALTER TYPE "StockMovementSource" ADD VALUE IF NOT EXISTS 'DELIVERY';
ALTER TYPE "StockMovementSource" ADD VALUE IF NOT EXISTS 'STOCKTAKE';
ALTER TYPE "StockMovementSource" ADD VALUE IF NOT EXISTS 'RETURN';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'ProjectStatus' AND n.nspname = 'public') THEN
    CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
  END IF;
END $$;
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'PLANNING';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'ProjectTaskStatus' AND n.nspname = 'public') THEN
    CREATE TYPE "ProjectTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');
  END IF;
END $$;
ALTER TYPE "ProjectTaskStatus" ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE "ProjectTaskStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "ProjectTaskStatus" ADD VALUE IF NOT EXISTS 'DONE';
