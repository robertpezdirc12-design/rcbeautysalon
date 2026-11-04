import { z } from "zod"

export const reviewSchema = z.object({
  rating: z
    .number()
    .min(1, "Izberite oceno")
    .max(5, "Ocena mora biti med 1 in 5"),
  comment: z
    .string()
    .min(10, "Komentar mora imeti vsaj 10 znakov")
    .max(1000, "Komentar ne sme presegati 1000 znakov")
    .trim(),
  // P2 #75: serviceId je OPTIONAL — null/izpuščen = ocena PODJETJA
  // (najemnika), ne posamezne storitve (profili brez storitev).
  serviceId: z.string().min(1).optional().nullable(),
})

export type ReviewInput = z.infer<typeof reviewSchema>

// Schema para editar review (sin serviceId)
export const editReviewSchema = z.object({
  rating: z
    .number()
    .min(1, "Izberite oceno")
    .max(5, "Ocena mora biti med 1 in 5"),
  comment: z
    .string()
    .min(10, "Komentar mora imeti vsaj 10 znakov")
    .max(1000, "Komentar ne sme presegati 1000 znakov")
    .trim(),
})

export type EditReviewInput = z.infer<typeof editReviewSchema>
