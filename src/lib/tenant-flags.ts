// ============================================================
// P1 #28 (re-audit 2026-11) — NOTRANJI (DEMO/TEST) NAJEMNIKI
//
// Demo in testni najemniki se ne smejo pojavljati v sitemap.xml
// in morajo biti noindex (obrambne v globino): javna platforma
// naj ne razkriva notranjih testnih podatkov ("Studio Test
// Lepote", "Test Šiviljstvo 4b").
//
// Client-safe: uporablja jo sitemap (strežnik) in seo.ts (metadata).
// ============================================================

// Ujame: "demo-frizer", "test-siviljstvo-4b" (predpona) IN
// "studio-test-lepote" (notranji "-test-" segment).
const INTERNAL_TENANT_SLUG = /^(demo|test)[-]|[-](demo|test)[-]/i

/** Ali je slug notranji (demo/test) najemnik — izključen iz SEO odkrivanja. */
export function isInternalTenantSlug(slug: string | null | undefined): boolean {
  if (!slug) return false
  return INTERNAL_TENANT_SLUG.test(slug)
}
