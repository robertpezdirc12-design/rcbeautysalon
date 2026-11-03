"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import Image from "next/image"
import { PauseIcon, PlayIcon } from "@/components/icons"
import { DEFAULT_HERO } from "@/lib/default-assets"

// P1 #18 (audit-2026-11): fallback defaults now come from the centralized
// default-assets module (single source of truth for third-party media).
const DEFAULT_VIDEO_WEBM = DEFAULT_HERO.videoWebm
const DEFAULT_VIDEO_MP4 = DEFAULT_HERO.videoMp4
const DEFAULT_POSTER = DEFAULT_HERO.poster

// Media-query + connection subscriptions (stable per document).
function subscribeMedia(query: string) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const mq = window.matchMedia(query)
  const cb = () => {}
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}

const subscribeReducedMotion = () => subscribeMedia("(prefers-reduced-motion: reduce)")

const subscribeCoarsePointer = () => subscribeMedia("(pointer: coarse)")

interface HeroVideoProps {
  imageUrl?: string | null
  videoUrl?: string | null
  posterUrl?: string | null
  /** Accessible description of the fallback hero image (e.g. hero heading). */
  alt?: string
}

/**
 * P1 #11 (audit-2026-11): the hero background video respects
 * prefers-reduced-motion and Save-Data (poster only, nothing downloaded),
 * lazy-starts after mount instead of preload="auto" (2.3 MB on cold load),
 * removes the manual rewind hack (loop is enough), and ships a keyboard
 * accessible pause/play control (WCAG 2.2.2 Pause, Stop, Hide).
 */
export function HeroVideo({ imageUrl, videoUrl, posterUrl, alt }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const poster = posterUrl || imageUrl || DEFAULT_POSTER

  // useSyncExternalStore avoids setState-in-effect hydration mismatches:
  // server renders the conservative default (no video), client re-evaluates.
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true
  )
  const isCoarsePointer = useSyncExternalStore(
    subscribeCoarsePointer,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => true
  )

  const [playing, setPlaying] = useState(true)
  const [started, setStarted] = useState(false)

  // Start playback after mount (idle) — never a blocking preload="auto".
  useEffect(() => {
    if (reducedMotion) return
    const video = videoRef.current
    if (!video) return
    const kick = () => {
      setStarted(true)
      video.play().catch(() => {
        /* autoplay blocked — the poster stays, user can press play */
      })
    }
    const id = setTimeout(kick, 200)
    return () => clearTimeout(id)
  }, [reducedMotion])

  // Mobile / data-saver clients don't get the video at all.
  const saveData =
    typeof navigator !== "undefined" &&
    "connection" in navigator &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Boolean((navigator as any).connection?.saveData)

  const videoAllowed = !reducedMotion && !saveData && !(isCoarsePointer && videoUrl)
  const showVideo = videoAllowed && started

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
      setPlaying(true)
    } else {
      video.pause()
      setPlaying(false)
    }
  }

  return (
    <>
      {/* Background Video / Image */}
      <div className="absolute inset-0">
        {showVideo ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              loop
              preload="none"
              className="h-full w-full object-cover"
              poster={poster}
              style={{
                objectFit: "cover",
              }}
            >
              {videoUrl ? (
                <source
                  src={videoUrl}
                  type={videoUrl.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4"}
                />
              ) : (
                <>
                  <source src={DEFAULT_VIDEO_WEBM} type="video/webm" />
                  <source src={DEFAULT_VIDEO_MP4} type="video/mp4" />
                </>
              )}
            </video>
            {/* WCAG 2.2.2: visible pause control, ≥44 px target, keyboard
                reachable, state announced via aria-pressed/label. */}
            <button
              type="button"
              onClick={togglePlay}
              aria-pressed={!playing}
              aria-label={playing ? "Ustavi video" : "Predvajaj video"}
              className="bg-black/40 text-white hover:bg-black/60 focus-visible:ring-primary absolute bottom-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {playing ? <PauseIcon size={20} aria-hidden /> : <PlayIcon size={20} aria-hidden />}
            </button>
          </>
        ) : (
          <Image
            src={poster}
            alt={alt ?? ""}
            fill
            priority
            className="h-full w-full object-cover"
            sizes="100vw"
          />
        )}
        {/* Overlay to improve text readability */}
        <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/50 to-black/60 dark:from-black/70 dark:via-black/60 dark:to-black/70 backdrop-blur-[1.5px]" />
      </div>
    </>
  )
}
