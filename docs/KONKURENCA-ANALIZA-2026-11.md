# Konkurenčna analiza: RCBeauty vs. Fresha · Booksy · Vagaro · Square Appointments

**Datum:** 2026-11-04 · **Obseg:** workflowi, UI/UX, funkcionalne luknje
**Metoda:** raziskava javnih strani/razglasov konkurence (viri na koncu) + revizija lastne kodebeze (potrjeno z grepom/branjem, ne ugibanje)
**Filozofija ocenjevanja:** ista kot v repu — vsak predlog mora imeti **dokumentirano posledico** za lastnika ali stranko; nič "fake it" (fail-closed, poštena UX)

---

## 1. Izvršni povzetek

RCBeauty je danes **funkcionalno na nivoju ali NAD** konkurenco na denarnem sloju (pologi kot pravilo, napitnine, provizije, vnaprej plačana vrednost, per-tenant Stripe) in **EDINSTVEN** na panogah (11 dejavnosti, terminologija, matrika zmožnosti, delovni nalogi). 

**Največje luknje niso v denarju, ampak v "sistemih priliva in obdržanja":**

| # | Luknja | Kdo to že ima | Vpliv |
|---|---|---|---|
| 1 | **Čakalna lista (waitlist)** | vsi štirje | izgubljeni prihodki ob vsaki odpovedi |
| 2 | **Marketing kampanje + segmenti strank** | vsi štirje | vsak mesec se začne "od nič" |
| 3 | **Dvopostopna sporočila / inbox** | Fresha (2026), Square | lastnik upravlja stike po 3+ orodjih |
| 4 | **Obrazec/konsultacija pripeta terminu** | Vagaro, Square | pri epilaciji/kozmetiki strokovno tveganje |
| 5 | **Kartica na datoteki (card-on-file)** | Booksy, Square | odpovednina neobdavžljiva → no-show ostaja brez cene |

**Priporočeni vrstni red:** 3 hitre zmage (P0, skupaj ~1 teden) → 5 epikov (P1) → strateške odločitve (P2). Detajli v §6.

---

## 2. Profili konkurence — kaj je NJIHOV superpower

| | Fresha | Booksy | Vagaro | Square Appointments |
|---|---|---|---|---|
| **Cenitev (2026)** | $19.95/mes solo; $14.95/član timu | naročnina, vse vključeno + marketplace | baza + dodatki (payroll ~$34/mes) | brezplačen 1 sedež; plačljive nadgradnje |
| **Superpower** | **embedded celostna izkušnja** (trgovina + rezervacija + pogovor v enem) | **marketplace + mobilna apka** lastnika (push-first dnevni ritem) | **širina**: obrazci, payroll, MySite, AI vsebine | **"interest → checkout"**: vse teče proti plačilu (add-ons, invoices, card-on-file) |
| **Razglasen razvoj 2026** | dvosmerna sporočila (WhatsApp/email/SMS inbox), napredna članstva, Fresha Capital, **AI recepcija**, viri per storitev, čakanje v vrsti/self check-in, stroški, cilji timu, ponudbe+računi | (kontinuiteta: kampanje, waitlist, gift cards, članstva) | AI opisi storitev/vsebin, instant payouts | booking **add-ons** z avto-ceno/časom, samodejne fakture per termin, AI sporočila |
| **Slabost, ki jo lahko izkoristimo** | 2026 so uvedli plačljive naročnine (dotedanji "zastonj" model posel) — cena postaja tem | močna vez na marketplace; manj fleksibilni za ne-lepotne panoge | dodatki dražijo (payroll +$34) | manj vertikalno globok (brez delovnih nalogov, brez panognih procesov) |

**Sklep:** konkurenca se sreče na "vse-v-enem za lepoto". RCBeauty ne zmaga s kopiranjem vsega, ampak z **istimi sistemi obdržanja na širših panogah + fiskalno + poštenostjo**.

---

## 3. RCBeauty danes — kar ŽE ima (revizija, ne marketing)

Potrjeno v kodi (datoteke so dokaz):

