// Popolnoma prevedi ta imenski prostor (slovenščina + angleščina).
// Ključi naj pokrivajo vse uporabniku vidne nize na pripadajoči strani.

/**
 * Slovenian pluralisation for "items":
 * 0 → "0 izdelkov"
 * 1 → "1 izdelek"
 * 2 → "2 izdelka"
 * 3–4 → "X izdelki"
 * 5+ → "X izdelkov"
 */
const itemsCountSl = (n: number) => {
  if (n === 1) return "1 izdelek"
  if (n === 2) return `${n} izdelka`
  if (n === 3 || n === 4) return `${n} izdelki`
  return `${n} izdelkov`
}

export const ordersSl = {
  title: "Spletna",
  titleAccent: "naročila",
  subtitle: "Upravljajte naročila izdelkov in njihovo izročitev",
  exportOrders: "Izvozi naročila",
  stats: {
    totalOrders: "Skupno naročil",
    pendingPickup: "V čakanju na prevzem",
    completedToday: "Zaključeno danes",
    revenueThisMonth: "Prihodki (ta mesec)",
  },
  allOrders: "Vsa naročila",
  inStorePickupDescription: "Naročila s prevzemom v trgovini",
  noOrders: "Ni najdenih naročil.",
  searchPlaceholder: "Iskanje naročil …",
  table: {
    orderId: "ID naročila",
    customer: "Stranka",
    items: "Izdelki",
    total: "Skupaj",
    status: "Status",
    date: "Datum",
    actions: "Dejanja",
  },
  csv: {
    orderId: "ID naročila",
    customer: "Stranka",
    email: "E-pošta",
    items: "Izdelki",
    total: "Skupaj",
    status: "Status",
    date: "Datum",
  },
  guest: "Gost",
  offlineBadge: "Po povzetju",
  itemsCount: itemsCountSl,
  statusLabels: {
    PENDING: "V čakanju",
    PAID: "Plačano",
    COMPLETED: "Zaključeno",
    CANCELLED: "Preklicano",
    REFUNDED: "Vrnjeno",
    SHIPPED: "Poslano",
    DELIVERED: "Dostavljeno",
  } as Record<string, string>,
}

export type OrdersDict = typeof ordersSl

const itemsCountEn = (n: number) => `${n} item${n !== 1 ? "s" : ""}`

export const ordersEn: OrdersDict = {
  title: "Shop",
  titleAccent: "Orders",
  subtitle: "Manage product orders and fulfillment",
  exportOrders: "Export Orders",
  stats: {
    totalOrders: "Total Orders",
    pendingPickup: "Pending Pickup",
    completedToday: "Completed Today",
    revenueThisMonth: "Revenue This Month",
  },
  allOrders: "All Orders",
  inStorePickupDescription: "In-store pickup orders",
  noOrders: "No orders found.",
  searchPlaceholder: "Search by order ID, customer...",
  table: {
    orderId: "Order ID",
    customer: "Customer",
    items: "Items",
    total: "Total",
    status: "Status",
    date: "Date",
    actions: "Actions",
  },
  csv: {
    orderId: "Order ID",
    customer: "Customer",
    email: "Email",
    items: "Items",
    total: "Total",
    status: "Status",
    date: "Date",
  },
  guest: "Guest",
  offlineBadge: "Pay on pickup",
  itemsCount: itemsCountEn,
  statusLabels: {
    PENDING: "Pending",
    PAID: "Paid",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
  } as Record<string, string>,
}
