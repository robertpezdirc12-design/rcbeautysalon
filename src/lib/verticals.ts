import { prisma } from "@/lib/prisma"
import { defaultSiteContent, type SiteContent } from "@/lib/site-content"

// ============================================================
// VERTICALS — salon industry presets. Each vertical ships with
// default categories, sample services, palette, fonts and copy,
// so a new salon gets a complete site instantly.
// ============================================================

export interface Palette {
  id: string
  label: string
  primaryHue: number
  primarySat: number
  primaryL: number // base lightness for -500
  accentHue: number
  accentSat: number
  accentL: number
  radius: string // tailwind radius value, e.g. "0.5rem"
  fontHeading: FontKey
  fontBody: FontKey
}

export type FontKey =
  | "rouge"
  | "poppins"
  | "playfair"
  | "cormorant"
  | "oswald"
  | "montserrat"
  | "inter"
  | "lora"

export const FONT_CSS_VARS: Record<FontKey, string> = {
  rouge: "var(--font-rouge-script)",
  poppins: "var(--font-poppins)",
  playfair: "var(--font-playfair)",
  cormorant: "var(--font-cormorant)",
  oswald: "var(--font-oswald)",
  montserrat: "var(--font-montserrat)",
  inter: "var(--font-inter)",
  lora: "var(--font-lora)",
}

export const FONT_LABELS: Record<FontKey, string> = {
  rouge: "Great Vibes (rokovpis)",
  poppins: "Poppins (sodobno)",
  playfair: "Playfair Display (eleganca)",
  cormorant: "Cormorant (romantično)",
  oswald: "Oswald (močno)",
  montserrat: "Montserrat (čisto)",
  inter: "Inter (minimalno)",
  lora: "Lora (toplo)",
}

export const PALETTES: Record<string, Palette> = {
  rose: { id: "rose", label: "Rožnata & Zlata", primaryHue: 340, primarySat: 45, primaryL: 50, accentHue: 38, accentSat: 70, accentL: 55, radius: "0.75rem", fontHeading: "rouge", fontBody: "poppins" },
  burgundy: { id: "burgundy", label: "Bordó & Terakota", primaryHue: 350, primarySat: 48, primaryL: 38, accentHue: 18, accentSat: 62, accentL: 55, radius: "0.5rem", fontHeading: "playfair", fontBody: "montserrat" },
  amber: { id: "amber", label: "Jantar & Med", primaryHue: 28, primarySat: 62, primaryL: 46, accentHue: 45, accentSat: 72, accentL: 52, radius: "0.5rem", fontHeading: "playfair", fontBody: "poppins" },
  charcoal: { id: "charcoal", label: "Antracit & Zlata", primaryHue: 220, primarySat: 12, primaryL: 24, accentHue: 43, accentSat: 65, accentL: 52, radius: "0.125rem", fontHeading: "oswald", fontBody: "inter" },
  violet: { id: "violet", label: "Vijolična & Pastel", primaryHue: 282, primarySat: 42, primaryL: 50, accentHue: 330, accentSat: 58, accentL: 62, radius: "1rem", fontHeading: "cormorant", fontBody: "poppins" },
  emerald: { id: "emerald", label: "Smaragdna", primaryHue: 160, primarySat: 45, primaryL: 40, accentHue: 95, accentSat: 42, accentL: 50, radius: "0.75rem", fontHeading: "lora", fontBody: "montserrat" },
  teal: { id: "teal", label: "Modrozelena & Mint", primaryHue: 190, primarySat: 52, primaryL: 40, accentHue: 165, accentSat: 45, accentL: 50, radius: "0.75rem", fontHeading: "montserrat", fontBody: "inter" },
  coral: { id: "coral", label: "Koralna", primaryHue: 12, primarySat: 65, primaryL: 55, accentHue: 35, accentSat: 65, accentL: 55, radius: "0.75rem", fontHeading: "poppins", fontBody: "inter" },
}

// Lightness ladder for 50–900 scale
const LADDER = [97, 93, 86, 76, 64] // 50..400
const LADDER_DOWN = [46, 38, 31, 24] // 600..900

