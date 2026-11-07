> **Opomba ob objavi:** delovni zapis, prenesen v repozitorij. Strojno specifične poti so odstranjene; neodvisni varnostni pregled in statični prototip nista del te objave.

# P1 — delovni nalog za drugi AI model (MARKEC / `rcbeautysalon`)

**Pripravil:** neodvisni pregled, 7. 11. 2026 00:10 (GMT+1)
**Vir:** izoliran klon repozitorija (samo branje)
**Pregledani commit:** `dc39ce6` (6. 11. 23:29) · **Stanje `origin/main` ob pisanju:** `6697a97` (23:54, `fix(demo cta)`)
**Preverjeno:** `git diff --name-only dc39ce6..6697a97 -- <vse spodnje datoteke>` je **prazno** → vse tri P1 še vedno veljajo.
**Postopek:** ta dokument ne spreminja repozitorija. Namenjen je temu, da ga predaš modelu, ki trenutno dela na projektu. Ne odpiramo vzporedne veje in ne pišemo v njegov delovni prostor.

> **Pred vsakim posegom:** `git fetch` in preveri trenutni HEAD. Če se je katera od spodnjih datotek medtem spremenila, navodila prilagodi — ne lepi slepo. `origin/main` se je v času pregleda premikal.

---

## 0. Popravek prvotnega poročila (beri najprej)

`POROCILO-2026-11-06.md` je v prvi različici pri P1-A trdilo, da strežniška akcija `updateStaffProfile` v repozitoriju ne obstaja. **To je bilo narobe.** Akcija `updateStaffSelfProfile` obstaja v `src/app/actions/staff.ts:955-1009` in je v osnovi pravilno napisana. Poročilo je bilo popravljeno v mestu.

Posledica: **P1-A je povezovalna napaka v klientski komponenti, ne manjkajoč backend.** Popravek je ~10 vrstic plus tri manjše strežniške izboljšave. Ne graditi nove akcije.

---

## P1-A — Obrazec profila zaposlenega lažno javi uspeh

**Status:** odprto · **Prioriteta:** najvišja (uporabnik tiho izgubi vnesene podatke)

**Datoteki**
- `src/components/staff/staff-profile-form.tsx:69-81` — `onSubmit`
- `src/app/actions/staff.ts:955-1009` — `updateStaffSelfProfile`
- Uporablja jo `src/app/(staff)/staff-portal/profile/page.tsx:38`

**Trenutno stanje**

```ts
async function onSubmit(data: StaffSelfUpdateFormData) {
  // TODO: Implement - call updateStaffProfile server action
  console.log("Form data:", data)          // :78 — osebni podatki v konzolo
  toast.success("Profil posodobljen")      // :79 — lažni uspeh
  setIsEditing(false)                      // :80 — obrazec se zapre
}
```

Akcija `updateStaffSelfProfile` ni nikjer uvožena. `staff.ts:21` sicer uvaža `StaffSelfUpdateFormData`, a le kot tip.

**Kaj akcija že dela prav:** `session.user.role === "STAFF"` → `getSessionOrg()` → preveri `Staff.organizationId === org.id` → `prisma.staff.update({ where: { userId: session.user.id }, data: { name, phone, bio } })` (bela lista polj) → `revalidatePath`. `Staff.userId` je `@unique`, zato je `where` veljaven.

**Popravek A1 — klient** (`staff-profile-form.tsx`)

```ts
import { updateStaffSelfProfile } from "@/app/actions/staff"

async function onSubmit(data: StaffSelfUpdateFormData) {
  const result = await updateStaffSelfProfile(data)
  if (!result.success) {
    toast.error(result.error || "Shranjevanje ni uspelo")
    return                         // obrazec ostane odprt, vnos se ne izgubi
  }
  reset(data)                      // sinhroniziraj defaultValues z novo vrednostjo
  toast.success("Profil posodobljen")
  setIsEditing(false)
}
```

Odstrani `console.log("Form data:", data)` in celoten zakomentiran `TODO` blok (`:70-77`). `isSubmitting` iz `useForm` že pokriva čakanje na `await`; dodaten `useState` ni potreben.

**Popravek A2 — tri stranske napake v `staff.ts`**

1. `:996` `revalidatePath("/staff/profile")` cilja **neobstoječo pot**. Dejanska pot je `/staff-portal/profile` (glej `src/app/(staff)/staff-portal/profile/page.tsx`). Popravi na `revalidatePath("/staff-portal/profile")`. Če se `bio` prikazuje tudi na javni strani zaposlenega, dodaj še revalidacijo te poti — ne obratno.
2. `:21` uvozi samo tip. Dodaj strežniško validacijo — clientski `zodResolver` ni varnostna meja za server action:
   ```ts
   import { staffSelfUpdateSchema, type StaffSelfUpdateFormData } from "@/lib/validations/staff"
   // znotraj try, pred prisma.staff.update:
   const parsed = staffSelfUpdateSchema.safeParse(data)
   if (!parsed.success) return { success: false, error: "Neveljavni podatki" }
   ```
   Nato v `data` uporabi `parsed.data`. `staffSelfUpdateSchema` (`src/lib/validations/staff.ts:49-64`) dovoljuje `phone`/`bio` kot `""`; ker sta v Prismi `String?`, preslikaj `"" → null`, da UI prikaže »Ni nastavljeno« namesto praznega polja. Ne spreminjaj sheme, če ni nujno.
