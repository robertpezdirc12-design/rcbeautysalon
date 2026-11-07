> **Opomba ob objavi:** delovni zapis, prenesen v repozitorij. Strojno specifične poti so odstranjene; neodvisni varnostni pregled in statični prototip nista del te objave.

# MARKEC — načrt za profesionalno vstopno stran (raziskava + izvedba)

**Datum:** 7. 11. 2026, 00:30 (GMT+1)
**Stanje:** Faza 0 (prototip) je izdelana v lokalnem statičnem prototipu (ni del repozitorija). Ta dokument opisuje prenos v pravi repozitorij in objavo na Vercelu.
**Vir za kodo:** izoliran klon `rcbeautysalon` na `origin/main` = `6697a97`. Drugi agent je po navedbi uporabnika ustavljen.

---

## 1. Najpomembnejša ugotovitev: ne graditi iz nič

Velik del tega, kar uporabnik opisuje, **že obstaja v kodi**. Ponovna gradnja bi podvojila delo in odprla nove napake.

| Zahteva | Kje je že narejeno |
|---|---|
| »Reklamna prva stran, ki je prva na Vercelu« | `src/app/(public)/page.tsx` → na platformnem gostitelju anonimni obiskovalec dobi `<PlatformLanding />` (P1 #66). Koren `/` je že izložba izdelka, ne najemnik. |
| »Profesionalen opis, moduli, primeri, paketi« | `src/components/landing/platform-landing.tsx` (209 vrstic): hero, karte dejavnosti, 3 koraki, paketi, končni CTA. |
| »Gumb za podjetnike: vstopi z uporabniškim imenom in geslom« | `/login` (`src/app/(auth)/login/page.tsx`) + NextAuth v5 Credentials v `src/lib/auth/auth.ts`. |
| »Vse vezano na račun« | `User` → `OrganizationMember` → `Organization`; tenant izolacija, podpisana `x-org-slug` glava, custom domene. |
| »Ko vstopi, vodena namestitev« | `src/components/onboarding/start-wizard.tsx` (3 koraki, SKD 2025 iskalnik, palete, vprašanja) **in** `src/components/dashboard/setup-checklist.tsx` + `guided-entry.tsx` — vztrajen kontrolni seznam, ki se računa strežniško iz resničnih podatkov, z enim »naslednjim korakom«, prazničnim stanjem ob zaključku in možnostjo skrivanja/prikaza. |
| »Slike, podatki, artikli, trgovina, rezervacije« | `src/lib/profiles/registry.ts` (12 profilov), `src/lib/plans/registry.ts`, `public/img/presets/` (36 JPG), `public/img/media/` (AVIF), moduli v `src/lib/profiles/modules.ts`. |
| Večjezičnost | `src/lib/i18n/` — `sl` + `en`, 18 slovarjev, `getServerI18n()`, `public-i18n-provider.tsx`. |
| SEO osnova | `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/og/route.tsx` (dinamična OG kartica), `buildTenantMetadata()` v `src/lib/seo`. |

**Zaključek:** edini pravi vrzeli sta **kakovost vstopne strani** in **SEO-pravilna večjezičnost**. Vse ostalo je integracija, ne gradnja.

---

## 2. Kaj danes na vstopni strani še ni v redu

1. **H1 je zamenljiv.** »Univerzalna poslovna platforma — vaše podjetje v nekaj minutah« bi lahko podpisal kdorkoli. Test iz raziskave: *ali bi isti stavek z enakim pomenom lahko uporabil konkurent?* Da → treba preoblikovati v izid za poimenovano ciljno skupino.
2. **Dva enakovredna CTA-ja v heroju** (»Ustvari svoje podjetje« + »Poglej dejavnosti«). En sam primarni gumb v povprečju konvertira 13,5 % proti 10,5 % pri več gumbih.
3. **Hero nima prikaza izdelka** — samo besedilo. Hero odloča 60–80 % izida; abstraktne animacije pred prikazom izdelka znižujejo konverzijo.
4. **Ni fotografij, ni primerov objavljenih strani** kljub 36 pripravljenim presetom v repozitoriju.
5. **Ni socialnega dokaza niti ugovorov (FAQ)** — stran se konča s paketi in ponovljenim CTA.
6. **Trdo kodirana slovenščina**: `plan.description.sl`, `f.sl`, vsi napisi v `platform-landing.tsx`. `en` slovar obstaja, a se na izložbi ne uporablja.
7. **i18n je piškotni, ne URL**: `LOCALE_COOKIE = "rc_admin_locale"`, `getLocaleFromCookies()`. Iskalniki vidijo eno samo različico; ni `hreflang`, ni `x-default`, ni lokaliziranih URL-jev. Približno 75 % mednarodnih strani ima napake v `hreflang` — tega je treba urediti **pred** objavo, sicer sledijo sto 301 preusmeritev.
8. **Ni platformnih metadata/OG**: `generateMetadata()` v `src/app/layout.tsx:90` gradi metadata za najemnika; komentar izrecno pravi, da za koren platforme ni fallbacka. `public/og-default.png` in `/og` obstajata, a ju izložba ne uporabi.
9. **Paketi nimajo cen.** `PLANS` vsebuje samo omejitve. Na strani zato **ne smemo** prikazati izmišljenih zneskov.

---

## 3. Kaj pravi raziskava (povzetek)

Viri: [Adfirm — CRO framework 2026](https://www.adfirm.net/blog/cro-framework-saas-landing-pages), [SaaSHero — B2B SaaS benchmarks 2026](https://www.saashero.net/strategy/b2b-saas-conversion-rate-benchmarks/), [Stackzeno — SaaS landing page design 2026](https://stackzeno.com/blog/saas-landing-page-design), [SoftwareSift — Best website builders 2026](https://softwaresift.com?p=124/), [Digital Vantage — licenciranje slik](https://www.digitalvantage.eu/posts/websites-internet/content-and-media/image-copyright), [sekin.in — 15 virov komercialnih slik](https://sekin.in/15-best-websites-for-free-commercial-images-in-2026).

- **Pozicioniranje:** ne »imamo rezervacije + trgovino + CMS« — Wix ima vse to že od paketa Core in na tem boju izgubimo. Pravi konkurent je **strošek sestavljanja**: stran + Acuity + trgovinski dodatek + prevajalnik + obrazec + ure povezovanja. Sporočilo: *en vmesnik, en račun, ena prijava*. Vsi veliki igralci so v 2025–26 dodali AI generiranje (Wix Harmony, Squarespace Blueprint AI, GoDaddy Airo, Hostinger AI Builder), zato se trg zdaj loči po **pripravljenosti za produkcijo**, ne po hitrosti prvega osnutka. Zato vodijo **rezervacije**: spletna rezervacija prinese ~26 % več terminov, opomniki zmanjšajo ne-prihode za 30–50 %, stranke ~3× raje rezervirajo same.
- **Hero:** eyebrow → H1 (5–12 besed, izid ne funkcija) → podnaslov z mehanizmom in ciljno skupino → **en** primarni CTA → prikaz izdelka → trust strip. Brez štirih alinej, šestih logotipov in animiranih gradinetov.
- **Vrstni red odsekov:** hero → zaupanje → poimenovan problem → 3–5 blokov funkcija→korist → 3 koraki → dokaz → paketi → FAQ/ugovori → končni CTA.
- **Hitrost:** vsaka dodatna sekunda odnese 7–10 % konverzije; cilj LCP < 2,5 s (idealno < 1,5 s). Mobilna konverzija je 50–60 % nižja, pri ne-tehničnih lastnikih verjetno še bolj → mobile-first.
- **Ujemanje sporočila:** vertikalne kampanje morajo pristati na lastnih straneh (`/za/frizerje`, `/en/for/hairdressers`), ne na generičnem korenu. To je faza 3, ne faza 1.
- **Večjezičnost:** podimeniki (`/en/`), ne poddomene ne ccTLD. Vzajemen `hreflang` + `x-default`, samokanonična vsaka različica, endonimi v preklopniku (»Deutsch«, ne zastavica), **brez** preusmerjanja po IP-ju / `Accept-Language`. ~72 % kupcev večino časa preživi na strani v svojem jeziku. Lokalizacija ni prevod: raziskati lokalni iskalni namen, ne prevajati naslovov besedo za besedo.
- **Onboarding:** aktivacija pri podjetjih pod 50 zaposlenimi povprečno ~19–20 %, ne 50 %. Time-to-value pod 10 minut pomeni 2,1× boljšo konverzijo kot 30+ minut. Kontrolni seznam 3–7 korakov, vsak pod 2 minuti, vnaprej odkljukan prvi korak, vzorčni podatki namesto prazne nadzorne plošče. **To v kodi že drži** — ne dodajati še turneje in tooltipov.
- **Slike:** Unsplash/Pexels dovoljujeta komercialno rabo brez navedbe, a prepovedujeta nakazano podporo osebe izdelku, uporabo kot blagovno znamko in prodajo nespremenjenih kopij; ne zagotavljata model release za vsako datoteko. Pravilo: splet = brezplačna knjižnica po prenosu in z registrom; tisk/plačana kampanja = plačljiva knjižnica z overjeno provenienco.

---

## 4. Odločitve, ki jih priporočam

| Vprašanje | Odločitev | Razlog |
|---|---|---|
| Kaj sploh gradimo | Nadgradnja `PlatformLanding` v obstoječem repozitoriju, ne ločen marketing projekt | `/` na platformnem hostu že servira izložbo; en deploy, ena prijava, čarovnik in kontrolni seznam že vezana nanjo. Ločen projekt bi podvojil domeno, SEO in prijavo. |
| H1 | »Spletna stran, ki od prvega dne sprejema rezervacije in naročila.« / EN: »A website that takes bookings and orders from day one.« | Izid + mehanizem, ne kategorija; vodi z rezervacijami. |
| CTA | **En** primarni gumb »Ustvari svojo stran — brezplačno« → `/start`. »Poglej primere« postane besedilna povezava, »Prijava« ostane v zaglavju. | +29 % relativno pri enem CTA; vsak odvečni gumb je izhod. |
| Jeziki | **sl + en**, kakovostno lokalizirana, URL podimeniki. `de/it/hr` šele ob povpraševanju. | Dva dobro narejena jezika > pet strojnih prevodov; `hreflang` se gradi enkrat, ne petkrat. |
| Struktura URL | `/` = sl kanonična + `x-default`, `/en/` = angleška. Eksplicitni mapi, ne dinamičen `[locale]` na korenu. | Dinamičen korenski segment bi tekmoval z `/login`, `/start`, `/s/...` in proxy prepisi. Statične poti imajo prednost, a je eksplicitno varneje. |
| Slike | ① lastni posnetki vmesnika (hero), ② obstoječih 36 presetov za karte dejavnosti, ③ AI samo za dekoracijo. **Brez hotlinkanja.** Registrirati izvor. | Hero mora pokazati izdelek; lastni posnetki nimajo licenčnega tveganja. Glej `markec-landing/ASSETS.md`. |
| Socialni dokaz | Dokler ni resničnih strank: nobenih izmišljenih številk, imen, citatov ali generiranih obrazov. Namesto tega preverljiva dejstva iz kode. | Neresnične trditve so pravno in reputacijsko tveganje; anonimni citati po raziskavi ne pomagajo. |
| Cene | Prikazati resnične omejitve paketov, brez zneskov, z iskreno opombo. Lastnik določi cene pred objavo. | Transparentne cene sicer konvertirajo 15–25 % bolje, a `PLANS` cen nima. Izmišljanje ni opcija. |
| Karte primerov | **5 kart kot vzorec**, ne seznam vseh dejavnosti. Karta »Univerzalno podjetje« (`generic`) se umakne z izložbe. | Odločitev lastnika 7. 11.: »teh 6 so samo primeri, univerzalna lahko umakneš«. `generic` ostane na voljo v `StartWizard`, le ne prikazujemo ga kot primer. Pod mrežo je dodana opomba »5 od 12 … vzorec, ne celoten seznam«. |
| »Uporabniško ime in geslo« | **Obdržati e-pošto + geslo** kot identifikator. Po želji dodati prikazno ime, ne migracije sheme. | `User.email` je `@unique`, potrjena, že vezana na ponastavitev gesla, obvestila in NextAuth `authorize()`. Nov `username` bi zahteval migracijo, backfill obstoječih računov in dvojno logiko prijave — za kozmetično spremembo. **Potrebna potrditev lastnika.** |

---

## 5. Tehnični načrt za repozitorij

### 5.1 Vstopna stran
- `src/components/landing/platform-landing.tsx` → razširiti v več komponent (`platform-hero`, `platform-examples`, `platform-faq`, …) ali obdržati eno, a uvoziti besedila iz novega slovarja `src/lib/i18n/dict/landing.ts` (`landingSl`, `landingEn`), dodati v `dictionaries.ts`.
- Zamenjati vse trdo kodirane `.sl` / slovenske nize z `dict.landing.*`. `PLANS` že ima `{sl, en}` za opise in značilnosti — uporabiti `locale` parameter.
- Dodati 5 kart primerov z `next/image` in `public/img/presets/hero-*.jpg`, `alt` iz slovarja, `loading="lazy"`, eksplicitne dimenzije. Karte so **vzorec 5 od 12 registriranih profilov**, ne celoten seznam; pod mrežo dodati kratko opombo iz slovarja (`ex.more`). Profil `generic` (»univerzalno podjetje«) na izložbi **ne bo prikazan** — po odločitvi lastnika 7. 11. ostane na voljo v čarovniku, ne pa kot primer.
- Hero vizual: CSS/HTML ponazoritev lastnega vmesnika (kot v prototipu) ali resnični posnetek `/dashboard` — oboje brez licenčnega tveganja, oboje takoj vidno.
- Odstraniti drugi enakovredni gumb iz heroja.

### 5.2 Večjezičnost in SEO
- Nova `src/app/en/page.tsx`, ki renderira isti `PlatformLanding` z `locale="en"`. `src/app/(public)/page.tsx` ostane `sl`.
- `generateMetadata()` v `src/app/layout.tsx:90`: za platformni koren dodati vejo z `title`, `description`, `alternates.canonical`, `alternates.languages: { sl: "/", en: "/en", "x-default": "/" }`, `openGraph` (uporabiti `public/og-default.png` ali `/og?title=…`), `robots: { index: true, follow: true }`. Danes ta veja ne obstaja.
- `<html lang>` mora slediti jeziku (danes ga določa root layout — preveriti, da `/en` ne dobi `lang="sl"`).
- Preklopnik jezika: crawlable `<a href="/">Slovenščina</a>` / `<a href="/en">English</a>`, endonima, brez IP redirecta. Izbira naj ne piše v `rc_admin_locale` (to je administratorski piškotek).
- `src/app/sitemap.ts` in `src/app/robots.ts` že obstajata → dodati obe različici z `alternates.languages` v sitemapu.
- `src/proxy.ts`: `matcher` zajame vse; `BARE_PUBLIC_PATH` ne zajame `/en`, zato bi moral preiti (`NextResponse.next()` na koncu). **Obvezno dodati test**, da `/en` vrže 200 in ni preusmerjen na najemnika ali 404. Prav tako preveriti `CUSTOM_DOMAIN_HEADER_DENYLIST`.
- `getPlatformHostsFromEnv()` bere `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `VERCEL_URL` → na Vercelu nastaviti `NEXT_PUBLIC_APP_URL` na končno domeno, sicer se koren lahko obnaša kot custom domena.

### 5.3 Prijava in voden začetek — ne spreminjati
- `/login`, `/start`, `StartWizard`, `SetupChecklistCard`, `GuidedEntry` ostanejo. Na strani samo povezave nanje.
- Če lastnik vseeno želi pravo uporabniško ime: `User.username @unique`, `authorize()` išče po `username OR email`, backfill iz e-pošte, posodobitev `/register` in 3. koraka čarovnika, testi za dvojnike. To je ločen, tvegan poseg — ne v istem sklopu kot landing.

### 5.4 Vercel
- `vercel.json` (cron `/api/cron/tick`) ostane nedotaknjen.
- Obvezni env: `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `CRON_SECRET`, `RESEND_API_KEY` (po potrebi), `PLATFORM_ADMIN_EMAILS`.
- **Opozorilo P2-C:** `npm run build` = `prisma generate && node scripts/resolve-failed-migrations.mjs && prisma migrate deploy && next build`. Build na Vercelu lahko z `prisma migrate resolve --rolled-back` spremeni zgodovino migracij **produkcijske** baze. Pred prvim deployem ta skript ločiti od builda ali ga vsaj pregledati.
- Po deployu preveriti: `/` 200 in platformna izložba, `/en` 200, `/login` `noindex`, `/s/<slug>` še vedno najemnik, custom domena še vedno deluje, OG kartica v deljenju.

---

## 6. Faze

| Faza | Vsebina | Status |
|---|---|---|
| **F0** | Raziskava + odločitve + delujoč prototip v `markec-landing/index.html` (sl/en, 7 odsekov + zaglavje/trust pas/noga, 5 kart primerov, 6 realnih slik, register izvora) | ✅ narejeno in validirano |
| **F1** | Prenos v `platform-landing.tsx`, nov slovar `landing.ts`, `/en` pot, metadata/hreflang/canonical/OG, sitemap, proxy test | naslednji korak |
| **F2a** | Ozki popravek SSR lupine za `/` in `/en` (H1 + JSON-LD v surovem HTML), `<html lang>` iz URL-ja | ✅ narejeno in objavljeno (commit `2e5b199`, §11) |
| **F2b** | Resnični posnetki izdelka, optimizacija v AVIF/WebP, `ATTRIBUTION.md`, LCP meritev | odprto |
| **F3** | Vertikalne strani (`/za/frizerje`, `/en/for/hairdressers`) z ujemanjem oglasnega sporočila | po meritvah F1 |
| **F4** | Deploy na Vercel + tedenska kohortna meritev | po potrditvi lastnika |

## 7. Sprejemni kriteriji in metrike

- `/` in `/en` sta indeksirani, vsaka s samokanoničnim URL-jem in vzajemnim `hreflang` + `x-default`; brez preusmerjanja po IP.
- LCP < 2,5 s na mobilnem, nobenega CLS pri slikah, vse slike z `alt`.
- En primarni CTA nad pregibom; prikaz izdelka viden brez animacijskega zamika.
- Nobena trditev na strani ni izmišljena (številke, citati, cene, imena strank).
- Po kliku na CTA se odpre obstoječi `/start`; po prijavi obstoječi kontrolni seznam. Ni nove registracijske poti.
- Meriti po tedenskih kohortah: aktivacija (prva objava / prvi termin), median time-to-value, dokončanje kontrolnega seznama, day-7 / day-30 zadržanje. Cilj za SMB ~20 % aktivacije, ne 50 %.

## 8. Odločitve, ki jih mora dati lastnik

1. **Cene** za PRO in SCALE (v EUR, z lokalnimi zneski, ne tečajnim preračunom) — ali naj stran ostane brez zneskov do zagona.
2. **Domena**: katera domena je kanonična platformna domena za `NEXT_PUBLIC_APP_URL`.
3. **Uporabniško ime**: ali je »uporabniško ime« mišljeno kot e-pošta (priporočam obdržati) ali res nov `username` z migracijo.
4. **Dodatni jeziki**: ali takoj `de`/`it`/`hr` ali šele po povpraševanju (priporočam slednje).
5. **Izvor 36 preset slik** — potrditi AI-generirane ali vpisati licenco; glej `ASSETS.md`.
6. **Resnične reference** — ali imamo že prve stranke, ki dovolijo ime, fotografijo in izjavo.

---

## 9. Validacija prototipa (7. 11., po izdelavi)

Strukturni pregled + render v headless Chromu, vključno s **pravim 390 px viewportom** prek CDP (navadni `--window-size=390` v headless Chromu tiho vrne 500 px, zato je treba uporabiti `Emulation.setDeviceMetricsOverride`).

| Preverjanje | Rezultat |
|---|---|
| `data-i18n` / `data-i18n-aria` / runtime ključi | 117 / 3 / 3; sl in en imata po 123 vnosov; **0 manjkajočih, 0 neuporabljenih** |
| Slike | 6 referenc (5 kart + miniatura v prikazu vmesnika), **0 manjkajočih datotek** |
| SEO | `hreflang` = `sl`, `en`, `x-default`; canonical; `og:locale` + `og:locale:alternate`; JSON-LD `SoftwareApplication` se parsira |
| Preklop v EN v brskalniku | `lang="en"`, angleški `<title>`, canonical `/en/`, `og:locale=en_US`, preveden `alt` in ime vzorčne strani |
| Mobilno 390 px | `scrollWidth === innerWidth`, ni vodoravnega prelivanja, noben element ne sega čez rob |
| Velikost | ~44,7 kB, brez zunanjih virov in brez omrežnih klicev |

**Popravek lažnega alarma:** prvi validator je javil `missing in sl/en: ['mock.miniCta']`. To ni resnična napaka — regex je sprejemal samo `[a-z0-9.]+`, ključ pa vsebuje veliko `C`. Ključ je prisoten v obeh slovarjih.

**Resnične napake, odkrite in popravljene med validacijo:**

1. **Notranje opombe so bile vidne obiskovalcu** (`plans.note`: »registry vsebuje le omejitve … potrditi lastnik«; `plans.lead`: »ne iz reklamnega besedila«; `mock.caption`: »ne stock fotografija«). Preoblikovane v javno besedilo; razlaga je zdaj v HTML komentarjih.
2. **Izmišljena trditev** `plans.badge` »Najpogostejša izbira / Most popular« — v podatkih ni nobene statistike o priljubljenosti. Zamenjana z »Več zmogljivosti / More capacity«.
3. `mod.4d` je obljubljal dodatne jezike »po zagonu« → zamenjano z dejstvom, ki ga koda podpira. Odstranjen tudi onemogočen gumb »Deutsch — kmalu«.
4. Tipkarska napaka v statičnem HTML (`stara` → `držita`), manjkajoč canonical in `og:locale`, neprevedeni `aria-label` atributi in `alt` miniaturne slike v prikazu vmesnika.
5. **Zaglavje se je na 390 px prelivalo** (CTA je bil odrezan). Pod 420 px se skrije zaglavni CTA in podnaslov blagovne znamke; hero CTA ostane edini primarni gumb nad pregibom.

**Trditve preverjene proti kodi** (`origin/main 6697a97`): omejitve paketov in »Prednostna podpora« (dobesedno v `PLANS`), zaloge izdelkov, opomniki/odpovedi, delovni nalogi in vozila, galerija, preklop modulov ne briše podatkov (`applyOverrides` spreminja samo stanje zmožnosti), čarovnik nima plačilnega koraka (`createSalonOrganization`, brez Stripe checkouta → »brez kreditne kartice« je utemeljeno), trije koraki, vsi `/start?vertical=…` kažejo na resnične ID-je iz `profiles/registry.ts`.

**Sprememba po odločitvi lastnika (7. 11., 00:54):** »teh 6 so samo primeri, univerzalna lahko umakneš«. Odstranjena je 6. karta »Univerzalno podjetje / Any other business« (`/start?vertical=generic`), z njo `ex.6t`/`ex.6d` v obeh slovarjih in 6. vnos v `ALT`. Dodan `ex.more` z opombo, da gre za **5 od 12 registriranih profilov** (število preverjeno v `profiles/registry.ts`). Mreža je preurejena v 6 sledi: 3 karte v prvi vrsti, 2 centrirani v drugi; pod 900 px se vse zloži v en stolpec. `generic` ostane v čarovniku, samo ni več oglaševalski primer. `hero-workspace.jpg` je zdaj rezerva. Ponovna validacija: 6 `<img>`, 5 `ALT` vnosov, 0 manjkajočih datotek, 390 px brez prelivanja.

**Razlike prototip → produkcija (obvezno urediti v F1):**

| Prototip | Produkcija |
|---|---|
| Jezik preklapljata gumba, izbira v `localStorage` | crawlable `<a href="/">Slovenščina</a>` in `<a href="/en">English</a>`, brez preusmerjanja po IP-ju |
| canonical `/` oz. `/en/` in `og:image` `/og-default.png` sta relativna | absolutna URL-ja prek `metadataBase` + končne domene (odločitev št. 2) |
| `lang`, canonical, `og:locale` nastavi JavaScript | statično v HTML vsake poti; iskalnik ne izvaja JS za `<html lang>` |
| enak `hreflang` sklop na eni datoteki | vzajemen sklop na obeh straneh + `x-default` |
| JPG + `loading="lazy"` | AVIF/WebP, `next/image`, eksplicitne dimenzije, meritev LCP |

---

## Priloga: prototip

`markec-landing/index.html` (lokalni staticni prototip, ni del repozitorija) — statičen, brez zunanjih odvisnosti, odpira se neposredno v brskalniku (dvojni klik). Jezik se preklaplja z gumboma v zaglavju (shranjeno v `localStorage`), vključno z vsemi `alt` besedili, `aria-label`, `<html lang>`, canonical, `og:locale`, naslovom in opisom strani. Povezave na `/login`, `/start`, `/start?vertical=…`, `/privacy` itd. kažejo na prave poti v aplikaciji, v samem prototipu pa niso aktivne — preverjati jih je treba šele po F1 v pravem repozitoriju.

Spremljevalni datoteki: `markec-landing/ASSETS.md` (izvor in licenciranje slik) in `markec-landing/assets/` (10 kopiranih presetov, 6 jih stran uporablja, ostali so rezerva). Prototip je **vizualni in vsebinski dogovor**, ne produkcijska koda: vanj ne dodajamo novih odvisnosti, v repozitorij pa se prenese kot `PlatformLanding` + nov slovar, ne kot kopija HTML-ja.

---

## 10. F1 — prenos v produkcijski repozitorij (7. 11.)

Odločitev lastnika: **»Merge, keep owner H1«**. H1, angleški tagline, strateški podnaslov in trije koraki iz commita `15aa272` ostanejo **dobesedno**; prototip doda vse ostalo.

**Commit:** `4a558dd` → `main` na `robertpezdirc12-design/rcbeautysalon` (`15aa272..4a558dd`), 12 datotek, +1453 / −170. Delovna kopija: `lokalni klon repozitorija`.

| Datoteka | Sprememba |
|---|---|
| `src/lib/i18n/dict/landing.ts` | **nov** — edini vir besedil, sl + en, enaka oblika (testirano) |
| `src/lib/i18n/platform-locale.ts` | **nov** — `platformLocaleForPath`, `resolveHtmlLocale`, `x-markec-locale` |
| `src/app/en/page.tsx` | **nov** — izrecna pot zunaj `(public)`, lastni EN metadata |
| `tests/landing/platform-landing.test.ts` | **nov** — 19 strukturnih testov |
| `platform-landing.tsx` | prenovljen v celovito dvojezično stran (566 vrstic) |
| `(public)/page.tsx`, `layout.tsx`, `proxy.ts`, `sitemap.ts`, `sitemap-builder.ts`, `dictionaries.ts` | metadata/hreflang/canonical, `<html lang>` prek podpisane proxy glave, denylist za `/en`, sitemap za `/` in `/en`, registracija slovarja |
| `tests/entry-checkout-65-69.test.ts` | usklajen z odločitvijo »5 kart je vzorec, ne taksonomija« |

**Zakaj `x-markec-locale`:** `<html lang>` je v obstoječem sistemu vezan na piškotek uprave. Proxy glavo ob vstopu **odstrani** in jo nastavi **samo** za `/en`; korenski layout jo prebere. Obiskovalec je ne more ponarediti. `resolveBrandOrg()` ima še posebno varovalko: na `/en` ne sme prevzeti najemniške teme ali JSON-LD prek seje prijavljenega lastnika.

**Validacija pred push:** 75 testnih datotek / **1093 testov** (po `prisma generate`; svež klon brez generiranega klienta je 11 datotek javljalo `Cannot find module '.prisma/client/default'` — napaka namestitve, ne kode), `eslint` čist, `tsc --noEmit` čist, `git diff --check` čist, Prettier čist na vseh novih datotekah. `pnpm format:check` sicer **pade na 599 obstoječih datotekah** — to je stanje repozitorija pred F1, zato skupnih datotek nisem množično preoblikoval.

**HTTP dimni test** (lokalni `next dev`, brez produkcijske baze): `/` in `/en` → 200; `lang="sl"` / `lang="en"`; canonical `…/` / `…/en`; po 3 vzajemne `hreflang` povezave (`sl`, `en`, `x-default`); `og:locale` `sl_SI` / `en_US`; `og:image` `/og-default.png`; slovarjeva `<title>` na obeh poteh. Primerjava s trenutno produkcijo pred deployem: stari naslov in `/en` → 404.

### ⚠ Nova ugotovitev (ni regresija F1, a vpliva na SEO vstopne strani)

**Celotna aplikacija ima prazno SSR lupino.** `src/components/providers/cart-provider.tsx` kliče `useSyncExternalStore(..., () => true, () => false)` in na strežniku vrne `null` — s tem odreže **vse** otroke korenskega layouta. Potrjeno na produkciji za `/`, `/login`, `/start`, `/privacy`: `<body>` vsebuje le `<div hidden><!--$--><!--/$--></div>`, vsebina se izriše šele v brskalniku. Posledice: `<h1>`, `SoftwareApplication` JSON-LD in `og:locale:alternate` (ki jih komponenta vstavi v telo) **niso v surovem HTML**; metadata v `<head>` (`title`, `description`, canonical, `hreflang`, `og:image`, `og:locale`) pa **je** in deluje.

Popravek ni vključen v ta commit, ker je globalen: vrnitev SSR bi razkrila komponente, ki v renderju neposredno berejo `window` (npr. `dashboard/appointment-intake-link.tsx:24`), in bi lahko zlomila najemniške/administrativne strani. **Predlog za ločeno F2:** (a) ozko — proxy označi samo platformski `/` in `/en`, korenski layout tam izpusti `CartProvider` in v `<head>` vstavi platformski JSON-LD; ali (b) široko — odstrani `if (!isClient) return null` in hkrati zavaruje vse `window.*` dostope v renderju. Variant (a) je varnejša in dovolj za vstopno stran.

**Stanje:** izvedena je varianta (a) v commitu `2e5b199` (F2a) — glej §11. Prazen SSR `<body>` na vseh *ostalih* poteh je namerno ohranjen; široki popravek (b) ostane ločena, tvegana naloga.

**Vercel — deploy uspešen (`state: success`, »Deployment has completed«).** Git integracija je sama zgradila `main`; API `v2/user` z `VERCEL_TOKEN` deluje, projektni klici pa vračajo `403` zaradi SAML scope (`robertpezdirc12-designs-projects`), zato je status preverjen prek GitHub commit statusov in HTTP.

| Preverjanje v produkciji | Rezultat |
|---|---|
| `/` | 200, `lang="sl"`, slovenski naslov, canonical na koren, 3 `hreflang`, `og:locale=sl_SI`, `og:image=/og-default.png`, `robots=index, follow` |
| `/en` | 200, `lang="en"`, angleški naslov, canonical `/en`, 3 `hreflang`, `og:locale=en_US`, angleški `og:title`, `robots=index, follow` |
| `/sitemap.xml` | prvi vnos je `/`, drugi `/en`, oba z enakim vzajemnim `hreflang` sklopom + `x-default` |
| `/robots.txt` | kaže na globalni sitemap |
| Povezave | `/privacy`, `/terms`, `/cookies`, `/login`, `/start`, `/og-default.png` in preseti → vsi 200 |
| Izložba | 6 referenc na presete, nobena povezava na `generic` |

Opomba iz pregleda še vedno velja: `build` skripta izvaja `prisma migrate deploy` in lahko med buildom spreminja produkcijsko zgodovino migracij (P2-C).

---

## 11. F2a — ozki popravek SSR lupine (7. 11.)

**Commit:** `2e5b199` → `main` (`4a558dd..2e5b199`), 6 datotek, +210 / −24. Vercel deploy: `success — Deployment has completed`.

### Problem

`src/components/providers/cart-provider.tsx` je edini ovijalnik, ki na strežniku vrne `null` (`useSyncExternalStore` s strežniškim posnetkom `false`). Ker v korenskem layoutu ovija `children`, je bil surovi `<body>` prazen na **vseh** poteh. Posledica za izložbo: `<h1>`, `SoftwareApplication` JSON-LD in `og:locale:alternate` — v F1 vstavljeni v telo komponente — niso dosegli iskalnikov. Metadata v `<head>` (title, description, canonical, hreflang, og:locale, og:image) so delovale.

### Rešitev: varianta (a) iz §10, ne globalni popravek

| Datoteka | Sprememba |
|---|---|
| `src/lib/platform-shell.ts` | **nov** — konstanti `x-markec-platform-landing` / vrednost `1`, čisti funkciji `isPlatformLandingPath()` in `isPlatformLandingRequest()`, brez uvozov (varno za edge runtime proxyja) |
| `src/proxy.ts` | vhodna glava se **vedno odstrani**; nastavi se samo za točno `/` in `/en`, ko ni podpisanega `x-org-slug` in gostitelj ni preverjena custom domena. `/en` je namerna izjema (že v denylistu iz F1). |
| `src/app/layout.tsx` | na označenih poteh izpusti samo `CartProvider`; platformski JSON-LD + recipročni `og:locale:alternate` v `<head>`; `<html lang>` določi URL, ne administratorski piškotek |
| `src/lib/i18n/platform-locale.ts` | nov `resolvePlatformLandingLocale()` → `sl` za `/`, `en` za `/en`, neznana vrednost pade na `sl` |
| `src/components/landing/platform-landing.tsx` | odstranjen podvojeni `<script>` / `<meta>` iz telesa |
| `tests/landing/platform-landing.test.ts` | 7 novih varovalnih testov (skupno 1100) |

**Zakaj ne kar odstraniti `if (!isClient) return null` globalno:** s tem bi se na strežniku prvič izvedle komponente, ki v renderju neposredno berejo `window` (npr. `dashboard/appointment-intake-link.tsx:24`) — tveganje za najemniške in administrativne strani. Ozka varianta je dovolj za izložbo in ne spreminja nobene druge poti.

**Varovalke, preverjene z zahtevo:** ponarejena glava na `/login` ne spremeni ničesar; prepis `/s/<slug>` → `/` v drugem prehodu že nosi podpisan `x-org-slug`, zato ne dobi oznake; koren preverjene custom domene prav tako ne. Piškotek `rc_admin_locale=en` na `/` ne more več nastaviti `lang="en"` na slovensko vsebino.

### Validacija

- **1100 / 1100 testov** (75 datotek), `eslint` čist, `tsc --noEmit` čist, `git diff --check` čist, Prettier čist na novih datotekah. `pnpm format:check` še vedno pada na 599 obstoječih datotek; `proxy.ts` in `layout.tsx` sta neoblikovana že v `4a558dd` (preverjeno proti HEAD), zato ju nisem množično preoblikoval — vsi novi bloki so v natančno Prettierjevi obliki.
- Lokalni `next dev` na **portu 3100** (port 3000 pripada ločenemu projektu `waas` in je ostal nedotaknjen): surovi HTML `/` in `/en` vsebuje lastnikov `<h1>`, natanko en `SoftwareApplication` v `<head>`, 3 `hreflang`, recipročni `og:locale:alternate`, `robots=index, follow`.
- `/login`, `/start` in `/s/neznan`: brez `<h1>`, brez platformskega JSON-LD, brez `og:locale:alternate` — prvotno obnašanje ohranjeno.
- Chromium prek `@playwright/test`: `/` in `/en` **brez hidracijskih napak**, 1 JSON-LD v `<head>`, 1 `og:locale:alternate`, 3 `hreflang`. Preostale konzolne napake izvirajo izključno iz manjkajočega `NEXTAUTH_SECRET` / CSP report-only v lokalnem dev okolju.

### Produkcija po deployu

| Preverjanje | Rezultat |
|---|---|
| `/` | 200, `lang="sl"`, slovenski `<h1>` v surovem HTML, 1 `SoftwareApplication` v `<head>`, canonical na koren, 3 `hreflang` + `x-default`, `og:locale=sl_SI`, `og:locale:alternate=en_US`, `robots=index, follow` |
| `/en` | 200, `lang="en"`, angleški `<h1>`, canonical `/en`, 3 `hreflang`, `og:locale=en_US`, `og:locale:alternate=sl_SI`, `robots=index, follow` |
| `/` z `rc_admin_locale=en` | `lang="sl"` — piškotek ne zmaga več |
| `/login` (kontrola) | 200, `noindex, nofollow`, brez `<h1>` in brez platformskega JSON-LD |
| Ostale poti | `/start`, `/privacy`, `/sitemap.xml`, `/robots.txt`, `/og-default.png` → 200; sitemap še vedno navaja `/` in `/en` z vzajemnimi alternati |

### Še vedno odprto

1. **F2b:** resnični posnetki izdelka, AVIF/WebP, `public/img/presets/ATTRIBUTION.md`, meritev LCP (cilj < 2,5 s).
2. **Široki SSR popravek:** vse ostale poti imajo še vedno prazen surovi `<body>`; zahteva zavarovanje vseh `window.*` dostopov v renderju.
3. **P2-C:** `npm run build` izvaja `prisma migrate deploy` — ločiti od builda pred produkcijsko migracijo.
4. Odločitve lastnika iz §8 (cene, kanonična domena, uporabniško ime, dodatni jeziki, izvor slik, reference).
