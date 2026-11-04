# MARKEC – MY BUSINESS PLATFORM · Arhitekturni načrt

> **Krovni issue:** #100 · **Status:** aktiven · **Zadnja posodobitev:** 2026-11-04
> **Izvedba:** agent (F0) · **Odobritev:** Robert Pezdirc — potrditev smernic 2026-11-04 (10 pravil, spodaj §8)
>
> **Opomba k poimenovanju:** končno ime znamke je **MARKEC – MY BUSINESS PLATFORM**
> (odločitev Roberta 2026-11-05; potrditveno besedilo je začasno vsebovalo tudi
> napačen zapis imena, ki je bil povsod popravljen). Vsi vidni predstavitveni teksti
> v kodi in dokumentu uporabljajo MARKEC. Tehnični identifikatorji ostajajo
> nespremenjeni (§9).

---

## 0. Namen dokumenta

Dokument je **enotno arhitekturno izhodišče** za preoblikovanje obstoječe aplikacije
RC Beauty v univerzalno modularno poslovno platformo MARKEC. Služi kot:

1. **matrika** »zahteva → kaj že obstaja → kaj manjka« (§3) za vse zahteve iz #100;
2. **SKD 2025** — uradna klasifikacija (22 sekcij A–V) in začetni katalog področij iz #100 (21 skupin) s pokritostjo obstoječih profilov (§4);
3. **pravila modulne arhitekture**, ki jih vsaka prihodnja faza mora spoštovati (§5);
4. **načrt faz** (§6) in **ločenih podprojektov** (§7);
5. **dnevnik odločitev** (§8) in **seznam tehničnih imen, ki namenoma ostajajo** (§9).

Načelo izvedbe: **obstoječe aplikacije NE prepisujemo.** EPIC 1–3 so izvedeni in
testirani (851 testov); MARKEC nastaja z razširjanjem obstoječega jedra po modulih.

---

## 1. Vizija (iz #100)

MARKEC je **univerzalna modularna poslovna platforma**: ena koda, večnajemniška,
za obrt, storitve, trgovino, proizvodnjo in druge oblike poslovanja.

- Dejavnost **ni obvezna izbira** — platforma deluje tudi brez nje.
- Izbira dejavnosti je **neobvezen pomočnik**, ki le **predlaga** module; predloge
  je mogoče spreminjati, dodajati, odstranjevati ali preskočiti.
- Izbira ne zaklene funkcij in ne ustvari ločene aplikacije.
- Uporabnik si lahko ustvari **lastne module brez programiranja** (no-code).
- Lastnik podjetja je **samostojen administrator** svojega poslovanja.

---

## 2. Izhodišče: kaj že obstaja (pregled kode, 2026-11-04)

