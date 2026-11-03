import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface FAQ {
  id: string
  question: string
  answer: string
  order: number
}

interface FAQSectionProps {
  faqs: FAQ[]
  /** P1 #35 (re-audit 2026-11): prevedena naslovna bloka — prej trdo
   * kodirana angleščina ("Frequently Asked Questions") na slovenski strani. */
  title?: string
  subtitle?: string
}

export function FAQSection({
  faqs,
  title = "Pogosta vprašanja",
  subtitle = "Vse, kar morate vedeti o tej storitvi",
}: FAQSectionProps) {
  if (faqs.length === 0) {
    return null // Don't show section if no FAQs
  }

  // Sort by order field
  const sortedFAQs = [...faqs].sort((a, b) => a.order - b.order)

  return (
    <section className="border-t border-primary/30 py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl">
          {/* Section Header */}
          <div className="mb-12 text-center">
            <h2 className="font-heading mb-4 text-4xl md:text-5xl">
              {title}
            </h2>
            <p className="text-muted-foreground text-lg">
              {subtitle}
            </p>
          </div>

          {/* FAQ Accordion */}
          <Accordion type="single" collapsible className="w-full space-y-4">
            {sortedFAQs.map((faq, index) => (
              <AccordionItem
                key={faq.id}
                value={`item-${index}`}
                className="border-primary/20 rounded-lg border px-6"
              >
                <AccordionTrigger className="text-left hover:text-primary-text hover:no-underline">
                  <span className="font-semibold">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pt-2 pb-4 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
