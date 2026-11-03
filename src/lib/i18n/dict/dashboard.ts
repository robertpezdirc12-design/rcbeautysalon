export const dashboardSl = {
  title: "Nadzorna",
  titleAccent: "plošča",
  welcome: "Dobrodošli nazaj! Tukaj je pregled vašega podjetja.",
  revenueThisMonth: "Prihodki (ta mesec)",
  appointments: "Termini",
  totalCustomers: "Število strank",
  shopSales: "Prodaja v trgovini",
  fromLastMonth: "v primerjavi s prejšnjim mesecem",
  noPreviousData: "Ni prejšnjih podatkov",
  thisMonth: "ta mesec",
  newThisWeek: "novih ta teden",
  todaysAppointments: "Današnji termini",
  /**
   * Slovenian pluralisation:
   * 0 → "Danes nimate terminov"
   * 1 → "Danes imate 1 termin"
   * 2 → "Danes imate 2 termina"
   * 3–4 → "Danes imate X termine"
   * 5+ → "Danes imate X terminov"
   */
  youHaveAppointmentsToday: (n: number) => {
    if (n === 0) return "Danes nimate terminov"
    if (n === 1) return "Danes imate 1 termin"
    if (n === 2) return `Danes imate ${n} termina`
    if (n === 3 || n === 4) return `Danes imate ${n} termine`
    return `Danes imate ${n} terminov`
  },
  noAppointmentsToday: "Za danes ni razporejenih terminov",
  guest: "Gost",
  staffLabel: "Osebje:",
  viewAllAppointments: "Prikaži vse termine",
  quickActions: "Hitra dejanja",
  commonTasks: "Pogosta opravila in bližnjice",
  newAppointment: "Nov termin",
  addProduct: "Dodaj izdelek",
  manageCustomers: "Upravljanje strank",
  recentActivity: "Nedavna dejavnost",
  noRecentActivity: "Ni nedavne dejavnosti",
  activity: {
    appointment: (name: string) => `Nova rezervacija: ${name}`,
    order: (name: string) => `Zaključeno naročilo: ${name}`,
    customer: (name: string) => `Nova stranka: ${name}`,
  },
  shareLink: {
    title: "Vaša povezava za stranke",
    description:
      "To je javni naslov vaše spletne strani. Prilepite ga, kamor koli želite nove stranke.",
    copy: "Kopiraj povezavo",
    copied: "Povezava kopirana!",
    copyFailed: "Kopiranje ni uspelo — povezavo označite in kopirajte ročno.",
    instagramTitle: "Instagram",
    instagramTip:
      "Prilepite povezavo v svojo Instagram bio — to je najmočnejši brezplačni kanal za nove stranke.",
    googleTitle: "Google Business Profile",
    googleTip:
      "Dodajte povezavo k svojemu Google poslovnemu profilu, da vas stranke najdejo v iskanju in na zemljevidu.",
    openGoogle: "Upravljaj Google profil",
  },
  setupChecklist: {
    title: "Vodena namestitev",
    subtitle:
      "Nekaj korakov do popolnoma pripravljene strani — vsi podatki podjetja so varni, ko ste kot na svojem domu.",
    progressFormat: "{done} od {total} korakov",
    progressAllDone: "Vse opravljeno",
    nextStep: "Naslednji korak",
    dismiss: "Skrij",
    dismissDescription: "Kontrolni seznam lahko kadarkoli znova odprete tukaj.",
    collapse: "Skrči",
    expand: "Razpri",
    reopen: "Pokaži vodeno namestitev",
    completedTitle: "Vse pripravljeno! 🎉",
    completedNote:
      "Namestitev je zaključena — vodeni vstop za zamenjavo dejavnosti je še vedno en klik stran.",
    growthTitle: "Priporočeni naslednji koraki",
    growthSubtitle: "Namestitev je zaključena — s temi koraki pridejo prve stranke.",
    growthTestLabel: "Preizkusite rezervacijo kot stranka",
    growthTestDescription: "Odpri svojo javno stran in rezerviraj termin — tako bo videla vsaka stranka.",
    growthTestCta: "Odpri stran",
    growthInstagramLabel: "Povezava v Instagram bio",
    growthInstagramDescription: "Prilepite javno povezavo v bio — najmočnejši brezplačni kanal za nove stranke.",
    growthCopyCta: "Kopiraj povezavo",
    growthCopyDone: "Skopirano!",
    growthGoogleLabel: "Google Business Profile",
    growthGoogleDescription: "Da vas stranke najdejo v iskanju in na zemljevidu.",
    growthGoogleCta: "Upravljaj profil",
    steps: {
      vertical: {
        label: "Izberite dejavnost",
        description: "Povlecite delovno površino na svojo panogo — moduli, terminologija in obrazci se prilagodijo.",
        cta: "Zaženi vodeni vstop",
        hint: "Izbira prilagodi module, izraze in obrazce — vsebina vaše strani ostane vaša.",
      },
      catalog: {
        label: "Prilagodite katalog svoji ponudbi",
        description: "Vzorčne storitve in izdelki so pripravljeni — popravite cene, dodajte svoje.",
        cta: "Odpri katalog",
        hint: "Kliknite storitev → Uredi: cena in trajanje določata, kako se polni koledar.",
      },
      staff: {
        label: "Dodajte osebje",
        description: "Dodajte sodelavce in jim nastavite urnik ter dostop.",
        cta: "Dodaj osebje",
        hint: "Vsak sodelavec dobi svoj dostop in urnik — teden, dopusti, delovne ure.",
      },
      customers: {
        label: "Dodajte prvo stranko",
        description: "Stranke so osnova terminov, naročil in sporočanja.",
        cta: "Dodaj stranko",
        hint: "Stranko dodate ročno ali pa se ob prvi rezervaciji ustvari sama.",
      },
      // P3 #49: profil brez rezervacij ne obljublja "terminov"/
      // "rezervacije" — linke pridejo iz povpraševanj in naročil.
      customersOrder: {
        label: "Dodajte prvo stranko",
        description: "Stranke so osnova naročil, povpraševanj in sporočanja.",
        cta: "Dodaj stranko",
        hint: "Stranko dodate ročno ali pa jo ustvari prvo povpraševanje ali naročilo.",
      },
      publish: {
        label: "Objavite svojo stran",
        description: "Objavljena stran je vidna strankam in odprta za rezervacije.",
        cta: "Odpri nastavitve objave",
        hint: "Objava vzame minuto — stran lahko kasneje kadarkoli znova skrijete.",
      },
      firstJob: {
        label: "Sprejmite prvi termin",
        description: "Prvi rezerviran termin je trenutek, ko aplikacija res začne služiti vam.",
        cta: "Nov termin",
        hint: "Termin lahko rezervira stranka prek vaše povezave ali ga dodate tu — oba štejeta.",
      },
      firstJobOrder: {
        label: "Zaključite prvo delovno naročilo",
        description: "Prvo naročilo je trenutek, ko aplikacija res začne služiti vam.",
        cta: "Nova naročila",
        hint: "Naročilo vodi sodelavce skozi postopek korak za korakom.",
      },
      publishNoBooking: {
        label: "Objavite svojo stran",
        description: "Objavljena vas naredi vidne strankam — brez spletnih rezervacij, dogovor poteka po vaših pravilih.",
        cta: "Odpri nastavitve objave",
        hint: "Objava vzame minuto — stran lahko kasneje kadarkoli znova skrijete.",
      },
      // P3 #49: profil z načinom "order" ne obljublja rezervacij — objava
      // odpre TRGOVINO (prej statično "odprta za rezervacije").
      publishOrder: {
        label: "Objavite svojo stran",
        description: "Objavljena stran je vidna strankam in odprta za naročila.",
        cta: "Odpri nastavitve objave",
        hint: "Objava vzame minuto — stran lahko kasneje kadarkoli znova skrijete.",
      },
      // P3 #49: profil z načinom "inquiry" — objava odpre povpraševanja.
      publishInquiry: {
        label: "Objavite svojo stran",
        description: "Objavljena stran je vidna strankam in pripravljena na povpraševanja.",
        cta: "Odpri nastavitve objave",
        hint: "Objava vzame minuto — stran lahko kasneje kadarkoli znova skrijete.",
      },
    },
  },
}

