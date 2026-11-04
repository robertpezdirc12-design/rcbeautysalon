// Popolnoma prevedi ta imenski prostor (slovenščina + angleščina).
// Pokriva rezervacijski čarovnik (javna pot /booking, /s/{slug}/booking).

export const bookingSl = {
  // ---- Korak 1: prikaz/izbira storitve ----
  selectedService: "Izbrana storitev",
  selectedServiceDesc: "Vaša izbrana storitev",
  chooseService: "Izberite storitev",
  chooseServiceDesc: "Izberite storitev za svoj termin",
  chooseServiceError: "Izberite storitev",

  // ---- Korak 2: specialista ----
  chooseSpecialist: "Izberite specialista",
  chooseSpecialistDesc: "Izberite svojega specialista",
  noStaffForService: "Za to storitev ni prostega osebja",
  yourSpecialist: "Vaš specialist",
  yourSpecialistDesc: "Rezervirate pri tem specialistu",

  // ---- Korak 3: datum in ura ----
  pickDateTime: "Izberite datum in uro",
  pickDateTimeDesc: "Izberite, kdaj želite obiskati {business}",
  pickStaffFirst: "Najprej izberite osebje",
  // P2 #15 (audit-2026-11): "vir" is back-office jargon — customers see
  // "prostor"; note no longer repeats the word "prost" twice.
  resourceLabel: "Želeni prostor (neobvezno)",
  resourcePlaceholder: "Izberite prostor",
  resourceNone: "Vseeno mi je",
  resourceNote:
    "Termin bomo rezervirali tudi za izbrani prostor; preverili bomo, ali je prost.",
  slotsFor: (date: string) => `Prosti termini za ${date}`,
  noSlots: "Za ta dan ni prostih terminov",

  // ---- Korak 4: kontakt ----
  yourDetails: "Vaši podatki",
  confirmDetailsDesc: "Potrdite svoje kontaktne podatke",
  enterDetailsDesc: "Vnesite svoje kontaktne podatke",
  firstName: "Ime",
  lastName: "Priimek",
  email: "E-pošta",
  phone: "Telefon",
  specialRequests: "Posebne želje (neobvezno)",
  firstNamePlaceholder: "Janez",
  lastNamePlaceholder: "Novak",
  emailPlaceholder: "janez@primer.si",
  phonePlaceholder: "040 123 456",
  notesPlaceholder: "Kakšne posebne želje ali preference?",

  // ---- Povzetek ----
  summaryTitle: "Povzetek rezervacije",
  // P1 #9 (audit-2026-11): vidni seznam manjkajočih korakov pred oddajo
  missingHeading: "Za oddajo še manjka:",
  service: "Storitev",
  staff: "Osebje",
  dateTime: "Datum in ura",
  duration: "Trajanje",
  notSelected: "Ni izbrano",
  atSeparator: "ob",
  servicePrice: "Cena storitve",
  employeeDiscount: "Popust za zaposlene (20 %)",
  finalPrice: "Končna cena",
  requiredDeposit: "Obvezni polog",
  notRequired: "Ni potreben",
  nonRefundableTitle: "Nepovratni polog",
  nonRefundableIntro: (amount: string) =>
    `Polog ${amount} je potreben za potrditev termina in je `,
  nonRefundableStrong: "nepovraten",
  depositInSalon: "Polog",
  depositInSalonValue: "{businessIn}",
  depositInSalonBoxTitle: "Plačilo {businessIn}",
  depositInSalonBoxBody:
    "Spletna plačila za {business} še niso omogočena. Rezervacijo oddate brez pologa, znesek pa poravnate ob obisku.",
  employeeBoxTitle: "Rezervacija zaposlenega",
  employeeBoxBody:
    "Polog ni potreben. Plačilo bo obračunano po opravljeni storitvi.",

  // ---- Gumbi ----
  payAndConfirm: (amount: string) => `Plačaj ${amount} in potrdi rezervacijo`,
  confirmEmployee: "Potrdi rezervacijo zaposlenega",
  submitNoPayment: "Oddaj rezervacijo (brez pologa)",

  // ---- Zaposleni banner ----
  employeeBanner: "Rezervirate kot zaposleni.",
  employeeBannerDiscount: "popust 20 %",

  // ---- Napake / obvestila ----
  staffRequired: "Izberite osebo za termin",
  staffRequiredToast: "Izberite osebo pred potrditvijo.",
  employeeCreateFailed:
    "Ustvarjanje termina ni uspelo. Poskusite znova.",
  noPaymentToast:
    "Rezervacija je bila oddana brez spletnega plačila — potrjena bo po pregledu, znesek pa poravnajte ob obisku.",
  noPaymentFailed:
    "Rezervacija ni uspela. Kontaktirajte {business} ali poskusite znova.",
  checkoutFailed: "Ustvarjanje plačila ni uspelo. Poskusite znova.",
  unexpectedError: "Prišlo je do nepričakovane napake. Poskusite znova.",

  // ---- Naslovi strani / koraka 0 ----
  bookTitle: "Rezervirajte svoj termin",
  bookSubtitleFlow0: "1. korak: izberite storitev",
  bookSubtitleService: "Izberite termin in si zagotovite svoj čas",
  bookWithStaff: (name: string) => `Rezerviraj pri ${name}`,
  bookServiceAria: (name: string) => `Rezerviraj storitev ${name}`,

  // ---- Pomožniki ----
  /** Slovenska množina: 1 minuta, 2 minuti, 3–4 minute, 5+ minut */
  minutes: (n: number) => {
    const mod100 = n % 100
    if (mod100 === 1) return `${n} minuta`
    if (mod100 === 2) return `${n} minuti`
    if (mod100 === 3 || mod100 === 4) return `${n} minute`
    return `${n} minut`
  },
  minutesShort: (n: number) => `${n} min`,
}

