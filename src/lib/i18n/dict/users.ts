// Popolnoma prevedi ta imenski prostor (slovenščina + angleščina).
// Ključi naj pokrivajo vse uporabniku vidne nize na pripadajoči strani.
export const usersSl = {
  // ---- Stran s seznamom (dashboard/users) ----
  title: "Upravljanje",
  titleAccent: "strank",
  subtitle: "Upravljajte svojo bazo strank",
  stats: {
    totalCustomersLabel: "Skupno število strank",
    activeSessions: "Aktivne seje",
    newThisMonth: "Novih ta mesec",
    leadsWithoutAccount: "Stranke brez računa",
  },
  allUsersTitle: "Vsi uporabniki",
  allUsersDesc: "Seznam vseh registriranih uporabnikov",
  noUsersFound: "Ni najdenih uporabnikov.",
  table: {
    user: "Uporabnik",
    email: "E-pošta",
    role: "Vloga",
    appointments: "Termini",
    orders: "Naročila",
    joined: "Registriran",
    actions: "Dejanja",
  },
  noName: "Brez imena",
  altUser: "Uporabnik",
  // P2 #48: linke iz javnih obrazcev (Customer brez računa)
  leads: {
    title: "Stranke brez računa",
    desc: "Linke iz javnih obrazcev — stranke, ki še nimajo računa.",
    badge: "Brez računa",
    empty: "Ni strank brez računa — vsi vaši linki imajo račun.",
    table: {
      customer: "Stranka",
      submissions: "Oddaje",
    },
    viewSubmissions: "Poglej oddaje",
  },
  searchPlaceholder: "Išči po imenu, e-pošti …",
  filter: "Filter",
  exportList: "Izvozi seznam",
  csvHeaders: {
    name: "Ime",
    email: "E-pošta",
    role: "Vloga",
    appointments: "Termini",
    orders: "Naročila",
    joined: "Registriran",
  },

  // ---- Stran s podrobnostmi (dashboard/users/[id]) ----
  userNotFound: "Uporabnik ni najden",
  userMetaTitle: (name: string) => `Uporabnik - ${name}`,
  userMetaDesc: (name: string) => `Podrobnosti uporabnika: ${name}`,
  userDetails: "Podrobnosti uporabnika",
  memberSince: (date: string) => `Član od ${date}`,
  editUser: "Uredi uporabnika",
  recentAppointments: "Nedavni termini",
  noAppointmentsFound: "Ni najdenih terminov",
  withStaff: (name: string) => `z ${name}`,
  viewAllAppointments: "Prikaži vse termine",
  recentOrders: "Nedavna naročila",
  noOrdersFound: "Ni najdenih naročil",
  orderNumber: (num: string) => `Naročilo #${num}`,
  /**
   * Slovenska množina:
   * 1 → "1 izdelek", 2 → "2 izdelka", 3–4 → "3 izdelki", 5+ → "X izdelkov"
   */
  itemCount: (n: number) => {
    const mod100 = n % 100
    if (mod100 === 1) return `${n} izdelek`
    if (mod100 === 2) return `${n} izdelka`
    if (mod100 === 3 || mod100 === 4) return `${n} izdelki`
    return `${n} izdelkov`
  },
  viewAllOrders: "Prikaži vsa naročila",
  profile: "Profil",
  verified: "Potrjen",
  customerStats: "Statistika stranke",
  appointmentsLabel: "Termini",
  ordersLabel: "Naročila",
  totalSpent: "Skupna poraba",
  staffProfile: "Profil osebja",
  position: "Položaj:",
  staffMember: "Član osebja",
  statusLabel: "Status:",
  active: "Aktiven",
  inactive: "Neaktiven",
  viewStaffProfile: "Prikaži profil osebja",
  accountInfo: "Podatki o računu",
  userId: "ID uporabnika:",
  created: "Ustvarjeno:",
  lastUpdated: "Nazadnje posodobljeno:",
  resetPassword: {
    button: "Ponastavi geslo",
    title: "Ponastavi geslo članu",
    description: (name: string) =>
      `Nastavite novo geslo za ${name}. Novo geslo mu posredujte varno — osebno ali po telefonu.`,
    newPassword: "Novo geslo",
    confirmPassword: "Potrdite geslo",
    generate: "Ustvari močno geslo",
    mismatch: "Gesli se ne ujemata",
    submit: "Nastavi geslo",
    submitting: "Shranjujem …",
    selfNote:
      "Član se bo prijavil s tem geslom. Priporočamo, da ga po prijavi spremeni v svoje.",
    toastSuccess: "Geslo uspešno nastavljeno",
    toastFailed: "Napaka pri nastavljanju gesla",
  },
  orderStatus: {
    PENDING: "V čakanju",
    PAID: "Plačano",
    COMPLETED: "Zaključeno",
    CANCELLED: "Preklicano",
    REFUNDED: "Vračilo",
  },

  // ---- Urejanje (dashboard/users/[id]/edit) ----
  roleTitle: "Vloga uporabnika",
  roleDescription: "Spremenite raven dostopa uporabnika v sistemu",
  roleFieldLabel: "Vloga",
  selectRole: "Izberite vlogo",
  roles: {
    CLIENTE: {
      label: "Stranka",
      description: "Lahko rezervira termine in kupuje izdelke",
    },
    STAFF: {
      label: "Osebje",
      description: "Lahko upravlja svoje termine in razpored",
    },
    ADMIN: {
      label: "Administrator",
      description: "Popoln dostop do vseh funkcij",
    },
  },
  notesTitle: "Opombe o stranki",
  notesDescription: "Notranje opombe o tej stranki (želje, alergije ipd.)",
  notesLabel: "Opombe",
  notesPlaceholder: "Dodajte opombe o tej stranki …",
  saveNotes: "Shrani opombe",
  actionsTitle: "Dejanja",
  backToUser: "Nazaj na podrobnosti uporabnika",
  dangerZone: "Nevarno območje",
  dangerDesc: "Nepovratna dejanja",
  deleteUser: "Izbriši uporabnika",
  deleteUserDesc: "Trajno odstrani tega uporabnika",
  deleteNote:
    "Opomba: Uporabnikov z obstoječimi termini ali naročili ni mogoče izbrisati.",
  confirmDelete: (name: string) =>
    `Ali ste prepričani, da želite izbrisati "${name}"? Tega dejanja ni mogoče razveljaviti.`,

  // ---- Obvestila (toast) ----
  toast: {
    roleUpdated: "Vloga uspešno posodobljena",
    roleUpdateFailed: "Napaka pri posodabljanju vloge",
    notesSaved: "Opombe uspešno shranjene",
    notesSaveFailed: "Napaka pri shranjevanju opomb",
    userDeleted: "Uporabnik uspešno izbrisan",
    deleteFailed: "Napaka pri izbrisu uporabnika",
    unexpectedError: "Prišlo je do nepričakovane napake",
  },

  // ---- #91: oznake strank (segmenti) ----
  tags: {
    column: "Oznake",
    edit: "Uredi oznake",
    save: "Shrani",
    cancel: "Prekliči",
    placeholder: "npr. VIP, rdeča, prijatelj",
    addHint: "Loči z vejico (največ 12 oznak).",
    filterLabel: "Segmenti",
    filterAll: "Vse stranke",
    saved: "Oznake shranjene",
  },

  // ---- Pomožnik za oznake vlog (vrednosti v bazi: ADMIN | STAFF | CLIENTE) ----
  roleLabel: (role: string): string => {
    if (role === "ADMIN") return "Administrator"
    if (role === "STAFF") return "Osebje"
    return "Stranka"
  },
}

