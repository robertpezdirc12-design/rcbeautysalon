
// ============================================================
// SITE CONTENT — everything a salon owner can edit from the
// dashboard "Izgled in vsebina" editor. Stored as JSON in
// SalonConfig.siteContent, merged over vertical defaults.
// ============================================================

export interface CtaLink {
  label: string
  href: string
}

export interface HeroContent {
  eyebrow?: string
  title: string
  subtitle: string
  imageUrl?: string
  videoUrl?: string
  posterUrl?: string
  primaryCta: CtaLink
  secondaryCta?: CtaLink | null
}

export interface FeatureContent {
  icon: string // lucide icon name, e.g. "CalendarCheck"
  title: string
  description: string
}

export interface StatContent {
  value: string
  label: string
}

export interface AboutContent {
  title: string
  paragraphs: string[]
  imageUrl?: string
  stats: StatContent[]
}

export interface CtaContent {
  title: string
  text: string
  buttonLabel: string
  buttonHref: string
  imageUrl?: string
}

export interface OpeningHour {
  day: number // 0 = Sunday ... 6 = Saturday
  open: string | null // "09:00" or null = closed
  close: string | null
}

export interface SocialLinks {
  instagram?: string
  facebook?: string
  tiktok?: string
  website?: string
}

export type SectionKey =
  | "hero"
  | "features"
  | "services"
  | "about"
  | "team"
  | "shop"
  | "cta"

export interface SectionMeta {
  key: SectionKey
  visible: boolean
}

export interface SiteContent {
  hero: HeroContent
  features: { title: string; subtitle: string; items: FeatureContent[] }
  services: { title: string; subtitle: string }
  about: AboutContent
  team: { title: string; subtitle: string }
  shop: { title: string; subtitle: string }
  cta: CtaContent
  openingHours: OpeningHour[]
  social: SocialLinks
  seo: { title?: string; description?: string }
  sections: SectionMeta[]
}

export const SECTION_KEYS: SectionKey[] = [
  "hero",
  "features",
  "services",
  "about",
  "team",
  "shop",
  "cta",
]

const DEFAULT_HOURS: OpeningHour[] = [
  { day: 1, open: "09:00", close: "18:00" },
  { day: 2, open: "09:00", close: "18:00" },
  { day: 3, open: "09:00", close: "18:00" },
  { day: 4, open: "09:00", close: "18:00" },
  { day: 5, open: "09:00", close: "18:00" },
  { day: 6, open: "09:00", close: "13:00" },
  { day: 0, open: null, close: null },
]

function sections(all = true): SectionMeta[] {
  return SECTION_KEYS.map((key) => ({ key, visible: all }))
}

/**
 * Tolerant normalization of the stored `sections` array (EPIC #3 E3-2):
 * - valid entries keep THEIR STORED ORDER (owner-defined section order)
 * - unknown keys are dropped, duplicates deduplicated (first wins)
 * - missing keys are appended at the end (visible, so nothing disappears)
 * Returns null when nothing valid is stored (caller keeps defaults).
 */
export function normalizeSections(input: unknown): SectionMeta[] | null {
  if (!Array.isArray(input)) return null
  const isObj = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v)
  const valid = (input as SectionMeta[]).filter(
    (x) => isObj(x) && SECTION_KEYS.includes(x.key)
  )
  if (valid.length === 0) return null
  const ordered: SectionMeta[] = []
  const seen = new Set<SectionKey>()
  for (const entry of valid) {
    if (seen.has(entry.key)) continue
    seen.add(entry.key)
    ordered.push({ key: entry.key, visible: !!entry.visible })
  }
  for (const key of SECTION_KEYS) {
    if (!seen.has(key)) {
      seen.add(key)
      ordered.push({ key, visible: true })
    }
  }
  return ordered
}

/**
 * Render order for the public home page (EPIC #3 E3-2): the stored order with
 * two guarantees — hero is ALWAYS first when visible (it is the page header),
 * and hidden sections never render. Pure so tests and the editor preview agree
 * with the public renderer.
 */
export function homeSectionOrder(sectionsMeta: SectionMeta[]): SectionKey[] {
  const visible = sectionsMeta.filter((s) => s.visible).map((s) => s.key)
  if (!visible.includes("hero")) return visible
  return ["hero", ...visible.filter((k) => k !== "hero")]
}

