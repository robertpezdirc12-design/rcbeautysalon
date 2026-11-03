import { useFormatPrice } from "@/lib/currency"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ClockIcon } from "@/components/icons"
import { useI18n } from "@/lib/i18n/provider"

interface ServiceStepProps {
  service: {
    name: string
    price: number
    duration: number
    category: { name: string } | null
  }
}

export function ServiceStep({ service }: ServiceStepProps) {
  const fmt = useFormatPrice()
  const { t } = useI18n()
  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            1
          </div>
          <CardTitle>{t.booking.selectedService}</CardTitle>
        </div>
        <CardDescription>{t.booking.selectedServiceDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <h3 className="text-3xl font-bold text-primary-text">{service.name}</h3>
              {service.category && (
                <p className="text-sm text-muted-foreground">{service.category.name}</p>
              )}
            </div>
            <Badge variant="secondary" className="text-base">
              {fmt(service.price)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <ClockIcon size={14} className="mr-1 inline" weight="regular" />
            {t.booking.minutes(service.duration)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
