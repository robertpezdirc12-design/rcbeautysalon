"use client"

// #95 (AD-03): potrditveni gumb odjave — GET stran brez stranskih
// učinkov; odjava se zgodi ŠELE ob eksplicitnem kliku (POST akcija).

import { useState, useTransition } from "react"

import { confirmUnsubscribe } from "@/app/actions/unsubscribe"
import { Button } from "@/components/ui/button"

export function ConfirmUnsubscribe({ token }: { token: string }) {
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (done) {
    return (
      <p className="text-foreground text-sm font-medium" role="status">
        Odjavljeni. Več kampanjskih sporočil od tega pošiljatelja ne boste
        prejemali.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={() =>
          startTransition(async () => {
            const res = await confirmUnsubscribe(token)
            if (res.success) {
              setDone(true)
            } else {
              setError(res.error ?? "Odjava ni uspela. Poskusite znova.")
            }
          })
        }
        disabled={pending}
        variant="outline"
      >
        {pending ? "Potrjujem …" : "Potrdi odjavo"}
      </Button>
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