/** CSS custom properties (HSL triplets) overriding the shadcn theme. */
export function paletteCssVars(p: Palette): Record<string, string> {
  const primaryScale: string[] = []
  for (let i = 0; i < 5; i++) primaryScale.push(`${p.primaryHue} ${p.primarySat}% ${LADDER[i]}%`)
  primaryScale.push(`${p.primaryHue} ${p.primarySat}% ${p.primaryL}%`)
  for (let i = 0; i < 4; i++) primaryScale.push(`${p.primaryHue} ${p.primarySat}% ${LADDER_DOWN[i]}%`)

  const accentScale: string[] = []
  for (let i = 0; i < 5; i++) accentScale.push(`${p.accentHue} ${p.accentSat}% ${LADDER[i]}%`)
  accentScale.push(`${p.accentHue} ${p.accentSat}% ${p.accentL}%`)
  for (let i = 0; i < 4; i++) accentScale.push(`${p.accentHue} ${p.accentSat}% ${LADDER_DOWN[i]}%`)

  const vars: Record<string, string> = {}
  const scaleNames = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"]
  primaryScale.forEach((v, i) => (vars[`--primary-${scaleNames[i]}`] = v))
  accentScale.forEach((v, i) => (vars[`--accent-${scaleNames[i]}`] = v))

  vars["--primary"] = vars["--primary-500"]
  vars["--primary-foreground"] = "0 0% 100%"
  vars["--accent"] = vars["--accent-500"]
  vars["--accent-foreground"] = "0 0% 12%"
  vars["--ring"] = vars["--primary-500"]
  vars["--radius"] = p.radius
  vars["--org-font-heading"] = FONT_CSS_VARS[p.fontHeading]
  vars["--org-font-body"] = FONT_CSS_VARS[p.fontBody]
  return vars
}

