-- #77: Product.sku must be unique PER TENANT, not across the platform.
-- Drop the global unique index; the composite @@unique([organizationId, sku])
-- is (and always was) the real business rule. Safe: the global index could
-- only have been hit by two tenants sharing a SKU, which is exactly the bug.
DROP INDEX IF EXISTS "Product_sku_key";
