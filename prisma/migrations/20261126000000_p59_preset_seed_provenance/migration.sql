-- P2 #59 — provenance of sample catalog rows ("Dopolni katalog")
--
-- presetSeed = preset id (e.g. "beekeeping") when the row was seeded by
-- seedOrganizationCatalog; NULL = owner-created (never replaced, never
-- overwritten). The seeder sets it on every row it creates; the vertical
-- switch replaces only foreign-preset sample rows (presetSeed set AND
-- different from the target preset).
--
-- Idempotent throughout (guard: resolve-failed-migrations.mjs may retry
-- this migration after a failed mid-apply).

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "presetSeed" TEXT;
ALTER TABLE "Service"  ADD COLUMN IF NOT EXISTS "presetSeed" TEXT;
ALTER TABLE "Product"  ADD COLUMN IF NOT EXISTS "presetSeed" TEXT;

-- Backfill: rows seeded by the wizard BEFORE this column existed get the
-- tenant's current vertical as provenance — but ONLY when the row name
-- matches that vertical's preset sample (conservative name-match; owner
-- rows with custom names stay NULL and are therefore never replaced).
-- Names overlap between presets, so the match is scoped to
-- Organization.vertical = preset id.
--
-- NOTE: the match subquery is SELF-CONTAINED (target tables of the UPDATE
-- are joined only in the outer WHERE — a target-table reference inside a
-- FROM-join ON clause is invalid in PostgreSQL and aborted the first
-- attempt of this migration).

UPDATE "Category" c
SET "presetSeed" = m.preset
FROM (
  SELECT o.id AS org_id, v.preset, v.name
  FROM "Organization" o
  JOIN (VALUES
    ('beauty', 'Lasje'),
    ('frizer', 'Ženske frizure'),
    ('frizer', 'Moško striženje'),
    ('barber', 'Striženje'),
    ('barber', 'Brada'),
    ('barber', 'Paketi'),
    ('nails', 'Manikira'),
    ('nails', 'Pedikura'),
    ('nails', 'Nail art'),
    ('cosmetica', 'Tretmaji obraza'),
    ('cosmetica', 'Make-up'),
    ('massage', 'Masaže'),
    ('massage', 'Wellness'),
    ('epilation', 'Laser epilacija'),
    ('epilation', 'Voščanje'),
    ('generic', 'Storitve'),
    ('seamstress', 'Spremembe oblačil'),
    ('seamstress', 'Popravila'),
    ('seamstress', 'Šivanje po meri'),
    ('tire-service', 'Vulkanizerija'),
    ('tire-service', 'Servis vozil')
  ) AS v(preset, name) ON o.vertical = v.preset
) m
WHERE c."organizationId" = m.org_id
  AND c.name = m.name
  AND c."presetSeed" IS NULL;

UPDATE "Service" s
SET "presetSeed" = m.preset
FROM (
  SELECT o.id AS org_id, v.preset, v.name
  FROM "Organization" o
  JOIN (VALUES
    ('beauty', 'Žensko striženje'),
    ('beauty', 'Barvanje korenin'),
    ('beauty', 'Balayage'),
    ('beauty', 'Manikira z laki'),
    ('beauty', 'Gel manikira'),
    ('beauty', 'Hidratantni tretmaj obraza'),
    ('frizer', 'Žensko striženje'),
    ('frizer', 'Barvanje celotne glave'),
    ('frizer', 'Prameni / Balayage'),
    ('frizer', 'Moški haircut'),
    ('frizer', 'Oblikovanje brade'),
    ('frizer', 'Regeneracijski tretmaj'),
    ('frizer', 'Keratin glajenje'),
    ('barber', 'Classic cut'),
    ('barber', 'Skin fade'),
    ('barber', 'Beard trim'),
    ('barber', 'Hot towel shave'),
    ('barber', 'Cut + brada'),
    ('nails', 'Klasična manikira'),
    ('nails', 'Gel manikira'),
    ('nails', 'Klasična pedikura'),
    ('nails', 'Spa pedikura'),
    ('nails', 'Nail art po meri'),
    ('nails', 'Umetni nohti'),
    ('cosmetica', 'Čiščenje obraza'),
    ('cosmetica', 'Hidratantni tretmaj'),
    ('cosmetica', 'Anti-aging tretmaj'),
    ('cosmetica', 'Dnevni make-up'),
    ('cosmetica', 'Večerni / poročni make-up'),
    ('massage', 'Relax masaža'),
    ('massage', 'Športna masaža'),
    ('massage', 'Hot stone masaža'),
    ('massage', 'Aromaterapija'),
    ('massage', 'Refleksologija stopal'),
    ('epilation', 'Laser — zgornja ustnica'),
    ('epilation', 'Laser — noge (celotne)'),
    ('epilation', 'Laser — pazusiha'),
    ('epilation', 'Noge — voščanje'),
    ('epilation', 'Brazilsko voščanje'),
    ('generic', 'Uvodni posvet'),
    ('generic', 'Storitev po meri'),
    ('seamstress', 'Krajšanje hlač'),
    ('seamstress', 'Prižemanje v pasu'),
    ('seamstress', 'Krajšanje rokavov'),
    ('seamstress', 'Zamenjava zadrgle'),
    ('seamstress', 'Popravilo prekinitve'),
    ('seamstress', 'Posvet in snemanje mer'),
    ('seamstress', 'Obleka po meri'),
    ('tire-service', 'Menjava gum (komplet)'),
    ('tire-service', 'Balansiranje'),
    ('tire-service', 'Popravilo punkture'),
    ('tire-service', 'Menjava olja in filtra'),
    ('tire-service', 'Diagnostika napak'),
    ('tire-service', 'Menjava zavorških blazinic')
  ) AS v(preset, name) ON o.vertical = v.preset
) m
WHERE s."organizationId" = m.org_id
  AND s.name = m.name
  AND s."presetSeed" IS NULL;

UPDATE "Product" p
SET "presetSeed" = m.preset
FROM (
  SELECT o.id AS org_id, v.preset, v.name
  FROM "Organization" o
  JOIN (VALUES
    ('beekeeping', 'Cvetlični med 500 g'),
    ('beekeeping', 'Lipov med 500 g'),
    ('beekeeping', 'Gozdni med 500 g'),
    ('beekeeping', 'Akačijski med 500 g'),
    ('beekeeping', 'Propolisna tinktura 30 ml'),
    ('beekeeping', 'Čebelji vosek — sveča')
  ) AS v(preset, name) ON o.vertical = v.preset
) m
WHERE p."organizationId" = m.org_id
  AND p.name = m.name
  AND p."presetSeed" IS NULL;

CREATE INDEX IF NOT EXISTS "Service_presetSeed_idx" ON "Service"("presetSeed");
CREATE INDEX IF NOT EXISTS "Product_presetSeed_idx" ON "Product"("presetSeed");
CREATE INDEX IF NOT EXISTS "Category_presetSeed_idx" ON "Category"("presetSeed");
