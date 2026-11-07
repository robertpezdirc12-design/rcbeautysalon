// ============================================================
// PLATFORM LANDING dictionary (F1, 7. 11. 2026)
//
// The bare "/" is the product's front door, "/en" its English twin.
// This is the ONLY source of landing copy — no hardcoded Slovenian
// in platform-landing.tsx. Both namespaces MUST have identical shapes
// (guarded by tests/landing/platform-landing.test.ts).
//
// OWNER COPY (commit 15aa272) is preserved VERBATIM in `hero.h1Lead`,
// `hero.h1Accent`, `hero.tagline` and `hero.lead` on the Slovenian side.
// The English H1 is the owner's own EN tagline, not a re-translation.
//
// No invented prices, customer names, logos, statistics or testimonials:
// plan figures come from src/lib/plans/registry.ts, not from this file.
// ============================================================

export const landingSl = {
  meta: {
    title: "MARKEC – MY BUSINESS PLATFORM | Tvoja spletna poslovna prisotnost",
    description:
      "Tvoje podjetje. Tvoja spletna stran. Tvoje stranke. Tvoja platforma. MARKEC ni izdelovalec spletnih strani — je enostaven sistem, v katerem podjetnik brez programiranja upravlja celotno svojo spletno poslovno prisotnost: spletno stran, trgovino, rezervacije in stranke.",
    ogTitle: "MARKEC – Tvoje podjetje. Tvoja platforma.",
    ogDescription:
      "Spletna stran, trgovina, rezervacije in urejanje vsebine v enem računu. Brez programiranja.",
  },
  brand: {
    sub: "MOJA POSLOVNA PLATFORMA",
  },
  nav: {
    modules: "Moduli",
    examples: "Primeri",
    steps: "Kako deluje",
    plans: "Paketi",
    login: "Prijava za podjetnike",
    cta: "Začni brezplačno",
  },
  aria: {
    nav: "Glavna navigacija",
    lang: "Izbira jezika",
    mock: "Ponazoritev vmesnika MARKEC",
    legal: "Pravne povezave",
    footer: "Platformske povezave",
  },
  languages: {
    sl: "Slovenščina",
    en: "English",
  },
  hero: {
    eyebrow: "MARKEC – MY BUSINESS PLATFORM",
    h1Lead: "Tvoje podjetje. Tvoja spletna stran. Tvoje stranke.",
    h1Accent: "Tvoja platforma.",
    // Owner's own English tagline — shown under the Slovenian H1.
    tagline: "Your Business. Your Website. Your Customers. Your Platform.",
    lead: "MARKEC ni samo še en izdelovalec spletnih strani — je enostaven sistem, v katerem podjetnik brez programiranja upravlja celotno svojo spletno poslovno prisotnost.",
    cta: "Ustvari svoje podjetje — brezplačno",
    secondary: "Poglej primere strani",
    micro:
      "Brez kartice · V 3 korakih · Spletna stran, trgovina in rezervacije so predpripravljene",
  },
  mock: {
    url: "markec.si/s/frizer-ana",
    brand: "MARKEC",
    side: [
      "Pregled",
      "Rezervacije",
      "Storitve",
      "Trgovina",
      "Vsebina",
      "Nastavitve",
    ],
    title: "Vodena namestitev",
    progress: "3 od 5 korakov opravljenih",
    tasks: [
      "Izberi dejavnost",
      "Dodaj podatke podjetja",
      "Naloži prve slike",
      "Dodaj storitve in cene",
      "Objavi spletno stran",
    ],
    doneCount: 3,
    miniName: "Frizer Ana",
    miniAlt: "Predogled strani frizerskega salona",
    mini: "Stran je pripravljena za objavo",
    miniCta: "Rezerviraj termin →",
    caption: "Ponazoritev vmesnika · vodena namestitev",
  },
  trust: [
    "Vse na enem računu",
    "Vmesnik v slovenščini in angleščini",
    "Brez nameščanja in brez kode",
    "Brezplačen paket za začetek",
  ],
  problem: {
    eyebrow: "Zakaj podjetniki obupajo",
    title: "Stran je šele začetek. Pravo delo se začne po objavi.",
    lead: "Večina orodij vam naredi lep prvi zaslon, potem pa morate rezervacije, trgovino, prevode in urejanje vsebine sestavljati iz ločenih naročnin.",
    cards: [
      {
        title: "Pet orodij, pet računov",
        body: "Stran pri enem ponudniku, termini pri drugem, trgovina pri tretjem. Vsak ima svojo prijavo in svoj račun.",
      },
      {
        title: "Vsaka sprememba čaka na razvijalca",
        body: "Nova cena, nova slika, nov delovni čas — namesto dveh minut dobite dopisovanje in račun.",
      },
      {
        title: "Prazna stran brez vsebine",
        body: "Predloga je lepa, a prazna. Nihče vam ne pripravi storitev, izdelkov in besedil za vašo dejavnost.",
      },
    ],
  },
  modules: [
    {
      title: "Rezervacije 24/7",
      body: "Stranke same izberejo termin, vi dobite obvestilo. Odpovedi in opomniki so del sistema.",
    },
    {
      title: "Trgovina in izdelki",
      body: "Katalog, cene, zaloge in naročila na isti strani kot ostala vsebina.",
    },
    {
      title: "Slike in besedila sami",
      body: "Urejevalnik brez kodiranja: zamenjajte fotografijo, popravite ceno, dodajte nov članek ali storitev.",
    },
    {
      title: "Dva jezika vmesnika",
      body: "Slovenščina in angleščina sta vgrajeni v vmesnik, brez dodatnega modula ali vtičnika.",
    },
  ],
  examples: {
    eyebrow: "Primeri iz platforme",
    title: "Neobvezna izbira dejavnosti",
    lead: "Dejavnost je samo pomočnik pri začetni nastavitvi — lahko jo preskočite. Vsaka predloga prinese pripravljen katalog, obrazce in besedila, ki jih poljubno spreminjate.",
    tag: "Pripravljena predloga",
    more: "Prikazanih je 5 od 12 dejavnosti, ki so na voljo v platformi — vzorec, ne celoten seznam.",
    items: [
      {
        vertical: "barber",
        image: "/img/presets/hero-barber.jpg",
        title: "Frizerstvo in barber shop",
        body: "Termini po zaposlenih, storitve, cenik in galerija del.",
        alt: "Notranjost brivnice z usnjenimi stoli",
      },
      {
        vertical: "mehanik",
        image: "/img/presets/hero-garage.jpg",
        title: "Avtoservis in vulkanizer",
        body: "Povpraševanja, vozila, delovni nalogi in servisni termini.",
        alt: "Avtoservis z dvignjenim vozilom",
      },
      {
        vertical: "beauty",
        image: "/img/presets/hero-spa.jpg",
        title: "Kozmetika in wellness",
        body: "Masaže, nega, paketi in spletne rezervacije.",
        alt: "Ambient kozmetičnega salona",
      },
      {
        vertical: "beekeeping",
        image: "/img/presets/hero-apiary.jpg",
        title: "Čebelarstvo",
        body: "Izdelki, trgovina, naročila in zgodba o pridelavi.",
        alt: "Čebelarstvo in medeni izdelki",
      },
      {
        vertical: "seamstress",
        image: "/img/presets/hero-atelier.jpg",
        title: "Šiviljstvo in atelje",
        body: "Mere, popravila, roki in povpraševanja po meri.",
        alt: "Šiviljski atelje z blagom",
      },
    ],
  },
  steps: {
    eyebrow: "Voden začetek",
    title: "Kako deluje",
    items: [
      {
        title: "Vstopite z računom",
        body: "Prijava in vse je pripravljeno: predpripravljena spletna stran, trgovina, rezervacije, slike in katalogi za vašo dejavnost.",
      },
      {
        title: "Uredite v svojem prostoru",
        body: "Besedila, slike, cene in urnik spreminjate sami — vse znotraj vašega prostora. Vsako spremembo pred objavo vidite v predogledu.",
      },
      {
        title: "Objavite — stranke pridejo",
        body: "Z enim klikom gre stran na splet. Vaše stranke javno rezervirajo termine, naročajo iz trgovine in vas najdejo na spletu.",
      },
    ],
  },
  plans: {
    eyebrow: "Preprosti paketi",
    title: "Preprosti paketi",
    lead: "Začnite brezplačno in nadgradite, ko vaše podjetje raste.",
    badge: "Več zmogljivosti",
    cta: "Začni brezplačno",
    note: "Cene za PRO in SCALE še niso določene. Brezplačni paket je na voljo takoj, brez kreditne kartice.",
  },
  faq: {
    title: "Pogosta vprašanja",
    items: [
      {
        q: "Ali potrebujem znanje programiranja?",
        a: "Ne. Vsebino, slike, cene, storitve in izdelke urejate v vmesniku. Modul vklopite ali izklopite z enim klikom; izklop ne izbriše podatkov.",
      },
      {
        q: "Kaj se zgodi po prijavi?",
        a: "Na nadzorni plošči vas pričaka voden kontrolni seznam, ki iz resničnih podatkov izračuna, kaj še manjka, in vedno predlaga en naslednji korak. Dokler ne objavite, je seznam viden ob vsaki prijavi.",
      },
      {
        q: "Ali lahko uporabim svojo domeno?",
        a: "Da, v paketu PRO je vključena ena lastna domena, v SCALE neomejeno. Brezplačni paket uporablja naslov na domeni platforme.",
      },
      {
        q: "V katerih jezikih je platforma?",
        a: "Vmesnik je na voljo v slovenščini in angleščini, javna vstopna stran pa ima slovensko in angleško različico na ločenih naslovih.",
      },
      {
        q: "Ali so moji podatki ločeni od drugih podjetij?",
        a: "Da. Vsako podjetje je svoj najemnik z lastnimi podatki, moduli, domeno in uporabniškimi pravicami.",
      },
    ],
  },
  final: {
    title: "Pripravljeni na začetek?",
    lead: "Ustvarite svojo stran brezplačno — objavite, ko boste zadovoljni s podobo in vsebino.",
    cta: "Ustvari svoje podjetje",
  },
  foot: {
    tag: "Moja poslovna platforma",
    privacy: "Zasebnost",
    terms: "Pogoji",
    cookies: "Piškotki",
    login: "Prijava",
    start: "Ustvari podjetje",
  },
}

