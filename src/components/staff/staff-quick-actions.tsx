import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CalendarIcon,
  ClockIcon,
  UserIcon,
  CalendarCheckIcon,
} from "@/components/icons"

export function StaffQuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Hitra dejanja</CardTitle>
        <CardDescription>Pogosta opravila in bližnjice</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Button variant="outline" className="h-auto justify-start py-3" asChild>
          <Link href="/staff-portal/appointments">
            <CalendarIcon size={20} className="mr-3 text-primary-text" />
            <div className="text-left">
              <p className="font-medium text-foreground">Prikaži vse termine</p>
              <p className="text-xs text-muted-foreground">Poglejte svoj celoten urnik</p>
            </div>
          </Link>
        </Button>

        <Button variant="outline" className="h-auto justify-start py-3" asChild>
          <Link href="/staff-portal/schedule">
            <ClockIcon size={20} className="mr-3 text-blue-600 dark:text-blue-400" />
            <div className="text-left">
              <p className="font-medium text-foreground">Upravljaj urnik</p>
              <p className="text-xs text-muted-foreground">Posodobite delovni čas</p>
            </div>
          </Link>
        </Button>

        <Button variant="outline" className="h-auto justify-start py-3" asChild>
          <Link href="/staff-portal/profile">
            <UserIcon size={20} className="mr-3 text-emerald-600 dark:text-emerald-400" />
            <div className="text-left">
              <p className="font-medium text-foreground">Uredi profil</p>
              <p className="text-xs text-muted-foreground">Posodobite svoje podatke</p>
            </div>
          </Link>
        </Button>

        <div className="relative">
          <Button
            variant="outline"
            className="h-auto w-full justify-start border-dashed py-3"
            disabled
          >
            <CalendarCheckIcon size={20} className="mr-3 text-amber-600 dark:text-amber-400" />
            <div className="text-left">
              <p className="font-medium text-foreground/70">Zahtevaj prost dan</p>
              <p className="text-xs text-muted-foreground">Oddajte prošnjo za dopust</p>
            </div>
          </Button>
          <Badge
            variant="secondary"
            className="absolute -top-2 right-2 text-[10px]"
          >
            Kmalu na voljo
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