3. `:1003` `console.log("Error updating staff self profile:", error)` → `console.error`.

**Test (manjka povsod):** noben test v `tests/` ali `e2e/` ne omenja ne komponente ne akcije. Dodaj vsaj:
- en test, ki po uspešnem `updateStaffSelfProfile` prebere vrednost iz (mockane) baze in trdi, da se je spremenila;
- en test, ki trdi, da neuspešna akcija ne vrže `success: true`;
- strukturni test v slogu `tests/marketing-unsubscribe-95.test.ts` (`readFileSync` + `expect(source).not.toContain(...)`), ki prepove `console.log("Form data:"` in `toast.success` brez pogoja.

**Sprejemni kriteriji:** zaposleni shrani ime/telefon/bio → osveži `/staff-portal/profile` → nove vrednosti so tam. Ob napaki se prikaže rdeč toast, obrazec ostane v načinu urejanja, zelenega sporočila ni. V konzoli ni osebnih podatkov. Ne-STAFF, tuji `organizationId` in neveljaven payload dobijo `success: false`.

---

## P1-B — Nastavitve obvestil se zapišejo, a nikoli preberejo

**Status:** odprto · **Datoteka:** `src/app/actions/account.ts:318-377` · bere jo `src/app/(customer)/my-account/page.tsx:46`

`getNotificationPreferences()` (`:318-344`) vsebuje španski `TODO: Implementar la lógica` in **vedno** vrne konstante, čeprav `updateNotificationPreferences` (`:347-377`) res piše v bazo prek `prisma.notificationPreferences.upsert`. Uporabnik izklopi `promotionalEmails`, shrani, osveži stran — stikalo je spet nazaj.

**Popravek B1**

```ts
const NOTIFICATION_DEFAULTS = {
  emailReminders: true,
  reminderTime: "24h",
  promotionalEmails: false,
  appointmentUpdates: true,
}

export async function getNotificationPreferences() {
  const session = await auth()
  if (!session?.user?.id) return NOTIFICATION_DEFAULTS
  try {
    const prefs = await prisma.notificationPreferences.findUnique({
      where: { userId: session.user.id },
    })
    if (!prefs) return NOTIFICATION_DEFAULTS
    return {
      emailReminders: prefs.emailReminders,
      reminderTime: prefs.reminderTime,
      promotionalEmails: prefs.promotionalEmails,
      appointmentUpdates: prefs.appointmentUpdates,
    }
  } catch (error) {
    console.error("Get notification preferences error:", error)
    return NOTIFICATION_DEFAULTS   // izpad baze ne sme podreti /my-account
  }
}
```

`NotificationPreferences.userId` je `@unique` (`prisma/schema.prisma:358-370`), zato je `findUnique` pravilen. Odstrani španski TODO in dvojni `return`.

**Popravek B2:** `:360-370` izračuna `validated`, preveri `validated.success`, nato v `upsert` vstavi **nevalidirani** `data`:

```ts
create: { userId: session.user.id, ...validated.data },
update: validated.data,
```

Shema `src/lib/validations/reschedule.ts:11-16` danes nima transformacij (praktično tveganje majhno), a ob razširitvi sheme to postane resnična napaka.

**Test:** shrani `promotionalEmails: true` → `getNotificationPreferences()` vrne `true`; brez vrstice vrne `NOTIFICATION_DEFAULTS`; neveljaven `reminderTime` (ni `"24h" | "48h" | "1week"`) je zavrnjen.

**Sprejemni kriteriji:** toggle → shrani → `F5` → vrednost ostane. Brez prijave in ob izpadu baze stran še vedno deluje s privzetimi vrednostmi.

---

## P1-C — Privolitev `promotionalEmails` se pri pošiljanju ne upošteva

**Status:** odprto · **Potrebna je najprej poslovna odločitev lastnika**

`promotionalEmails` se v celotnem `src/` pojavlja **samo** v UI (`src/components/account/notification-preferences.tsx:156`), validaciji (`reschedule.ts:14`) in akciji za shranjevanje. `src/lib/jobs/send-marketing-emails.ts:196-207` filtrira izključno `marketingUnsubscribe.findMany`; `NotificationPreferences` ne bere nikjer. Uporabnikov izklop torej nima učinka — edina pot je odjavni token v vsakem sporočilu.

**Korak C0 (odločitev, ne koda):** ali so kampanje `REACTIVATION`, `NO_SHOW`, `BIRTHDAY` promocijska ali transakcijska e-pošta? Če promocijska (verjetno), je to vprašanje skladnosti (GDPR / ZEKom-1), ne UX. Če transakcijska, to dokumentiraj in zapri P1-C kot »po dizajnu« — a potem `promotionalEmails` nima več nobenega učinka in ga je treba ali odstraniti ali vezati na prihodnje promocijske kanale.

