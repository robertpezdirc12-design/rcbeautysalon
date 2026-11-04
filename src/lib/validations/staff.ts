import { z } from "zod"

// Working hours schema for a single day
const workingHourSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  isActive: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Neveljavna oblika časa"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Neveljavna oblika časa"),
})

// Base schema with common fields
const staffBaseSchema = z.object({
  name: z
    .string()
    .min(2, "Ime mora imeti vsaj 2 znaka")
    .max(100, "Ime ne sme biti daljše od 100 znakov"),
  email: z
    .string()
    .email("Neveljaven e-poštni naslov"),
  phone: z.string().optional(),
  bio: z.string().optional(),
  image: z.string().optional(),
  isActive: z.boolean(),
  serviceIds: z.array(z.string()).optional(),
  workingHours: z.array(workingHourSchema).optional(),
  // #79: payroll — default tip suggestion + commission rule.
  defaultTipPercent: z
    .number()
    .min(0, "Tip percent must be 0–100")
    .max(100, "Tip percent must be 0–100")
    .optional()
    .nullable(),
  commissionType: z.enum(["NONE", "PERCENT", "FIXED"]).optional(),
  commissionValue: z
    .number()
    .min(0, "Commission value must be positive")
    .optional()
    .nullable(),
  commissionBasis: z.string().optional(),
})

// Schema for creating staff
export const createStaffSchema = staffBaseSchema

// Schema for updating staff
export const updateStaffSchema = staffBaseSchema

// Schema for staff self-update (limited fields)
export const staffSelfUpdateSchema = z.object({
  name: z
    .string()
    .min(2, "Ime mora imeti vsaj 2 znaka")
    .max(100, "Ime ne sme biti daljše od 100 znakov"),
  phone: z
    .string()
    .regex(/^[\d\s\-+()]*$/, "Neveljavna oblika telefonske številke")
    .optional()
    .or(z.literal("")),
  bio: z
    .string()
    .max(500, "Predstavitev ne sme biti daljša od 500 znakov")
    .optional()
    .or(z.literal("")),
})

export type WorkingHourFormData = z.infer<typeof workingHourSchema>
export type CreateStaffFormData = z.infer<typeof createStaffSchema>
export type UpdateStaffFormData = z.infer<typeof updateStaffSchema>
export type StaffFormData = CreateStaffFormData | UpdateStaffFormData
export type StaffSelfUpdateFormData = z.infer<typeof staffSelfUpdateSchema>