| Področje | Stanje | Dokaz |
|---|---|---|
| Rezervacije s pologom **kot pravilo** | ✅ INHERIT/NONE/FIXED/PERCENT + `Math.min` (polog nikoli > cena) | `src/lib/booking/deposit.ts` |
| Napitnine + provizije | ✅ `tipAmount`, `commissionAmount` zapisan ENKRAT ob COMPLETED | `prisma/schema.prisma` |
| Vnaprej plačana vrednost | ✅ darilni boni, paketi s seansami, liability poročilo; članstva v isti primitivi | `PrepaidProduct/Purchase/Redemption`, `tests/prepaid-value-80.test.ts` (31 testov) |
| Inventura retail sloj | ✅ DDV, črtna koda, znamka, enota, `forSale`, prejem blaga, inventura, paginacija | `tests/retail-inventory-78.test.ts` (37 testov) |
| **Vodena namestitev** (wizard → checklist → next-best-action) | ✅ Shopify/Fresha vzorec; solo odstrani korak osebja; "brez spletnih rezervacij" preformulira objavo | `src/lib/profiles/setup-checklist.ts`, `/start` korak 2 (#88) |
| Delovni nalogi + procesi + dinamični obrazci brez kode | ✅ materializirani per najemnik, verzionirano | `src/lib/profiles/materialize` |
| Vloge po meri per salon (12 dovoljenj) | ✅ matrika na AKCIJAH in STRANEH | `/dashboard/roles` (E4-6) |
| Dokumenti: računi + ponudbe, številčenje po najemniku, DDV | ✅ | `documents` |
| Opomniki po e-pošti | ✅ dnevni cron (tick) + `send-due-reminders` | `src/lib/jobs/` |
| Ocene kot prvo-razredna sekcija + JSON-LD | ✅ | `tests/batch-74-87.test.ts` |
| Per-tenant Stripe (platforma NE vidi najemniškega denarja) | ✅ namenoma, brez fallbacka | E4-3b |
| SL/EN + terminologija per panoga | ✅ `businessSingular/In/Genitive` + `{business}` interpolacija | #89 |
| SEO: per-tenant sitemap, OG, canonical, noindex osnutki | ✅ | #83, #74-87 |

**Vedno manjka (potrjeno z grepom: 0 zadetkov):** čakalna lista, kampanje/segmenti/oznake, dvosmerna sporočila, PWA/push, stroški, viri (dvigala/prostori), walk-in vrsta.

---

## 4. Matrika pokritosti (5 izdelkov × 14 področij)

🟢 = polno · 🟡 = delno · 🔴 = manjka

| Področje | Fresha | Booksy | Vagaro | Square | **RCBeauty** |
|---|---|---|---|---|---|
| Rezervacije + koledar | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| Pologi / no-show zaščita | 🟢 | 🟢 card-on-file | 🟡 | 🟢 card-on-file | 🟡 pravila ✅, card-on-file 🔴 |
| Čakalna lista | 🟢 | 🟢 auto-fill | 🟢 auto-notify | 🟢 auto-notify | 🔴 |
| Darilni boni / paketi / članstva | 🟢 | 🟢 | 🟢 | 🟡 | 🟢 boni+paketi; članstva 🟡 (scheduler) |
| Napitnine / provizije | 🟡 | 🟡 | 🟢 (payroll $) | 🟡 | 🟢 |
| Trgovina + inventura | 🟢 | 🟡 | 🟢 | 🟢 | 🟢 (+DDV, inventura — bolj kot Booksy) |
| Kampanje / segmenti | 🟢 AI blast | 🟢 | 🟢 AI | 🟢 AI | 🔴 |
| Dvosmerna sporočila | 🟢 2026 | 🟡 | 🟡 | 🟢 AI | 🔴 (samo transakcijski email) |
| Obrazci / konsultacije | 🟡 | 🟡 | 🟢 pripeti terminu | 🟢 med rezervacijo | 🟡 dinamični obrazci obstajajo, NISO pripeti rezervaciji |
| Ponudbe + računi | 🟢 2026 | 🟡 | 🟢 | 🟢 samodejno per termin | 🟢 (+ per-tenant številčenje) |
| Stroški / dobiček | 🟢 2026 | 🟡 | 🟢 | 🟢 | 🔴 |
| Cilji tima / payroll | 🟢 2026 | 🟡 | 🟢 +$34 | 🟡 | 🔴 (provizije so osnova) |
| Lastniška mobilna izkušnja | 🟢 web+app | 🟢 app push-first | 🟢 app | 🟢 app | 🔴 odzivni web (brez PWA/push) |
| AI pomočnik | 🟢 recepcija | 🟡 | 🟢 vsebine | 🟢 sporočila | 🔴 |
| **Več panog + terminologija** | 🔴 lepotno | 🟡 lepot+barber | 🟡 +gym/yoga | 🟡 širše, plitvo | 🟢 **11 panog, matrika zmožnosti** |
| **Delovni nalogi / procesi** | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 **edinstveno** |
| **Multi-tenant SaaS + lastna domena** | 🔴 | 🔴 | 🟡 (MySite) | 🔴 | 🟢 |

---

## 5. UX/workflow VZORCI za prevzem (ne funkcije, ampak obnašanja)

1. **Square — "interest → checkout"**: čakalna lista ni ločen seznam, ampak vstop v plačilo (kontakt + želja → ob odprtju EN klik do rezervacije s plačilom). Pri nas: prijava na čakalno listo → ob odpovedi ponudba termina s **povezavo direktno v rezervacijski čarovnik z vnaprej izpolnjeno storitvijo**.
2. **Square — add-ons s samodejno ceno/časom**: stranka izbere dodatek → cena, trajanje in razpoložljivost se preštejejo V ATOMU (brez ponovnega izračuna). Pri nas: dodaj "izboljšavo" (npr. +ulje za gume) v summary kartico.
3. **Booksy — push-first lastniški dan**: lastnikova apka je ENKANAL (danes: X terminov, 2 nova, 1 odpoved, 1 čakanje). Pri nas: **dnevni digest email + PWA push** (poceni, brez trgovin z aplikacijami).
4. **Vagaro — obrazec PRED prvim obiskom**: epilacija/kozmetika zahteva kontraindikacije → obrazec pripet storitvi, stranka izpolni pri rezervaciji, odgovori vidni lastniku v detajl termina. **Mi imamo dinamični obrazci urejevalnik per najemnik — konkurenca tega NIMA.** Reuse.
5. **Fresha — konsolidiran inbox**: vsi kanali v en pogled z zgodovino. Pri nas v1: **email nit per stranko** v dashboardu (Resend + inbound), SMS/WhatsApp kasneje (strošek/odločitev — §7).
6. **Fresha — next-best-action**: mi to ŽE imamo (vodena namestitev). Razširitev: po `firstJob` "rastni" način (že ima osnovo #55 growth card) → cilji tima.

---

## 6. Prioritizirani načrt

### P0 — hitre zmage (skupaj ~1 teden, velik vpliv na vsakdan)

| # | Kaj | Zakaj zdaj | Obseg |
|---|---|---|---|
| 1 | **Čakalna lista v1** (poštena): javna prijava "termin zaseden? obvesti me" (storitev+datum okoli), admin seznam per najemnik, ob odpovedi EN gumb "obvesti čakajoče" (email). **NE auto-book** — obvestilo + 1-klik rezervacija (Square pattern brez rizika) | vsi 4 konkurenti; največja prihranitev prihodka na odpoved | 2–3 dni: model `WaitlistEntry`, javni vnos v booking flow, admin kartica, email |
| 2 | **Oznake strank + segmenti v1**: proste oznake (VIP, rdeča, VIP-rdeča...), filter na Strankah, shramba `Customer.tags String[]` | temelj za VSE kampanje (P1#4); brez tega kampanje ne morejo biti ciljane | 1–2 dni |
| 3 | **Dodatki storitvi (add-ons)**: Service ➜ neobvezni doplačila (čas+cena), izbira v rezervacijskem čarovniku, avto prešteje skupno ceno/trajanje (Square atomarnost) | poveča povprečni raček; pošteno — cena vidna PRED potrditvijo | 2 dni |

### P1 — epiki (1–2 tedna vsak, zaporedno po P0)

| # | Kaj | Zakaj | Opomba |
|---|---|---|---|
| 4 | **Marketing sklop #1 — avtomatika**: reaktivacija (X dni brez obiska), rojstni dan, no-show follow-up. Email (Resend je v repu), predloge per najemnik, segmenti iz P0#2, pošteno: **vedno kazalec odjavljanja + log poslanih** | Booksy kampanje / Fresha blast; vsak mesec od nič → od nič NE | brez SMS v v1 |
| 5 | **Sprejemni obrazci pripeti terminu**: storitev ➜ obvezen/neobvezen obrazec (REUSE dinamičnega motorja), stranka izpolni ob rezervaciji ali po povezavi, odgovori v detajl termina | Vagaro/Square pattern; strokovno tveganje (epilacija); **naš motor urejanja brez kode je edinstven** | |
| 6 | **Kartica na datoteki + odpovednina** (issue #79 sklop D): Stripe SetupIntent ob rezervaciji s pologom, ob no-show zaračunaj | Booksy/Square; zaključi no-show zaščito | zahteva pravilnik + SLO pravne formulacije |
| 7 | **Walk-in vrsta za drive-in panoge** (vulkanizer, avtoservis): dashboard "živa vrsta" + javna stran "ste X. na vrsti"; Fresha 2026 self check-in | fit za NAŠE panoge, kjer konkurenca nima odgovora | |
| 8 | **PWA + push za lastnika**: manifest + service worker, push ob novem terminu/odpovedi + dnevni digest | Booksy app push-first; brez stroškov app store | |

### P2 — strateško (odločitev lastnika)

| # | Kaj | Odprto vprašanje |
|---|---|---|
| 9 | Dvosmerna sporočila (email nit v1 → SMS/WhatsApp v2) | strošek SMS per najemnik? WhatsApp Business API partner? |
| 10 | Stroški + dobiček (Fresha 2026) + cilji tima | ali v analytics ali v dokumente? |
| 11 | Viri per storitev (dvigalo, sauna) | relevantno za vulkanizer; Fresha 2026 |
| 12 | AI pomoč: opisi storitev SL/EN, predlogi odgovorov | **pošteno označiti** (ne skrivati AI); Vagaro vzorec |
| 13 | **Javni imenik objavljenih najemnikov** (marketplace-ish) | STRATEŠKA: SEO igra + nova stranka pridobitev PROTI beli oznaki "tvoja stran, tvoja domena" — potreben lastniški pozicijkski odgovor |

---

## 7. Kje je RCBeauty že NAPREJ (ne posnemati!)

1. **11 panog + terminologija + matrika zmožnosti** — noben konkurent nima delovnih nalogov, procesov, evidenc po razširitvah (vozila/gume, čebele/serije, mere šiviljstva).
2. **Per-tenant Stripe** — platforma ne dotika najemniškega denarja. Konkurenti jemljejo provizijo ali fee; to je prodajni argument ("tvoja trgovina, tvoja cena procesiranja").
3. **Poštena UX filozofija** — "setup required" namesto fake stanj, fail-closed dostopi, nobene tihe okvare. Konkurenti ob nekonfiguriranih ključih molčijo.
4. **Vloge po meri per salon** z matriko na akcijah in straneh — Square ima vgrajene vloge, ne per-tenant urejevalnika.
5. **Fiskalno za SI** — DDV na izdelku, številčenje dokumentov per najemnik; Fresha/Booksy niso zgrajeni za SI fiskalno.
6. **Dinamični obrazci brez kode per najemnik** — konkurenca ima fiksne forme.

---

## 8. Predlagan zaporedje (če soglasje)

```
Teden 1–2:  P0 #1 čakalna lista  →  P0 #2 oznake/segmenti
Teden 3:    P0 #3 add-ons
Teden 4–6:  P1 #4 marketing avtomatika   (zahteva P0#2)
Teden 7–8:  P1 #5 obrazci na termin      (reuse motor)
Teden 9:    P1 #8 PWA + push            (hitrega, dvigne vsakdan)
Teden 10+:  P1 #6 card-on-file  →  P1 #7 walk-in vrsta
Paralelno:  P2 odločitve (imenik, SMS, AI)
```

Vsak sklop = svoj issue + PLAN.md po vzorcu EPIC-4 (male, pregledne faze, odločitveni dnevnik).

---

## 9. Viri

- [Fresha for Business](https://www.fresha.com/for-business) · [Fresha Up Next 2026 (roadmap)](https://www.fresha.com/blog/Up-Next-2026) · [Fresha pricing 2026](https://heybooked.com/blogs/fresha-pricing) · [Fresha review](https://thesalonbusiness.com/fresha-review)
- [Booksy Biz features](https://biz.booksy.com/features) · [Booksy What's New](https://biz.booksy.com/whats-new) · [Booksy waitlist support](https://support.booksy.com/hc/en-us/articles/16463469277714)
- [Vagaro multi-location](https://www.vagaro.com/pro/multi-location-salon-software) · [Vagaro waitlist](https://support.vagaro.com/hc/en-us/articles/360010609213-Set-Up-the-Waitlist-Feature) · [Vagaro pricing](https://koalendar.com/blog/vagaro-pricing) · [Vagaro review 2026](https://thesalonbusiness.com/vagaro-review) · [Vagaro vs Square](https://www.meevo.com/blog/vagaro-vs-square)
- [Square Appointments](https://squareup.com/us/en/appointments) · [Square features](https://squareup.com/us/en/appointments/features) · [Square waitlist](https://squareup.com/help/us/en/article/7923) · [Square invoicing app](https://squareup.com/us/en/app-marketplace/app/appointments-invoicing)
- Lastna revizija: grep + branje `src/` (2026-11-04, HEAD `c96058c`)
