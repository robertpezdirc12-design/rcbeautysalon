import { redirect } from "next/navigation"
import { getResolvedOrg } from "@/lib/tenant"
import { orgPath } from "@/lib/org-path"
import { isBookingEnabled } from "@/lib/public-cta"

// ============================================================
// P0 #24 (re-audit 2026-11) — BOOKING GUARD V SHELL FAZI
//
// Prej je page klical redirect(): strežnik je vseeno odposlal 200
// (streaming) in serviral /inquiry vsebino pod /booking URL-jem —
// točno to, kar je audit ujel kot "duplicate content z HTTP 200".
// Stražar je prestavljen v LAYOUT (del odzivne lupine): preusmeritev
// se zgodi PRED splakom → pravi 307 v produkciji.
// ============================================================

export default async function BookingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const org = await getResolvedOrg()
  if (!isBookingEnabled(org)) {
    // Profile guard (EPIC #1 §21): non-appointment businesses never see
    // a booking calendar — they are routed to the inquiry form instead.
    redirect(orgPath(org?.slug, "/inquiry"))
  }
  return <>{children}</>
}