export type LandingDictionary = typeof landingSl

export const landingEn: LandingDictionary = {
  meta: {
    title: "MARKEC – MY BUSINESS PLATFORM | Your Business. Your Platform.",
    description:
      "Your Business. Your Website. Your Customers. Your Platform. MARKEC isn't a website builder — it's a simple system where a business owner manages their entire online business presence without coding: website, shop, bookings and customers.",
    ogTitle: "MARKEC – Your Business. Your Platform.",
    ogDescription:
      "Website, shop, bookings and content editing in one account. No coding required.",
  },
  brand: {
    sub: "MY BUSINESS PLATFORM",
  },
  nav: {
    modules: "Modules",
    examples: "Examples",
    steps: "How it works",
    plans: "Plans",
    login: "Business login",
    cta: "Start for free",
  },
  aria: {
    nav: "Main navigation",
    lang: "Language",
    mock: "MARKEC interface illustration",
    legal: "Legal links",
    footer: "Platform links",
  },
  languages: {
    sl: "Slovenščina",
    en: "English",
  },
  hero: {
    eyebrow: "MARKEC – MY BUSINESS PLATFORM",
    h1Lead: "Your Business. Your Website. Your Customers.",
    h1Accent: "Your Platform.",
    // The owner's EN tagline is the H1 here; this line adds the mechanism.
    tagline: "One account. One dashboard. No code.",
    lead: "MARKEC isn't just another website builder — it's a simple system where a business owner manages their whole online business presence without coding.",
    cta: "Create your business — free",
    secondary: "See example sites",
    micro:
      "No credit card · Three steps · Website, shop and bookings are ready from the start",
  },
  mock: {
    url: "markec.si/s/frizer-ana",
    brand: "MARKEC",
    side: ["Overview", "Bookings", "Services", "Shop", "Content", "Settings"],
    title: "Guided setup",
    progress: "3 of 5 steps done",
    tasks: [
      "Choose your activity",
      "Add business details",
      "Upload your first photos",
      "Add services and prices",
      "Publish your website",
    ],
    doneCount: 3,
    miniName: "Ana's Hair Studio",
    miniAlt: "Preview of a hair salon page",
    mini: "Your site is ready to publish",
    miniCta: "Book an appointment →",
    caption: "Interface illustration · guided setup",
  },
  trust: [
    "Everything in one account",
    "Slovenian and English interface",
    "Nothing to install, no code",
    "Free plan to get started",
  ],
  problem: {
    eyebrow: "Why owners give up",
    title: "The site is only the beginning. The real work starts after launch.",
    lead: "Most tools give you a pretty first screen, then you have to assemble bookings, shop, translations and content editing from separate subscriptions.",
    cards: [
      {
        title: "Five tools, five accounts",
        body: "Your site with one provider, appointments with another, shop with a third. Each has its own login and its own bill.",
      },
      {
        title: "Every change waits on a developer",
        body: "A new price, a new photo, new opening hours — two minutes of work turns into an email thread and an invoice.",
      },
      {
        title: "An empty page with no content",
        body: "The template looks good but is blank. Nobody prepares the services, products and copy for your trade.",
      },
    ],
  },
  modules: [
    {
      title: "24/7 bookings",
      body: "Customers pick a slot themselves and you get notified. Cancellations and reminders are built in.",
    },
    {
      title: "Shop and products",
      body: "Catalog, prices, stock and orders on the same site as the rest of your content.",
    },
    {
      title: "Photos and copy, by you",
      body: "A no-code editor: swap a photo, fix a price, add an article or a service.",
    },
    {
      title: "Two interface languages",
      body: "Slovenian and English are built into the interface, with no extra module or plugin.",
    },
  ],
  examples: {
    eyebrow: "Examples from the platform",
    title: "Choosing an activity is optional",
    lead: "An activity is only a helper for the initial setup — you can skip it. Every preset brings a ready catalog, forms and copy that you can change freely.",
    tag: "Ready-made preset",
    more: "Showing 5 of the 12 activities available in the platform — a sample, not the full list.",
    items: [
      {
        vertical: "barber",
        image: "/img/presets/hero-barber.jpg",
        title: "Hairdresser and barber",
        body: "Per-staff appointments, services, price list and gallery.",
        alt: "Barbershop interior with leather chairs",
      },
      {
        vertical: "mehanik",
        image: "/img/presets/hero-garage.jpg",
        title: "Garage and tyre service",
        body: "Inquiries, vehicles, work orders and service slots.",
        alt: "Car workshop with a vehicle on a lift",
      },
      {
        vertical: "beauty",
        image: "/img/presets/hero-spa.jpg",
        title: "Beauty and wellness",
        body: "Massages, treatments, packages and online booking.",
        alt: "Beauty salon interior",
      },
      {
        vertical: "beekeeping",
        image: "/img/presets/hero-apiary.jpg",
        title: "Beekeeping",
        body: "Products, shop, orders and the story behind your honey.",
        alt: "Beekeeping and honey products",
      },
      {
        vertical: "seamstress",
        image: "/img/presets/hero-atelier.jpg",
        title: "Tailoring and atelier",
        body: "Measurements, alterations, deadlines and made-to-measure inquiries.",
        alt: "Tailoring atelier with fabric",
      },
    ],
  },
  steps: {
    eyebrow: "Guided start",
    title: "How it works",
    items: [
      {
        title: "Sign in with your account",
        body: "Log in and everything is ready: a prepared website, shop, bookings, images and catalogs for your activity.",
      },
      {
        title: "Edit it in your own space",
        body: "You change the copy, images, prices and opening hours yourself — all inside your own space. Every change is visible in a preview before publishing.",
      },
      {
        title: "Publish — customers arrive",
        body: "One click puts the site online. Your customers publicly book appointments, order from the shop and find you on the web.",
      },
    ],
  },
  plans: {
    eyebrow: "Simple plans",
    title: "Simple plans",
    lead: "Start for free and upgrade as your business grows.",
    badge: "More capacity",
    cta: "Start for free",
    note: "PRO and SCALE pricing has not been set yet. The free plan is available now, with no credit card.",
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      {
        q: "Do I need to know how to code?",
        a: "No. You edit content, photos, prices, services and products in the interface. Switch a module on or off with one click; switching it off does not delete data.",
      },
      {
        q: "What happens after I log in?",
        a: "A guided checklist on your dashboard computes from real data what is still missing and always suggests one next step. It stays visible at every login until you publish.",
      },
      {
        q: "Can I use my own domain?",
        a: "Yes. PRO includes one custom domain, SCALE includes unlimited ones. The free plan uses an address on the platform domain.",
      },
      {
        q: "Which languages are supported?",
        a: "The interface is available in Slovenian and English, and the public landing page has separate Slovenian and English URLs.",
      },
      {
        q: "Is my data separate from other businesses?",
        a: "Yes. Every business is its own tenant with separate data, modules, domains and user permissions.",
      },
    ],
  },
  final: {
    title: "Ready to get started?",
    lead: "Create your site for free — publish once you are happy with the look and content.",
    cta: "Create your business",
  },
  foot: {
    tag: "My business platform",
    privacy: "Privacy",
    terms: "Terms",
    cookies: "Cookies",
    login: "Login",
    start: "Create a business",
  },
}
