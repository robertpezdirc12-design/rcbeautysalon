export const appointmentsSl = {
  // Seznam terminov — /dashboard/appointments
  list: {
    title: "Upravljanje",
    titleAccent: "terminov",
    subtitle: "Upravljajte in spremljajte vse termine svojega {businessGenitive}",
    newAppointment: "Nov termin",
    stats: {
      todaysAppointments: "Današnji termini",
      pendingConfirmation: "V čakanju na potrditev",
      completedToday: "Zaključeno danes",
      revenueToday: "Prihodki danes",
    },
    allAppointments: "Vsi termini",
    /**
     * Slovenska množina:
     * 1 → "1 termin", 2 → "2 termina", 3–4 → "X termine", 5+ → "X terminov"
     */
    totalAppointments: (n: number) => {
      if (n === 1) return "1 termin"
      if (n === 2) return "2 termina"
      if (n === 3 || n === 4) return `${n} termine`
      return `${n} terminov`
    },
    emptyTitle: "Še ni terminov",
    emptyDescription: "Ustvarite svoj prvi termin, da začnete",
    table: {
      customer: "Stranka",
      service: "Storitev",
      staff: "Osebje",
      dateAndTime: "Datum in čas",
      status: "Status",
      price: "Cena",
      actions: "Dejanja",
    },
    guest: "Gost",
  },

  // Podrobnosti termina — /dashboard/appointments/[id]
  details: {
    notFoundTitle: "Termin ni bil najden",
    metaTitle: (name: string) => `Termin – ${name}`,
    metaDescription: (name: string, date: string) =>
      `Podrobnosti termina za ${name} dne ${date}`,
    detailsTitle: "Podrobnosti termina",
    booking: "Rezervacija #",
    statusTitle: "Status",
    serviceDetails: "Podrobnosti storitve",
    date: "Datum",
    time: "Čas",
    totalDurationMinutes: (n: number) => {
      if (n === 1) return "Skupno trajanje: 1 minuta"
      if (n === 2) return `Skupno trajanje: ${n} minuti`
      if (n === 3 || n === 4) return `Skupno trajanje: ${n} minute`
      return `Skupno trajanje: ${n} minut`
    },
    notesTitle: "Opombe",
    noNotes: "Ni opomb za ta termin",
    customerTitle: "Stranka",
    guest: "Gost",
    viewCustomerProfile: "Poglej profil stranke",
    assignedStaff: "Dodeljeno osebje",
    staffMember: "Član osebja",
    paymentTitle: "Plačilo",
    serviceTotal: "Skupaj storitve",
    deposit: "Polog",
    paid: "Plačano",
    notPaid: "Neplačano",
    balanceDue: "Za plačilo",
    // #79: napitnina + provizija
    tip: "Napitnina",
    tipHint: "Zabeležite napitnino (gotovina ali kartica) — ločena vrstica prihodka.",
    tipAmountLabel: "Znesek (€)",
    tipMethod: "Način",
    tipCash: "Gotovina",
    tipCard: "Kartica",
    tipSave: "Shrani napitnino",
    tipSaved: "Napitnina zabeležena",
    tipFailed: "Zapis napitnine ni uspel",
    commission: "Provizija (izračunana ob zaključku)",
    bookingInfo: "Podatki o rezervaciji",
    createdOn: (date: string) => `Ustvarjeno ${date}`,
    bookingId: "ID rezervacije:",
  },

  // Nov termin — /dashboard/appointments/new
  new: {
    newAppointment: "Nov termin",
    newDescription: "Ustvarite nov termin za stranko",
    formTitle: "Podrobnosti termina",
    formDescription: "Izpolnite spodnje podatke za ustvarjanje novega termina",
  },

  // Dejanja statusa (stranski odjemalec)
  statusActions: {
    confirm: "Potrdi",
    markComplete: "Označi kot zaključeno",
    noShow: "Ni se pojavil",
    reopenPending: "Ponovno odpri kot v čakanju",
    noActions: "Ni dejanj za ta status",
    statusUpdated: (status: string) => `Status posodobljen na ${status}`,
    updateFailed: "Posodobitev statusa ni uspela",
  },

  // Obrazec za nov termin (stranski odjemalec)
  form: {
    selectExistingCustomer: "Izberi obstoječo stranko (neobvezno)",
    searchExistingCustomers: "Išči med obstoječimi strankami …",
    selectCustomerHint:
      "Izberite stranko za samodejno izpolnitev podatkov, ali jih vnesite ročno spodaj",
    customerInfo: "Podatki stranke",
    nameLabel: "Ime *",
    namePlaceholder: "Ime stranke",
    phoneLabel: "Telefon *",
    phonePlaceholder: "040 123 456",
    emailLabel: "E-pošta",
    emailPlaceholder: "stranka@email.si",
    serviceLabel: "Storitev *",
    servicePlaceholder: "Izberite storitev",
    staffLabel: "Osebje *",
    staffLoading: "Nalaganje osebja …",
    staffSelectServiceFirst: "Najprej izberite storitev",
    staffPlaceholder: "Izberite osebje",
    staffNone: "Za to storitev ni razpoložljivega osebja",
    resourceLabel: "Prostor / vir (neobvezno)",
    resourceNone: "Brez posebnega prostora",
    resourcePlaceholder: "Izberite prostor ali vir",
    resourceHint: "Termin bo rezerviran tudi za izbrani prostor — preverjamo, da je prost.",
    dateLabel: "Datum *",
    datePlaceholder: "Izberite datum",
    timeLabel: "Čas *",
    timeLoading: "Nalaganje razpoložljivih ur …",
    timeSelectFirst: "Najprej izberite osebje in datum",
    timePlaceholder: "Izberite časovni termin",
    timeNone: "Ni razpoložljivih časovnih terminov",
    slotsAvailable: (n: number) => {
      if (n === 1) return "1 razpoložljiv časovni termin"
      if (n === 2) return `${n} razpoložljiva časovna termina`
      if (n === 3 || n === 4) return `${n} razpoložljivi časovni termini`
      return `${n} razpoložljivih časovnih terminov`
    },
    slotsHint: "Razpoložljive ure se prikažejo po izbiri osebja in datuma",
    notesLabel: "Opombe",
    notesPlaceholder: "Posebne želje ali opombe …",
    create: "Ustvari termin",
    createFailed: "Ustvarjanje termina ni uspelo",
    createFailedRetry: "Ustvarjanje termina ni uspelo. Poskusite znova.",
  },

  // #90: čakalna lista — /dashboard/waitlist
  waitlist: {
    title: "Čakalna",
    titleAccent: "lista",
    subtitle: "Gosti, ki čakajo na prosto mesto — ob odpovedi jih obvestite z enim klikom",
    statsWaiting: "Čakajo",
    statsNotified: "Obveščeni",
    statsBooked: "Rezervirano",
    filterAll: "Vsi",
    statusWaiting: "Čaka",
    statusNotified: "Obveščen",
    statusBooked: "Rezervirano",
    statusExpired: "Poteklo",
    colName: "Gost",
    colService: "Storitev",
    colDate: "Željeni datum",
    colNotes: "Opomba",
    colJoined: "Prijavljen",
    colActions: "Dejanja",
    notify: "Obvesti",
    notifyHint: "E-pošta s povezavo v rezervacijo — gost si izbere termin sam",
    notifySuccess: "Obvestilo poslano.",
    notifyFailed: "Obveščanje ni uspelo",
    booked: "Rezervirano",
    delete: "Izbriši",
    deleteConfirm: "Izbrišem prijavo gostu?",
    empty: "Čakalna lista je prazna — prijave gostov bodo prikazane tukaj.",
    preferredDateAny: "karkoli prosto",
  },
}

