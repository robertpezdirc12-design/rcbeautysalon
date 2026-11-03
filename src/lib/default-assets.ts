// ============================================================
// P1 #18 (audit-2026-11) — CENTRALIZED DEFAULT ASSETS
//
// Single source of truth for every default/demo media URL.
//
// The set is SELF-HOSTED under /public/img/media (no third-party
// CDN dependency): previously these files were hot-linked from a
// third-party Cloudinary account, which posed an availability,
// branding and billing risk. Regression guard:
// scripts/check-third-party-assets.mjs fails the build if the
// third-party account name ever reappears anywhere in the repo.
// ============================================================

/** Upload fallback when NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is unset (dev). */
export const FALLBACK_CLOUD_NAME = ""

/** Default hero media (landing + services page fallbacks). */
export const DEFAULT_HERO = {
  videoWebm: "/img/media/hero/hero-bg.webm",
  videoMp4: "/img/media/hero/hero-bg.mp4",
  poster: "/img/media/hero/hero-bg.avif",
  image: "/img/media/hero/hero-bg.avif",
} as const

/** Services page band media. */
export const DEFAULT_SERVICES_MEDIA = {
  videoWebm: "/img/media/hero/services-band.webm",
  videoMp4: "/img/media/hero/services-band.mp4",
} as const

/**
 * Logo used by transactional e-mails when the tenant has none.
 *
 * E-mail clients cannot resolve relative URLs, so the path is made
 * absolute against NEXT_PUBLIC_APP_URL (the same base used for all
 * action links in the templates). Falls back to localhost in dev.
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
export const DEFAULT_EMAIL_LOGO = `${APP_URL}/img/media/brand/email-logo.png`

/** Sample catalog images used as vertical preset defaults. */
export const DEFAULT_CATALOG_IMAGES = {
  salonInterior: "/img/media/services/salon-interior.avif",
  heroImage: "/img/media/hero/hero-bg.avif",
  transform: "/img/media/services/transform.avif",
  haircut: "/img/media/services/classic-haircut.avif",
  coloring: "/img/media/services/coloring.avif",
  highlights: "/img/media/services/highlights.avif",
  hairTreatment: "/img/media/services/hair-treatment.avif",
  manicure: "/img/media/services/manicure.avif",
  gelManicure: "/img/media/services/gel-manicure.avif",
  spaPedicure: "/img/media/services/spa-pedicure.avif",
  facial: "/img/media/services/hydrating-facial.avif",
  antiAging: "/img/media/services/anti-aging-facial.avif",
  deepClean: "/img/media/services/deep-cleansing-facial.avif",
  massage: "/img/media/services/swedish-massage.avif",
  hotStone: "/img/media/services/hot-stone-massage.avif",
} as const

/** Legacy seed demo media (staff avatars + demo shop products). */
export const DEFAULT_DEMO_MEDIA = {
  staffLaura: "/img/media/staff/laura-thompson.avif",
  staffMaria: "/img/media/staff/maria-rodriguez.avif",
  staffSofia: "/img/media/staff/sofia-martinez.avif",
  staffAna: "/img/media/staff/ana-garcia.avif",
  productShampoo: "/img/media/products/premium-hair-shampoo.avif",
  productConditioner: "/img/media/products/deep-conditioning-treatment.avif",
  productFaceCream: "/img/media/products/hydrating-face-cream.avif",
  productHairSerum: "/img/media/products/hair-growth-serum.avif",
  productFacialSerum: "/img/media/products/anti-aging-facial-serum.avif",
  productNailPolish: "/img/media/products/premium-nail-polish-set.avif",
} as const
