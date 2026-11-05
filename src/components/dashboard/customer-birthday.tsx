"use client"

// #95 BIRTHDAY — rojstni dan per stranko (vrstica tabele). Datum je
// koledarski podatek (yyyy-MM-dd); BIRTHDAY kampanja ga bere kot
// mesec-dan. Pravzaprav isti vzorec kot CustomerTags: urejanje na klik,
// shranjevanje prek org-scoped akcije, uspeh osveži seznam.

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateCustomerBirthday } from "@/app/actions/users"

export function CustomerBirthday({
  customerId,
  dateOfBirth,
  labels,
}: {
  customerId: string
  /** "yyyy-MM-dd" ali null (ni nastavljen). */
  dateOfBirth: string | null
  labels: { edit: string; save: string; cancel: string }
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(dateOfBirth ?? "")
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const res = await updateCustomerBirthday(customerId, value ? value : null)
      if (res.success) {
        toast.success(labels.save)
        setEditing(false)
        router.refresh()
      } else {
        toast.error(res.error ?? labels.save)
      }
    })
  }

  if (editing) {
    return (
      <div className="flex min-w-44 flex-col gap-1.5">
        <Input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          aria-label={labels.edit}
        />
        <div className="flex gap-1.5">
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? "…" : labels.save}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(false)
              setValue(dateOfBirth ?? "")
            }}
            disabled={pending}
          >
            {labels.cancel}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-left text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      aria-label={labels.edit}
    >
      {dateOfBirth ?? <span className="text-muted-foreground">Dodaj rojstni dan</span>}
    </button>
  )
}
