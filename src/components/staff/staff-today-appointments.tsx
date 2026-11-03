import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ClockIcon, CheckCircleIcon } from "@/components/icons"
import { format } from "date-fns"

interface AppointmentService {
  service: {
    name: string
    duration: number
    price: number
  }
}

const statusLabels: Record<string, string> = {
  PENDING: "V čakanju",
  CONFIRMED: "Potrjeno",
  COMPLETED: "Zaključeno",
  CANCELLED: "Odpovedano",
  NO_SHOW: "Ni se pojavil",
}

interface Appointment {
  id: string
  startTime: Date
  endTime: Date
  status: string
  customerName: string
  totalPrice: number
  services: AppointmentService[]
}

interface StaffTodayAppointmentsProps {
  appointments: Appointment[]
}

export function StaffTodayAppointments({
  appointments,
}: StaffTodayAppointmentsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Današnji termini</CardTitle>
        <CardDescription>Vaši termini za današnji dan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {appointments.map((appointment, index) => {
          const serviceName =
            appointment.services[0]?.service.name || "Storitev"
          const totalDuration = appointment.services.reduce(
            (acc, s) => acc + s.service.duration,
            0
          )

          return (
            <div key={appointment.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Time */}
                  <div className="w-20 text-sm font-medium">
                    {format(new Date(appointment.startTime), "HH:mm")}
                  </div>

                  {/* Customer Avatar */}
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary-text">
                      {appointment.customerName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>

                  {/* Details */}
                  <div>
                    <p className="font-medium">{appointment.customerName}</p>
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <span>{serviceName}</span>
                      {appointment.services.length > 1 && (
                        <span>+{appointment.services.length - 1}</span>
                      )}
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <ClockIcon size={14} />
                        {totalDuration} min
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      appointment.status === "COMPLETED"
                        ? "default"
                        : appointment.status === "CONFIRMED"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {appointment.status === "COMPLETED" && (
                      <CheckCircleIcon size={14} className="mr-1" />
                    )}
                    {statusLabels[appointment.status] || appointment.status}
                  </Badge>

                  {appointment.status !== "COMPLETED" && (
                    <Button size="sm" variant="outline">
                      Označi kot zaključeno
                    </Button>
                  )}
                </div>
              </div>

              {index < appointments.length - 1 && (
                <Separator className="mt-4" />
              )}
            </div>
          )
        })}

        {appointments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground">
              Za danes ni razporejenih terminov
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
