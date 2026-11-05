import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/auth"
import {
  decideMediaAccess,
  type MediaAccessDecision,
} from "@/lib/media-access"
import {
  isPlatformAdminEmail,
  PLATFORM_ADMIN_EMAILS_ENV,
} from "@/lib/platform/access"

// ============================================================
// V-3 (issue #102 — F0-S): media is served ONLY with an access
// decision — never on the basis of the ID alone. Public images of
// public sites remain reachable (immutable cache); draft/suspended
// tenant media is member/operator-only and never cacheable publicly.
// ============================================================

/** Serves images stored in the DB (Media model) — used when Cloudinary is not configured. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const media = await prisma.media.findUnique({
      where: { id },
      include: {
        organization: { select: { status: true, publishState: true } },
      },
    })
    if (!media) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const session = await auth()
    const requesterEmail = session?.user?.email ?? null
    const decision: MediaAccessDecision = decideMediaAccess({
      organizationId: media.organizationId,
      orgStatus: media.organization?.status ?? null,
      orgPublishState: media.organization?.publishState ?? null,
      requesterOrganizationId: session?.user?.organizationId ?? null,
      requesterIsPlatformAdmin: requesterEmail
        ? isPlatformAdminEmail(requesterEmail, process.env[PLATFORM_ADMIN_EMAILS_ENV])
        : false,
    })

    if (decision === "denied") {
      // 404 (not 403) — do not confirm the ID exists to strangers.
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      )
    }

    const buffer = Buffer.from(media.data, "base64")
    // Public media: immutable shared cache. Owner-only media: never
    // stored in a shared cache (the same URL must not leak via caches).
    const cacheControl =
      decision === "public"
        ? "public, max-age=31536000, immutable"
        : "private, no-store"
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": media.mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": cacheControl,
      },
    })
  } catch (error) {
    console.error("Media serve error:", error)
    return NextResponse.json({ error: "Failed to serve media" }, { status: 500 })
  }
}