// --- Sample catalog images (public CDN, used as defaults) ---
const IMG = {
  salonInterior: "https://res.cloudinary.com/caballerorandy/image/upload/v1763776103/Beauty%20Salon/services/salon-interior_uxr7ba.avif",
  heroImage: "https://res.cloudinary.com/caballerorandy/image/upload/v1763776064/Beauty%20Salon/services/hero-bg_t2k2ca.avif",
  heroVideo: "https://res.cloudinary.com/caballerorandy/video/upload/v1763776242/Beauty%20Salon/services/hero-bg_rn87gq.mp4",
  heroPoster: "https://res.cloudinary.com/caballerorandy/image/upload/v1763776064/Beauty%20Salon/services/hero-bg_t2k2ca.avif",
  transform: "https://res.cloudinary.com/caballerorandy/image/upload/v1763776103/Beauty%20Salon/services/transform_hwvixg.avif",
  haircut: "https://res.cloudinary.com/caballerorandy/image/upload/v1763611761/Beauty%20Salon/services/classic-haircut_inzgrp.avif",
  coloring: "https://res.cloudinary.com/caballerorandy/image/upload/v1763538513/Beauty%20Salon/services/coloring_aiw6e3.avif",
  highlights: "https://res.cloudinary.com/caballerorandy/image/upload/v1763612088/Beauty%20Salon/services/highlights_mrhaba.avif",
  hairTreatment: "https://res.cloudinary.com/caballerorandy/image/upload/v1763611939/Beauty%20Salon/services/hair-treatment_hs60yv.avif",
  manicure: "https://res.cloudinary.com/caballerorandy/image/upload/v1763538512/Beauty%20Salon/services/manicure_hyudpf.avif",
  gelManicure: "https://res.cloudinary.com/caballerorandy/image/upload/v1763613072/Beauty%20Salon/services/gel-manicure_e7k2gb.avif",
  spaPedicure: "https://res.cloudinary.com/caballerorandy/image/upload/v1763613172/Beauty%20Salon/services/spa-pedicure_fpbjgq.avif",
  facial: "https://res.cloudinary.com/caballerorandy/image/upload/v1763611296/Beauty%20Salon/services/hydrating-facial_sliwao.avif",
  antiAging: "https://res.cloudinary.com/caballerorandy/image/upload/v1763611000/Beauty%20Salon/services/anti-aging-facial_qgusgu.avif",
  deepClean: "https://res.cloudinary.com/caballerorandy/image/upload/v1763611175/Beauty%20Salon/services/deep-cleansing-facial_jzjp7l.avif",
  massage: "https://res.cloudinary.com/caballerorandy/image/upload/v1763612585/Beauty%20Salon/services/swedish-massage_degn1f.avif",
  hotStone: "https://res.cloudinary.com/caballerorandy/image/upload/v1763612414/Beauty%20Salon/services/hot-stone-massage_krxtkc.avif",

  // ----------------------------------------------------------
  // Local preset imagery (ships with the app in /public) —
  // photorealistic test/demo photos for verticals whose presets
  // previously had no imagery at all (EPIC #4 test data).
  // Local paths bypass Cloudinary transforms (see cloudinary.ts
  // pass-through) and carry no third-party CDN dependency.
  // ----------------------------------------------------------
  barberBeard: "/img/presets/beard.jpg",
  barberHotTowel: "/img/presets/hottowel.jpg",
  makeup: "/img/presets/makeup.jpg",
  sportMassage: "/img/presets/sportmassage.jpg",
  aromaTherapy: "/img/presets/aroma.jpg",
  reflexology: "/img/presets/reflexology.jpg",
  laser: "/img/presets/laser.jpg",
  wax: "/img/presets/wax.jpg",
  sewing: "/img/presets/sewing.jpg",
  zipper: "/img/presets/zipper.jpg",
  customDress: "/img/presets/dress.jpg",
  tireChange: "/img/presets/tirechange.jpg",
  oilChange: "/img/presets/oilchange.jpg",
  brakes: "/img/presets/brakes.jpg",
  diagnostics: "/img/presets/diagnostics.jpg",
  honeyJars: "/img/presets/honey.jpg",
  propolis: "/img/presets/propolis.jpg",
  honeycomb: "/img/presets/honeycomb.jpg",

  // Per-vertical hero imagery (wide shots)
  heroBarber: "/img/presets/hero-barber.jpg",
  heroSpa: "/img/presets/hero-spa.jpg",
  heroLaser: "/img/presets/hero-laser.jpg",
  heroAtelier: "/img/presets/hero-atelier.jpg",
  heroGarage: "/img/presets/hero-garage.jpg",
  heroApiary: "/img/presets/hero-apiary.jpg",

  // Owner/staff portrait presets (photorealistic, per vertical)
  staffFrizerka: "/img/presets/staff-frizerka.jpg",
  staffBarber: "/img/presets/staff-barber.jpg",
  staffKozmeticka: "/img/presets/staff-kozmeticka.jpg",
  staffMaserka: "/img/presets/staff-maserka.jpg",
  staffEpilacija: "/img/presets/staff-epilacija.jpg",
  staffSivilja: "/img/presets/staff-sivilja.jpg",
  staffMehanik: "/img/presets/staff-mehanik.jpg",
  staffCebelar: "/img/presets/staff-cebelar.jpg",
  staffNails: "/img/presets/staff-nails.jpg",
}

/**
 * Owner staff portrait per vertical, applied when onboarding creates the
 * tenant's first (owner) staff profile. Verticals without a fitting
 * portrait (generic) return undefined — the public staff card renders a
 * graceful initials fallback. Shared asset keys keep the mapping honest:
 * cosmetica-adjacent verticals reuse the beauty portrait.
 */
const PRESET_STAFF_IMAGE: Record<string, string> = {
  frizer: IMG.staffFrizerka,
  barber: IMG.staffBarber,
  nails: IMG.staffNails,
  cosmetica: IMG.staffKozmeticka,
  beauty: IMG.staffKozmeticka,
  massage: IMG.staffMaserka,
  epilation: IMG.staffEpilacija,
  seamstress: IMG.staffSivilja,
  "tire-service": IMG.staffMehanik,
  beekeeping: IMG.staffCebelar,
}

/**
 * Pure helper: preset staff portrait for a vertical id (undefined when
 * the vertical has no preset — onboarding then leaves image null).
 */
