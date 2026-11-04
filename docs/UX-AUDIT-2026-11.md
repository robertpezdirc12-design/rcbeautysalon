# UX/Vizualni audit — 11 profilov (#94 faza 1, november 2026)

**Metoda:** živi prehod skozi produkcijske demo najemnike (pravi brskalnik, agent-browser), zajeti posnetki pri 1440×900 in 390×844, plus pregled kode (palet, tokenov, presetov, render poti). Pretekla dela (#20 UI/UX audit javne strani — ZAKLJUČENO, #7 WCAG kontrast palet — ZAKLJUČENO) so pregledana: njihovi popravki so v kodi in se NE ponavljajo tukaj.
**Posnetki:** `.zcode-audit/` (platform-1440, rc-beauty, studio-nika, nail-studio-luna, kozmetika-biser, krojasnica-marjeta @1440; krojasnica @390).

## Potrjene najdbe

### P1 — napačna panoga hero slike na obstoječih najemnikih (POPRAVLJENO v tej fazi)
- **Kje:** vsi demo najemniki razen beauty (krojasnica-marjeta/šiviljstvo, nail-studio-luna, studio-nika …) — hero, about in cta slike.
- **Problem:** najemniki, ustvarjeni pred per-panognimi preseti (`VERTICAL_IMAGERY`), nosijo v `siteContent` snapshotu stari SKUPNI frizerski interier. Šiviljstvo z vijoličnim frizerskim salonon v heroju je za stranko zaupanja vredno nesprejemljivo (§D: »irrelevant imagery materially harms the result«). Slike presetov SO na produkciji (`/img/presets/hero-atelier.jpg` → 200) — snapshot jih ne poveže.
- **Vzrok:** `mergeSiteContent` pusti, da zastarel stored `imageUrl` premaga svež preset (spread prepiše default).
- **Popravek (implementiran):** `upgradeLegacyImagery(content, vertical)` na render poti (`getPublicSiteData`) — nadomesti SAMO slike, ki so še vedno vzorčne (`isSampleImageUrl`); lastniško prilagojene (katerikoli drug URL) se nikoli ne pregazijo. Testi: `tests/utils/verticals-imagery.test.ts` (4 novi).

### P2 — vsebinske napake v demo podatkih (podatki, ne koda)
- **studio-nika hero:** »Najboljši striži v mestu« — »striži« ni slovenska beseda (pravilno: »Najboljše striženje v mestu«) + generični slogan. Koda te nizi ne vsebuje — demo najemnikov lastniški snapshot; popraviti na produkciji (urejanje vsebine) ali s ponovnim seedom.

### P2 — platformska lupina diši po lepotni panogi (strategija, ne hitro)
- Platforma prodaja 11 panog, landing pa je rožnato-zlat s pisano script pisavo in bledim logotipom (§A: »platform shell coherent, business-specific accents«). Ni bloker — naslednja dizajnerska iteracija: nevtralna profesionalna podlaga platforme, panogni akcenti ostanejo najemnikom. Zahteva lastniško produktno odločitev (slogovna usoda).

### ✅ Preverjeno OK (brez ukrepa)
- **Pogojni CTA pravilen per panoga:** šiviljstvo → »Oddaj povpraševanje« (inquiry), frizer/nohti → »Rezerviraj termin«; terminologija in moduli se ujemajo z matriko zmožnosti (#85, EPIC #1).
- **Palete:** 8 palet z že popravljenimi kontrasti (#7); različne per panogi (teal šiviljstvo, vijolična nohti, jantar frizer) — profili niso sploščeni.
- **Responsivno @390:** brez horizontalnega preliva (scrollW=390=clientW), hamburger navigacija, polnoširinski CTA-ji, berljivo.
- **Slovenski znaki (č/š/ž)** se pravilno izrisujejo v vseh zajetih pogledih; ni FOUT opaženega preloma postavitve.

## Preostali obseg #94 (predlagan vrstni red)
1. P2 vsebine demo najemnikov (popraviti copy na produkciji ali re-seed) — kratek.
2. Platformska lupina: nevtralna paleta/logo/typografia landinga (produktna odločitev → potem implementacija + pred/po posnetki vseh 11 profilov).
3. Svetli/temni način po paletah — sistematicni screenshot sweep + kontrast testi v CI (razširitev #7).
4. Dashboard/site editor pregled (§F) — poseben sklop.
