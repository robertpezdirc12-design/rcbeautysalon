// ============================================================
// #106 — STREŽNIŠKA ZOD VALIDACIJA PRODUKTOV (bela lista polj)
// Zod-validacija je obstajala SAMO v odjemalskem obrazcu — akciji
// createProduct/updateProduct sta payload poslali neposredno v Prisma
// (mass-assignment; #105: "<script>…" je bil sprejet kot name/sku).
// Ta shema je avtoritativna na strežniku: parsed.data vsebuje SAMO
// dovoljena polja — vsak drug ključ strukturno izgine (ne "ignoriran
// prek preskoka", ampak nikoli ne pride do Prisme).
// Čisto + testabilno (brez DB).
// ============================================================

import { z } from "zod"

/** SKU: omejen znakovni nabor (črke, številke, ločila, presledek) —
 * XSS payloadi kot "<script src=…>" so strukturno nemogoči. */
const SKU_PATTERN = /^[a-zA-Z0-9._\- /]*$/

export const productServerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ime je obvezno")
    .max(200, "Ime je predolgo (največ 200 znakov)"),
  description: z.string().trim().max(5000, "Opis je predolg (največ 5000 znakov)").optional(),
  price: z
    .number()
    .min(0, "Cena ne sme biti negativna")
    .max(1_000_000, "Cena je prevelika"),
  compareAtPrice: z
    .number()
    .min(0)
    .max(1_000_000)
    .optional()
    .nullable(),
  sku: z
    .string()
    .trim()
    .max(64, "SKU je predolg (največ 64 znakov)")
    .regex(SKU_PATTERN, "SKU vsebuje nedovoljene znake")
    .optional()
    .nullable(),
  barcode: z.string().trim().max(64).optional().nullable(),
  brand: z.string().trim().max(100).optional().nullable(),
  unit: z.string().trim().max(20).optional(),
  vatRate: z
    .number()
    .min(0, "DDV mora biti 0–100")
    .max(100, "DDV mora biti 0–100")
    .optional()
    .nullable(),
  forSale: z.boolean().optional(),
  reorderPoint: z.number().int().min(0).max(1_000_000).optional().nullable(),
  trackInventory: z.boolean().optional(),
  stockQuantity: z.number().int().min(0).max(1_000_000).optional(),
  images: z.array(z.string().max(500)).max(12, "Največ 12 slik").optional(),
  categoryId: z.string().max(40).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
})

export type ProductServerInput = z.infer<typeof productServerSchema>

/** Posodobitev: vsa polja neobvezna (isto belo listo, brez zahtevanih). */
export const productServerUpdateSchema = productServerSchema.partial()

/** Varno parsanje: vrne podatke ALI človeku razumljivo sporočilo prve napake.
 * Overloada: create zahteva vsa obvezna polja, update je delna bela lista. */
export function parseProductServerInput(
  data: unknown,
  mode: "create"
): { ok: true; data: ProductServerInput } | { ok: false; error: string }
export function parseProductServerInput(
  data: unknown,
  mode: "update"
): { ok: true; data: Partial<ProductServerInput> } | { ok: false; error: string }
export function parseProductServerInput(
  data: unknown,
  mode: "create" | "update"
): { ok: true; data: Partial<ProductServerInput> } | { ok: false; error: string } {
  const schema = mode === "create" ? productServerSchema : productServerUpdateSchema
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path?.join(".") || "podatki"
    return { ok: false, error: `Neveljavni podatki izdelka — ${field}: ${issue?.message ?? "napaka"}` }
  }
  return { ok: true, data: parsed.data }
}
