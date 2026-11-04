// Popolnoma prevedi ta imenski prostor (slovenščina + angleščina).
// Pokriva javno navigacijo (navbar, mobilni meni).

export const publicSl = {
  navServices: "Storitve",
  navAbout: "O nas",
  navTeam: "Ekipa",
  navReviews: "Mnenja",
  navShop: "Trgovina",
  navContact: "Kontakt",
  account: "Račun",
  dashboard: "Nadzorna plošča",
  staffPortal: "Portal za osebje",
  myAccount: "Moj račun",
  myAppointments: "Moji termini",
  myOrders: "Moja naročila",
  myReviews: "Moje ocene",
  logout: "Odjava",
  login: "Prijava",
  toggleMenu: "Preklopi meni",
  testimonialsTitle: "Izjave naših strank",
  testimonialsSubtitle: "Prave izkušnje strank, ki nam zaupajo svoj videz.",
  reviewAnonym: "Stranka",
  reviewsSectionTitle: "Mnenja strank",
  // P1 #8 (audit-2026-11): dostopna imena košarice/izdelkov + i18n
  cart: "Košarica",
  cartWithCount: (n: number) => `Košarica (${n} izdelkov)`,
  addToCart: "Dodaj v košarico",
  addToCartNamed: (name: string) => `Dodaj v košarico: ${name}`,
  details: "Podrobnosti",
  noImage: "Brez slike",
  allServices: "Vse storitve",
  allProducts: "Vsi izdelki",
  allTeam: "Vsa ekipa",
  uncategorized: "Izdelki",
  // P1 #35 (re-audit 2026-11): galerija/PVP na straneh storitev brez
  // trdo kodirane angleščine.
  galleryTitle: "Galerija",
  gallerySubtitle: (serviceName: string) =>
    `Pred in po — ${serviceName}`,
  faqTitle: "Pogosta vprašanja",
  faqSubtitle: "Vse, kar morate vedeti o tej storitvi",
  // P1 #39-3 (re-audit 2026-11): domača stran prikaže IZBRANE storitve
  // z vidno številko — obiskovalec ne sme sklepati, da salon ponuja
  // samo prvih 5 storitev.
  featuredServicesCount: (shown: number, total: number) =>
    `Izbranih ${shown} od ${total} storitev — celoten katalog na strani Storitve`,
  // P2 #15 (audit-2026-11): pravne strani brez trdo kodiranih nizov
  backToHome: "← Nazaj na domačo stran",
  lastUpdated: "Zadnja posodobitev:",
}

export type PublicDict = typeof publicSl

export const publicEn: PublicDict = {
  navServices: "Services",
  navAbout: "About us",
  navTeam: "Team",
  navReviews: "Reviews",
  navShop: "Shop",
  navContact: "Contact",
  account: "Account",
  dashboard: "Dashboard",
  staffPortal: "Staff portal",
  myAccount: "My account",
  myAppointments: "My appointments",
  myOrders: "My orders",
  myReviews: "My reviews",
  logout: "Sign out",
  login: "Sign in",
  toggleMenu: "Toggle menu",
  testimonialsTitle: "What Our Clients Say",
  testimonialsSubtitle: "Real experiences from clients who trust us with their look.",
  reviewAnonym: "Client",
  reviewsSectionTitle: "Customer Reviews",
  cart: "Cart",
  cartWithCount: (n: number) => `Cart (${n} items)`,
  addToCart: "Add to cart",
  addToCartNamed: (name: string) => `Add to cart: ${name}`,
  details: "Details",
  noImage: "No image",
  allServices: "All services",
  allProducts: "All products",
  allTeam: "The whole team",
  uncategorized: "Products",
  galleryTitle: "Gallery",
  gallerySubtitle: (serviceName: string) => `Before and after — ${serviceName}`,
  faqTitle: "Frequently Asked Questions",
  faqSubtitle: "Everything you need to know about this service",
  featuredServicesCount: (shown: number, total: number) =>
    `Showing ${shown} of ${total} services — full catalogue on the Services page`,
  backToHome: "← Back to home page",
  lastUpdated: "Last updated:",
}
