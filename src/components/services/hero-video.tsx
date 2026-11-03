"use client"

import { useRef, useState, useSyncExternalStore } from "react"
import { PauseIcon, PlayIcon } from "@/components/icons"
import { DEFAULT_SERVICES_MEDIA } from "@/lib/default-assets"

// P1 #18 (audit-2026-11): centralized defaults
const DEFAULT_VIDEO_WEBM = DEFAULT_SERVICES_MEDIA.videoWebm
const DEFAULT_VIDEO_MP4 = DEFAULT_SERVICES_MEDIA.videoMp4

const subscribeReducedMotion = (cb: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}

interface HeroVideoProps {
  videoUrl?: string | null
  posterUrl?: string | null
}

/**
 * Services page hero. P1 #11 (audit-2026-11): respects prefers-reduced-motion
 * and Save-Data (no autoplay), ships a pause/play control (WCAG 2.2.2) and
 * drops the manual timeupdate rewind hack (loop handles it).
 */
export function HeroVideo({ videoUrl, posterUrl }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(true)

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true
  )

  const saveData =
    typeof navigator !== "undefined" &&
    "connection" in navigator &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Boolean((navigator as any).connection?.saveData)

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

  const shouldAutoplay = !reducedMotion && !saveData

  return (
    <>
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <video
          ref={videoRef}
          autoPlay={shouldAutoplay}
          muted
          playsInline
          loop
          preload="metadata"
          className="h-full w-full object-cover"
          poster={posterUrl || undefined}
          onLoadedMetadata={(e) => {
            // Reduced motion / data saver: render the first frame, paused.
            if (!shouldAutoplay) e.currentTarget.pause()
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
        {/* WCAG 2.2.2: pause control, ≥44 px target, state announced. */}
        <button
          type="button"
          onClick={togglePlay}
          aria-pressed={!playing}
          aria-label={playing ? "Ustavi video" : "Predvajaj video"}
          className="bg-black/40 text-white hover:bg-black/60 focus-visible:ring-primary absolute bottom-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {playing ? <PauseIcon size={20} aria-hidden /> : <PlayIcon size={20} aria-hidden />}
        </button>
      </div>

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 z-10 bg-black/50 dark:bg-black/40" />
    </>
  )
}
