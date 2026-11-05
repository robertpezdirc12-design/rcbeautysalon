"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { setServiceIntakeForm } from "@/app/actions/services"

// #96 — izbira sprejemnega obrazca za storitev (obveznega/neobveznega
// pred obiskom). Obrazci so lastnikovi FormDefinition-i (urejevalnik
// /dashboard/forms); tukaj jih samo povežemo s storitvijo.
export function ServiceIntakeFormPicker({
  serviceId,
  currentFormId,
  options,
}: {
  serviceId: string
  currentFormId: string | null
  options: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [value, setValue] = useState<string>(currentFormId ?? "none")
  const [pending, startTransition] = useTransition()

  function save(next: string) {
    setValue(next)
    startTransition(async () => {
      const res = await setServiceIntakeForm(serviceId, next === "none" ? null : next)
      if (res.success) {
        toast.success("Sprejemni obrazec shranjen.")
        router.refresh()
      } else {
        toast.error(res.error ?? "Shranjevanje ni uspelo.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sprejemni obrazec (neobvezno)</CardTitle>
        <CardDescription>
          Gost izpolni obrazec ob rezervaciji (npr. kontraindikacije, merilni podatki).
          Obrazce urejate v predalu Obrazci; odgovori se vidijo v detajlu termina.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-sm space-y-2">
        <Label htmlFor="intake-form" className="text-xs">
          Obrazec za to storitev
        </Label>
        <Select value={value} onValueChange={save} disabled={pending}>
          <SelectTrigger id="intake-form">
            <SelectValue placeholder="Brez obrazca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Brez obrazca</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {options.length === 0 && (
          <p className="text-muted-foreground text-xs">
          Nimate še nobenega obrazca — ustvarite ga v predalu Obrazci.
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => save("none")}
          disabled={pending || value === "none"}
        >
          Odstrani obrazec
        </Button>
      </CardContent>
    </Card>
  )
}
