"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateCustomerTags } from "@/app/actions/users"

// #91 — urejevalnik oznak per stranko (vrstica tabele). Shranjuje
// prek org-scoped akcije; neuspeh je viden (toast), uspeh osveži seznam.
export function CustomerTags({
  customerId,
  tags,
  labels,
}: {
  customerId: string
  tags: string[]
  labels: {
    edit: string
    save: string
    cancel: string
    placeholder: string
    addHint: string
  }
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(tags.join(", "))
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const parsed = value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
      const res = await updateCustomerTags(customerId, parsed)
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
      <div className="flex min-w-56 flex-col gap-1.5">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={labels.placeholder}
          maxLength={400}
          disabled={pending}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              save()
            }
            if (e.key === "Escape") setEditing(false)
          }}
          autoFocus
        />
        <p className="text-muted-foreground text-xs">{labels.addHint}</p>
        <div className="flex gap-1.5">
          <Button size="sm" onClick={save} disabled={pending}>
            {labels.save}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
            {labels.cancel}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(tags.join(", "))
        setEditing(true)
      }}
      className="group flex max-w-48 flex-wrap items-center gap-1 text-left"
      title={labels.edit}
    >
      {tags.length === 0 ? (
        <span className="text-muted-foreground text-xs underline-offset-2 group-hover:underline">
          + {labels.edit}
        </span>
      ) : (
        tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-text"
          >
            {tag}
          </span>
        ))
      )}
    </button>
  )
}
