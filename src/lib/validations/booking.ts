import { z } from "zod"

/**
 * Rezervacijske validacije z lokaliziranimi sporočili (SL/EN).
 * Factory je čista funkcija — ista pravila, samo besedila se razlikujejo.
 * Imenski izvozi (bookingSchema, authenticatedBookingSchema) ohranjajo
 * slovenska sporočila za združljivost.
 */
export type BookingSchemaLocale = "sl" | "en"

const bookingMessages = {
  sl: {
    staffRequired: "Izberite osebo za termin",
    dateRequired: "Izberite datum",
    timeRequired: "Izberite uro",
    timeInvalid: "Neveljavna ura",
    firstNameMin: "Ime mora imeti vsaj 2 znaka",
    firstNameMax: "Ime ne sme presegati 50 znakov",
    lastNameMin: "Priimek mora imeti vsaj 2 znaka",
    lastNameMax: "Priimek ne sme presegati 50 znakov",
    emailInvalid: "Vnesite veljaven e-poštni naslov",
    emailRequired: "E-pošta je obvezna",
    phoneMin: "Telefonska številka mora imeti vsaj 8 števk",
    phoneMax: "Telefonska številka ne sme presegati 20 znakov",
    phoneInvalid: "Vnesite veljavno telefonsko številko",
    notesMax: "Opombe ne smejo presegati 500 znakov",
  },
  en: {
    staffRequired: "Choose a staff member",
    dateRequired: "Choose a date",
    timeRequired: "Choose a time",
    timeInvalid: "Invalid time",
    firstNameMin: "First name must have at least 2 characters",
    firstNameMax: "First name cannot exceed 50 characters",
    lastNameMin: "Last name must have at least 2 characters",
    lastNameMax: "Last name cannot exceed 50 characters",
    emailInvalid: "Enter a valid email address",
    emailRequired: "Email is required",
    phoneMin: "Phone number must have at least 8 digits",
    phoneMax: "Phone number cannot exceed 20 characters",
    phoneInvalid: "Enter a valid phone number",
    notesMax: "Notes cannot exceed 500 characters",
  },
} as const

export function buildBookingSchema(locale: BookingSchemaLocale = "sl") {
  const m = bookingMessages[locale]
  return z.object({
    staffId: z.string().min(1, m.staffRequired),
    date: z.date({ message: m.dateRequired }),
    time: z
      .string()
      .min(1, m.timeRequired)
      .refine((val) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
        message: m.timeInvalid,
      }),
    firstName: z
      .string()
      .min(2, m.firstNameMin)
      .max(50, m.firstNameMax)
      .trim(),
    lastName: z
      .string()
      .min(2, m.lastNameMin)
      .max(50, m.lastNameMax)
      .trim(),
    email: z
      .string()
      .email(m.emailInvalid)
      .min(1, m.emailRequired),
    phone: z
      .string()
      .min(8, m.phoneMin)
      .max(20, m.phoneMax)
      .refine((val) => /^[\d\s\-\(\)\+]+$/.test(val), {
        message: m.phoneInvalid,
      }),
    notes: z
      .string()
      .max(500, m.notesMax)
      .trim()
      .optional(),
  })
}

export function buildAuthenticatedBookingSchema(
  locale: BookingSchemaLocale = "sl"
) {
  // #112: prijavljen uporabnik (lastnik/osebje) nima mogoče vnesti telefona
  // v zaposlenem načinu — brez tega je validacija tiho padla na skritem
  // polju (defect #112-2). Kontakt za goste ostane obvezen (guest schema).
  return buildBookingSchema(locale).extend({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z
      .string()
      .max(20)
      .refine((val) => val === "" || /^[\d\s\-\(\)\+]+$/.test(val), {
        message: bookingMessages[locale].phoneInvalid,
      })
      .optional(),
  })
}

export const bookingSchema = buildBookingSchema("sl")

// Schema for authenticated users (firstName, lastName, email are optional/disabled)
export const authenticatedBookingSchema = bookingSchema.extend({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
})

export type BookingInput = z.infer<typeof bookingSchema>
export type AuthenticatedBookingInput = z.infer<typeof authenticatedBookingSchema>