| Zmogljivost | Kje v kodi | Stanje |
|---|---|---|
| Večnajemniško jedro (Organization, izolacija) | `prisma/schema.prisma`, `tests/platform/*` | ✅ izvedeno |
| Vloge, dovoljenja, CustomRole (preverjanje na strežniku) | schema + server actions (org-scoped) | ✅ izvedeno |
| Profili dejavnosti (capabilities) | `src/lib/profiles/registry.ts` — 10 profilov + generic | ✅ 11 vnosov |
| Razširitve (extension registry) | `src/lib/profiles/extensions.ts` — 9 razširitev | ✅ 9 vnosov |
| Izklop modulov = override, podatki ostanejo | `src/components/dashboard/modules-configurator.tsx` | ✅ izvedeno |
| Vodeni vstop (`/start?vertical=`) | `src/app/start/` | ✅ izvedeno (F1 ga razširi) |
| Javna stran najemnika `/s/[slug]` + objava/umik (publish gate) | `src/app/(public)`, `resolvePublishGate` | ✅ izvedeno |
| SEO: dinamične OG slike, JSON-LD, domene | `src/app/og/route.tsx`, `buildTenantMetadata` | ✅ izvedeno |
| Rezervacije: storitve, termini, urniki, čakalna lista (#79) | `(admin)` booking poti | ✅ izvedeno |
| Polog / deposit (#93) + transakcijska varnost | advisory lock + tx + unique payment | ✅ izvedeno |
| Dodatki storitvam — add-ons (#92) | `Service.addOns` | ✅ izvedeno |
| Dinamični obrazci + polymorphic `contextType/contextId` | `FormDefinition/FormSubmission` | ✅ izvedeno (#96 pripete) |
| Konverzija oddaj → delovni nalog | `src/app/actions/forms.ts` | ✅ izvedeno |
| Marketing v1: REACTIVATION / NO_SHOW kampanje (#95) | `src/lib/marketing/campaigns.ts`, cron tick | ✅ v1 izvedeno (BIRTHDAY v delu) |
| Stripe per-tenant + Checkout webhook | `src/lib/payments/*` | ✅ izvedeno (card-on-file #97 manjka) |
| WCAG kontrastna zaščita v CI, nevtralna platformska lupina (#94) | `platform-theme.ts`, palete | ✅ izvedeno |
| Testi (vitest) + axe rescan + playwright e2e | `tests/` (851), `scripts/axe-rescan.mjs`, `e2e/` | ✅ zeleni |

---

## 3. Matrika: zahteva → obstaja → manjka → faza

Iz vseh treh dopolnitev #100 (22:03, 22:07, 22:09 UTC).

| # | Zahteva | Kaj obstaja | Kaj manjka | Faza |
|---|---|---|---|---|
| 1 | Preimenovanje v MARKEC – MY BUSINESS PLATFORM | vse vidne točke (ta F0 commit) | repo/package/URL-ja se ne preimenujejo (§9) | **F0** |
| 2 | SKD 2025 katalog (uradna klasifikacija 22 sekcij + 21 začetnih področij iz #100, hierarhija, več izbir, lastne oznake, preskok) | 11 profilov, `/start` čarovnik | podatkovni katalog SKD + shranjevanje izbire/oznak na Organization | **F1** |
| 3 | Dejavnost ni obvezna | `generic` profil; preskok izbire | potrditi preskok na vseh vstopnih tokovih | **F1** |
| 4 | Predlogi modulov po izbranih dejavnostih (ne zaklep) | capabilities per profil | mapiranje SKD → priporočeni moduli (samo predlog) | **F1** |
| 5 | Vklop/izklop celotnega modula | `modules-configurator` (override) | nič | obstaja |
| 6 | Vklop/izklop posamezne funkcije znotraj modula | capabilities granularno delno | per-function stikala + shranjevanje | **F2** |
| 7 | Odvisnosti med moduli (opozorilo pred aktivacijo, ne tiho spreminjanje) | nič | deklarirane odvisnosti + potrditveni tok | **F2** |
| 8 | 5 dejanj: vklopi/izklopi, prikaži/skrij, objavi/umikni, arhiviraj/obnovi, izbriši | publish gate (3. dejanje delno) | preostala dejanja z ohranitvijo podatkov | **F2–F5** |
| 9 | Specializirani sklopi po dejavnostih (17 primerov iz §4 dopolnitve) | 9 razširitev (vozilo, mere, projekti, …) | ostale razširitve po povpraševanju | **F3+** |
| 10 | No-code izdelovalnik lastnih modulov | nič | celoten podprojekt | **ločen pod-issue** |
| 11 | Kontekstualna pomoč »Kako to uredim?« | nič | helpRegistry + komponenta pomoči | **F4** |
| 12 | Kontrola pripravljenosti + konkretna opozorila z gumbom | nič | readiness checks per modul | **F4** |
| 13 | Predogled, osnutek/objava/umik brez izgube različice | publish gate obstaja | različice vsebine | **F5** |
| 14 | Walk-in vrsta (samostojen izbirni modul za VSE dejavnosti — odločitev AD-02) | nič | modul + javni vstop | **#98** |
| 15 | Funkcionalna odjava od e-pošte (odločitev AD-03) | nič | `emailUnsubscribedAt` + token tok + upoštevanje pri pošiljanju | **#95** |
| 16 | BIRTHDAY kampanja + segmenti po oznakah | stashed WIP (schema + `pickBirthdayTargets`) | zaključek + UI + odjava | **#95** |
| 17 | Card-on-file: privolitev, avtorizacija prihodnjih plačil, varnost, vračila (odločitev AD-07) | Stripe osnova | mandate/consent model + odpovednina | **#97** |
| 18 | PWA + push za lastnika + dnevni digest | manifest osnova | service worker, push, digest job | **#99** |
| 19 | Obrazci pripeti terminu (reuse motorja) | `contextType/contextId` pripravljeno | pripet tok na Appointment | **#96** |

---

## 4. SKD 2025 — uradna klasifikacija (22 sekcij) in začetni katalog področij

**Uradni vir (preverjeno 2026-11-05 na SURS Klasje, klasifikacija `SKD_2025` V1):**
SKD 2025 je veljaven od 1. 1. 2025 (Uredba o standardni klasifikaciji dejavnosti,
**Uradni list RS, št. 27/2024**; podlaga: delegirana uredba Komisije (EU) 2023/137 —
NACE Rev. 2.1). Hierarhija: **sekcija** (raven 1, vzorec `A`) → **oddelek** (raven 2,
vzorec `A11`) → **skupina** (raven 3) → **podrazred** (raven 5, vzorec `A11.110`).
Raven 1 ima **22 zapisov (sekcije A–V)**, raven 2 ima 87 zapisov (oddelki).

### 4a. Uradne sekcije SKD 2025 (A–V)

| Sekcija | Naziv |
|---|---|
| A | Kmetijstvo in lov, gozdarstvo, ribištvo |
| B | Rudarstvo |
| C | Predelovalne dejavnosti |
| D | Oskrba z električno energijo, plinom, paro in hladnim zrakom |
| E | Oskrba z vodo, ravnanje z odplakami in odpadki, saniranje okolja |
| F | Gradbeništvo |
| G | Trgovina |
| H | Prevoz in skladiščenje |
| I | Nastanitvene in gostinske dejavnosti |
| J | Založništvo, radiodifuzija ter produkcija in distribucija vsebin |
| K | Dejavnosti v zvezi s telekomunikacijami, računalniškim programiranjem, svetovanjem, računalniško infrastrukturo in drugimi informacijskimi storitvami |
| L | Finančne in zavarovalniške dejavnosti |
| M | Poslovanje z nepremičninami |
| N | Strokovne, znanstvene in tehnične dejavnosti |
| O | Druge raznovrstne poslovne dejavnosti |
| P | Dejavnost javne uprave in obrambe, dejavnost obvezne socialne varnosti |
| Q | Izobraževanje |
| R | Zdravstvo in socialno varstvo |
| S | Kulturne, športne in rekreacijske dejavnosti |
| T | Druge dejavnosti |
| U | Dejavnost gospodinjstev z zaposlenim hišnim osebjem ter proizvodnja za lastno rabo |
| V | Dejavnost eksteritorialnih organizacij in teles |

### 4b. Začetni katalog področij platforme (21 skupin iz #100) in pokritost

Začetni katalog iz dopolnitve #100 je **panožno skupinjanje področij** (21 skupin),
ki se v F1 mapira na uradne sekcije/oddelke SKD 2025. SKD je **referenčni vir
predlogov**, ne omejitev: uporabnik izbere več dejavnosti, doda lastne oznake ali
izbiro **preskoči** (odločitev AD-05). Katalog živi kot podatkovna datoteka
(razširljivo, ne fiksen seznam v logiki).

| # | Področje (začetni katalog #100) | Pokritost danes | Presoj |
|---|---|---|---|
| 1 | Lepota in osebna nega | beauty, frizer, barber, nails, cosmetica, massage, epilation | ✅ pokrito |
| 2 | Zdravje in terapevtske storitve | massage/wellness delno | ➕ novo (F1 katalog, moduli po potrebi) |
| 3 | Avtomobili, motorji in kolesa | tire-service + extension `vehicle-workshop` | 🟡 delno (detailing, pralnica, motorna kolesa) |
| 4 | Gradbeništvo in instalacije | extension `projects` delno | 🟡 delno |
| 5 | Obrt, popravila in izdelava | seamstress + extension `batch-production` | 🟡 delno |
| 6 | Čiščenje in vzdrževanje | ponavljajoča opravila delno | 🟡 delno |
| 7 | Kmetijstvo in naravne dejavnosti | beekeeping (+ panjska postaja) | 🟡 delno |
| 8 | Gostinstvo in prehrana | rezervacije prek generic | ➕ novo |
| 9 | Trgovina in prodaja | izdelki, košarica, naročila | 🟡 delno (POS, kuponi) |
| 10 | Turizem in nastanitve | — | ➕ novo |
| 11 | Prevoz in logistika | extension `delivery-runtime` | 🟡 delno |
| 12 | Kreativne in medijske dejavnosti | generic + galerije | 🟡 delno |
| 13 | Digitalne in tehnološke storitve | generic + `projects` | 🟡 delno |
| 14 | Izobraževanje in svetovanje | generic | ➕ novo (tečaji, prijave) |
| 15 | Šport in rekreacija | extension `memberships` delno | 🟡 delno |
| 16 | Živali | generic | ➕ novo (pasji salon — podatki o živali) |
| 17 | Nepremičnine in upravljanje objektov | `projects` | 🟡 delno |
| 18 | Najem in izposoja | extension `workspace-resources` | 🟡 delno |
| 19 | Dogodki in prireditve | — | ➕ novo |
| 20 | Strokovne in druge storitve | `projects` + generic | 🟡 delno |
| 21 | Druge in nove dejavnosti | `generic` + lastne oznake | 🟡 F1 dopolni lastne oznake |

**Model shranjevanja (F1):** `Organization.skdCodes String[]` (izbrane šifre),
`Organization.customTags String[]` (lastne oznake). Izbira je nasvet, ne zaklep:
profili/capabilities se aktivirajo šele, ko uporabnik **potrdi predlagane module**.

---

## 5. Modulna arhitektura — pravila (obvezna za vse faze)

1. **Enotno jedro:** vsi najemniki uporabljajo isto platformo; dejavnost ne ustvarja
   ločene aplikacije (profili in razširitve so konfiguracijske predloge).
2. **Izklop ≠ izguba podatkov:** izklop modula/funkcije je override; rezervacije,
   naročila, plačila in zgodovina ostanejo. Javni vhodi izklopljenega modula se
   varno onemogočijo (ne samo skriti gumb v UI).
3. **Pet dejanj, jasno ločenih:** vklopi/izklopi · prikaži/skrij · objavi/umikni ·
   arhiviraj/obnovi · izbriši (trajno, s potrditvijo in preverjanjem povezav).
4. **Odvisnosti deklarirane:** aktivacija odvisnega modula uporabnika eksplicitno
   vpraša; sistem ne spreminja nastavitev tiho.
5. **Pravice na strežniku:** vsaka akcija preveri dovoljenja in najemniško izolacijo
   (tenant isolation) na strežniški strani.
6. **Pred izklopom odvisne funkcije** sistem pokaže razumljivo opozorilo in varen
   postopek.
7. **Dokaz delovanja:** funkcija je »dokončana« šele, ko dejansko deluje, shranjuje
   podatke in spoštuje pravice — UI sam ni dokaz (odločitev AD-10).

---

## 6. Načrt faz

| Faza | Vsebina | Povezave |
|---|---|---|
| **F0** | Pregled kode, ta dokument, varno preimenovanje v MARKEC | ta commit |
| **F1** | SKD 2025 katalog kot neobvezen korak v vodenem vstopu: iskanje, več izbir, lastne oznake, preskok; predlogi modulov brez zaklepa | #100 |
| **F2** | Per-function stikala znotraj modulov + deklarirane odvisnosti + opozorila pred izklopom | #100 |
| **F3** | Specializirani sklopi po dejavnostih (postopno, po prioriteti uporabnikov) | #100 |
| **F4** | Kontekstualna pomoč »Kako to uredim?« + kontrola pripravljenosti z direktnimi prehodi | #100 |
| **F5** | Različice vsebine: osnutek/objava/umik brez izgube delujoče različice | #100 |
| **#95→#97** | Po končani F1: marketing zaključek (odjava funkcionalna), walk-in kot samostojen modul, obrazci na terminu, PWA/digest, card-on-file | glej §7 |

Vrstni red po potrditvi (2026-11-04): **F0 → F1 → #95 → #94 zaključek → #98 → #96 → #99 → #97**,
no-code builder vzporedno kot ločen podprojekt.

---

## 7. Ločeni podprojekti

- **No-code izdelovalnik modulov** — ločen večji podprojekt (odločitev AD-06),
  ustvarjen kot pod-issue #101 pod krovno #100. Varen konfiguracijski model:
  uporabnik ne sme izvajati strežniške kode ali posegati v sistemske podatke.
- **#97 Card-on-file** — privolitev (mandate), avtorizacija prihodnjih plačil,
  varnost (ni shranjevanja surovih kartic), vračila; ločen sklop z lastnimi testi.
- **#99 PWA + push + digest** — service worker, push za nov termin/odpoved,
  dnevni digest lastniku.

---

## 8. Odločitve (dnevnik, potrjeno 2026-11-04)

- **AD-01** — #100 ostane **odprt** kot krovni arhitekturni issue, dokler niso
  zaključene vse ključne zahteve in podnaloge. Ne zapirati po F0.
- **AD-02** — Walk-in je **samostojen izbirni modul za vse dejavnosti**, ne samo
  za avtoservis in vulkanizerstvo (#98).
- **AD-03** — Odjava od e-pošte v #95 mora biti **dejansko funkcionalna**
  (token, shranjevanje stanja, upoštevanje pri vsakem pošiljanju).
- **AD-04** — F0 = pregled kode + ta dokument + preimenovanje RC Beauty →
  **MARKEC – MY BUSINESS PLATFORM**. Ne prepisujemo aplikacije.
- **AD-05** — SKD 2025 = **katalog predlogov**: več izbir, lastne oznake, preskok.
- **AD-06** — No-code izdelovalnik = **ločen večji podprojekt** (#101).
- **AD-07** — Card-on-file: pravilno urediti **privolitev, avtorizacijo prihodnjih
  plačil, varnost in vračila**.
- **AD-08** — Pred vsako spremembo preveriti **odprte issue-e, PR-je in delo drugih
  agentov**; ne podvajati ne prepisovati.
- **AD-09** — Vsak sklop = **ločen commit + testi + lint + poročilo z dokazom**
  dejanske funkcionalnosti.
- **AD-10** — Nalog ne zapiramo zgolj zaradi UI: funkcija mora **dejansko delovati,
  shranjevati podatke in spoštovati pravice**.

---

## 9. Tehnična imena, ki **namenoma ostajajo** (merilo 5 iz dopolnitve 22:03)

| Ime | Vrsta | Zakaj ostaja |
|---|---|---|
| GitHub repo `rcbeautysalon` | URL | preimenovanje repozitorija je administrativna odločitev lastnika (redirecti, CI, odprti linki) |
| `package.json` name `beauty-salon` | notranje ime | ni uporabniško vidno; brez funkcionalnega učinka |
| slug organizacije `rc-beauty`, id `org_rcbeauty` | podatek/URL | obstoječi podatki in javni URL `/s/rc-beauty` — brez migracije se ne spreminja |
| demo e-pošte `*@rcbeautysalon.org` | prijavni podatki | obstoječi uporabniki/racuni ostanejo (AD: ohrani uporabnike); demo prikaz samo v dev načinu |
| Vercel URL `rcbeautysalon-phi.vercel.app` | URL | produktna domena — ločena odločitev o domeni MARKEC |
| tehnični identifikatorji v DB/API | ključi | ne spreminjati na slepo (varnost podatkov, delovanje) |

**Preimenovano v F0 (uporabniško vidno):** meta title/description + openGraph
(`layout.tsx`), OG-slike (`og/route.tsx`), besedilna identiteta na prijavi,
`public/manifest.json` (PWA ime), naslovna komentarja v `globals.css`, e-poštna
predloga za aktivacijo računa, README naslov, demo prikazna imena v seed
(`SalonConfig.name`, `Organization.name` — samo prikazna imena, ne slug/e-pošte),
ter testne trditve, ki sledijo znamki.

---

## 10. Merila dokončanosti (skupno vsem fazam)

Sklop je **dokončan**, ko veljajo vsa merila:

1. Funkcija deluje na računalniku **in** telefonu (ne samo vizualni prikaz).
2. Podatki se **dejansko shranjujejo** in so ohranjeni po ponovni prijavi.
3. Pravice in izolacija najemnikov preverjene **na strežniški strani**.
4. Izklop/funkcija ne izgubi podatkov, zgodovine, rezervacij, plačil ali dokumentov.
5. Avtomatizirani testi + lint zeleni; vsak sklop ločen commit (AD-09).
6. Poročilo na issue vsebuje **dokaz** (kaj se je spremenilo, kaj ostalo in zakaj).