export type DashboardDict = typeof dashboardSl

export const dashboardEn: DashboardDict = {
  title: "Admin",
  titleAccent: "Dashboard",
  welcome: "Welcome back! Here's your business overview.",
  revenueThisMonth: "Revenue (This Month)",
  appointments: "Appointments",
  totalCustomers: "Total Customers",
  shopSales: "Shop Sales",
  fromLastMonth: "from last month",
  noPreviousData: "No previous data",
  thisMonth: "this month",
  newThisWeek: "new this week",
  todaysAppointments: "Today's Appointments",
  youHaveAppointmentsToday: (n: number) =>
    `You have ${n} appointment${n !== 1 ? "s" : ""} today`,
  noAppointmentsToday: "No appointments scheduled for today",
  guest: "Guest",
  staffLabel: "Staff:",
  viewAllAppointments: "View All Appointments",
  quickActions: "Quick Actions",
  commonTasks: "Common tasks and shortcuts",
  newAppointment: "New Appointment",
  addProduct: "Add Product",
  manageCustomers: "Manage Customers",
  recentActivity: "Recent Activity",
  noRecentActivity: "No recent activity",
  activity: {
    appointment: (name: string) => `New booking: ${name}`,
    order: (name: string) => `Order completed: ${name}`,
    customer: (name: string) => `New customer: ${name}`,
  },
  shareLink: {
    title: "Your customer-facing link",
    description:
      "This is the public address of your website. Paste it wherever you want new customers to come from.",
    copy: "Copy link",
    copied: "Link copied!",
    copyFailed: "Copy failed — select the link and copy it manually.",
    instagramTitle: "Instagram",
    instagramTip:
      "Paste the link into your Instagram bio — the strongest free channel for new customers.",
    googleTitle: "Google Business Profile",
    googleTip:
      "Add the link to your Google Business Profile so customers can find you in Search and on Maps.",
    openGoogle: "Manage Google profile",
  },
  setupChecklist: {
    title: "Guided setup",
    subtitle:
      "A few steps to a fully ready page — your data stays yours at every step.",
    progressFormat: "{done} of {total} steps",
    progressAllDone: "All done",
    nextStep: "Next step",
    dismiss: "Hide",
    dismissDescription: "You can reopen the checklist here at any time.",
    collapse: "Collapse",
    expand: "Expand",
    reopen: "Show guided setup",
    completedTitle: "All set! 🎉",
    completedNote:
      "Setup is complete — the guided entry for switching activities stays one click away.",
    growthTitle: "Recommended next steps",
    growthSubtitle: "Setup is complete — these steps bring the first customers.",
    growthTestLabel: "Try a booking as a customer",
    growthTestDescription: "Open your public page and book an appointment — this is what every customer sees.",
    growthTestCta: "Open page",
    growthInstagramLabel: "Link in your Instagram bio",
    growthInstagramDescription: "Paste your public link into the bio — the strongest free channel for new customers.",
    growthCopyCta: "Copy link",
    growthCopyDone: "Copied!",
    growthGoogleLabel: "Google Business Profile",
    growthGoogleDescription: "So customers find you in search and on the map.",
    growthGoogleCta: "Manage profile",
    steps: {
      vertical: {
        label: "Choose your activity",
        description: "Tailor the workspace to your trade — modules, terminology and forms follow.",
        cta: "Start guided entry",
        hint: "The choice re-scopes modules, labels and forms — your page content stays yours.",
      },
      catalog: {
        label: "Tailor the catalog to your offer",
        description: "Sample services and products are ready — adjust prices and add your own.",
        cta: "Open catalog",
        hint: "Click a service → Edit: price and duration decide how the calendar fills up.",
      },
      staff: {
        label: "Add your team",
        description: "Add colleagues and set their schedule and access.",
        cta: "Add staff",
        hint: "Every colleague gets their own access and schedule — week, time off, working hours.",
      },
      customers: {
        label: "Add your first customer",
        description: "Customers are the basis of bookings, orders and messaging.",
        cta: "Add customer",
        hint: "Add a customer manually, or one is created at the first booking.",
      },
      // P3 #49: non-booking profiles get orders/inquiries wording.
      customersOrder: {
        label: "Add your first customer",
        description: "Customers are the basis of orders, inquiries and messaging.",
        cta: "Add customer",
        hint: "Add a customer manually, or one is created at the first inquiry or order.",
      },
      publish: {
        label: "Publish your page",
        description: "A published page is visible to customers and open for bookings.",
        cta: "Open publishing settings",
        hint: "Publishing takes a minute — you can hide the page again at any time.",
      },
      firstJob: {
        label: "Take your first booking",
        description: "The first appointment is when the app truly starts working for you.",
        cta: "New appointment",
        hint: "The customer can book via your link, or you add it here — both count.",
      },
      firstJobOrder: {
        label: "Complete your first work order",
        description: "The first order is when the app truly starts working for you.",
        cta: "New orders",
        hint: "A work order walks your team through the process step by step.",
      },
      publishNoBooking: {
        label: "Publish your page",
        description: "A published page makes you findable — no online bookings promised; you arrange every visit yourself.",
        cta: "Open publishing settings",
        hint: "Publishing takes a minute — you can hide the page again at any time.",
      },
      // P3 #49: order-mode profiles promise ORDERS, not reservations.
      publishOrder: {
        label: "Publish your page",
        description: "A published page is visible to customers and open for orders.",
        cta: "Open publishing settings",
        hint: "Publishing takes a minute — you can hide the page again at any time.",
      },
      // P3 #49: inquiry-mode profiles promise INQUIRIES.
      publishInquiry: {
        label: "Publish your page",
        description: "A published page is visible to customers and ready for inquiries.",
        cta: "Open publishing settings",
        hint: "Publishing takes a minute — you can hide the page again at any time.",
      },
    },
  },
}