**Korak C1 — filter**, dodaj po bloku za odjavo (`:208`), **pred** dedupom (`:210`):

```ts
if (targets.length > 0) {
  const emails = [...new Set(targets.map((t) => t.email.toLowerCase()))]
  const optedIn = await prisma.notificationPreferences.findMany({
    where: { promotionalEmails: true, user: { email: { in: emails } } },
    select: { user: { select: { email: true } } },
  })
  const allowed = new Set(optedIn.map((r) => r.user.email.toLowerCase()))
  targets = targets.filter((t) => allowed.has(t.email.toLowerCase()))
}
```

Vrni števec v `JobRunResult.detail` (npr. `skippedNoConsent`), vzporedno z obstoječim `skippedUnsubscribed` (`:39`, `:207`, `:261`), da je izpad obsega viden v logih.

**Štiri pasti, ki jih je treba rešiti zavestno:**

1. **`NotificationPreferences` ni org-scoped.** Ima samo `userId @unique`; `User.email` je globalno `@unique` (`schema.prisma:312`), `User.organizationId` pa je opcijsko. Ena privolitev zato velja za **vse najemnike**, medtem ko je `MarketingUnsubscribe` org-scoped z `@@unique([organizationId, email])`. Če je potrebna privolitev po podjetju, je nujna migracija sheme (dodati `organizationId` + sestavljen unikatni ključ) — ne rešuj z `where` na `User.organizationId`.
2. **Gostje brez računa** (`appointment.guestEmail`, `:78/:111/:153`) nimajo `User` vrstice, torej nimajo niti `NotificationPreferences`. Privzeti `promotionalEmails: false` pomeni, da vsi gostje izpadejo. To je GDPR-varno, a lahko drastično zmanjša obseg kampanj. Odločitev lastnika + dokumentacija, ne tiha privzeta vrednost.
3. **Velikost črk.** `email: { in: [...] }` je na Postgresu case-sensitive, obstoječi zapisi pa morda niso normalizirani. `mode: "insensitive"` se ne kombinira neposredno z `in`. Raje normaliziraj ob zapisu (`User.email`) ali primerjaj v JavaScriptu z `Set`, kot v zgornji skici.
4. **Vrstni red:** odjava (`MarketingUnsubscribe`) mora vedno zmagati in ostati pred dedupom; nov filter naj bo za njo, nikoli pred njo. `CampaignSend` dedup (`:210-216`) ostane na uspeh, ne na poskus (`:230-249`) — ne spreminjaj.

**Test:** obstoječa `tests/marketing-campaigns-95.test.ts` in `tests/marketing-unsubscribe-95.test.ts` testirata čiste funkcije in **strukturo izvorne kode** (`readFileSync` + `expect(src).toContain(...)`), ne pa joba z mockano bazo. Najčistejša pot: izluščiti čisto funkcijo `filterByPromotionalConsent(targets, optedInEmails)` v `src/lib/marketing/campaigns.ts`, unit-testati štiri primere (privolitev `true` gre skozi, `false` izpade, gost izpade, velikost črk je neobčutljiva) in dodati strukturno trditev, da job kliče `notificationPreferences.findMany`. Ne uvajaj nove DB-mock infrastrukture za en filter.

---

## Kaj **ne** sodi v ta nalog

- P2-A CSP Report-Only brez ponora poročil (`next.config.ts:22-38`) — po P1.
- P2-B `src/proxy.ts` fail-open ob napaki resolverja — po P1.
- P2-C `npm run build` kliče `scripts/resolve-failed-migrations.mjs`, ki lahko s `prisma migrate resolve --rolled-back` **spremeni zgodovino migracij produkcijske baze** — najnevarnejši P2, a ločen poseg z načrtom.
- Popravek `README.md` (zaostaja ~2 tedna: piše »kampanje P1« in »500+ testov«, koda pa ima marketing konzolo in commiti navajajo 1074/1074).
- Gradnja novega marketinškega vmesnika — **že obstaja** (`/dashboard/marketing`, `actions/marketing.ts`, HMAC unsubscribe).
- Vgradnja Plasmic / Webstudio (licenčna tveganja: AGPL-3.0 / ločena platformna licenca).

## Preverjanje po popravkih

```bash
corepack pnpm exec vitest run tests/marketing-campaigns-95.test.ts tests/marketing-unsubscribe-95.test.ts
corepack pnpm test
corepack pnpm exec tsc --noEmit
```

`package.json` pinna `pnpm@10.34.9` — uporabi to različico (`corepack`), ne globalne. **Ne zaganjaj `pnpm build` proti produkcijski bazi** (glej P2-C); build namreč vsebuje `prisma migrate deploy`.

**Po pushu:** javite za ponovni neodvisni pregled na svežem klonu — preverim `git diff dc39ce6..origin/main`, ali so P1 res zaprte, in morebitne regresije v tenant izolaciji / Stripe webhookih / dedupu kampanj.
