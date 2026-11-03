import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"
import { getServerI18n } from "@/lib/i18n/server"

export const metadata: Metadata = {
  title: "Pogoji uporabe",
  description:
    "Pogoji rezervacije terminov, plačila pologa, odpovedi in odgovornosti salona ter platforme.",
}

export default async function TermsPage() {
  const { t } = await getServerI18n()
  return (
    <LegalPage
      title="Pogoji uporabe"
      updated="2. november 2026"
      backLabel={t.public.backToHome}
      updatedLabel={t.public.lastUpdated}
      sections={[
        {
          heading: "Rezervacije terminov",
          body: [
            "Rezervacijo oddate prek spletnega čarovnika in jo potrdite z e-pošto. Termin je veljaven, ko ga salon potrdi. Za nekatere storitve salon lahko zahteva polog, ki je razviden pred oddajo rezervacije.",
            "Če salon nima omogočenih spletnih plačil, rezervacijo oddate brez pologa, znesek pa poravnate ob obisku.",
          ],
        },
        {
          heading: "Odpoved in sprememba termina",
          body: [
            "Termin lahko odpovete ali prestavite prek svojega računa ali z odgovorom na potrditveno e-poštno sporočilo. Priporočamo odpoved vsaj 24 ur vnaprej.",
            "V primeru neodpovedanega termina salon lahko zahteva nadomestilo po svojih pravilih (razvidna pri rezervaciji).",
          ],
        },
        {
          heading: "Cene",
          body: [
            "Vse cene so v EUR in vključujejo DDV, razen če ni navedeno drugače. Cene storitev in izdelkov določa salon in se lahko spremenijo; za vas velja cena, razvidna v trenutku oddaje rezervacije oziroma naročila.",
          ],
        },
        {
          heading: "Odgovornost",
          body: [
            "Za kakovost in izvedbo storitev odgovarja salon. Platforma posreduje rezervacije in omogoča tehnično delovanje; za vsebino, ki jo objavi salon (opisi, slike, delovni čas), odgovarja salon.",
          ],
        },
      ]}
    />
  )
}
