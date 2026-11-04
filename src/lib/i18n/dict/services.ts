// Popolnoma prevedi ta imenski prostor (slovenščina + angleščina).
// Ključi naj pokrivajo vse uporabniku vidne nize na pripadajoči strani.
export const servicesSl = {
  // Glava strani
  title: "Upravljanje",
  titleAccent: "storitev",
  subtitle: "Upravljajte storitve svojega {businessGenitive}",
  addService: "Dodaj storitev",

  // Statistika
  totalServices: "Skupno število storitev",
  activeServices: "Aktivne storitve",
  featured: "Izpostavljeno",
  categories: "Kategorije",

  // Prazno stanje
  noServicesFound: "Ni storitev, ki bi ustrezale vašemu iskanju",
  noServicesYet: "Ni še nobenih storitev",
  addFirstService: "Dodajte prvo storitev",

  // Značke
  featuredBadge: "Izpostavljeno",
  inactiveBadge: "Neaktivno",

  // Metapodatki kartice storitve
  /**
   * Slovenska sklanjatev:
   * 1 → "1 minuta", 2 → "2 minuti", 3–4 → "X minute", 5+ → "X minut"
   */
  durationMinutes: (n: number) => {
    if (n === 1) return "1 minuta"
    if (n === 2) return "2 minuti"
    if (n === 3 || n === 4) return `${n} minute`
    return `${n} minut`
  },
  bookingsCount: (n: number) => {
    if (n === 1) return "1 rezervacija"
    if (n === 2) return "2 rezervaciji"
    if (n === 3 || n === 4) return `${n} rezervacije`
    return `${n} rezervacij`
  },
  staffCount: (n: number) => {
    if (n === 1) return "1 zaposleni"
    if (n === 2) return "2 zaposlena"
    if (n === 3 || n === 4) return `${n} zaposleni`
    return `${n} zaposlenih`
  },
  viewPublicPage: "Poglej javno stran",
  editService: "Uredi storitev",

  // Iskanje
  searchPlaceholder: "Iskanje storitev …",

  // Glavi strani za novo / urejanje
  newTitle: "Nova storitev",
  newSubtitle: "Ustvarite novo storitev {businessGenitive}",
  editTitle: "Uredi storitev",

  // Obrazec: kartica podatkov o storitvi
  serviceInfoTitle: "Podatki o storitvi",
  serviceInfoDesc: "Osnovni podatki o storitvi",
  nameLabel: "Ime storitve *",
  namePlaceholder: "npr. Striženje in oblikovanje",
  slugLabel: "URL naslov (slug) *",
  slugPlaceholder: "npr. strizenje-in-oblikovanje",
  slugHelp: "To bo uporabljeno v URL naslovu storitve",
  descriptionLabel: "Opis",
  descriptionPlaceholder: "Opišite storitev …",
  durationLabel: "Trajanje (minut) *",
  priceLabel: "Cena (€) *",
  categoryLabel: "Kategorija",
  categoryPlaceholder: "Izberite kategorijo",
  // P3 #52: prazno stanje izbirnika — razlaga + pot do prve kategorije
  noCategories: "Ni kategorij. Ustvarite prvo, da lahko razvrstite storitve.",
  createCategory: "Ustvari kategorijo",
  newCategoryLabel: "Ime nove kategorije",
  newCategoryPlaceholder: "npr. Nega las",
  categoryCreated: "Kategorija ustvarjena",
  categoryCreateFailed: "Ustvarjanje kategorije ni uspelo",

  // Obrazec: kartica slike
  imageTitle: "Slika storitve",
  imageDesc: "Naložite sliko za storitev",
  imageAlt: "Predogled storitve",
  clickToUpload: "Kliknite za nalaganje slike",

  // Obrazec: kartica vidnosti
  visibilityTitle: "Vidnost",
  activeLabel: "Aktiven",
  activeDesc: "Storitev je na voljo za rezervacijo",
  featuredLabel: "Izpostavljeno",
  featuredDesc: "Prikaži na naslovni strani",

  // Obrazec: kartica osebja
  staffTitle: "Osebje",
  staffDesc: "Dodelite osebje, ki lahko izvaja to storitev",
  noStaff: "Ni osebja na voljo",

  // Dejanja obrazca
  updateButton: "Posodobi storitev",
  createButton: "Ustvari storitev",
  deleteButton: "Izbriši storitev",

  // Sporočila (obvestila / potrditvena okna)
  imageTypeError: "Izberite slikovno datoteko",
  imageSizeError: "Slika mora biti manjša od 5 MB",
  imageUploadSuccess: "Slika je uspešno naložena",
  imageUploadFailed: "Napaka pri nalaganju slike",
  uploadFailed: "Nalaganje ni uspelo",
  deleteConfirm:
    "Ste prepričani, da želite izbrisati to storitev? Dejanja ni mogoče razveljaviti.",
  deleteSuccess: "Storitev je uspešno izbrisana",
  deleteFailed: "Napaka pri brisanju storitve",
  createSuccess: "Storitev je uspešno ustvarjena",
  createFailed: "Napaka pri ustvarjanju storitve",
  updateSuccess: "Storitev je uspešno posodobljena",
  updateFailed: "Napaka pri posodabljanju storitve",
  unexpectedError: "Prišlo je do nepričakovane napake",
}

