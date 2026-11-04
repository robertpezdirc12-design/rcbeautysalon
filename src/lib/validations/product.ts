import { z } from "zod"

// Base schema with common fields
const productBaseSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  description: z.string().optional(),
  price: z
    .number({ error: "Price is required" })
    .min(0, "Price must be positive"),
  compareAtPrice: z
    .number()
    .min(0, "Compare at price must be positive")
    .optional()
    .nullable(),
  sku: z.string().optional(),
  trackInventory: z.boolean(),
  stockQuantity: z
    .number()
    .min(0, "Stock quantity must be positive")
    .optional(),
  images: z.array(z.string()).optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  // #78: retail layer — barcode/brand/unit so opcijska besedila, vatRate je
  // odstotek 0–100, forSale loči prodajne izdelke od back-bara, reorderPoint
  // je per-izdelek prag nizke zaloge (null = org privzeto).
  barcode: z.string().max(64).optional(),
  brand: z.string().max(100).optional(),
  unit: z.string().max(20).optional(),
  vatRate: z
    .number()
    .min(0, "VAT rate must be 0–100")
    .max(100, "VAT rate must be 0–100")
    .optional()
    .nullable(),
  forSale: z.boolean().optional(),
  reorderPoint: z
    .number()
    .int()
    .min(0, "Reorder point must be 0 or more")
    .optional()
    .nullable(),
})

// Schema for creating products
export const createProductSchema = productBaseSchema

// Schema for updating products
export const updateProductSchema = productBaseSchema

export type CreateProductFormData = z.infer<typeof createProductSchema>
export type UpdateProductFormData = z.infer<typeof updateProductSchema>
export type ProductFormData = CreateProductFormData | UpdateProductFormData
