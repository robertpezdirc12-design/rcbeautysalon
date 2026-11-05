-- #100 MARKEC — platformski predstavitveni najemnik (rc-beauty) brez demo
-- podatkov, ki vmesniku določajo dejavnost
--
-- Demo najemnik 'rc-beauty' je po rebrandu (0095de4) platformska
-- predstavitvena stran: MARKEC – univerzalna poslovna platforma. V bazi je
-- od prvotnega seeda (prisma/seed.ts, starejši commit) ostal lepotilni demo
-- katalog, ki VMEJNIKU določa dejavnost, ki je lastnik ne izvaja: 4 demo
-- osebe ekipe (Ana Garcia, Laura Thompson, Maria Rodriguez, Sofia
-- Martinez), 12 lepotilnih storitev, 6 kozmetičnih izdelkov in demo ocene.
-- Lastnik je solo podjetnik („nimam ekipe, sam sem“) in je odstranitev tega
-- stanja izrecno zahteval (issue #100: vmesnik ne sme določati dejavnosti).
--
-- NON-DESTRUKTIVNO (načelo #100: izklop ≠ izbris): vrstice se samo
-- IZKLOPIJO (isActive / forSale / isFeatured → false). Naročila, termini,
-- delovni čas in nastavitve ostanejo ohranjeni; lastnik lahko vrstice kadar
-- koli znova vklopi v nadzorni plošči.
--
-- OBSEG: izključno najemnik 'rc-beauty' (platformska predstavitvena stran,
-- izbran po slugu, ne po id-u). Drugi najemniki (studio-nika,
-- nail-studio-luna, …) so nedotaknjeni.
--
-- Idempotentno: ponovni zagon je no-op (pogoji na trenutne vrednosti).

-- 1) Ime in vertikal platformskih vrati → MARKEC / 'generic' (Univerzalno).
--    Predstavitev platforme ne sme nositi vertikale beauty: tab naslov,
--    JSON-LD @type BeautySalon, terminologija „salon“, ctaMode booking
--    (s praznim katalogom = mrtvi CTA). Generic je stanje „brez dejavnosti“
--    (issue #100: izbira dejavnosti ni obvezna). Palete NE spreminjamo —
--    rose je hkrati akcent platforme (#94). Ime: naslov zavihka in noga
--    izpisujeta org.name (seo.title je prazen) — mora pisati MARKEC.
UPDATE "Organization"
SET "vertical" = 'generic',
    "name" = 'MARKEC',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'rc-beauty'
  AND ("vertical" IS DISTINCT FROM 'generic' OR "name" IS DISTINCT FROM 'MARKEC');

-- 2) Demo ekipa → neaktivna (sekcija „Naša ekipa“ izgine; lastnik dela sam).
UPDATE "Staff"
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "isActive" = true
  AND "organizationId" = (SELECT "id" FROM "Organization" WHERE "slug" = 'rc-beauty');

-- 3) Demo izdelki → neaktivni, ne-v naprodaj, ne-izpostavljeni
--    („Izbrani izdelki“ s kozmetiko izgine iz predstavitve platforme).
UPDATE "Product"
SET "isActive" = false,
    "isFeatured" = false,
    "forSale" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE ("isActive" = true OR "isFeatured" = true OR "forSale" = true)
  AND "organizationId" = (SELECT "id" FROM "Organization" WHERE "slug" = 'rc-beauty');

-- 4) Demo storitve → neaktivne in ne-izpostavljene (cenik ne določa več
--    dejavnosti; termini z zgodovino ostanejo ohranjeni).
UPDATE "Service"
SET "isActive" = false,
    "isFeatured" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE ("isActive" = true OR "isFeatured" = true)
  AND "organizationId" = (SELECT "id" FROM "Organization" WHERE "slug" = 'rc-beauty');

-- 5) Demo ocene → neaktivne (brez lažnega socialnega dokaza na
--    predstavitveni strani).
UPDATE "Review"
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "isActive" = true
  AND "organizationId" = (SELECT "id" FROM "Organization" WHERE "slug" = 'rc-beauty');
