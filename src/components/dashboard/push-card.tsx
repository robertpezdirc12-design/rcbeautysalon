"use client"

// #99: kartica "Push obvestila" v nastavitvah — vklop/izklop naročnine.
// Pošteno: brez VAPID ključev pokaže "ni nastavljeno na strežniku",
// brez podpore brskalnika pokaže tisto, kar dejansko velja.

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getPushConfig, subscribePush, unsubscribePush } from "@/app/actions/push"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export function PushCard() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [supported, setSupported] = useState(true)
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    // Mount-time brskalniška zmožnost — SSR ne more izrisati te vrednosti
    // (isti vzorec kot E4-4 resume berka v start-wizard).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(
      typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    )
    getPushConfig()
      .then((c) => {
        setConfigured(c.configured)
        setSubscribed(c.subscribed)
      })
      .catch(() => setConfigured(false))
  }, [])

  async function currentSubscription() {
    const reg = await navigator.serviceWorker.ready
    return reg.pushManager.getSubscription()
  }

  function enable() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== "granted") {
          toast.error("Obvestila ste zavrnili v brskalniku.")
          return
        }
        const config = await getPushConfig()
        if (!config.configured || !config.vapidPublicKey) {
          toast.error("Push ni nastavljen na strežniku.")
          return
        }
        const reg = await navigator.serviceWorker.ready
        let sub = await reg.pushManager.getSubscription()
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
              config.vapidPublicKey
            ) as BufferSource,
          })
        }
        const json = sub.toJSON()
        const res = await subscribePush({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        })
        if (res.success) {
          setSubscribed(true)
          toast.success("Obvestila omogočena.")
          router.refresh()
        } else {
          toast.error(res.error ?? "Naročnina ni uspela.")
        }
      } catch {
        toast.error("Naročnina ni uspela. Poskusite znova.")
      }
    })
  }

  function disable() {
    startTransition(async () => {
      try {
        const sub = await currentSubscription()
        if (sub) await sub.unsubscribe()
        await unsubscribePush(sub?.endpoint ?? "")
        setSubscribed(false)
        toast.success("Obvestila izklopljena.")
        router.refresh()
      } catch {
        toast.error("Izklop ni uspel. Poskusite znova.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Push obvestila</CardTitle>
        <CardDescription>
          Nov termin in odpoved takoj na telefonu/računalniku — brez odpiranja
          plošče. Podatki ostanejo v aplikaciji; push je samo obvestilo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!supported ? (
          <p className="text-muted-foreground text-sm">
            Ta brskalnik ne podpira push obvestil.
          </p>
        ) : configured === false ? (
          <p className="text-muted-foreground text-sm">
            Push ni nastavljen na strežniku (manjkajo VAPID ključi).
          </p>
        ) : configured === null ? (
          <p className="text-muted-foreground text-sm">Preverjam …</p>
        ) : subscribed ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Obvestila so omogočena.</p>
            <Button variant="outline" size="sm" onClick={disable} disabled={pending}>
              Izklopi
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              Omogočite, da vas opozorimo ob novem terminu ali odpovedi.
            </p>
            <Button size="sm" onClick={enable} disabled={pending}>
              {pending ? " …" : "Omogoči obvestila"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
