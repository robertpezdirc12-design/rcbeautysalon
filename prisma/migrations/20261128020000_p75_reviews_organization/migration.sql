-- P2 #75: mnenja niso vezana na storitev.
--  1) nov stolpec organizationId (backfill iz service.organizationId),
--  2) serviceId postane nullable, FK onDelete: SET NULL
--     (bris storitve ne sme izbrisati ocene podjetja),
--  3) indeks na organizationId (getPublicTestimonials filtrira po njem).
ALTER TABLE "Review" ADD COLUMN "organizationId" TEXT;

UPDATE "Review"
SET "organizationId" = (
  SELECT s."organizationId" FROM "Service" s WHERE s."id" = "Review"."serviceId"
)
WHERE "organizationId" IS NULL;

-- Demo/seed vrstice, katerih storitev NI ima organizacije (organizationId
-- null), jih ni mogoče pripisati nobenemu najemniku. Prav tako nikoli niso
-- bile vidne: getPublicTestimonials je filtriral po
-- service.organizationId, storitve brez najemnika pa nikoli niso čakale.
-- Izmišljati lastnika (npr. najstarejši najemnik) bi bilo napako — tako
-- dekorativne vrstice se izbrišejo, ne pripisane resnemu podjetju.
DELETE FROM "Review" WHERE "organizationId" IS NULL;

ALTER TABLE "Review" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Review" ALTER COLUMN "serviceId" DROP NOT NULL;

ALTER TABLE "Review" DROP CONSTRAINT "Review_serviceId_fkey";

ALTER TABLE "Review" ADD CONSTRAINT "Review_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "Review_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Review_organizationId_idx" ON "Review"("organizationId");
