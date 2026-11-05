"use client"

// #99: registracija service workerja (samo push kanal — brez cache
// strategij). Tiha napaka: SW je izboljšava, ne pogoj delovanja.

import { useEffect } from "react"

export function PushSetup() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    const timer = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // tiho — brez SW deluje vse razen push
      })
    }, 1500) // po priključitvi strani, ne blokiramo
    return () => clearTimeout(timer)
  }, [])

  return null
}
