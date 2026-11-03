// ============================================================
// P1 #18 (audit-2026-11) — CENTRALIZED DEFAULT ASSETS
//
// Single source of truth for every default/demo media URL so the
// third-party Cloudinary account reference lives in exactly ONE
// file (grep guard: scripts/check-third-party-assets.mjs).
//
// ⚠️ OWNERSHIP PENDING CONFIRMATION: these assets are currently
// hot-linked from the `caballerorandy` Cloudinary account. If that
// account is not project-controlled, re-upload the set to the
// project's own cloud (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) or to
// Vercel Blob / /public and update ONLY this module.
// ============================================================

const CLOUD = "https://res.cloudinary.com/caballerorandy"

/** Upload fallback when NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is unset (dev). */
export const FALLBACK_CLOUD_NAME = "caballerorandy"

/** Default hero media (landing + services page fallbacks). */
export const DEFAULT_HERO = {
  videoWebm: `${CLOUD}/video/upload/v1763776212/Beauty%20Salon/services/hero-bg_yje6fb.webm`,
  videoMp4: `${CLOUD}/video/upload/v1763776242/Beauty%20Salon/services/hero-bg_rn87gq.mp4`,
  poster: `${CLOUD}/image/upload/v1763776064/Beauty%20Salon/services/hero-bg_t2k2ca.avif`,
  image: `${CLOUD}/image/upload/v1763776064/Beauty%20Salon/services/hero-bg_t2k2ca.avif`,
} as const

/** Services page band media. */
export const DEFAULT_SERVICES_MEDIA = {
  videoWebm: `${CLOUD}/video/upload/v1763776430/Beauty%20Salon/services/services_ija8oq.webm`,
  videoMp4: `${CLOUD}/video/upload/v1763776446/Beauty%20Salon/services/services_umsjwg.mp4`,
} as const

/** Logo used by transactional e-mails when the tenant has none. */
export const DEFAULT_EMAIL_LOGO = `${CLOUD}/image/upload/v1764553458/Beauty%20Salon/services/logo_yfvhhd.png`

/** Sample catalog images used as vertical preset defaults. */
export const DEFAULT_CATALOG_IMAGES = {
  salonInterior: `${CLOUD}/image/upload/v1763776103/Beauty%20Salon/services/salon-interior_uxr7ba.avif`,
  heroImage: `${CLOUD}/image/upload/v1763776064/Beauty%20Salon/services/hero-bg_t2k2ca.avif`,
  transform: `${CLOUD}/image/upload/v1763776103/Beauty%20Salon/services/transform_hwvixg.avif`,
  haircut: `${CLOUD}/image/upload/v1763611761/Beauty%20Salon/services/classic-haircut_inzgrp.avif`,
  coloring: `${CLOUD}/image/upload/v1763538513/Beauty%20Salon/services/coloring_aiw6e3.avif`,
  highlights: `${CLOUD}/image/upload/v1763612088/Beauty%20Salon/services/highlights_mrhaba.avif`,
  hairTreatment: `${CLOUD}/image/upload/v1763611939/Beauty%20Salon/services/hair-treatment_hs60yv.avif`,
  manicure: `${CLOUD}/image/upload/v1763538512/Beauty%20Salon/services/manicure_hyudpf.avif`,
  gelManicure: `${CLOUD}/image/upload/v1763613072/Beauty%20Salon/services/gel-manicure_e7k2gb.avif`,
  spaPedicure: `${CLOUD}/image/upload/v1763613172/Beauty%20Salon/services/spa-pedicure_fpbjgq.avif`,
  facial: `${CLOUD}/image/upload/v1763611296/Beauty%20Salon/services/hydrating-facial_sliwao.avif`,
  antiAging: `${CLOUD}/image/upload/v1763611000/Beauty%20Salon/services/anti-aging-facial_qgusgu.avif`,
  deepClean: `${CLOUD}/image/upload/v1763611175/Beauty%20Salon/services/deep-cleansing-facial_jzjp7l.avif`,
  massage: `${CLOUD}/image/upload/v1763612585/Beauty%20Salon/services/swedish-massage_degn1f.avif`,
  hotStone: `${CLOUD}/image/upload/v1763612414/Beauty%20Salon/services/hot-stone-massage_krxtkc.avif`,
} as const

/** Legacy seed demo media (staff avatars + demo shop products). */
export const DEFAULT_DEMO_MEDIA = {
  staffLaura: `${CLOUD}/image/upload/v1764141936/Beauty%20Salon/services/laura-thompson_asbi3t.avif`,
  staffMaria: `${CLOUD}/image/upload/v1764142469/Beauty%20Salon/services/maria-rodriguez_uzksdw.avif`,
  staffSofia: `${CLOUD}/image/upload/v1764142586/Beauty%20Salon/services/sofia-martinez_vc28m8.avif`,
  staffAna: `${CLOUD}/image/upload/v1764142701/Beauty%20Salon/services/ana-garcia_cl0tgj.avif`,
  productShampoo: `${CLOUD}/image/upload/v1764652547/Beauty%20Salon/services/premium-hair-shampoo_lyekdy.avif`,
  productConditioner: `${CLOUD}/image/upload/v1764652695/Beauty%20Salon/services/deep-conditioning-treatment_rkeqdp.avif`,
  productFaceCream: `${CLOUD}/image/upload/v1764653082/Beauty%20Salon/services/hydrating-face-cream_hapgsz.avif`,
  productHairSerum: `${CLOUD}/image/upload/v1764653341/Beauty%20Salon/services/hair-growth-serum_zruj5f.avif`,
  productFacialSerum: `${CLOUD}/image/upload/v1764653498/Beauty%20Salon/services/anti-aging-facial-serum_grkuhs.avif`,
  productNailPolish: `${CLOUD}/image/upload/v1764653996/Beauty%20Salon/services/premium-nail-polish-set_xag8xr.avif`,
} as const
