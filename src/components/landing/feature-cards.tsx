import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Sparkles,
  Scissors,
  CalendarCheck,
  ShoppingBag,
  Leaf,
  ShieldCheck,
  Microscope,
  HeartHandshake,
  Zap,
  Flame,
  Star,
  Clock,
  LayoutGrid,
  MessageCircle,
  FileText,
  type LucideIcon,
} from "lucide-react"
import type { FeatureContent } from "@/lib/site-content"
import { AccentSpan, splitLastWord } from "./section-title"

// Fixed icon palette editable from the dashboard content editor
const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Scissors,
  CalendarCheck,
  ShoppingBag,
  Leaf,
  ShieldCheck,
  Microscope,
  HeartHandshake,
  Zap,
  Flame,
  Star,
  Clock,
  LayoutGrid,
  MessageCircle,
  FileText,
}

interface FeatureCardsProps {
  title: string
  subtitle: string
  items: FeatureContent[]
}

export function FeatureCards({ title, subtitle, items }: FeatureCardsProps) {
  const { lead, accent } = splitLastWord(title)

  return (
    <div>
      <div className="mb-12 text-center">
        <h2 className="font-heading mb-4 text-4xl md:text-5xl lg:text-6xl">
          {lead} {accent && <AccentSpan>{accent}</AccentSpan>}
        </h2>
        <p className="text-muted-foreground md:text-lg">{subtitle}</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((item, index) => {
          const Icon = ICONS[item.icon] ?? Sparkles
          return (
            <Card
              key={`${item.title}-${index}`}
              className={
                index === 1
                  ? "border-primary/30 from-primary/8 hover:border-primary/40 group bg-linear-to-br to-transparent transition-all hover:shadow-xl"
                  : "border-primary/20 from-primary/5 hover:border-primary/30 group bg-linear-to-br to-transparent transition-all hover:shadow-lg"
              }
            >
              <CardHeader>
                <div
                  className={
                    index === 1
                      ? "from-primary to-primary/80 ring-accent/30 group-hover:shadow-accent/30 mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br shadow-md ring-2 transition-all"
                      : "from-primary to-primary/80 group-hover:shadow-accent/20 mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br shadow-md transition-shadow"
                  }
                >
                  <Icon size={24} className="text-white" />
                </div>
                <CardTitle className="group-hover:text-primary-text transition-colors">
                  {item.title}
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
