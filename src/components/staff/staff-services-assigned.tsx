"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ClockIcon, CurrencyDollarIcon, ScissorsIcon } from "@/components/icons"
import { useFormatPrice } from "@/lib/currency"

interface AssignedService {
  id: string
  name: string
  duration: number
  price: number
  category?: {
    id: string
    name: string
  } | null
}

interface StaffServicesAssignedProps {
  services: AssignedService[]
}

/** Slovenska množina: 1 storitev, 2 storitvi, 3–4 storitve, 5+ storitev. */
function storitveCount(n: number): string {
  if (n === 1) return "1 storitev"
  if (n === 2) return `${n} storitvi`
  if (n === 3 || n === 4) return `${n} storitve`
  return `${n} storitev`
}

export function StaffServicesAssigned({ services }: StaffServicesAssignedProps) {
  const fmt = useFormatPrice()
  // Group services by category
  const groupedServices = services.reduce(
    (acc, service) => {
      const categoryName = service.category?.name || "Drugo"
      if (!acc[categoryName]) {
        acc[categoryName] = []
      }
      acc[categoryName].push(service)
      return acc
    },
    {} as Record<string, AssignedService[]>
  )

  const categories = Object.keys(groupedServices)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScissorsIcon size={20} className="text-primary-text" />
            <CardTitle className="text-lg">Dodeljene storitve</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {storitveCount(services.length)}
          </Badge>
        </div>
        <CardDescription>
          Storitve, ki jih lahko izvajate
        </CardDescription>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-8 text-center">
            <ScissorsIcon size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Ni še dodeljenih storitev</p>
            <p className="mt-1 text-xs">Za dodelitev storitev se obrnite na skrbnika</p>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((category, catIndex) => (
              <div key={category}>
                {/* Category Header */}
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-medium">
                    {category}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    ({groupedServices[category].length})
                  </span>
                </div>

                {/* Services List */}
                <div className="space-y-2">
                  {groupedServices[category].map((service) => (
                    <div
                      key={service.id}
                      className="bg-muted/30 hover:bg-muted/50 flex items-center justify-between rounded-lg p-3 transition-colors sm:p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{service.name}</p>
                        <div className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
                          <span className="flex items-center gap-1">
                            <ClockIcon size={14} />
                            {service.duration} min
                          </span>
                          <span className="flex items-center gap-1">
                            <CurrencyDollarIcon size={14} />
                            {fmt(service.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {catIndex < categories.length - 1 && (
                  <Separator className="mt-6" />
                )}
              </div>
            ))}

            {/* Summary */}
            <div className="bg-primary/5 border-primary/20 mt-4 rounded-xl border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Skupno število storitev</span>
                <span className="font-semibold">{services.length}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Kategorije</span>
                <span className="font-semibold">{categories.length}</span>
              </div>
              <Separator className="bg-primary/20 my-3" />
              <p className="text-muted-foreground text-xs">
                Za posodobitev dodeljenih storitev se obrnite na skrbnika
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
