# RC Beauty Salon — večnajemniška platforma za salone lepote

Sodobna full-stack platforma za upravljanje frizerskih in kozmetičnih salonov, zgrajena z **Next.js 16**, **React 19**, **TypeScript** in **Tailwind CSS v4**.

🌐 **V živo:** [https://rcbeautysalon-phi.vercel.app](https://rcbeautysalon-phi.vercel.app)

Ena namestitev streže **več neodvisnim salonom** — vsak s svojo domeno (`/s/ime-salona`), temo, vsebino, storitvami, osebjem in plačili.

## ✨ Zmožnosti

### 🏢 Univerzalna platforma za vse dejavnosti (EPIC #1)
- **Profilni motor dejavnosti** — dejavnost določa CELO izkušnjo, ne samo izgled: module, terminologijo (SL/EN), obrazce, delovne procese, dashboard widgete, javni CTA način (`booking | inquiry | order | quote`) in razširitve
- **11 profilov dejavnosti**: lepotni salon, frizer, barber, nohti, kozmetika, masaža, epilacija, šiviljstvo, **vulkanizer & avtoservis**, **čebelarstvo** + univerzalno
- **Matrika zmožnosti `required | optional | disabled`** — irelevantni moduli se nikjer ne izrisujejo (npr. čebelarstvo brez terminov, delovnih nalog in storitev)
- **Univerzalna delovna naročila** s konfigurabilnimi procesi (stopnje, validirani prehodi, popolna sled dogodkov)
- **Dinamični obrazci** — javna povpraševanja + admin inbox, urejanje polj brez kode, strežniška validacija vsakega polja
- **Evidence po razširitvah** (§13) — evidenca vozil in gum za vulkanizerja, serije/žetev za čebelarstvo, mere za šiviljstvo; nova razširitev = samo vnos v register, brez kode in brez migracije
- **Katalog**: storitve, izdelki, variante, paketi (storitve + izdelki), ponudbe in računi s številčenjem po najemniku
- **Lastniška prilagoditev**: moduli vklop/izklop, dashboard widgeti, urejevalniki obrazcev in procesov — vse verzionirano, brez programiranja

### 🧩 Razširitve in več dejavnosti (EPIC #2)
- **Registry razširitev zmožnosti** — deklarativni vnosi z tipiziranimi odvisnostmi; nova razširitev = samo vnos v register + test ([vodnik](docs/ADD-NEW-TEMPLATE.md))
- **Projekti + naloge (E2-3)** — večnevski posli (fotograf/čistilec/šiviljstvo): pravilo zaključka (vse naloge DONE → projekt COMPLETED), opozorila rok
- **Inventarni runtime (E2-2)** — `StockMovement` LEDGER: prihod/odhod v transakciji, negativna zaloga zavrnjena, sledljivost serij prek `ExtensionRecord`
- **Več dejavnosti pod enim računom (E2-4)** — sekundarna panoga kot **unija zmožnosti**: moduli obeh se združijo, terminologija/obrazci/stran ostanejo od primarne (vulkanizer + trgovina)
- **Zgodovina konfiguracije + rollback (E2-5)** — append-only sled vsake spremembe modulov/obrazcev/procesov; povrnitev ustvari NOVO verzijo, zgodovina se nikoli ne prepiše

### 🚀 SaaS platforma (EPIC #3)
- **Objava/predogled strani** — DRAFT/PUBLISHED/UNPUBLISHED življenjski cikel, snapshot objave, povrnitev verzij vsebine
- **Naročnine + plani** — FREE/PRO/SCALE register, limiti pri novih vnosih, raba „X/Y“ z opozorili pri 80 %, Stripe checkout + idempotenten webhook, grace politika (neplačilo/downgrade **nikoli** ne briše podatkov — [GRACE-POLICY](docs/EPIC-3/GRACE-POLICY.md))
- **Lastne domene** — verifikacija prek Vercel Domains API (VERIFIED izključno s potrditvijo ponudnika), DNS navodila v UI, host-based razrešitev najemnika
- **Operaterska konzola `/platform`** — najemniki, naročnine, suspend/reaktivacija z revizijsko sledjo
- **React 19 `action={}` obrazci (F1)** — kritični obrazci na React 19 vzorec z kontroliranimi polji in FormData pomočniki (`src/lib/forms/form-data.ts`)

### 📊 Analitika, zdravje in vizualni pregled (EPIC #4) — **ZAKLJUČENO**
- **Platformna analitika (E4-1)** — distribucija paketov, konverzija, odhod, prihodki, webhook zdravje v operaterski konzoli `/platform` (vse izpeljano iz obstoječih tabel)
- **Najemniška analitika (E4-2a/2b)** — povpraševanja s poštenimi praznimi stanji; neobvezen lastni GA4 Measurement ID (skript izključno v objavljeni strani, platforma sama ne sledi)
- **Webhook dnevnik napak (E4-3)** — vsaka neuspešna dostava vedno zabeležena, vidna v `/platform`, pošteno omejen zapisovalnik zoper zlorabe, idempotenca ostane
- **Najemniški Stripe ključi (E4-3b)** — izključno lastniški vnos; env fallback odstranjen (platforma ne more imeti ključa)
- **Nadaljevanje namestitve (E4-4)** — osnutek čarovnika v localStorage: „Nadaljuj, kjer si ostal?“ na `/start`, gesla strukturno izključena iz osnutka, TTL 7 dni, brisanje po uspešni kreaciji
- **Health endpoint + alerting priprava (E4-5)** — javen `/api/health` brez DB, operaterski `/api/health/internal` fail-closed (DB ping, stanje migracij, webhook števci); runbook v [ROLLBACK-BACKUP.md §6](docs/ROLLBACK-BACKUP.md)
- **Vizualni pregled + testni podatki** — 10 demo najemnikov pokriva vseh 11 panog s popolnimi katalogi (storitve/izdelki s slikami, preset portreti osebja, hero slike po panogi); praktični testi rezervacije, trgovine in lastniške plošče na produkciji; DOM preverba slik 10/10 brez napak; popravljene najdene napake: CTA puščanje med najemniki, mrtev checkout gumb, mrtvi sidri, podvojeni jezikovni preklopnik, slugify č/š/ž, a11y nalaganja slik — [docs/EPIC-4/PLAN.md](docs/EPIC-4/PLAN.md)
- **Vloge po meri (G8, E4-6)** — katalog 12 dovoljenj, vloge per salon („admin brez financ“, „senior frizer“), urejevalnik na `/dashboard/roles`; **polna matrika uveljavljena na ravni AKCIJ in STRANI** (E4-6b): vsaka admin akcija preverja dovoljenje (`requirePermissionOrg`), vse dashboard strani imajo varovala (`requirePagePermission`), navigacija nikoli ne pokaže povezave, ki jo stran zavrne; skrcen admin ne more eskalirati (ustvarjanje ADMIN računov in urejanje kataloga vlog je rezervirano za neskrčene admine), prihodki so vidni samo z dovoljenjem `finances.view` (tudi na landing strani); član brez vloge po meri ima nespremenjen dostop, vloga po meri ga OMEJI (velja takoj, sveže iz DB ob vsaki zahtevi); košarica ločena per salon, rezervacijski čarovnik z inline izbiro storitve
- **Rezervacija brez spletnega plačila** — salon brez Stripe ključa ne blokira rezervacij: gumb „Oddaj rezervacijo (brez pologa)“ ustvari PENDING termin (polog ob obisku), pošten potrditveni zaslon in e-pošta; napake checkouta vedno toast + inline (nobena tiha okvara)
- **Per-tenant SEO** — naslov/opis iz SEO nastavitev najemnika, Open Graph + Twitter kartice (hero slika ali logotip), canonical na `/s/{slug}` (goli dostop se deduplira), `noindex` za osnutke in dashboard
- **Ponastavitev gesla** — samoslužni tok prek e-pošte (žeton 1 h, pošteno sporočilo neodvisno od obstoja računa) + admin ponastavitev članu iz `/dashboard/users/[id]`: močno generirano geslo brez dvoumnih znakov, org-scoped, zaščiteno (ne samo-sebi, ne drugim adminom), pošteno i18n SL/EN

### 🏢 Večnajemniškost (multi-tenant)
- Vsak salon dobi svojo javno stran pod `/s/[slug]` (npr. `/s/salon-luna/rezervacija`)
- **Izolacija najemnikov** — vsaka poizvedba org-scoped, shemski guardrail test zahteva `organizationId` + indeks na vseh najemniških modelih, runtime izolacijski skript
- **Profili dejavnosti** — vnaprej pripravljene predloge po panogi, ki jih lastnik lahko preglasi (overrides ne mutirajo skupnega profila)
- **Tema engine** — palete + pisave na nivoju organizacije, urejanje vsebine (hero, odprt čas, o nas …)
- **Samostojno vključitev (onboarding)** — nov salon se registrira na `/start`, izbere dejavnost in takoj dobi celotno stran z materializiranimi obrazci, procesi in katalogom

### 📅 Rezervacije
- Spletna rezervacija s pologom (znesek nastavi salon, privzeto **50 €**)
- Koledar z **uvojitvijo `Europe/Ljubljana`** — termini so natančni na časovni pas (date-fns tz)
- Preverjanje razpoložljivosti v realnem času, izbira storitve in osebja
- Preklic / prestavitev rezervacije s strani stranke
- Samodejna e-poštna potrdila in opomniki

### 🛍️ Trgovina (e-commerce)
- Katalog izdelkov s slikami, košarica (Zustand), Stripe checkout
- Upravljanje naročil in zalog v nadzorni plošči
- Valuta salona (EUR) — brez trdo kodiranih USD

### 💳 Stripe plačila — **admin vnese ključe sam**
Ni treba urejati environment spremenljivk! Lastnik salona v **Nastavitve → Plačila** sam vnese:
1. **Skrivni ključ** (`sk_live_…` / `sk_test_…`) — pred shranjevanjem se preveri prek Stripe API-ja
2. **Webhook skrivnost** (`whsec_…`) — za zanesljive potrditve plačil

Varnost:
- Ključ vnaša salon sam in je vezan na organizacijo (multi-tenant); platforma **nima skupnega ključa** — plačila vedno gredo neposredno na salona lastni Stripe račun
- Ključ se **nikoli** ne vrne brskalniku — samo maskiran prikaz (`sk_live_••••1234`)
- Webhook preverja podpis s skrivnostmi organizacij (vsak salon registrira endpoint v svojem Stripe računu) — brez platformne/env skrivnosti (E4-3b)
- Fallback na okolje je **namenoma odstranjen** (E4-3b): brez lastnega ključa se plačila elegantno degradirajo (prijazno sporočilo, brez sesutja)

### 🌐 Dvojezičnost (i18n)
- **Slovenščina (privzeto)** + angleščina (preklopnik v admin glavi **in javnem navbarju** — isti cookie, izbira velja povsod)
- **Javno prevedeno**: navbar + mobilni meni in **celoten rezervacijski čarovnik** (koraki, polja, povzetek, gumbi, napake, validacijska sporočila, datumi po lokalni konvenciji)
- Še v slovenščini: vsebina domače strani (hero/sekcije — podatki najemnika), trgovina/košarica, podnožje; prevod je načrtovan
- Jezikovni preklopnik nastavi tudi `<html lang>` (a11y/SEO) in CTA oznako najemnika

### 👥 Vloge
| Vloga | Dostop |
|---|---|
| `ADMIN` | Nadzorna plošča: analitika, termini, storitve, izdelki, stranke, osebje, nastavitve, plačila |
| `STAFF` | Staff portal: lastni termini, urnik, stranke |
| `CLIENTE` | Rezervacije, trgovina, moji termini / naročila / ocene |

### 📧 E-pošta
React Email predloge: potrdilo rezervacije, opomnik 24 h, prestavitev, zaključen termin, no-show, aktivacija računa, ponastavitev gesla, potrdilo naročila.

## 🚀 Tehnologije

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Jezik:** TypeScript 5
- **Styling:** Tailwind CSS v4 + shadcn/ui + Phosphor/Lucide ikone
- **Baza:** PostgreSQL (Neon) + Prisma ORM
- **Avtentikacija:** NextAuth.js v5 (Prisma adapter)
- **Plačila:** Stripe (ključi na nivoju organizacije)
- **E-pošta:** React Email
- **Obrazci:** React Hook Form + Zod
- **Paketni upravitelj:** pnpm ≥ 10 (pin v `packageManager`, edini lockfile: `pnpm-lock.yaml` — #57)

## 📦 Lokalna namestitev

> #57: repozitorij ima **en sam lockfile** (`pnpm-lock.yaml`), različica pnpm pa je
> pripeta v `package.json` → `packageManager`. Corepack zaganja točno to različico.

```bash
# 0. Node ≥ 20.9 (priporočeno 22 LTS) + pnpm prek Corepacka
corepack enable       # uporabi pnpm iz polja packageManager

# 1. Namesti odvisnosti (deterministično, enako kot Vercel/CI)
pnpm install --frozen-lockfile

# 2. Nastavi okolje
cp .env.example .env   # izpolni spodnje spremenljivke

# 3. Baza
pnpm exec prisma generate
pnpm run db:push       # ali: pnpm run db:migrate
pnpm run db:seed       # (neobvezno) vzorčni podatki

# 4. Zaženi
pnpm run dev           # http://localhost:3000
```

### Okoljske spremenljivke

```env
DATABASE_URL="postgresql://user:password@localhost:5432/beauty_salon"
AUTH_SECRET=""              # openssl rand -base64 32
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Stripe — NEOBVEZNO in NEDOSTOPNO za najemniška plačila: ključe vnese
# vsak salon lastnik v Nastavitve → Plačila (E4-3b: env fallback je odstranjen)
# PLATFORM_STRIPE_* pa so izključno platformin lastni račun za naročnine SaaS
```

> 💡 Najemniški Stripe ključi se VEDNO vnesejo prek nadzorne plošče (lastnik salona) — platforma ne hrani skupnega ključa. `PLATFORM_STRIPE_*` velja samo za platformin lastni račun za naročnine.

## 💳 Nastavitev Stripe (za lastnika salona)

1. Prijavi se kot admin → **Nastavitve → Plačila**
2. V [Stripe Dashboard → Developers → API keys](https://dashboard.stripe.com/apikeys) kopiraj **Secret key** (`sk_test_…` za testiranje, `sk_live_…` za produkcijo)
3. Prilepi v aplikacijo → **»Shrani in preveri ključ«** — aplikacija takoj preveri veljavnost ključa prek Stripe API-ja
4. (Priporočeno) V Stripe: **Developers → Webhooks → Add endpoint**:
   - Naslov: `https://tvoja-domena.si/api/webhooks/stripe`
   - Dogodek: `checkout.session.completed`
   - Skrivnost (`whsec_…`) prilepi v **Nastavitve → Plačila**
5. Status se spremeni v »Testni način« / »Živi način« — plačila so aktivna ✅

## 🗂️ Struktura projekta

```
src/
├── app/
│   ├── (public)/            # Javne strani (na /s/slug preko proxyja)
│   │   ├── page.tsx         # Domov
│   │   ├── booking/         # Rezervacija (+ uspeh / preklic)
│   │   ├── services/        # Storitve
│   │   └── staff/           # Osebje
│   ├── (customer)/          # Strankov portal
│   │   ├── shop/            # Trgovina
│   │   ├── cart/ checkout/  # Košarica + blagajna
│   │   └── my-appointments/ my-orders/ my-reviews/ my-account/
│   ├── (staff)/             # Staff portal
│   ├── (admin)/dashboard/   # Nadzorna plošča
│   │   ├── analytics/ appointments/ orders/
│   │   ├── products/ services/ users/ staff/
│   │   └── settings/        # Nastavitve (vklj. zavihek Plačila)
│   ├── (auth)/              # Prijava, registracija, /start (onboarding) …
│   ├── actions/             # Server Actions (appointments, payments, …)
│   └── api/webhooks/stripe/ # Stripe webhook (večnajemniška verifikacija)
├── components/              # UI + dashboard + booking + shop komponente
├── lib/
│   ├── i18n/                # SL/EN slovarji + provider
│   ├── verticals.ts         # Panoge: palete, pisave, vzorčne vsebine
│   ├── stripe.ts            # Stripe na nivoju organizacije + validacija ključev
│   ├── booking-time.ts      # Časovni pasi (Europe/Ljubljana)
│   ├── org-path.ts          # orgPath() — /s/slug predpone
│   ├── auth/                # NextAuth + guards (requireRole …)
│   └── email/               # React Email predloge
└── proxy.ts                 # Middleware: /s/[slug]/* → /* + x-org-slug + role guards
```

## 🏗️ Kako deluje večnajemniškost

1. Zahteva na `/s/salon-luna/booking` → middleware (`src/proxy.ts`) prepiše na `/booking` in nastavi glavo `x-org-slug: salon-luna`
2. Vse poizvedbe v bazi se filtrirajo po organizaciji (`src/lib/tenant.ts`)
3. Vsaka organizacija ima svoje: temo, vsebino, storitve, osebje, stranke, izdelke, Stripe ključe, valuta in časovni pas
4. Nov salon: registracija na `/start` → izbira panoge (vertikale) → samodejno ustvarjanje kategorij, storitev in teme

## 🚢 Deployment

### Vercel + Neon (trenutna nastavitev)
1. Repo povezan z Vercelom — vsak push na `main` se samodejno deploya
2. Baza: [Neon](https://neon.tech) PostgreSQL
3. Webhook endpoint: `https://rcbeautysalon-phi.vercel.app/api/webhooks/stripe`

### Drugi ponudniki baz
Neon ✅ · Supabase · Railway — katerikoli PostgreSQL

## 🛠️ Razvoj

```bash
pnpm run dev          # dev strežnik (Turbopack)
pnpm run build        # produkcijski build
pnpm run lint         # ESLint
pnpm run test         # vitest — profilni motor, razširitve, unija dejavnosti, zgodovina konfiguracije, viri v razporejevalniku, obrazni FormData vrata, platformna + najemniška analitika, čarovniški osnutek, orgPath predpone (500+ testov)
DATABASE_URL=… pnpm exec tsx scripts/verify-tenant-isolation.ts   # runtime preverba izolacije najemnikov
pnpm run format       # Prettier
pnpm run db:studio    # Prisma Studio (GUI za bazo)
pnpm run db:seed      # vzorčni podatki
```

> #57: po vsaki spremembi odvisnosti poženi `pnpm install` (posodobi
> `pnpm-lock.yaml`) — Vercel build sicer pade z `ERR_PNPM_OUTDATED_LOCKFILE`.
> Če pnpm javi napačno različico, je Corepack ni prenesel: `corepack enable`.

Arhitektura in fazni načrti:
- EPIC #1 (univerzalna platforma): [`docs/EPIC-1/ARCHITECTURE.md`](docs/EPIC-1/ARCHITECTURE.md)
- EPIC #2 (razširitve po panogah): [`docs/EPIC-2/PLAN.md`](docs/EPIC-2/PLAN.md)
- EPIC #3 (SaaS platforma): [`docs/EPIC-3/PLAN.md`](docs/EPIC-3/PLAN.md)
- EPIC #4 (analitika + zdravje + vizualni pregled): [`docs/EPIC-4/PLAN.md`](docs/EPIC-4/PLAN.md)
- **Nov profil/razširitev v 1 datoteki + 1 testu:** [`docs/ADD-NEW-TEMPLATE.md`](docs/ADD-NEW-TEMPLATE.md)

## 🧪 Testni najemniki (demo podatki)

Produkcija vsebuje 10 demo najemnikov — po enega za vsako panogo, s popolnimi katalogi (storitve/izdelki s slikami), preset portreti osebja in hero slikami:

| Panoga | Javna stran | | Panoga | Javna stran |
|---|---|---|---|---|
| Frizer | [`/s/demo-frizer`](https://rcbeautysalon-phi.vercel.app/s/demo-frizer) | | Epilacija | [`/s/demo-epilacija`](https://rcbeautysalon-phi.vercel.app/s/demo-epilacija) |
| Barber | [`/s/demo-barber`](https://rcbeautysalon-phi.vercel.app/s/demo-barber) | | Lepotni salon | [`/s/demo-lepotni`](https://rcbeautysalon-phi.vercel.app/s/demo-lepotni) |
| Naili | [`/s/demo-nails`](https://rcbeautysalon-phi.vercel.app/s/demo-nails) | | Šiviljstvo | [`/s/demo-siviljstvo`](https://rcbeautysalon-phi.vercel.app/s/demo-siviljstvo) |
| Kozmetika | [`/s/demo-kozmetika`](https://rcbeautysalon-phi.vercel.app/s/demo-kozmetika) | | Vulkanizer | [`/s/demo-vulkanizer`](https://rcbeautysalon-phi.vercel.app/s/demo-vulkanizer) |
| Masaža | [`/s/demo-masaza`](https://rcbeautysalon-phi.vercel.app/s/demo-masaza) | | Čebelarstvo | [`/s/demo-cebelarstvo`](https://rcbeautysalon-phi.vercel.app/s/demo-cebelarstvo) |

Prijavni računi za testiranje:

| Vloga | E-pošta | Geslo | Opis |
|---|---|---|---|
| Platformni admin | `admin@rcbeautysalon.org` | `admin123` | konzola `/platform` + nadzorna plošča glavnega salona |
| Lastnik salona (frizer) | `nika@demo.si` | `demo1234` | nadzorna plošča za `/s/studio-nika` |
| Lastnik salona (naili) | `luna@demo.si` | `demo1234` | nadzorna plošča za `/s/nail-studio-luna` |
| Stranka | `cliente@rcbeautysalon.org` | `cliente123` | rezervacije, naročila, ocene |

> 💡 Plačila v demo najemnikih niso nastavljena (noben Stripe ključ) — rezervacijski polog in checkout prikažeta iskreno sporočilo »Spletna plačila še niso nastavljena«, kar je pričakovano vedenje (E4-3b).

## 📄 Licenca

Proprietary — vse pravice pridržane.

---

Zgrajeno z ❤️ — Next.js 16, React 19, Tailwind CSS v4 · 🇸🇮 po slovensko
