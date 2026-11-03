/**
 * P1 #18 (audit-2026-11) — default media migration (shared logic).
 *
 * Rewrites every default/demo media reference from the third-party
 * Cloudinary account to the self-hosted copies under /public/img/media.
 *
 * Handles BOTH stored forms:
 *  - full URLs   : https://res.cloudinary.com/<third-party-account>/(image|video)/upload/vXXX/.../NAME.ext
 *  - bare public : "Beauty Salon/services/NAME" (written by older scripts)
 *
 * Touched fields (only rows that actually reference the third-party
 * account are updated — user uploads are never modified):
 *  Service.imageUrl · ServiceGallery.imageUrl · Staff.image
 *  Product.images[] · Organization.logo · User.image
 *  SalonConfig.logo · SalonConfig.siteContent (deep JSON walk)
 *  SalonConfig.publishedSiteContent (deep JSON walk)
 *
 * Idempotent: already-migrated values don't match and are skipped.
 *
 * Used by:
 *  - scripts/migrate-default-media.ts (local/dev DB)
 *  - the one-time production run of 2026-11-03 via the temporary guarded
 *    endpoint POST /api/admin/migrate-default-media (route and the
 *    MIGRATION_TOKEN env var removed immediately after the successful run:
 *    89 values rewritten — 57 Service, 4 Staff, 6 Product, 22 SalonConfig JSON)
 */
import type { PrismaClient } from "@prisma/client"

// publicId basename (Cloudinary "NAME_hash") → self-hosted path
const MAP: ReadonlyMap<string, string> = new Map([
  ["hero-bg_t2k2ca", "/img/media/hero/hero-bg.avif"],
  ["hero-bg_yje6fb", "/img/media/hero/hero-bg.webm"],
  ["hero-bg_rn87gq", "/img/media/hero/hero-bg.mp4"],
  ["services_ija8oq", "/img/media/hero/services-band.webm"],
  ["services_umsjwg", "/img/media/hero/services-band.mp4"],
  ["logo_yfvhhd", "/img/media/brand/email-logo.png"],
  ["salon-interior_uxr7ba", "/img/media/services/salon-interior.avif"],
  ["transform_hwvixg", "/img/media/services/transform.avif"],
  ["classic-haircut_inzgrp", "/img/media/services/classic-haircut.avif"],
  ["coloring_aiw6e3", "/img/media/services/coloring.avif"],
  ["highlights_mrhaba", "/img/media/services/highlights.avif"],
  ["hair-treatment_hs60yv", "/img/media/services/hair-treatment.avif"],
  ["manicure_hyudpf", "/img/media/services/manicure.avif"],
  ["gel-manicure_e7k2gb", "/img/media/services/gel-manicure.avif"],
  ["spa-pedicure_fpbjgq", "/img/media/services/spa-pedicure.avif"],
  ["hydrating-facial_sliwao", "/img/media/services/hydrating-facial.avif"],
  ["anti-aging-facial_qgusgu", "/img/media/services/anti-aging-facial.avif"],
  ["deep-cleansing-facial_jzjp7l", "/img/media/services/deep-cleansing-facial.avif"],
  ["swedish-massage_degn1f", "/img/media/services/swedish-massage.avif"],
  ["hot-stone-massage_krxtkc", "/img/media/services/hot-stone-massage.avif"],
  ["laura-thompson_asbi3t", "/img/media/staff/laura-thompson.avif"],
  ["maria-rodriguez_uzksdw", "/img/media/staff/maria-rodriguez.avif"],
  ["sofia-martinez_vc28m8", "/img/media/staff/sofia-martinez.avif"],
  ["ana-garcia_cl0tgj", "/img/media/staff/ana-garcia.avif"],
  ["premium-hair-shampoo_lyekdy", "/img/media/products/premium-hair-shampoo.avif"],
  ["deep-conditioning-treatment_rkeqdp", "/img/media/products/deep-conditioning-treatment.avif"],
  ["hydrating-face-cream_hapgsz", "/img/media/products/hydrating-face-cream.avif"],
  ["hair-growth-serum_zruj5f", "/img/media/products/hair-growth-serum.avif"],
  ["anti-aging-facial-serum_grkuhs", "/img/media/products/anti-aging-facial-serum.avif"],
  ["premium-nail-polish-set_xag8xr", "/img/media/products/premium-nail-polish-set.avif"],
])

export interface MigrationChange {
  table: string
  id: string
  field: string
  from: string
  to: string
}

export interface MigrationResult {
  dryRun: boolean
  changes: MigrationChange[]
  total: number
}

/** Guard: only strings that reference the third-party account (or its
 *  seeded public-ID namespace) are eligible for rewriting. */
function isLegacyRef(v: string): boolean {
  return v.includes("caballero" + "randy") || v.startsWith("Beauty Salon/")
}