export type AppointmentsDict = typeof appointmentsSl

export const appointmentsEn: AppointmentsDict = {
  // Appointments list — /dashboard/appointments
  list: {
    title: "Manage",
    titleAccent: "Appointments",
    subtitle: "Manage and track all {business} appointments",
    newAppointment: "New Appointment",
    stats: {
      todaysAppointments: "Today's Appointments",
      pendingConfirmation: "Pending Confirmation",
      completedToday: "Completed Today",
      revenueToday: "Revenue Today",
    },
    allAppointments: "All Appointments",
    totalAppointments: (n: number) =>
      `${n} total appointment${n !== 1 ? "s" : ""}`,
    emptyTitle: "No appointments yet",
    emptyDescription: "Create your first appointment to get started",
    table: {
      customer: "Customer",
      service: "Service",
      staff: "Staff",
      dateAndTime: "Date & Time",
      status: "Status",
      price: "Price",
      actions: "Actions",
    },
    guest: "Guest",
  },

  // Appointment details — /dashboard/appointments/[id]
  details: {
    notFoundTitle: "Appointment Not Found",
    metaTitle: (name: string) => `Appointment - ${name}`,
    metaDescription: (name: string, date: string) =>
      `Appointment details for ${name} on ${date}`,
    detailsTitle: "Appointment Details",
    booking: "Booking #",
    statusTitle: "Status",
    serviceDetails: "Service Details",
    date: "Date",
    time: "Time",
    totalDurationMinutes: (n: number) =>
      `Total duration: ${n} minute${n !== 1 ? "s" : ""}`,
    notesTitle: "Notes",
    noNotes: "No notes for this appointment",
    customerTitle: "Customer",
    guest: "Guest",
    viewCustomerProfile: "View Customer Profile",
    assignedStaff: "Assigned Staff",
    staffMember: "Staff Member",
    paymentTitle: "Payment",
    serviceTotal: "Service Total",
    deposit: "Deposit",
    paid: "Paid",
    notPaid: "Not paid",
    balanceDue: "Balance Due",
    // #79: tip + commission
    tip: "Tip",
    tipHint: "Record the tip (cash or card) — a separate revenue line.",
    tipAmountLabel: "Amount (€)",
    tipMethod: "Method",
    tipCash: "Cash",
    tipCard: "Card",
    tipSave: "Save tip",
    tipSaved: "Tip recorded",
    tipFailed: "Recording the tip failed",
    commission: "Commission (frozen at completion)",
    bookingInfo: "Booking Info",
    createdOn: (date: string) => `Created on ${date}`,
    bookingId: "Booking ID:",
  },

  // New appointment — /dashboard/appointments/new
  new: {
    newAppointment: "New Appointment",
    newDescription: "Create a new appointment for a customer",
    formTitle: "Appointment Details",
    formDescription: "Fill in the details below to create a new appointment",
  },

  // Status actions (client)
  statusActions: {
    confirm: "Confirm",
    markComplete: "Mark Complete",
    noShow: "No Show",
    reopenPending: "Reopen as Pending",
    noActions: "No actions available for this status",
    statusUpdated: (status: string) => `Status updated to ${status}`,
    updateFailed: "Failed to update status",
  },

  // Appointment form (client)
  form: {
    selectExistingCustomer: "Select existing customer (optional)",
    searchExistingCustomers: "Search existing customers …",
    selectCustomerHint:
      "Select a customer to auto-fill their details, or enter them manually below",
    customerInfo: "Customer Information",
    nameLabel: "Name *",
    namePlaceholder: "Customer name",
    phoneLabel: "Phone *",
    phonePlaceholder: "040 123 456",
    emailLabel: "Email",
    emailPlaceholder: "customer@email.com",
    serviceLabel: "Service *",
    servicePlaceholder: "Select a service",
    staffLabel: "Staff Member *",
    staffLoading: "Loading staff...",
    staffSelectServiceFirst: "Select a service first",
    staffPlaceholder: "Select staff member",
    staffNone: "No staff available for this service",
    resourceLabel: "Space / resource (optional)",
    resourceNone: "No specific space",
    resourcePlaceholder: "Choose a space or resource",
    resourceHint: "The appointment also reserves the chosen space — we check it is free.",
    dateLabel: "Date *",
    datePlaceholder: "Select a date",
    timeLabel: "Time *",
    timeLoading: "Loading available times...",
    timeSelectFirst: "Select staff and date first",
    timePlaceholder: "Select a time slot",
    timeNone: "No available time slots",
    slotsAvailable: (n: number) =>
      `${n} time slot${n !== 1 ? "s" : ""} available`,
    slotsHint: "Available times will appear after selecting staff and date",
    notesLabel: "Notes",
    notesPlaceholder: "Any special requests or notes...",
    create: "Create Appointment",
    createFailed: "Failed to create appointment",
    createFailedRetry: "Failed to create appointment. Please try again.",
  },

  // #90: waitlist — /dashboard/waitlist
  waitlist: {
    title: "Wait",
    titleAccent: "list",
    subtitle: "Guests waiting for a free slot — notify them with one click on a cancellation",
    statsWaiting: "Waiting",
    statsNotified: "Notified",
    statsBooked: "Booked",
    filterAll: "All",
    statusWaiting: "Waiting",
    statusNotified: "Notified",
    statusBooked: "Booked",
    statusExpired: "Expired",
    colName: "Guest",
    colService: "Service",
    colDate: "Preferred date",
    colNotes: "Note",
    colJoined: "Joined",
    colActions: "Actions",
    notify: "Notify",
    notifyHint: "Email with a booking link — the guest picks the time themselves",
    notifySuccess: "Notification sent.",
    notifyFailed: "Notification failed",
    booked: "Booked",
    delete: "Delete",
    deleteConfirm: "Delete this guest's entry?",
    empty: "The waitlist is empty — guest signups will appear here.",
    preferredDateAny: "anything free",
  },
}