export function presetStaffImage(verticalId: string): string | undefined {
  return PRESET_STAFF_IMAGE[verticalId]
}

/**
 * Vertical-specific site imagery overrides (hero/about/cta). Verticals
 * not listed keep the generic beauty-salon imagery — appropriate for
 * the remaining profiles (beauty, frizer, nails, cosmetica, generic).
 */
const VERTICAL_IMAGERY: Record<string, { hero?: string; about?: string; cta?: string }> = {
  barber: { hero: IMG.heroBarber, about: IMG.barberBeard, cta: IMG.barberHotTowel },
  massage: { hero: IMG.heroSpa, about: IMG.massage, cta: IMG.hotStone },
  epilation: { hero: IMG.heroLaser, about: IMG.laser, cta: IMG.wax },
  seamstress: { hero: IMG.heroAtelier, about: IMG.sewing, cta: IMG.customDress },
  "tire-service": { hero: IMG.heroGarage, about: IMG.tireChange, cta: IMG.oilChange },
  beekeeping: { hero: IMG.heroApiary, about: IMG.honeycomb, cta: IMG.honeyJars },
}

export interface PresetService {
  name: string
  description: string
  duration: number
  price: number
  imageUrl?: string
  isFeatured?: boolean
}

export interface PresetCategory {
  name: string
  slug: string
  services: PresetService[]
}

export interface PresetProduct {
  name: string
  description: string
  price: number
  stockQuantity: number
  imageUrl?: string
  trackInventory?: boolean
  isFeatured?: boolean
}

export interface VerticalPreset {
  id: string
  label: string
  description: string
  palette: string
  currency: string
  locale: string
  timezone: string
  categories: PresetCategory[]
  /** Sample products seeded for product-centric profiles (e.g. beekeeping). */
  products?: PresetProduct[]
  siteContent: SiteContent
}

function withImages(vertical: string, content: SiteContent, aboutImage?: string): SiteContent {
  const imagery = VERTICAL_IMAGERY[vertical]
  const hero = vertical === "beauty"
    ? { ...content.hero, videoUrl: IMG.heroVideo, posterUrl: IMG.heroPoster }
    : { ...content.hero, imageUrl: imagery?.hero ?? IMG.heroImage }
  return {
    ...content,
    hero,
    about: { ...content.about, imageUrl: imagery?.about ?? aboutImage ?? IMG.salonInterior },
    cta: { ...content.cta, imageUrl: imagery?.cta ?? IMG.transform },
  }
}

