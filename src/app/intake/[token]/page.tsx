// #96 v2: javno izpolnjevanje sprejemnega obrazca po povezavi.
// Žeton je pooblastilo sama po sebi (G2) — preveri se obstoj termina,
// aktivna org, neodpovedani status in org-scoped aktivna definicija.
// Stran je namenoma minimalna in neodvisna od /s/[slug] konteksta.

import { format } from "date-fns"
import { sl } from "date-fns/locale"

import { getIntakeFormByToken } from "@/app/actions/appointments"
import { Card, CardContent } from "@/components/ui/card"

import { IntakeLinkForm } from "./intake-link-form"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Sprejemni obrazec — MARKEC",
  robots: { index: false, follow: false },
}

export default async function IntakeByTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getIntakeFormByToken(token)

  if (!data) {
    return (
      <main className="bg-background flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center">
            <p className="text-lg font-semibold">Povezava ni veljavna.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Povezava je morda potekla ali pa termin ne obstaja več.
              Kontaktirajte ponudnika.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (data.submitted) {
    return (
      <main className="bg-background flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center">
            <p className="text-lg font-semibold">
              Obrazec je že izpolnjen. Hvala!
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Vaši odgovori so že zabeleženi.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  const when = format(new Date(data.when), "d. MMMM yyyy", { locale: sl })

  return (
    <main className="bg-background min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            {data.organizationName}
          </p>
          <h1 className="text-xl font-semibold">Sprejemni obrazec</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data.serviceName ? `${data.serviceName}, ` : ""}
            {when}
          </p>
        </div>

        <IntakeLinkForm
          token={token}
          formName={data.form.name}
          formDescription={data.form.description}
          fields={data.form.fields}
        />
      </div>
    </main>
  )
}
