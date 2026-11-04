import { getOrgBySlug } from "@/lib/tenant"
import { isInternalTenantSlug } from "@/lib/tenant-flags"
import { parsePublishState } from "@/lib/publication"
import { resolveAppUrl } from "@/lib/sitemap-builder"

/**
 * Najemniški robots.txt (#83) — prava ruta na /s/<slug>/robots.txt.
 *
 * P1 #83: globalni /robots.txt oglašuje ${appUrl}/sitemap.xml kot THE
 * sitemap — na najemniški poti (in custom domeni) to pomeni, da robots.txt
 * posameznega podjetja kaže na seznam VSEH najemnikov. Ta ruta kaže na
 * najemnikov LASTNI sitemap (/s/<slug>/sitemap.xml).
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

  const appUrl = resolveAppUrl()
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${appUrl}/s/${slug}/sitemap.xml`,
    "",
  ].join("\n")

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=900",
    },
  })
}
