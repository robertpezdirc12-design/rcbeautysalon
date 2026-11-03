"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { StarIcon } from "@/components/icons"
import { SectionWrapper } from "@/components/layouts/section-wrapper"
import { AccentSpan, splitLastWord } from "@/components/landing/section-title"
import { useI18n } from "@/lib/i18n/provider"
import { cloudinaryPresets } from "@/lib/utils/cloudinary"
import { displayAuthor } from "@/lib/utils/author"

export interface LandingTestimonial {
  id: string
  rating: number
  comment: string
  user: { name: string | null; image: string | null }
  service: { name: string } | null
}

/** P1 #39-4: enoten format avtorja — skupni util (src/lib/utils/author). */

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          size={16}
          weight={i < rating ? "fill" : "regular"}
          className={i < rating ? "text-accent-text" : "text-muted-foreground/30"}
        />
      ))}
    </div>
  )
}

/**
 * Landing "Izjave strank" section (competitor pattern: NaročiSe/MyPlanly).
 * Renders real, moderated customer reviews for the tenant — hidden entirely
 * while the tenant has none (no fake social proof, ever).
 */
export function TestimonialsSection({ testimonials }: { testimonials: LandingTestimonial[] }) {
  const { t } = useI18n()

  if (testimonials.length === 0) return null

  const average = testimonials.reduce((sum, r) => sum + r.rating, 0) / testimonials.length
  const { lead, accent } = splitLastWord(t.public.testimonialsTitle)

  return (
    <SectionWrapper id="testimonials" className="border-primary/30 border-t py-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="font-heading mb-4 text-4xl md:text-5xl">
            {lead} {accent && <AccentSpan>{accent}</AccentSpan>}
          </h2>
          <p className="text-muted-foreground md:text-lg">{t.public.testimonialsSubtitle}</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <StarIcon size={20} weight="fill" className="text-accent-text" />
            <span className="text-xl font-bold">{average.toFixed(1)}</span>
          </div>
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap justify-center gap-6">
            {testimonials.map((review) => (
              <Card
                key={review.id}
                className="border-primary/10 w-full flex flex-col md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
              >
                <CardContent className="flex flex-1 flex-col gap-4 pt-6">
                  <Stars rating={review.rating} />
                  <p className="text-muted-foreground line-clamp-5 flex-1 leading-relaxed">
                    “{review.comment}”
                  </p>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {review.user.image && (
                        <AvatarImage
                          src={cloudinaryPresets.userAvatar(review.user.image)}
                          alt={review.user.name ?? ""}
                        />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary-text">
                        {displayAuthor(review.user.name, t.public.reviewAnonym).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">
                        {displayAuthor(review.user.name, t.public.reviewAnonym)}
                      </p>
                      {review.service && (
                        <p className="text-muted-foreground text-xs">{review.service.name}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </SectionWrapper>
  )
}
