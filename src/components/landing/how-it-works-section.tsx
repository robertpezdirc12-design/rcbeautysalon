import {
  BadgeCheck,
  CalendarCheck,
  CalendarSearch,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { AccentSpan, splitLastWord } from "./section-title"
import { useI18n } from "@/lib/i18n/provider"

// ============================================================
// "Kako deluje" — public trust section explaining the booking
// flow in four truthful steps (pattern: NaročiSe / MyPlanly
// landing pages). Copy is intentionally aligned with the real
// booking semantics: a guest booking is created as PENDING and
// the business confirms it, so step 3 names the BUSINESS —
// with the tenant's own noun (#84: "Salon potrdi" za lepoto,
// "Servis potrdi" za vulkanizerja) — never promise e-mail/SMS
// confirmations here, delivery depends on tenant e-mail
// configuration.
// ============================================================

export interface BookingStep {
  title: string
  description: string
  icon: LucideIcon
}

/**
 * P2 #84: interpolates {business} with the tenant's own noun and
 * capitalizes the first letter ("servis" → "Servis potrdi").
 * Pure — tests and the renderer stay in sync.
 */
export function resolveBusinessTemplate(text: string, business: string): string {
  return text
    .replace(/\{business\}/g, business)
    .replace(/^./, (c) => c.toUpperCase())
}

/** Pure data so tests and the renderer stay in sync. Step titles may
 *  carry the {business} placeholder (#84) — resolved at render time. */
export const HOW_IT_WORKS_STEPS: BookingStep[] = [
  {
    title: "Izberite storitev",
    description:
      "Cenik s trajanji je viden takoj — vse jasno navedeno, brez presenečenj.",
    icon: CalendarSearch,
  },
  {
    title: "Izberite termin",
    description:
      "Prosti termini v realnem času. Rezervirate kadarkoli, 24/7 — brez klicanja.",
    icon: CalendarCheck,
  },
  {
    title: "{business} potrdi",
    description:
      "Vašo rezervacijo preverimo in potrdimo v najkrajšem možnem času.",
    icon: BadgeCheck,
  },
  {
    title: "Prihod",
    description: "Samo še pridite. Termin spremenite ali odpoveste z nekaj kliki.",
    icon: Sparkles,
  },
]

interface HowItWorksSectionProps {
  title?: string
  subtitle?: string
}

export function HowItWorksSection({
  title = "Kako deluje",
  subtitle = "Rezervacija termina v štirih korakih — preprosto in brez klicanja.",
}: HowItWorksSectionProps) {
  const { lead, accent } = splitLastWord(title)
  // P2 #84: the confirming party is the tenant's OWN business noun
  // ("salon" za lepoto, "servis" za vulkanizerja) — iz i18n profila.
  const { term } = useI18n()
  const business = term("businessSingular")
  const confirmStepTitle = resolveBusinessTemplate(
    HOW_IT_WORKS_STEPS[2].title,
    business
  )

  return (
    <section className="border-primary/30 bg-background border-t py-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="font-heading mb-4 text-4xl md:text-5xl lg:text-6xl">
            {lead} {accent && <AccentSpan>{accent}</AccentSpan>}
          </h2>
          <p className="text-muted-foreground md:text-lg">{subtitle}</p>
        </div>
        <ol className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map((step, index) => {
            const Icon = step.icon
            const num = String(index + 1).padStart(2, "0")
            const displayTitle =
              index === 2 ? confirmStepTitle : step.title
            return (
              <li
                key={step.title}
                className="border-primary/20 from-primary/5 hover:border-primary/30 group relative rounded-lg border bg-linear-to-br to-transparent p-6 transition-all hover:shadow-lg"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span
                    aria-hidden="true"
                    className="from-accent to-primary bg-linear-to-r bg-clip-text text-3xl font-bold text-transparent"
                  >
                    {num}
                  </span>
                  <span className="from-primary to-primary/80 group-hover:shadow-accent/20 flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br shadow-md transition-shadow">
                    <Icon size={20} className="text-white" aria-hidden="true" />
                  </span>
                </div>
                <h3 className="group-hover:text-primary-text mb-2 font-semibold transition-colors">
                  {displayTitle}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
