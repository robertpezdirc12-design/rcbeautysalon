import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"
import { getServerI18n } from "@/lib/i18n/server"

export const metadata: Metadata = {
  title: "Zasebnost",
  description:
    "Katere osebne podatke obdelujemo pri rezervacijah terminov in naročanju izdelkov ter kaj je vaša pravica (GDPR).",
}

export default async function PrivacyPage() {
  const { t } = await getServerI18n()
  return (
    <LegalPage
      title="Politika zasebnosti"
      updated="2. november 2026"
      backLabel={t.public.backToHome}
      updatedLabel={t.public.lastUpdated}
      sections={[
        {
          heading: "Katere podatke obdelujemo",
          body: [
            "Pri rezervaciji termina zberemo vaše ime, e-poštni naslov, telefonsko številko in neobvezne posebne želje. Podatke izkoristimo izključno za izvedbo in potrditev termina ter za komunikacijo o njem.",
            "Pri naročilu izdelkov obdelujemo naročene izdelke in kontaktne podatke za dostavo.",
            "Če ustvarite račun, shranimo tudi vaše geslo — izključno kot nepovratno šifriran (bcrypt) zapis.",
          ],
        },
        {
          heading: "Kdo obdeluje podatke",
          body: [
            "Podatke o rezervacijah vidi salon, ki ga obiščete (lastnik in zaposleni), ter upravljavec platforme, ki zagotavlja tehnično delovanje.",
            "Ne prodajamo in ne posredujemo vaših podatkov tretjim osebam za marketinške namene.",
          ],
        },
        {
          heading: "E-poštna sporočila",
          body: [
            "Na vaš e-poštni naslov pošiljamo izključno operativna sporočila: potrditev računa, potrditev termina, opomnik pred terminom in sporočila o spremembi ali odpovedi termina. Ne pošiljamo reklamnega gradiva.",
          ],
        },
        {
          heading: "Vaše pravice (GDPR)",
          body: [
            "Na zahtevo lahko zahtevate vpogled, popravek ali izbris svojih podatkov, omejitev obdelave ali prenos podatkov. Obrnite se na salon, kjer imate rezervacijo, ali na upravljavca platforme na prikazanem kontaktnem naslovu.",
            "Imate tudi pravico do pritožbe pri Informacijskem pooblaščencu RS.",
          ],
        },
        {
          heading: "Hramba podatkov",
          body: [
            "Podatke o rezervacijah hranimo, dokler so relevantni za poslovanje salona (zgodovina obiskov) ali dokler ne zahtevate izbrisa.",
          ],
        },
      ]}
    />
  )
}