export type BookingDict = typeof bookingSl

export const bookingEn: BookingDict = {
  selectedService: "Selected service",
  selectedServiceDesc: "Your selected service",
  chooseService: "Choose a service",
  chooseServiceDesc: "Choose a service for your appointment",
  chooseServiceError: "Choose a service",

  chooseSpecialist: "Choose a specialist",
  chooseSpecialistDesc: "Choose your specialist",
  noStaffForService: "No staff available for this service",
  yourSpecialist: "Your specialist",
  yourSpecialistDesc: "You are booking with this specialist",

  pickDateTime: "Pick a date and time",
  pickDateTimeDesc: "Choose when you would like to visit the {business}",
  pickStaffFirst: "Choose a staff member first",
  resourceLabel: "Preferred space (optional)",
  resourcePlaceholder: "Choose a space",
  resourceNone: "It doesn't matter to me",
  resourceNote:
    "The slot will also be reserved for the chosen space — we make sure it is free.",
  slotsFor: (date: string) => `Available slots for ${date}`,
  noSlots: "No available slots for this day",

  yourDetails: "Your details",
  confirmDetailsDesc: "Confirm your contact details",
  enterDetailsDesc: "Enter your contact details",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  specialRequests: "Special requests (optional)",
  firstNamePlaceholder: "John",
  lastNamePlaceholder: "Smith",
  emailPlaceholder: "john@example.com",
  phonePlaceholder: "040 123 456",
  notesPlaceholder: "Any special requests or preferences?",

  summaryTitle: "Booking summary",
  missingHeading: "Still missing before you can submit:",
  service: "Service",
  staff: "Staff",
  dateTime: "Date and time",
  duration: "Duration",
  notSelected: "Not selected",
  atSeparator: "at",
  servicePrice: "Service price",
  employeeDiscount: "Employee discount (20%)",
  finalPrice: "Final price",
  requiredDeposit: "Required deposit",
  notRequired: "Not required",
  nonRefundableTitle: "Non-refundable deposit",
  nonRefundableIntro: (amount: string) =>
    `The deposit of ${amount} is required to confirm the appointment and is `,
  nonRefundableStrong: "non-refundable",
  depositInSalon: "Deposit",
  depositInSalonValue: "{businessIn}",
  depositInSalonBoxTitle: "Pay {businessIn}",
  depositInSalonBoxBody:
    "Online payments are not yet enabled for this {business}. Submit your booking without a deposit and settle the amount during your visit.",
  employeeBoxTitle: "Employee booking",
  employeeBoxBody:
    "No deposit required. Payment will be charged after the service.",

  payAndConfirm: (amount: string) => `Pay ${amount} and confirm booking`,
  confirmEmployee: "Confirm employee booking",
  submitNoPayment: "Submit booking (no deposit)",

  employeeBanner: "You are booking as an employee.",
  employeeBannerDiscount: "20% discount",

  staffRequired: "Choose a staff member",
  staffRequiredToast: "Choose a staff member before confirming.",
  employeeCreateFailed: "Failed to create the appointment. Please try again.",
  noPaymentToast:
    "Your booking was submitted without online payment — it will be confirmed after review and the deposit settled on arrival.",
  noPaymentFailed: "Booking failed. Contact the {business} or try again.",
  checkoutFailed: "Failed to create the payment. Please try again.",
  unexpectedError: "An unexpected error occurred. Please try again.",

  bookTitle: "Book your appointment",
  bookSubtitleFlow0: "Step 1: choose a service",
  bookSubtitleService: "Pick a time and secure your slot",
  bookWithStaff: (name: string) => `Book with ${name}`,
  bookServiceAria: (name: string) => `Book service ${name}`,

  minutes: (n: number) => `${n} ${n === 1 ? "minute" : "minutes"}`,
  minutesShort: (n: number) => `${n} min`,
}