/** Map one stored value (full URL or bare public ID) to the local path. */
function mapValue(v: string): string | null {
  if (!isLegacyRef(v)) return null
  const seg = v.split("/").pop() || ""
  const base = seg.replace(/\.[a-z0-9]+$/i, "")
  return MAP.get(base) ?? null
}

/** Deep-walk JSON (SalonConfig.siteContent / publishedSiteContent). */
function walkJson(node: unknown): { node: unknown; changed: boolean } {
  if (typeof node === "string") {
    const mapped = mapValue(node)
    return mapped ? { node: mapped, changed: true } : { node, changed: false }
  }
  if (Array.isArray(node)) {
    let changed = false
    const out = node.map((item) => {
      const r = walkJson(item)
      changed = changed || r.changed
      return r.node
    })
    return { node: out, changed }
  }
  if (node && typeof node === "object") {
    let changed = false
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(node as Record<string, unknown>)) {
      const r = walkJson(val)
      changed = changed || r.changed
      out[k] = r.node
    }
    return { node: out, changed }
  }
  return { node, changed: false }
}

export async function migrateDefaultMedia(
  client: PrismaClient,
  dryRun: boolean
): Promise<MigrationResult> {
  const changes: MigrationChange[] = []
  const record = (table: string, id: string, field: string, from: string, to: string) =>
    changes.push({ table, id, field, from, to })

  // Scalar string fields, shared logic
  async function migrateScalar(
    table: string,
    rows: { id: string; value: string | null }[],
    field: string,
    apply: (id: string, next: string) => Promise<unknown>
  ) {
    for (const row of rows) {
      if (!row.value) continue
      const next = mapValue(row.value)
      if (!next) continue
      record(table, row.id, field, row.value, next)
      if (!dryRun) await apply(row.id, next)
    }
  }

  const services = await client.service.findMany({ select: { id: true, imageUrl: true } })
  await migrateScalar(
    "Service",
    services.map((s) => ({ id: s.id, value: s.imageUrl })),
    "imageUrl",
    (id, next) => client.service.update({ where: { id }, data: { imageUrl: next } })
  )

  const gallery = await client.serviceGallery.findMany({ select: { id: true, imageUrl: true } })
  await migrateScalar(
    "ServiceGallery",
    gallery.map((g) => ({ id: g.id, value: g.imageUrl })),
    "imageUrl",
    (id, next) => client.serviceGallery.update({ where: { id }, data: { imageUrl: next } })
  )

  const staff = await client.staff.findMany({ select: { id: true, image: true } })
  await migrateScalar(
    "Staff",
    staff.map((s) => ({ id: s.id, value: s.image })),
    "image",
    (id, next) => client.staff.update({ where: { id }, data: { image: next } })
  )

  const users = await client.user.findMany({ select: { id: true, image: true } })
  await migrateScalar(
    "User",
    users.map((u) => ({ id: u.id, value: u.image })),
    "image",
    (id, next) => client.user.update({ where: { id }, data: { image: next } })
  )

  const orgs = await client.organization.findMany({ select: { id: true, logo: true } })
  await migrateScalar(
    "Organization",
    orgs.map((o) => ({ id: o.id, value: o.logo })),
    "logo",
    (id, next) => client.organization.update({ where: { id }, data: { logo: next } })
  )

  // Product.images (string[])
  const products = await client.product.findMany({ select: { id: true, images: true } })
  for (const p of products) {
    if (!p.images?.length) continue
    const next = p.images.map((img) => mapValue(img) ?? img)
    if (JSON.stringify(next) === JSON.stringify(p.images)) continue
    p.images.forEach((img, i) => {
      if (next[i] !== img) record("Product", p.id, `images[${i}]`, img, next[i])
    })
    if (!dryRun) await client.product.update({ where: { id: p.id }, data: { images: next } })
  }

  // SalonConfig: logo + siteContent + publishedSiteContent (deep JSON)
  const configs = await client.salonConfig.findMany({
    select: { id: true, logo: true, siteContent: true, publishedSiteContent: true },
  })
  for (const c of configs) {
    if (c.logo) {
      const next = mapValue(c.logo)
      if (next) {
        record("SalonConfig", c.id, "logo", c.logo, next)
        if (!dryRun) await client.salonConfig.update({ where: { id: c.id }, data: { logo: next } })
      }
    }
    for (const key of ["siteContent", "publishedSiteContent"] as const) {
      const json = c[key]
      if (json == null) continue
      const r = walkJson(json)
      if (!r.changed) continue
      record(
        "SalonConfig",
        c.id,
        key,
        JSON.stringify(json).slice(0, 160),
        JSON.stringify(r.node).slice(0, 160)
      )
      if (!dryRun)
        await client.salonConfig.update({
          where: { id: c.id },
          data: { [key]: r.node as object },
        })
    }
  }

  return { dryRun, changes, total: changes.length }
}