/** Default site content per vertical (Slovenian copy). */
export function defaultSiteContent(vertical: string): SiteContent {
  const byVertical: Record<string, Partial<SiteContent>> = {
    beauty: {
      hero: {
        eyebrow: "Dobrodošli",
        title: "Vaša lepota, naša strast",
        subtitle:
          "Izkušnja vrhunske lepote in premium izdelkov na enem mestu. Rezervirajte svoj termin že danes.",
        primaryCta: { label: "Rezerviraj termin", href: "/booking" },
        secondaryCta: { label: "Obišči trgovino", href: "/shop" },
      },
      about: {
        title: "Dobrodošli v našem salonu",
        paragraphs: [
          "Stopite v svet, kjer se srečujeta luksuz in strokovnost. Naša ekipa strokovnjakov je posvečena vsaki podrobnosti — od trenutka, ko vstopite, do žarečega rezultata.",
          "Uporabljamo izključno preverjene, visokokakovostne izdelke in tehnike, prilagojene vašim željam.",
        ],
        stats: [
          { value: "10+", label: "Let izkušenj" },
          { value: "5K+", label: "Zadovoljnih strank" },
        ],
      },
      features: {
        title: "Zakaj izbrati nas",
        subtitle: "Dostopno razkošje, prilagojeno vam",
        items: [
          { icon: "CalendarCheck", title: "Enostavno naročanje", description: "Rezervirajte termin v nekaj klikih, 24/7." },
          { icon: "Sparkles", title: "Strokovnjakinje", description: "Izkušena ekipa z občutkom za detajle." },
          { icon: "ShoppingBag", title: "Premium izdelki", description: "Samo preverjene blagovne znamke." },
        ],
      },
      cta: {
        title: "Pripravljeni na spremembo?",
        text: "Rezervirajte svoj termin še danes — vaši lasje in koža vam bodo hvaležni.",
        buttonLabel: "Rezerviraj zdaj",
        buttonHref: "/booking",
      },
    },
    frizer: {
      hero: {
        eyebrow: "Frizerski salon",
        title: "Vaš slog, naša obrt",
        subtitle:
          "Precizno striženje, barvanje in oblikovanje — prilagojeno vašemu slogu. Rezervirajte termin online.",
        primaryCta: { label: "Rezerviraj termin", href: "/booking" },
        secondaryCta: { label: "Cenik storitev", href: "/services" },
      },
      about: {
        title: "Več kot le frizerija",
        paragraphs: [
          "Verjamemo, da dobra frizura spremeni dan — in pogosto tudi teden. Vsak obisk začnemo s posvetom, da razumemo vaše želje in življenjski slog.",
          "Naša ekipa se redno izobražuje na svetovnih trendih, uporabljamo pa profesionalne izdelke, ki negujejo lase.",
        ],
        stats: [
          { value: "8+", label: "Let izkušenj" },
          { value: "3K+", label: "Srečnih strank" },
        ],
      },
      features: {
        title: "Zakaj k nam",
        subtitle: "Frizerska obrt s srcem",
        items: [
          { icon: "Scissors", title: "Precizno striženje", description: "Vsak rez skrbno načrtovan po vaših željah." },
          { icon: "CalendarCheck", title: "Hitro naročanje", description: "Online rezervacija brez klicanja." },
          { icon: "Leaf", title: "Profesionalni izdelki", description: "Negujemo lase z vrhunskimi izdelki." },
        ],
      },
      cta: {
        title: "Čas je za novo frizuro",
        text: "Rezervirajte svoj termin še danes — vaši lasje vam bodo hvaležni.",
        buttonLabel: "Rezerviraj zdaj",
        buttonHref: "/booking",
      },
    },
    barber: {
      hero: {
        eyebrow: "Barber Shop",
        title: "Precizno. Tradicionalno. Tvoje.",
        subtitle:
          "Klasično moško striženje, brada in hot-towel britje v mestnem stilu. Rezerviraj svoj termin.",
        primaryCta: { label: "Rezerviraj termin", href: "/booking" },
        secondaryCta: { label: "Cenik", href: "/services" },
      },
      about: {
        title: "Več kot le barber",
        paragraphs: [
          "Pri nas se srečata tradicionalna obrt in sodoben slog. Vsak haircut je projekt — od posveta do zadnjega detajla.",
          "Kava, dobra glasba in precizno ročno delo. To je kraj, kjer se sprostiš in prideš ven kot nov človek.",
        ],
        stats: [
          { value: "6+", label: "Let izkušenj" },
          { value: "2K+", label: "Zvestih strank" },
        ],
      },
      features: {
        title: "Zakaj pri nas",
        subtitle: "Barber izkušnja na visoki ravni",
        items: [
          { icon: "Scissors", title: "Skin fades & klasika", description: "Obvladujemo vse tehnike — od klasičnega do sodobnega." },
          { icon: "Flame", title: "Hot towel britje", description: "Tradicionalno britje z vročo brisačo." },
          { icon: "CalendarCheck", title: "Brez čakanja", description: "Online rezervacija — tvoj termin, tvoj čas." },
        ],
      },
      cta: {
        title: "Pripravljen na svež cut?",
        text: "Rezerviraj termin online — brez čakanja in brez telefona.",
        buttonLabel: "Rezerviraj zdaj",
        buttonHref: "/booking",
      },
    },
    nails: {
      hero: {
        eyebrow: "Nail Studio",
        title: "Nohti kot umetnina",
        subtitle:
          "Manikira, pedikura in nail art po meri. Trajna lakiranja, ki ostanejo brezmadežna tedeni.",
        primaryCta: { label: "Rezerviraj termin", href: "/booking" },
        secondaryCta: { label: "Galerija storitev", href: "/services" },
      },
      about: {
        title: "Malo studijo, velika ljubezen do detajlov",
        paragraphs: [
          "Verjamemo, da so nohti malenkost z velikim učinkom. Vsaka manikira je mini umetnina — od oblike in barve do končnega sijaja.",
          "Uporabljamo sertificirane materiale in vzdržujemo najvišje higienske standarde.",
        ],
        stats: [
          { value: "5+", label: "Let izkušenj" },
          { value: "2K+", label: "Narejenih nohtov" },
        ],
      },
      features: {
        title: "Zakaj k nam",
        subtitle: "Manikira na višjem nivoju",
        items: [
          { icon: "Sparkles", title: "Nail art po meri", description: "Od prefinjenega do drznega — po tvoji želji." },
          { icon: "ShieldCheck", title: "Higiena na prvem mestu", description: "Sterilno orodje pri vsakem terminu." },
          { icon: "CalendarCheck", title: "Rezerviraj online", description: "Izberi termin, ki ti ustreza." },
        ],
      },
      cta: {
        title: "Tvoji nohti zaslužijo najboljše",
        text: "Rezerviraj termin in pusti detajle nam.",
        buttonLabel: "Rezerviraj zdaj",
        buttonHref: "/booking",
      },
    },
    cosmetica: {
      hero: {
        eyebrow: "Kozmetični salon",
        title: "Tvoja koža v najboljših rokah",
        subtitle:
          "Tretmaji obraza, čiščenja in podaljšana nega — z naprednimi tehnikami in vrhunskimi izdelki.",
        primaryCta: { label: "Rezerviraj termin", href: "/booking" },
        secondaryCta: { label: "Storitve", href: "/services" },
      },
      about: {
        title: "Nega, prilagojena tvoji koži",
        paragraphs: [
          "Vsaka koža je drugačna — zato se vsak tretma začne z analizo kože in posvetom. Rezultate gradimo postopoma in trajnostno.",
          "Sodelujemo s preverjenimi blagovnimi znamkami in se nenehno izobražujemo o novostih v kozmetiki.",
        ],
        stats: [
          { value: "12+", label: "Let izkušenj" },
          { value: "4K+", label: "Tretmajev letno" },
        ],
      },
      features: {
        title: "Zakaj k nam",
        subtitle: "Strokovna nega na dokazih",
        items: [
          { icon: "Microscope", title: "Analiza kože", description: "Tretmaji prilagojeni tvojemu tipu kože." },
          { icon: "Sparkles", title: "Napredne tehnike", description: "Sodobni aparati in izdelki." },
          { icon: "CalendarCheck", title: "Enostavno naročanje", description: "Online rezervacija 24/7." },
        ],
      },
      cta: {
        title: "Tvoja koža si zasluži najboljše",
        text: "Rezerviraj brezplačen posvet in ugotovi, kaj koža potrebuje.",
        buttonLabel: "Rezerviraj posvet",
        buttonHref: "/booking",
      },
    },
    massage: {
      hero: {
        eyebrow: "Masaža & Wellness",
        title: "Sprostitev telesa in duha",
        subtitle:
          "Relax, športne in terapevtske masaže — prilagojene tvojim potrebam. Pridi, oddahni se.",
        primaryCta: { label: "Rezerviraj masažo", href: "/booking" },
        secondaryCta: { label: "Storitve", href: "/services" },
      },
      about: {
        title: "Oaza miru v mestu",
        paragraphs: [
          "Naša vizija je preprosta: da odideš lažji, kot si prišel. Vsako masažo prilagodimo tvojim potrebam — od sprostitve do regeneracije.",
          "Delamo s certificiranimi terapevti in naravnimi olji.",
        ],
        stats: [
          { value: "9+", label: "Let izkušenj" },
          { value: "6K+", label: "Izvedenih masaž" },
        ],
      },
      features: {
        title: "Zakaj k nam",
        subtitle: "Wellness na osebni ravni",
        items: [
          { icon: "HeartHandshake", title: "Osebni pristop", description: "Masaža prilagojena tvojim potrebam." },
          { icon: "Leaf", title: "Naravna olja", description: "Aromaterapija s preverjenimi olji." },
          { icon: "CalendarCheck", title: "Rezerviraj online", description: "Tvoj termin v nekaj klikih." },
        ],
      },
      cta: {
        title: "Pripravljen na odmor?",
        text: "Rezerviraj masažo in dovoli telesu, da si povrne energijo.",
        buttonLabel: "Rezerviraj zdaj",
        buttonHref: "/booking",
      },
    },
    epilation: {
      hero: {
        eyebrow: "Epilacija & Laser",
        title: "Gladka koža, trajno",
        subtitle:
          "Laser epilacija in voščanje z vrhunskimi apirati. Rezultati, ki ostanejo.",
        primaryCta: { label: "Rezerviraj termin", href: "/booking" },
        secondaryCta: { label: "Storitve in cene", href: "/services" },
      },
      about: {
        title: "Trajne rešitve za gladko kožo",
        paragraphs: [
          "Z najnovejšo laser tehnologijo zagotavljamo varne in učinkovite tretmaje za vse tipe kože. Rezultati vidni že po prvih tretmajih.",
          "Vsak tretmaj začnemo s posvetom in testom kože.",
        ],
        stats: [
          { value: "7+", label: "Let izkušenj" },
          { value: "3K+", label: "Zadovoljnih strank" },
        ],
      },
      features: {
        title: "Zakaj k nam",
        subtitle: "Varno in učinkovito",
        items: [
          { icon: "Zap", title: "Najnovejši lasri", description: "Hitri in manj boleči tretmaji." },
          { icon: "ShieldCheck", title: "Certificirani strokovnjaki", description: "Tretmaji pod nadzorom specialistov." },
          { icon: "CalendarCheck", title: "Online naročanje", description: "Rezerviraj termin v nekaj klikih." },
        ],
      },
      cta: {
        title: "Poslavlja se od britja",
        text: "Rezerviraj brezplačen posvet in izračunaj svoj program tretmajev.",
        buttonLabel: "Rezerviraj posvet",
        buttonHref: "/booking",
      },
    },

    // --- §21 acceptance profiles: genuinely different business models ---
    seamstress: {
      hero: {
        eyebrow: "Šiviljstvo",
        title: "Vsako oblačilo, popolno prileganje",
        subtitle:
          "Spremembe, popravila in šivanje po meri — z merilnim listom in dogovorjenim rokom. Oddajte povpraševanje.",
        primaryCta: { label: "Oddaj povpraševanje", href: "/booking" },
        secondaryCta: { label: "Cenik storitev", href: "/services" },
      },
      about: {
        title: "Obrt z nitjo in iglo",
        paragraphs: [
          "Vsako naročilo začnemo s posvetom in meritvami — vaše želje, material in pričakovanja so zapisana v merilnem listu, ki ga upoštevamo od prvega do zadnjega šiva.",
          "Delamo s preciznostjo: od krajšanja hlač do šivanja oblek po meri. Vsak kos pregledamo še pred predajo.",
        ],
        stats: [
          { value: "15+", label: "Let izkušenj" },
          { value: "2K+", label: "Zadovoljnih strank" },
        ],
      },
      features: {
        title: "Zakaj k nam",
        subtitle: "Preciznost, rok in pošten dogovor",
        items: [
          { icon: "Scissors", title: "Natančne spremembe", description: "Vsak poseg naredimo po merilnem listu." },
          { icon: "CalendarCheck", title: "Dogovorjeni roki", description: "Naročilo ima jasen proces od povpraševanja do prevzema." },
          { icon: "HeartHandshake", title: "Poštene cene", description: "Predračun pred delom — brez presenečenj." },
        ],
      },
      cta: {
        title: "Oblačilo, ki čaka na popravek?",
        text: "Oddajte povpraševanje — odgovorimo z rokom in ceno v najkrajšem možnem času.",
        buttonLabel: "Oddaj povpraševanje",
        buttonHref: "/booking",
      },
    },
    "tire-service": {
      hero: {
        eyebrow: "Vulkanizer & avtoservis",
        title: "Vaše vozilo v najboljših rokah",
        subtitle:
          "Menjava gum, balansiranje, servis in diagnostika — z delovnim nalogom, ki sledi vsakemu posegu. Rezervirajte termin menjave.",
        primaryCta: { label: "Rezerviraj menjavo gum", href: "/booking" },
        secondaryCta: { label: "Cenik storitev", href: "/services" },
      },
      about: {
        title: "Hitro, pošteno, profesionalno",
        paragraphs: [
          "Vsak obisk se začne s sprejemom vozila in zapisom stanja. Naš delovni nalog sledi vsemu: od diagnostike, preko rezervnih delov, do prevzema in plačila.",
          "Delamo z kakovostnimi materiali in za vsako delo vnaprej dogovorimo obseg ter ceno.",
        ],
        stats: [
          { value: "12+", label: "Let izkušenj" },
          { value: "8K+", label: "Servisiranih vozil" },
        ],
      },
      features: {
        title: "Zakaj k nam",
        subtitle: "Servis, ki mu zaupate",
        items: [
          { icon: "ShieldCheck", title: "Delovni nalog", description: "Vsak poseg dokumentiran — od sprejema do oddaje." },
          { icon: "ShoppingBag", title: "Gume in deli", description: "Zaloge priljubljenih dimenzij in rezervnih delov." },
          { icon: "CalendarCheck", title: "Rezervacija menjave", description: "Sezonske menjave brez čakanja." },
        ],
      },
      cta: {
        title: "Čas za zimske gume?",
        text: "Rezervirajte termin menjave in prepustite preostalo nam.",
        buttonLabel: "Rezerviraj termin",
        buttonHref: "/booking",
      },
    },
    beekeeping: {
      hero: {
        eyebrow: "Čebelarstvo",
        title: "Med, kot ga daje narava",
        subtitle:
          "Odcejen med iz lastnih panjskih postaj, propolis, vosek in drugi čebelji izdelki. Naročite izdelke s svežo žetvijo.",
        primaryCta: { label: "Naroči izdelke", href: "/shop" },
        secondaryCta: { label: "Poglej izdelke", href: "/shop" },
      },
      about: {
        title: "Družinsko čebelarstvo",
        paragraphs: [
          "Vsaka serija medu je sledljiva — zapisan je datum žetve, panjska postaja in količina. Zato veste, točno kaj pojete.",
          "Med črpamo ob načrtovanih terminih žetve in ga pakiramo v kakovostno embalažo. Količine so odvisne od sezone.",
        ],
        stats: [
          { value: "120+", label: "Čebeljih družin" },
          { value: "1.5t", label: "Letne žetve" },
        ],
      },
      features: {
        title: "Zakaj naš med",
        subtitle: "Sledljivo od panja do kozarca",
        items: [
          { icon: "Leaf", title: "Naravna žetev", description: "Brez aditivov — samo med, kot so ga pripravile čebele." },
          { icon: "ShieldCheck", title: "Sledljive serije", description: "Vsak lot ima oznako in datum žetve." },
          { icon: "ShoppingBag", title: "Naročilo na spletu", description: "Izdelke naročite preprosto prek spletne trgovine." },
        ],
      },
      cta: {
        title: "Med s sveže žetve",
        text: "Naročite svoj paket — količine se spreminjajo s sezono, zato hitite.",
        buttonLabel: "Naroči izdelke",
        buttonHref: "/shop",
      },
    },
  }

  const v = byVertical[vertical] ?? byVertical.beauty
  const base: SiteContent = {
    hero: v.hero as HeroContent,
    features: v.features!,
    services: {
      title: "Naše storitve",
      subtitle: "Najljubše storitve naših strank",
    },
    about: v.about as AboutContent,
    team: { title: "Naša ekipa", subtitle: "Strokovnjaki, posvečeni vaši lepoti" },
    shop: { title: "Izbrani izdelki", subtitle: "Izdelki, ki jih uporabljamo in priporočamo" },
    cta: v.cta as CtaContent,
    openingHours: DEFAULT_HOURS.map((h) => ({ ...h })),
    social: {},
    seo: {},
    sections: sections(true),
  }
  // Vertical-specific about image handled by verticals.ts (imageUrl preset)
  return base
}

