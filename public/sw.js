// #99 — Service Worker: push obvestila za lastnika (VAPID Web Push).
// Minimalen, brez strategij predpomnjenja (apl. se posodablja sama;
// SW je tu SAMO push kanal — ničesar ne cache-a, ne posega v OAuth).

self.addEventListener("install", () => {
  // Brez skipWaiting: nova verzija prevzame po naravnem ponovnem odpiranju.
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

// Push: payload je JSON { title, body, url } (src/lib/push/core.ts).
self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || "MARKEC"
  const options = {
    body: data.body || "",
    // tag združi več obvestil istega dogodka (ne poplavi pladnja).
    tag: data.kind || "markec",
    data: { url: data.url || "/dashboard" },
    // brez ikone: privzeta sistemska (manaifest ikone so SVG any-size).
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Klik: odpri/fokusiraj dashboard na ciljni ruti.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/dashboard"
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })()
  )
})