export const VERTICALS: VerticalPreset[] = [
  {
    id: "beauty",
    label: "Lepotni salon",
    description: "Kombinacija frizerije, nohtov in kozmetike",
    palette: "rose",
    currency: "EUR",
    locale: "sl",
    timezone: "Europe/Ljubljana",
    categories: [
      { name: "Lasje", slug: "lasje", services: [
        { name: "Žensko striženje", description: "Striženje in oblikovanje po želji", duration: 45, price: 35, imageUrl: IMG.haircut, isFeatured: true },
        { name: "Barvanje korenin", description: "Barvanje izrastkov s profesionalnimi barvili", duration: 60, price: 45, imageUrl: IMG.coloring, isFeatured: true },
        { name: "Balayage", description: "Prostoročne prameni za naraven preliv", duration: 120, price: 85, imageUrl: IMG.highlights, isFeatured: true },
      ]},
      { name: "Nohti", slug: "nohti", services: [
        { name: "Manikira z laki", description: "Klasična manikira z lakiranjem", duration: 45, price: 20, imageUrl: IMG.manicure },
        { name: "Gel manikira", description: "Trajno lakiranje do 3 tedne", duration: 60, price: 30, imageUrl: IMG.gelManicure, isFeatured: true },
      ]},
      { name: "Obraz", slug: "obraz", services: [
        { name: "Hidratantni tretmaj obraza", description: "Globinska hidratacija in sijaj", duration: 60, price: 40, imageUrl: IMG.facial, isFeatured: true },
      ]},
    ],
    siteContent: defaultSiteContent("beauty"),
  },
  {
    id: "frizer",
    label: "Frizerski salon",
    description: "Striženje, barvanje in oblikovanje las",
    palette: "amber",
    currency: "EUR",
    locale: "sl",
    timezone: "Europe/Ljubljana",
    categories: [
      { name: "Ženske frizure", slug: "zenske-frizure", services: [
        { name: "Žensko striženje", description: "Svetovanje, striženje in feniranje", duration: 45, price: 35, imageUrl: IMG.haircut, isFeatured: true },
        { name: "Barvanje celotne glave", description: "Profesionalna barvanja po želji", duration: 90, price: 65, imageUrl: IMG.coloring, isFeatured: true },
        { name: "Prameni / Balayage", description: "Naravni prelivi po sodobnih tehnikah", duration: 150, price: 90, imageUrl: IMG.highlights },
      ]},
      { name: "Moško striženje", slug: "mosko-strizenje", services: [
        { name: "Moški haircut", description: "Klasično in sodobno moško striženje", duration: 30, price: 20, imageUrl: IMG.haircut, isFeatured: true },
        { name: "Oblikovanje brade", description: "Trim in oblikovanje brade", duration: 20, price: 12, imageUrl: IMG.barberBeard },
      ]},
      { name: "Nega las", slug: "nega-las", services: [
        { name: "Regeneracijski tretmaj", description: "Globinska regeneracija z ampulami", duration: 40, price: 25, imageUrl: IMG.hairTreatment },
        { name: "Keratin glajenje", description: "Trajno glajenje in sijaj", duration: 120, price: 110, imageUrl: IMG.hairTreatment },
      ]},
    ],
    siteContent: defaultSiteContent("frizer"),
  },
  {
    id: "barber",
    label: "Barber shop",
    description: "Moško striženje, brada, hot towel",
    palette: "charcoal",
    currency: "EUR",
    locale: "sl",
    timezone: "Europe/Ljubljana",
    categories: [
      { name: "Striženje", slug: "strizenje", services: [
        { name: "Classic cut", description: "Klasično moško striženje z stylingom", duration: 30, price: 22, imageUrl: IMG.haircut, isFeatured: true },
        { name: "Skin fade", description: "Precizen fade po tvoji želji", duration: 45, price: 28, imageUrl: IMG.highlights, isFeatured: true },
      ]},
      { name: "Brada", slug: "brada", services: [
        { name: "Beard trim", description: "Oblikovanje in negovanje brade", duration: 20, price: 14, imageUrl: IMG.barberBeard, isFeatured: true },
        { name: "Hot towel shave", description: "Tradicionalno britje z vročo brisačo", duration: 30, price: 20, imageUrl: IMG.barberHotTowel },
      ]},
      { name: "Paketi", slug: "paketi", services: [
        { name: "Cut + brada", description: "Kombiniran termin za striženje in brado", duration: 60, price: 40, imageUrl: IMG.barberBeard, isFeatured: true },
      ]},
    ],
    siteContent: defaultSiteContent("barber"),
  },
  {
    id: "nails",
    label: "Nail studio",
    description: "Manikira, pedikura in nail art",
    palette: "violet",
    currency: "EUR",
    locale: "sl",
    timezone: "Europe/Ljubljana",
    categories: [
      { name: "Manikira", slug: "manikira", services: [
        { name: "Klasična manikira", description: "Nega nohtov in kožice z lakiranjem", duration: 45, price: 22, imageUrl: IMG.manicure, isFeatured: true },
        { name: "Gel manikira", description: "Trajno lakiranje do 3 tedne", duration: 60, price: 32, imageUrl: IMG.gelManicure, isFeatured: true },
      ]},
      { name: "Pedikura", slug: "pedikura", services: [
        { name: "Klasična pedikura", description: "Nega stopal in nohtov", duration: 50, price: 28, imageUrl: IMG.spaPedicure },
        { name: "Spa pedikura", description: "Peeling, maska in masaža stopal", duration: 70, price: 40, imageUrl: IMG.spaPedicure, isFeatured: true },
      ]},
      { name: "Nail art", slug: "nail-art", services: [
        { name: "Nail art po meri", description: "Risbe, folije in okraski", duration: 30, price: 15, imageUrl: IMG.gelManicure },
        { name: "Umetni nohti", description: "Izgradnja nohtov po želji", duration: 90, price: 50, imageUrl: IMG.manicure },
      ]},
    ],
    siteContent: defaultSiteContent("nails"),
  },
  {
    id: "cosmetica",
    label: "Kozmetični salon",
    description: "Tretmaji obraza, nega kože, make-up",
    palette: "burgundy",
    currency: "EUR",
    locale: "sl",
    timezone: "Europe/Ljubljana",
    categories: [
      { name: "Tretmaji obraza", slug: "tretmaji-obraza", services: [
        { name: "Čiščenje obraza", description: "Globinsko čiščenje za vse tipe kože", duration: 60, price: 45, imageUrl: IMG.deepClean, isFeatured: true },
        { name: "Hidratantni tretmaj", description: "Hidratacija in sijaj kože", duration: 60, price: 40, imageUrl: IMG.facial, isFeatured: true },
        { name: "Anti-aging tretmaj", description: "Zgladitev gub in dvig kontur", duration: 75, price: 60, imageUrl: IMG.antiAging },
      ]},
      { name: "Make-up", slug: "make-up", services: [
        { name: "Dnevni make-up", description: "Naraven izgled za vsak dan", duration: 45, price: 30, imageUrl: IMG.makeup },
        { name: "Večerni / poročni make-up", description: "Trajen make-up za posebne priložnosti", duration: 75, price: 55, imageUrl: IMG.makeup },
      ]},
    ],
    siteContent: defaultSiteContent("cosmetica"),
  },
  {
    id: "massage",
    label: "Masaža & wellness",
    description: "Relax, športne in terapevtske masaže",
    palette: "emerald",
    currency: "EUR",
    locale: "sl",
    timezone: "Europe/Ljubljana",
    categories: [
      { name: "Masaže", slug: "masaze", services: [
        { name: "Relax masaža", description: "Celočasovna sprostitvena masaža telesa", duration: 60, price: 45, imageUrl: IMG.massage, isFeatured: true },
        { name: "Športna masaža", description: "Regeneracija po vadbi", duration: 60, price: 55, imageUrl: IMG.sportMassage, isFeatured: true },
        { name: "Hot stone masaža", description: "Terapija z ogrevanimi kamni", duration: 75, price: 65, imageUrl: IMG.hotStone },
      ]},
      { name: "Wellness", slug: "wellness", services: [
        { name: "Aromaterapija", description: "Masaža z eteričnimi olji po izbiri", duration: 60, price: 50, imageUrl: IMG.aromaTherapy },
        { name: "Refleksologija stopal", description: "Terapija pritiskov na refleksovnih točkah", duration: 45, price: 40, imageUrl: IMG.reflexology },
      ]},
    ],
    siteContent: defaultSiteContent("massage"),
  },
  {
    id: "epilation",
    label: "Epilacija & laser",
    description: "Laser epilacija, voščanje",
    palette: "teal",
    currency: "EUR",
    locale: "sl",
    timezone: "Europe/Ljubljana",
    categories: [
      { name: "Laser epilacija", slug: "laser-epilacija", services: [
        { name: "Laser — zgornja ustnica", description: "Trajna odstranitev dlak", duration: 15, price: 20, imageUrl: IMG.laser, isFeatured: true },
        { name: "Laser — noge (celotne)", description: "Hitra in učinkovita laser epilacija nog", duration: 45, price: 60, imageUrl: IMG.laser, isFeatured: true },
        { name: "Laser — pazusiha", description: "Gladke pazusihe brez britja", duration: 15, price: 25, imageUrl: IMG.laser },
      ]},
      { name: "Voščanje", slug: "voscanje", services: [
        { name: "Noge — voščanje", description: "Gladke noge do 4 tedne", duration: 40, price: 30, imageUrl: IMG.wax },
        { name: "Brazilsko voščanje", description: "Profesionalno in higienično", duration: 30, price: 35, imageUrl: IMG.wax },
      ]},
    ],
    siteContent: defaultSiteContent("epilation"),
  },
  {
    id: "generic",
    label: "Univerzalno",
    description: "Za podjetja z lastnim katalogom storitev",
    palette: "coral",
    currency: "EUR",
    locale: "sl",
    timezone: "Europe/Ljubljana",
    categories: [
      { name: "Storitve", slug: "storitve", services: [
        { name: "Uvodni posvet", description: "Pogovor o vaših željah in pričakovanjih", duration: 30, price: 0, imageUrl: IMG.salonInterior, isFeatured: true },
        { name: "Storitev po meri", description: "Dopolni s svojimi storitvami v urejevalniku", duration: 60, price: 50, imageUrl: IMG.transform, isFeatured: true },
      ]},
    ],
    siteContent: defaultSiteContent("beauty"),
  },

  // --- §21 acceptance profiles: genuinely different business models ---
  {
    id: "seamstress",
    label: "Šiviljstvo",
    description: "Spremembe, popravila in šivanje po meri",
    palette: "teal",
    currency: "EUR",
    locale: "sl",
    timezone: "Europe/Ljubljana",
    categories: [
      { name: "Spremembe oblačil", slug: "spremembe-oblacil", services: [
        { name: "Krajšanje hlač", description: "Krajšanje hlač z ohranitvijo originalnega roba", duration: 30, price: 12, imageUrl: IMG.sewing, isFeatured: true },
        { name: "Prižemanje v pasu", description: "Prižemanje hlač, sukjenj in jakn v pasu", duration: 45, price: 18, imageUrl: IMG.sewing, isFeatured: true },
        { name: "Krajšanje rokavov", description: "Krajšanje rokavov pri jaknah in srajcah", duration: 40, price: 15, imageUrl: IMG.sewing },
      ]},
      { name: "Popravila", slug: "popravila", services: [
        { name: "Zamenjava zadrgle", description: "Zamenjava zadrgle na oblačilih in torbah", duration: 45, price: 15, imageUrl: IMG.zipper, isFeatured: true },
        { name: "Popravilo prekinitve", description: "Skrivanje in popravilo prekinitvenih mest", duration: 30, price: 10, imageUrl: IMG.zipper },
      ]},
      { name: "Šivanje po meri", slug: "sivanje-po-meri", services: [
        { name: "Posvet in snemanje mer", description: "Svetovanje o materialih in snemanje merilnega lista", duration: 45, price: 0, imageUrl: IMG.sewing },
        { name: "Obleka po meri", description: "Šivanje obleke po merilnem listu (cena od, glede na material)", duration: 240, price: 180, imageUrl: IMG.customDress },
      ]},
    ],
    siteContent: defaultSiteContent("seamstress"),
  },
  {
    id: "tire-service",
    label: "Vulkanizer & avtoservis",
    description: "Menjava guma, servis vozil, deli in delovni nalogi",
    palette: "charcoal",
    currency: "EUR",
    locale: "sl",
    timezone: "Europe/Ljubljana",
    categories: [
      { name: "Vulkanizerija", slug: "vulkanizerija", services: [
        { name: "Menjava gum (komplet)", description: "Demontaža, montaža in balansiranje štirih gum", duration: 60, price: 40, imageUrl: IMG.tireChange, isFeatured: true },
        { name: "Balansiranje", description: "Balansiranje kolesa s svinčenimi utežmi", duration: 20, price: 10, imageUrl: IMG.tireChange },
        { name: "Popravilo punkture", description: "Popravilo preboja z vstavljanjem gumene zamaške", duration: 30, price: 15, imageUrl: IMG.tireChange },
      ]},
      { name: "Servis vozil", slug: "servis-vozil", services: [
        { name: "Menjava olja in filtra", description: "Menjava motornega olja in oljnega filtra", duration: 45, price: 55, imageUrl: IMG.oilChange, isFeatured: true },
        { name: "Diagnostika napak", description: "Pregled z diagnostično napravo in razlaga napak", duration: 30, price: 25, imageUrl: IMG.diagnostics },
        { name: "Menjava zavorških blazinic", description: "Menjava zavorških blazinic na eni osi", duration: 60, price: 45, imageUrl: IMG.brakes },
      ]},
    ],
    siteContent: defaultSiteContent("tire-service"),
  },
  {
    id: "beekeeping",
    label: "Čebelarstvo",
    description: "Med in čebelji izdelki — prodaja brez rezervacij",
    palette: "amber",
    currency: "EUR",
    locale: "sl",
    timezone: "Europe/Ljubljana",
    categories: [],
    products: [
      { name: "Cvetlični med 500 g", description: "Odcejen cvetlični med iz lastnih panjskih postaj.", price: 9, stockQuantity: 120, imageUrl: IMG.honeyJars, isFeatured: true },
      { name: "Lipov med 500 g", description: "Aromaten lipov med — priljubljen za prehladne dni.", price: 11, stockQuantity: 80, imageUrl: IMG.honeyJars, isFeatured: true },
      { name: "Gozdni med 500 g", description: "Temni gozdni med z izrazito mineralno noto.", price: 12, stockQuantity: 60, imageUrl: IMG.honeycomb },
      { name: "Akačijski med 500 g", description: "Bister, blag akačijski med, ki ostane tekoč dlje časa.", price: 13, stockQuantity: 40, imageUrl: IMG.honeyJars },
      { name: "Propolisna tinktura 30 ml", description: "Naravna propolisna tinktura lastne proizvodnje.", price: 14, stockQuantity: 35, imageUrl: IMG.propolis },
      { name: "Čebelji vosek — sveča", description: "Ročno vlita sveča iz čistega čebeljega voska.", price: 6, stockQuantity: 90, imageUrl: IMG.propolis },
    ],
    siteContent: defaultSiteContent("beekeeping"),
  },
]