/** Deep-merge stored JSON over defaults — tolerant of missing/corrupt data. */
export function mergeSiteContent(stored: unknown, vertical: string): SiteContent {
  const defaults = defaultSiteContent(vertical)
  if (!stored || typeof stored !== "object") return defaults
  const s = stored as Record<string, unknown>
  const merged: SiteContent = { ...defaults }

  const isObj = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v)

  if (isObj(s.hero)) merged.hero = { ...defaults.hero, ...(s.hero as Partial<HeroContent>) }
  if (isObj(s.features)) {
    const f = s.features as Partial<SiteContent["features"]>
    merged.features = {
      title: f.title ?? defaults.features.title,
      subtitle: f.subtitle ?? defaults.features.subtitle,
      items: Array.isArray(f.items) && f.items.length ? (f.items as FeatureContent[]) : defaults.features.items,
    }
  }
  if (isObj(s.services)) merged.services = { ...defaults.services, ...(s.services as Partial<SiteContent["services"]>) }
  if (isObj(s.about)) {
    const a = s.about as Partial<AboutContent>
    merged.about = {
      ...defaults.about,
      ...a,
      paragraphs: Array.isArray(a.paragraphs) ? a.paragraphs : defaults.about.paragraphs,
      stats: Array.isArray(a.stats) ? (a.stats as StatContent[]) : defaults.about.stats,
    }
  }
  if (isObj(s.team)) merged.team = { ...defaults.team, ...(s.team as Partial<SiteContent["team"]>) }
  if (isObj(s.shop)) merged.shop = { ...defaults.shop, ...(s.shop as Partial<SiteContent["shop"]>) }
  if (isObj(s.cta)) merged.cta = { ...defaults.cta, ...(s.cta as Partial<CtaContent>) }
  if (Array.isArray(s.openingHours)) {
    const hours = (s.openingHours as OpeningHour[]).filter(
      (h) => isObj(h) && typeof h.day === "number"
    )
    if (hours.length) merged.openingHours = hours
  }
  if (isObj(s.social)) merged.social = { ...defaults.social, ...(s.social as SocialLinks) }
  if (isObj(s.seo)) merged.seo = { ...defaults.seo, ...(s.seo as SiteContent["seo"]) }
  if (Array.isArray(s.sections)) {
    // E3-2: keep the owner-defined section ORDER (tolerant: unknown keys
    // dropped, duplicates deduped, missing keys appended visible).
    const normalized = normalizeSections(s.sections)
    if (normalized) merged.sections = normalized
  }
  return merged
}

const DAY_NAMES_SL = ["Nedelja", "Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota"]

export function formatOpeningHours(hours: OpeningHour[]): { day: string; value: string }[] {
  const ordered = [...hours].sort((a, b) => {
    // Monday first
    const idx = (d: number) => (d === 0 ? 7 : d)
    return idx(a.day) - idx(b.day)
  })
  return ordered.map((h) => ({
    day: DAY_NAMES_SL[h.day] ?? `Dan ${h.day}`,
    value: h.open && h.close ? `${h.open} – ${h.close}` : "Zaprto",
  }))
}
