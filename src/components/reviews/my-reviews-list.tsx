"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StarIcon, ScissorsIcon } from "@/components/icons"
import { MyReviewCard } from "./my-review-card"

// TODO: Import proper type from Prisma when implementing logic
interface Review {
  id: string
  rating: number
  comment: string
  createdAt: Date
  // P2 #75: ocena podjetja nima storitve (serviceId null → service null)
  service: {
    id: string
    name: string
    slug: string
    imageUrl: string | null
  } | null
}

interface MyReviewsListProps {
  reviews: Review[]
}

export function MyReviewsList({ reviews }: MyReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <StarIcon size={32} className="text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Še ni ocen</h3>
          <p className="text-muted-foreground mb-6 text-center max-w-sm">
            Po zaključeni storitvi lahko pustite oceno, s katero pomagate
            drugim in delite svojo izkušnjo.
          </p>
          <Button asChild>
            <Link href="/services">
              <ScissorsIcon size={16} className="mr-2" />
              Raziščite storitve
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <MyReviewCard key={review.id} review={review} />
      ))}
    </div>
  )
}
