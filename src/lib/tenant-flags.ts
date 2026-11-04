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

// Ujame: "demo-frizer", "test-siviljstvo-4b", "qa-verify-52" (predpona) IN
// "studio-test-lepote" (notranji "-test-" segment).
// #83: "qa-" je sedaj tudi notranja predpona — QA najemniki (qa-*) so bili
// edini notranji najemniki, ki so preživeli ta filter in končali v javnem
// sitemap-u poleg resnih podjetij.
const INTERNAL_TENANT_SLUG = /^(demo|test|qa)[-]|[-](demo|test|qa)[-]/i

/** Ali je slug notranji (demo/test) najemnik — izključen iz SEO odkrivanja. */
export function isInternalTenantSlug(slug: string | null | undefined): boolean {
  if (!slug) return false
  return INTERNAL_TENANT_SLUG.test(slug)
}