export type ServicesDict = typeof servicesSl

export const servicesEn: ServicesDict = {
  // Page header
  title: "Manage",
  titleAccent: "Services",
  subtitle: "Manage your {business} services",
  addService: "Add Service",

  // Stats
  totalServices: "Total Services",
  activeServices: "Active Services",
  featured: "Featured",
  categories: "Categories",

  // Empty state
  noServicesFound: "No services found matching your search",
  noServicesYet: "No services yet",
  addFirstService: "Add Your First Service",

  // Badges
  featuredBadge: "Featured",
  inactiveBadge: "Inactive",

  // Service card meta
  durationMinutes: (n: number) => `${n} minutes`,
  bookingsCount: (n: number) => `${n} bookings`,
  staffCount: (n: number) => `${n} staff`,
  viewPublicPage: "View public page",
  editService: "Edit service",

  // Search
  searchPlaceholder: "Search services by name or category...",

  // New / edit page headers
  newTitle: "New Service",
  newSubtitle: "Create a new {business} service",
  editTitle: "Edit Service",

  // Form: service information card
  serviceInfoTitle: "Service Information",
  serviceInfoDesc: "Basic details about the service",
  nameLabel: "Service Name *",
  namePlaceholder: "e.g., Haircut & Styling",
  slugLabel: "URL Slug *",
  slugPlaceholder: "e.g., haircut-styling",
  slugHelp: "This will be used in the service URL",
  descriptionLabel: "Description",
  descriptionPlaceholder: "Describe the service...",
  durationLabel: "Duration (minutes) *",
  priceLabel: "Price (€) *",
  categoryLabel: "Category",
  categoryPlaceholder: "Select a category",
  // P3 #52: empty state of the picker — explanation + path to the first one
  noCategories: "No categories yet. Create the first one to classify services.",
  createCategory: "Create category",
  newCategoryLabel: "New category name",
  newCategoryPlaceholder: "e.g. Hair care",
  categoryCreated: "Category created",
  categoryCreateFailed: "Creating the category failed",

  // Form: image card
  imageTitle: "Service Image",
  imageDesc: "Upload an image for the service",
  imageAlt: "Service preview",
  clickToUpload: "Click to upload an image",

  // Form: visibility card
  visibilityTitle: "Visibility",
  activeLabel: "Active",
  activeDesc: "Service is available for booking",
  featuredLabel: "Featured",
  featuredDesc: "Show on landing page",

  // Form: staff card
  staffTitle: "Staff",
  staffDesc: "Assign staff who can perform this service",
  noStaff: "No staff available",

  // Form actions
  updateButton: "Update Service",
  createButton: "Create Service",
  deleteButton: "Delete Service",

  // Messages (toasts / dialogs)
  imageTypeError: "Please select an image file",
  imageSizeError: "Image must be less than 5MB",
  imageUploadSuccess: "Image uploaded successfully",
  imageUploadFailed: "Failed to upload image",
  uploadFailed: "Upload failed",
  deleteConfirm:
    "Are you sure you want to delete this service? This action cannot be undone.",
  deleteSuccess: "Service deleted successfully",
  deleteFailed: "Failed to delete service",
  createSuccess: "Service created successfully",
  createFailed: "Failed to create service",
  updateSuccess: "Service updated successfully",
  updateFailed: "Failed to update service",
  unexpectedError: "An unexpected error occurred",
}
