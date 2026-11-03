import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"

/**
 * Skupni okvir pravnih strani (Zasebnost / Pogoji / Piškotki).
 * Besedilo je splošno in pošteno — opisuje dejansko obnašanje platforme
 * (katere podatke se shranjujejo in zakaj), ne pravne vodovodne palice.
 */
export function LegalPage({
  title,
  updated,
  sections,
  // P2 #15 (audit-2026-11): labels come from the i18n dict via callers,
  // so the EN locale no longer renders hard-coded Slovenian strings.
  backLabel = "← Nazaj na domačo stran",
  updatedLabel = "Zadnja posodobitev:",
}: {
  title: string
  updated: string
  sections: { heading: string; body: string[] }[]
  backLabel?: string
  updatedLabel?: string
}) {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <Card>
        <CardHeader>
          {/* P2 #12 (audit-2026-11): real <h1> — CardTitle renders a <div>,
              which left the legal pages without a level-1 heading. */}
          <h1 className="text-3xl font-semibold leading-none tracking-tight">
            {title}
          </h1>
          <CardDescription>{updatedLabel} {updated}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="mb-2 text-lg font-semibold">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="text-muted-foreground mb-2 text-sm leading-relaxed">
                  {p}
                </p>
              ))}
            </section>
          ))}
          <div className="pt-2">
            <Button asChild variant="outline">
              <Link href="/">{backLabel}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
