/**
 * P1 #18 (audit-2026-11) — ONE-TIME production migration endpoint.
 *
 * Runs the default-media migration (src/lib/default-media-migration.ts)
 * against the production database. Guarded by the MIGRATION_TOKEN env
 * var (constant-time compare, fail-closed when unset) because the
 * production Postgres is not reachable from developer machines.
 *
 * TEMPORARY: this route is removed in the immediately following commit
 * once the migration has been executed, together with the
 * MIGRATION_TOKEN environment variable.
 *
 * POST /api/admin/migrate-default-media
 * Headers: x-migration-token: <MIGRATION_TOKEN>
 * Body:    { "dryRun": true }   → report only (default)
 *          { "dryRun": false }  → apply
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { migrateDefaultMedia } from "@/lib/default-media-migration"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function POST(request: NextRequest) {
  const expected = process.env.MIGRATION_TOKEN
  if (!expected) {
    return NextResponse.json({ error: "Migration endpoint is disabled" }, { status: 404 })
  }
  const provided = request.headers.get("x-migration-token") ?? ""
  if (!timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let dryRun = true
  try {
    const body = await request.json().catch(() => ({}))
    dryRun = (body as { dryRun?: boolean }).dryRun !== false
  } catch {
    dryRun = true
  }

  try {
    const result = await migrateDefaultMedia(prisma, dryRun)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[migrate-default-media] failed:", error)
    return NextResponse.json({ error: "Migration failed" }, { status: 500 })
  }
}
