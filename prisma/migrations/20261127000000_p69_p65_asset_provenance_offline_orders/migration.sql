-- P1 #69 + P1 #65 — asset provenance & offline orders
--
-- 1) sourceProfile: profile id when a Form/Workflow definition was
--    materialized from the registry; NULL = owner-created (an activity
--    switch never deactivates owner rows).
-- 2) paymentMethod on Order: "online" (default, Stripe hosted checkout)
--    or "offline" (order created without Stripe — owner collects payment).
--
-- Fully idempotent (the guard may retry after a failed mid-apply).

ALTER TABLE "FormDefinition" ADD COLUMN IF NOT EXISTS "sourceProfile" TEXT;
ALTER TABLE "WorkflowDefinition" ADD COLUMN IF NOT EXISTS "sourceProfile" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'online';

-- Backfill: registry-materialized rows get the org's current vertical as
-- provenance — only when their key matches that vertical's template keys
-- (conservative; unknown keys stay NULL = owner-created).
-- The (vertical, key) pairs are generated from src/lib/profiles/registry.ts.

UPDATE "FormDefinition" f
SET "sourceProfile" = m.vertical
FROM (
  SELECT o.id AS org_id, v.vertical, v.key
  FROM "Organization" o
  JOIN (VALUES
    ('cosmetica', 'consultation'),
    ('massage', 'health-screening'),
    ('seamstress', 'order-details'),
    ('seamstress', 'measurements'),
    ('tire-service', 'vehicle-intake'),
    ('beekeeping', 'harvest-record')
  ) AS v(vertical, key) ON o.vertical = v.vertical
) m
WHERE f."organizationId" = m.org_id
  AND f.key = m.key
  AND f."sourceProfile" IS NULL;

UPDATE "WorkflowDefinition" w
SET "sourceProfile" = m.vertical
FROM (
  SELECT o.id AS org_id, v.vertical, v.key
  FROM "Organization" o
  JOIN (VALUES
    ('seamstress', 'production-order'),
    ('tire-service', 'work-order')
  ) AS v(vertical, key) ON o.vertical = v.vertical
) m
WHERE w."organizationId" = m.org_id
  AND w.key = m.key
  AND w."sourceProfile" IS NULL;

CREATE INDEX IF NOT EXISTS "FormDefinition_sourceProfile_idx" ON "FormDefinition"("sourceProfile");
CREATE INDEX IF NOT EXISTS "WorkflowDefinition_sourceProfile_idx" ON "WorkflowDefinition"("sourceProfile");
