import { getOrgBySlug } from "@/lib/tenant"
import { isInternalTenantSlug } from "@/lib/tenant-flags"
import { parsePublishState } from "@/lib/publication"
import { tenantSitemapXml } from "@/lib/sitemap-builder"

/**
 * Najemniški sitemap (#83) — prava ruta na /s/<slug>/sitemap.xml.
 *
 * P1 #83: prej je proxy vsako /s/<slug>/* prepisal na golo /sitemap.xml,
 * ki izpiše VSE objavljene najemnike — čebelarjev sitemap je Googleju
 * povedal za devet drugih podjetij (vključno z QA najemniki). Ta ruta
 * opisuje SAMO enega najemnika in je izključena iz prepisa (proxy).
 *
 * 404: neobjavljen (DRAFT/UNPUBLISHED), suspendiran, neznana ali
 * notranja (demo-/test-/qa-) sluga — nikoli ne potrdi, da slug obstaja.
 */

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const org = await getOrgBySlug(slug).catch(() => null)
  const publishable =
    org &&
    org.status === "ACTIVE" &&
    parsePublishState(org.publishState) === "PUBLISHED" &&
    !isInternalTenantSlug(org.slug)

  if (!publishable) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  }

  return new Response(tenantSitemapXml(org), {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=900",
    },
  })
}