export type UsersDict = typeof usersSl

export const usersEn: UsersDict = {
  // ---- Users list page (dashboard/users) ----
  title: "Manage",
  titleAccent: "Customers",
  subtitle: "Manage your customer database",
  stats: {
    totalCustomersLabel: "Total Customers",
    activeSessions: "Active Sessions",
    newThisMonth: "New This Month",
    leadsWithoutAccount: "Customers Without Account",
  },
  allUsersTitle: "All Users",
  allUsersDesc: "A list of all registered users",
  noUsersFound: "No users found.",
  table: {
    user: "User",
    email: "Email",
    role: "Role",
    appointments: "Appointments",
    orders: "Orders",
    joined: "Joined",
    actions: "Actions",
  },
  noName: "No name",
  altUser: "User",
  // P2 #48: leads from public forms (Customer without a user account)
  leads: {
    title: "Customers without account",
    desc: "Leads from public forms — customers who don't have an account yet.",
    badge: "No account",
    empty: "No customers without an account — every lead has one.",
    table: {
      customer: "Customer",
      submissions: "Submissions",
    },
    viewSubmissions: "View submissions",
  },
  searchPlaceholder: "Search by name, email...",
  filter: "Filter",
  exportList: "Export List",
  csvHeaders: {
    name: "Name",
    email: "Email",
    role: "Role",
    appointments: "Appointments",
    orders: "Orders",
    joined: "Joined",
  },

  // ---- User details page (dashboard/users/[id]) ----
  userNotFound: "User Not Found",
  userMetaTitle: (name: string) => `User - ${name}`,
  userMetaDesc: (name: string) => `User details for ${name}`,
  userDetails: "User Details",
  memberSince: (date: string) => `Member since ${date}`,
  editUser: "Edit User",
  recentAppointments: "Recent Appointments",
  noAppointmentsFound: "No appointments found",
  withStaff: (name: string) => `with ${name}`,
  viewAllAppointments: "View All Appointments",
  recentOrders: "Recent Orders",
  noOrdersFound: "No orders found",
  orderNumber: (num: string) => `Order #${num}`,
  itemCount: (n: number) => `${n} item${n !== 1 ? "s" : ""}`,
  viewAllOrders: "View All Orders",
  profile: "Profile",
  verified: "Verified",
  customerStats: "Customer Stats",
  appointmentsLabel: "Appointments",
  ordersLabel: "Orders",
  totalSpent: "Total Spent",
  staffProfile: "Staff Profile",
  position: "Position:",
  staffMember: "Staff Member",
  statusLabel: "Status:",
  active: "Active",
  inactive: "Inactive",
  viewStaffProfile: "View Staff Profile",
  accountInfo: "Account Info",
  userId: "User ID:",
  created: "Created:",
  lastUpdated: "Last Updated:",
  resetPassword: {
    button: "Reset password",
    title: "Reset member password",
    description: (name: string) =>
      `Set a new password for ${name}. Share it with them securely — in person or by phone.`,
    newPassword: "New password",
    confirmPassword: "Confirm password",
    generate: "Generate strong password",
    mismatch: "Passwords do not match",
    submit: "Set password",
    submitting: "Saving …",
    selfNote:
      "The member will sign in with this password. We recommend they change it after signing in.",
    toastSuccess: "Password set successfully",
    toastFailed: "Failed to set password",
  },
  orderStatus: {
    PENDING: "Pending",
    PAID: "Paid",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
  },

  // ---- Edit page (dashboard/users/[id]/edit) ----
  roleTitle: "User Role",
  roleDescription: "Change the user's access level in the system",
  roleFieldLabel: "Role",
  selectRole: "Select role",
  roles: {
    CLIENTE: {
      label: "Client",
      description: "Can book appointments and buy products",
    },
    STAFF: {
      label: "Staff",
      description: "Can manage their appointments and schedule",
    },
    ADMIN: {
      label: "Admin",
      description: "Full access to all features",
    },
  },
  notesTitle: "Customer Notes",
  notesDescription:
    "Internal notes about this customer (preferences, allergies, etc.)",
  notesLabel: "Notes",
  notesPlaceholder: "Add notes about this customer...",
  saveNotes: "Save Notes",
  actionsTitle: "Actions",
  backToUser: "Back to User Details",
  dangerZone: "Danger Zone",
  dangerDesc: "Irreversible actions",
  deleteUser: "Delete User",
  deleteUserDesc: "Permanently remove this user",
  deleteNote:
    "Note: Users with existing appointments or orders cannot be deleted.",
  confirmDelete: (name: string) =>
    `Are you sure you want to delete "${name}"? This action cannot be undone.`,

  // ---- Toasts ----
  toast: {
    roleUpdated: "Role updated successfully",
    roleUpdateFailed: "Failed to update role",
    notesSaved: "Notes saved successfully",
    notesSaveFailed: "Failed to save notes",
    userDeleted: "User deleted successfully",
    deleteFailed: "Failed to delete user",
    unexpectedError: "An unexpected error occurred",
  },

  // ---- Role label helper (DB values: ADMIN | STAFF | CLIENTE) ----
  roleLabel: (role: string): string => {
    if (role === "ADMIN") return "Administrator"
    if (role === "STAFF") return "Staff"
    return "Client"
  },

  // ---- #91: customer tags (segments) ----
  tags: {
    column: "Tags",
    edit: "Edit tags",
    save: "Save",
    cancel: "Cancel",
    placeholder: "e.g. VIP, red, friend",
    addHint: "Separate with commas (max 12 tags).",
    filterLabel: "Segments",
    filterAll: "All customers",
    saved: "Tags saved",
  },
}