import { Locale } from "./config"
import { sl as dfSl, enUS as dfEnUS } from "date-fns/locale"
import { commonSl, commonEn } from "./dict/common"
import { dashboardSl, dashboardEn } from "./dict/dashboard"
import { analyticsSl, analyticsEn } from "./dict/analytics"
import { appointmentsSl, appointmentsEn } from "./dict/appointments"
import { usersSl, usersEn } from "./dict/users"
import { servicesSl, servicesEn } from "./dict/services"
import { productsSl, productsEn } from "./dict/products"
import { ordersSl, ordersEn } from "./dict/orders"
import { staffSl, staffEn } from "./dict/staff"
import { settingsSl, settingsEn } from "./dict/settings"
import { authSl, authEn } from "./dict/auth"
import { workFormsSl, workFormsEn } from "./dict/work-forms"
import { catalogDocsSl, catalogDocsEn } from "./dict/catalog-docs"
import { recordsSl, recordsEn } from "./dict/records"
import { inventorySl, inventoryEn } from "./dict/inventory"
import { projectsSl, projectsEn } from "./dict/projects"
import { bookingSl, bookingEn } from "./dict/booking"
import { publicSl, publicEn } from "./dict/public"
// F1: URL-localised platform landing ("/" + "/en").
import { landingSl, landingEn } from "./dict/landing"

const dictionaries = {
  sl: {
    common: commonSl,
    dashboard: dashboardSl,
    analytics: analyticsSl,
    appointments: appointmentsSl,
    users: usersSl,
    services: servicesSl,
    products: productsSl,
    orders: ordersSl,
    staff: staffSl,
    settings: settingsSl,
    auth: authSl,
    workForms: workFormsSl,
    catalogDocs: catalogDocsSl,
    recordsPage: recordsSl,
    inventory: inventorySl,
    projects: projectsSl,
    booking: bookingSl,
    public: publicSl,
    landing: landingSl,
  },
  en: {
    common: commonEn,
    dashboard: dashboardEn,
    analytics: analyticsEn,
    appointments: appointmentsEn,
    users: usersEn,
    services: servicesEn,
    products: productsEn,
    orders: ordersEn,
    staff: staffEn,
    settings: settingsEn,
    auth: authEn,
    workForms: workFormsEn,
    catalogDocs: catalogDocsEn,
    recordsPage: recordsEn,
    inventory: inventoryEn,
    projects: projectsEn,
    booking: bookingEn,
    public: publicEn,
    landing: landingEn,
  },
} as const

export type Dictionary = (typeof dictionaries)["sl"]

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale]
}

/** date-fns locale object matching our Locale values */
export function getDateFnsLocale(locale: Locale) {
  return locale === "sl" ? dfSl : dfEnUS
}