export function getVertical(id: string): VerticalPreset {
  // Unknown profile ids fall back to the universal preset — never to a
  // salon-specific one (EPIC #1 §21: no silent industry assumptions).
  return VERTICALS.find((v) => v.id === id) ?? (VERTICALS.find((v) => v.id === "generic") ?? VERTICALS[0])
}

/** Fill content with vertical-specific default imagery. */
export function verticalSiteContent(id: string): SiteContent {
  const v = getVertical(id)
  const aboutImg =
    v.id === "massage" ? IMG.massage : v.id === "nails" ? IMG.manicure : v.id === "cosmetica" ? IMG.facial : IMG.salonInterior
  return withImages(v.id, v.siteContent, aboutImg)
}

/** Creates categories + sample services + sample products for a fresh organization. */
export async function seedOrganizationCatalog(orgId: string, verticalId: string): Promise<void> {
  const existing = await prisma.category.count({ where: { organizationId: orgId } })
  if (existing > 0) return
  const preset = getVertical(verticalId)
  for (const cat of preset.categories) {
    const category = await prisma.category.create({
      data: { name: cat.name, slug: cat.slug, organizationId: orgId },
    })
    for (const [i, svc] of cat.services.entries()) {
      await prisma.service.create({
        data: {
          name: svc.name,
          slug: `${cat.slug}-${svc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
          description: svc.description,
          duration: svc.duration,
          price: svc.price,
          imageUrl: svc.imageUrl,
          isActive: true,
          isFeatured: !!svc.isFeatured && i < 2,
          order: i,
          organizationId: orgId,
          categoryId: category.id,
        },
      })
    }
  }
  // Sample products for product-centric profiles (e.g. beekeeping).
  if (preset.products?.length) {
    const existingProducts = await prisma.product.count({ where: { organizationId: orgId } })
    if (existingProducts === 0) {
      await prisma.product.createMany({
        data: preset.products.map((p) => ({
          name: p.name,
          description: p.description,
          price: p.price,
          trackInventory: p.trackInventory ?? true,
          stockQuantity: p.stockQuantity,
          images: p.imageUrl ? [p.imageUrl] : [],
          isActive: true,
          isFeatured: !!p.isFeatured,
          organizationId: orgId,
        })),
      })
    }
  }
}
