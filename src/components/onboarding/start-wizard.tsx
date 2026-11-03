"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Logo } from "@/components/ui/logo"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  SparkleIcon,
  SpinnerIcon,
  StorefrontIcon,
  XCircleIcon,
} from "@/components/icons"
import { PALETTE_OPTIONS } from "@/lib/palettes-client"
import { listProfileOptions } from "@/lib/profiles/registry"
import { checkSlugAvailability, createSalonOrganization } from "@/app/actions/onboarding"
import {
  WIZARD_DRAFT_KEY,
  clearDraftRaw,
  isDraftSubstantial,
  parseWizardDraft,
  readDraftRaw,
  safeResumeStep,
  serializeWizardDraft,
  writeDraftRaw,
  type WizardDraftData,
  type WizardDraftEnvelope,
} from "@/lib/onboarding/wizard-draft"
import { cn } from "@/lib/utils"

// Single-source activity options (EPIC #1 registry).
const ACTIVITY_OPTIONS = listProfileOptions()

// E4-4 — registry allowlists for draft validation (unknown ids fail closed).
const ALLOWED_VERTICAL_IDS = ACTIVITY_OPTIONS.map((v) => v.id)
const ALLOWED_PALETTE_IDS = PALETTE_OPTIONS.map((p) => p.id)

// Client-safe slugify (mirror of src/lib/tenant.ts, which is server-only)
function slugifyLocal(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics (č->c, š->s, ž->z)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type SlugStatus = "idle" | "checking" | "available" | "taken"

const STEPS = [
  { id: 1, label: "Dejavnost" },
  { id: 2, label: "Podjetje" },
  { id: 3, label: "Lastnik" },
] as const

// P1 #40 (onboarding audit 2026-11): ko je uporabnik že prijavljen,
// korak 3 NE ustvarja novega računa — e-pošta iz seje je odčitavana,
// gesla se ne sprašuje, podjetje se pripne obstoječemu računu (strežnik
// sam poveže organizacijo in osveži vlogo v seji).
export function StartWizard({
  authedEmail,
  authedName,
}: {
  authedEmail?: string | null
  authedName?: string | null
}) {
  const router = useRouter()
  const authed = Boolean(authedEmail)
  const authedDisplayName =
    authedName && authedName.trim().length >= 2 ? authedName.trim() : null

  const [step, setStep] = useState(1)
  const [creating, setCreating] = useState(false)

  // Step 1 — vertical & palette
  const [vertical, setVertical] = useState<string | null>(null)
  const [secondary, setSecondary] = useState<string | null>(null)
  const [palette, setPalette] = useState<string | null>(null)

  // Step 2 — salon details
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle")

  // Step 3 — owner
  // #40: prijavljen uporabnik — e-pošta je iz seje (nespremenljiva), ime
  // se predizpolni iz računa.
  const [ownerName, setOwnerName] = useState(authedDisplayName ?? "")
  const [email, setEmail] = useState(authedEmail ?? "")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // E4-4 — resume offer (set once on mount from localStorage; null = none).
  // While pending, storage still belongs to the saved draft.
  const [resumeOffer, setResumeOffer] = useState<WizardDraftEnvelope | null>(null)

  const selectedVertical = useMemo(
    () => ACTIVITY_OPTIONS.find((v) => v.id === vertical) ?? null,
    [vertical]
  )
  const selectedPalette = useMemo(
    () => PALETTE_OPTIONS.find((p) => p.id === palette) ?? null,
    [palette]
  )

  // Debounced slug availability check (state is set in change handlers;
  // this effect only schedules the async lookup)
  const checkIdRef = useRef(0)
  useEffect(() => {
    const trimmed = slug.trim()
    if (trimmed.length < 2) return
    const id = ++checkIdRef.current
    const timer = setTimeout(async () => {
      try {
        const res = await checkSlugAvailability(trimmed)
        if (checkIdRef.current !== id) return // stale response
        setSlugStatus(res.available ? "available" : "taken")
      } catch {
        if (checkIdRef.current !== id) return
        setSlugStatus("idle")
      }
    }, 450)
    return () => clearTimeout(timer)
  }, [slug])

  // E4-4 — draft persistence (localStorage, per browser). Load once on
  // mount; a substantial draft becomes an explicit resume question.
  // Passwords are structurally excluded from the draft shape.
  const pristineRef = useRef<WizardDraftData | null>(null)
  useEffect(() => {
    const result = parseWizardDraft(readDraftRaw(window.localStorage, WIZARD_DRAFT_KEY), {
      now: Date.now(),
      allowedVerticalIds: ALLOWED_VERTICAL_IDS,
      allowedPaletteIds: ALLOWED_PALETTE_IDS,
    })
    if (result.ok) {
      // Mount-time storage read cannot be a lazy initializer — SSR would
      // render a different first frame (hydration mismatch). Safe: the
      // offer state starts null on both server and client, and is only
      // revealed after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isDraftSubstantial(result.envelope.data)) setResumeOffer(result.envelope)
    } else if (result.reason !== "empty") {
      // malformed / stale / invalid — remove so the next visit starts clean
      clearDraftRaw(window.localStorage, WIZARD_DRAFT_KEY)
    }
  }, [])

  // Mirror meaningful progress into the draft. The first run only fixes
  // the mount baseline (storage untouched), so a pending draft can never
  // be wiped by a mount-time effect (incl. StrictMode double-invoke).
  useEffect(() => {
    const data: WizardDraftData = {
      step,
      vertical,
      secondary,
      palette,
      name,
      slug,
      slugTouched,
      ownerName,
      email,
    }
    const pristine = pristineRef.current
    if (pristine === null) {
      pristineRef.current = data
      return
    }
    if (
      pristine.step === data.step &&
      pristine.vertical === data.vertical &&
      pristine.secondary === data.secondary &&
      pristine.palette === data.palette &&
      pristine.name === data.name &&
      pristine.slug === data.slug &&
      pristine.slugTouched === data.slugTouched &&
      pristine.ownerName === data.ownerName &&
      pristine.email === data.email
    ) {
      return
    }
    // A resume offer is pending: storage still belongs to the saved
    // draft — the user's decision below applies or removes it.
    if (resumeOffer) return
    if (isDraftSubstantial(data)) {
      writeDraftRaw(
        window.localStorage,
        WIZARD_DRAFT_KEY,
        serializeWizardDraft(data, {
          now: Date.now(),
          allowedVerticalIds: ALLOWED_VERTICAL_IDS,
          allowedPaletteIds: ALLOWED_PALETTE_IDS,
        })
      )
    } else {
      clearDraftRaw(window.localStorage, WIZARD_DRAFT_KEY)
    }
  }, [step, vertical, secondary, palette, name, slug, slugTouched, ownerName, email, resumeOffer])

  // E4-4 — honest resume: restore the saved draft, but never land
  // further than the data actually allows (safeResumeStep). The slug
  // availability re-check runs automatically (the [slug] effect above).
  function applyResume() {
    if (!resumeOffer) return
    const d = resumeOffer.data
    setStep(safeResumeStep(d))
    setVertical(d.vertical)
    setSecondary(d.secondary)
    setPalette(d.palette)
    setName(d.name)
    setSlug(d.slug)
    setSlugTouched(d.slugTouched)
    setSlugStatus(d.slug.trim().length >= 2 ? "checking" : "idle")
    setOwnerName(d.ownerName)
    // #40: e-pošta prijavljenega uporabnika je avtoritativna — osnutek je
    // ne more preglasiti.
    setEmail(authedEmail ?? d.email)
    setResumeOffer(null)
  }

  function startFresh() {
    clearDraftRaw(window.localStorage, WIZARD_DRAFT_KEY)
    setResumeOffer(null)
  }

  // Auto-slug from salon name until the user edits the slug manually
  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) {
      const next = slugifyLocal(value)
      setSlug(next)
      setSlugStatus(next.trim().length < 2 ? "idle" : "checking")
    }
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true)
    const next = slugifyLocal(value)
    setSlug(next)
    setSlugStatus(next.trim().length < 2 ? "idle" : "checking")
  }

  function selectVertical(id: string) {
    setVertical(id)
    // Secondary must always differ from the primary (E2-4) — reset on change.
    setSecondary((prev) => (prev === id ? null : prev))
    const preset = ACTIVITY_OPTIONS.find((v) => v.id === id)
    if (preset) setPalette(preset.palette)
  }

  function validateStep(current: number): boolean {
    if (current === 1) {
      if (!vertical) {
        toast.error("Izberite panogo.", { description: "Izberite eno od panog za nadaljevanje." })
        return false
      }
      if (!palette) {
        toast.error("Izberite barvno paleto.")
        return false
      }
      return true
    }
    if (current === 2) {
      if (name.trim().length < 2) {
        toast.error("Ime salona mora imeti vsaj 2 znaka.")
        return false
      }
      if (slug.trim().length < 2) {
        toast.error("Vnesite URL naslov za vašo stran.")
        return false
      }
      if (slugStatus === "checking") {
        toast.error("Preverjam razpoložljivost URL naslova …")
        return false
      }
      if (slugStatus !== "available") {
        toast.error("Ta URL naslov ni prost. Izberite drugega.")
        return false
      }
      if (!palette) {
        toast.error("Izberite barvno paleto.")
        return false
      }
      return true
    }
    // Step 3
    if (ownerName.trim().length < 2) {
      toast.error("Vnesite ime in priimek.")
      return false
    }
    // #40: prijavljen uporabnik — e-pošta je fiksna iz seje, gesla ni.
    if (!authed) {
      if (!EMAIL_REGEX.test(email.trim())) {
        toast.error("Vnesite veljaven e-poštni naslov.")
        return false
      }
      if (password.length < 8) {
        toast.error("Geslo mora imeti vsaj 8 znakov.")
        return false
      }
      if (password !== confirmPassword) {
        toast.error("Gesli se ne ujemata.")
        return false
      }
    }
    return true
  }

  function goNext() {
    if (!validateStep(step)) return
    setStep((s) => Math.min(3, s + 1))
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1))
  }

  // E4-4 — truthful summary of what the saved draft contains (only
  // fields the owner actually filled; never a fabricated progress claim).
  const offerSummary = (() => {
    if (!resumeOffer) return null
    const parts: string[] = []
    const vLabel = ACTIVITY_OPTIONS.find((v) => v.id === resumeOffer.data.vertical)?.label
    if (vLabel) parts.push(`panoga: ${vLabel}`)
    const n = resumeOffer.data.name.trim()
    if (n) parts.push(`podjetje: ${n}`)
    return parts.length > 0 ? parts.join(" · ") : null
  })()

  async function handleSubmit() {
    if (!validateStep(3)) return
    setCreating(true)
    try {
      const res = await createSalonOrganization({
        name: name.trim(),
        slug: slug.trim(),
        vertical: vertical!,
        secondaryVertical: secondary,
        palette: palette!,
        ownerName: ownerName.trim(),
        // #40: prijavljen uporabnik — e-pošta iz seje, gesla ni (strežnik
        // poveže obstoječi račun in ne ustvari novega).
        email: (authed ? authedEmail! : email).trim(),
        password: authed ? "" : password,
      })

      if (!res.success) {
        toast.error(res.error ?? "Pri ustvarjanju podjetja je prišlo do napake. Poskusite znova.")
        setCreating(false)
        return
      }

      // E4-4 — tenant created: the draft served its purpose and must not
      // outlive the account (the next person on this browser starts clean).
      clearDraftRaw(window.localStorage, WIZARD_DRAFT_KEY)

      // #40: prijavljen uporabnik je ŽE prijavljen (strežnik je osvežil
      // sejo z novo vlogo/organizacijo) — prijava se ne ponavlja.
      if (!authed) {
        const login = await signIn("credentials", {
          email: email.trim(),
          password,
          redirect: false,
        })

        if (login?.error) {
          toast.error("Podjetje je ustvarjeno, avtomatska prijava pa ni uspela.", {
            description: "Prijavite se ročno z vašo e-pošto in geslom.",
            duration: 8000,
          })
          router.push("/login")
          return
        }
      }

      toast.success("Podjetje je ustvarjeno!", {
        description: `Vaša stran je na voljo na /s/${res.slug}`,
      })
      router.push("/dashboard?welcome=1")
      router.refresh()
    } catch {
      toast.error("Pri ustvarjanju podjetja je prišlo do napake. Poskusite znova.")
      setCreating(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" aria-label="Na začetno stran">
            <Logo variant="navbar" />
          </Link>
          <p className="text-sm text-muted-foreground">
            Imate že račun?{" "}
            <Link href="/login" className="font-medium text-primary-text hover:underline">
              Prijava
            </Link>
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">
        {/* E4-4 — resume question: an honest prompt over the saved draft,
            with a truthful summary and an explicit note that passwords
            are never stored. */}
        {resumeOffer && (
          <section
            aria-label="Nadaljevanje registracije"
            className="mb-8 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Nadaljuj, kjer si ostal?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  V tem brskalniku je shranjen nedokončan vnos
                  {offerSummary ? ` (${offerSummary})` : ""}. Gesel nikoli ne shranjujemo.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="outline" onClick={startFresh} className="min-h-11">
                  Začni na novo
                </Button>
                <Button onClick={applyResume} className="min-h-11">
                  <ArrowRightIcon size={16} weight="bold" className="mr-1.5" />
                  Nadaljuj
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Step indicator */}
        <nav aria-label="Koraki registracije" className="mb-8">
          <ol className="flex items-center">
            {STEPS.map((s, i) => {
              const isActive = s.id === step
              const isDone = s.id < step
              return (
                <li key={s.id} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      aria-current={isActive ? "step" : undefined}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                        isDone && "border-primary bg-primary text-primary-foreground",
                        isActive && "border-primary bg-primary/10 text-primary-text",
                        !isActive && !isDone && "border-border bg-background text-muted-foreground"
                      )}
                    >
                      {isDone ? <CheckCircleIcon size={18} weight="bold" /> : s.id}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "mx-3 mb-6 h-px flex-1 sm:mx-4",
                        s.id < step ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>

        {/* Step 1 — Vertical */}
        {step === 1 && (
          <section aria-labelledby="step-1-title">
            <h1 id="step-1-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Kaj je vaša dejavnost?
            </h1>
            <p className="mt-2 text-muted-foreground">
              Izberite dejavnost — pripravili vam bomo module, katalog, obrazce, procese in vsebino strani.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {ACTIVITY_OPTIONS.map((v) => {
                const paletteOption = PALETTE_OPTIONS.find((p) => p.id === v.palette)
                const isSelected = vertical === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectVertical(v.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected && "border-primary bg-primary/5 ring-2 ring-primary/20"
                    )}
                  >
                    <span className="mt-0.5 flex shrink-0 items-center">
                      <span
                        className="h-5 w-5 rounded-full ring-1 ring-border"
                        style={{ backgroundColor: paletteOption?.primary ?? "#000000" }}
                      />
                      <span
                        className="-ml-2 h-5 w-5 rounded-full ring-1 ring-border"
                        style={{ backgroundColor: paletteOption?.accent ?? "#d4af37" }}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold leading-tight">{v.label}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{v.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Secondary activity (E2-4): optional capability union — the primary
                activity keeps terminology, forms, workflows and site content. */}
            <div className="mt-8 rounded-xl border bg-muted/30 p-4 sm:p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">Dodatna dejavnost (neobvezno)</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Izberite še drugo dejavnost — moduli obeh se združijo (npr. vulkanizer + trgovina).
                    Jezik, obrazci in vsebina strani ostanejo od prve dejavnosti.
                  </p>
                </div>
                <div className="mt-3 shrink-0 sm:mt-0 sm:w-64">
                  <Select
                    value={secondary ?? "none"}
                    onValueChange={(v) => setSecondary(v === "none" ? null : v)}
                    disabled={!vertical}
                  >
                    <SelectTrigger aria-label="Dodatna dejavnost">
                      <SelectValue placeholder="Izberite dodatno dejavnost" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Brez dodatne dejavnosti</SelectItem>
                      {ACTIVITY_OPTIONS.filter((v) => v.id !== vertical).map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Step 2 — Salon */}
        {step === 2 && (
          <section aria-labelledby="step-2-title">
            <h1 id="step-2-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Podatki o podjetju
            </h1>
            <p className="mt-2 text-muted-foreground">
              To se bo prikazalo vašim strankam na vaši spletni strani.
            </p>

            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="company-name">Ime podjetja</Label>
                <Input
                  id="company-name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="npr. Studio Nika"
                  maxLength={60}
                  autoComplete="organization"
                  disabled={creating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="salon-slug">URL naslov</Label>
                <Input
                  id="salon-slug"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="npr. studio-nika"
                  maxLength={40}
                  disabled={creating}
                />
                <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-mono text-muted-foreground">
                    Vaša stran: <span className="text-foreground">/s/{slug || "…"}</span>
                  </span>
                  {slugStatus === "checking" && (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <SpinnerIcon size={14} className="animate-spin" /> Preverjam …
                    </span>
                  )}
                  {slugStatus === "available" && (
                    <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircleIcon size={16} weight="fill" /> Prosto
                    </span>
                  )}
                  {slugStatus === "taken" && (
                    <span className="flex items-center gap-1.5 font-medium text-destructive">
                      <XCircleIcon size={16} weight="fill" /> Zasedeno
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Paleta</Label>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                  {PALETTE_OPTIONS.map((p) => {
                    const isSelected = palette === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        title={p.label}
                        aria-label={`Paleta ${p.label}`}
                        aria-pressed={isSelected}
                        onClick={() => setPalette(p.id)}
                        className={cn(
                          "flex h-11 w-full items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        )}
                      >
                        <span
                          className="h-9 w-9 rounded-full ring-1 ring-black/10"
                          style={{
                            background: `linear-gradient(135deg, ${p.primary} 50%, ${p.accent} 50%)`,
                          }}
                        />
                      </button>
                    )
                  })}
                </div>
                {selectedPalette && (
                  <p className="text-sm text-muted-foreground">
                    Izbrana paleta: <span className="font-medium text-foreground">{selectedPalette.label}</span>
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Step 3 — Owner */}
        {step === 3 && (
          <section aria-labelledby="step-3-title">
            <h1 id="step-3-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Vaš račun
            </h1>
            <p className="mt-2 text-muted-foreground">
              {authed
                ? "Podjetje povežemo z vašim obstoječim računom — brez nove prijave."
                : "S tem računom upravljate salon, rezervacije in trgovino."}
            </p>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="owner-name">Ime in priimek</Label>
                <Input
                  id="owner-name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="npr. Nika Novak"
                  autoComplete="name"
                  disabled={creating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner-email">E-pošta</Label>
                {authed ? (
                  <>
                    <Input
                      id="owner-email"
                      type="email"
                      value={email}
                      readOnly
                      aria-readonly="true"
                      autoComplete="email"
                      disabled={creating}
                      className="bg-muted/60"
                    />
                    <p className="text-muted-foreground text-xs">
                      Prijavljeni ste s tem računom — podjetje se poveže nanj.
                    </p>
                  </>
                ) : (
                  <Input
                    id="owner-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="npr. nika@studionika.si"
                    autoComplete="email"
                    disabled={creating}
                  />
                )}
              </div>

              {!authed && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="owner-password">Geslo</Label>
                    <Input
                      id="owner-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Najmanj 8 znakov"
                      autoComplete="new-password"
                      disabled={creating}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="owner-password-confirm">Potrditev gesla</Label>
                    <Input
                      id="owner-password-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ponovite geslo"
                      autoComplete="new-password"
                      disabled={creating}
                    />
                  </div>
                </>
              )}

              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <SparkleIcon size={18} weight="fill" className="mt-0.5 shrink-0 text-primary-text" />
                  <span>
                    Po registraciji dobite takoj svojo spletno stran z rezervacijami in trgovino.
                    {slug ? (
                      <>
                        {" "}
                        Vaša stran bo na voljo na{" "}
                        <span className="font-mono font-medium text-foreground">/s/{slug}</span>.
                      </>
                    ) : null}
                  </span>
                </p>
                {selectedVertical && (
                  <p className="mt-2 flex items-start gap-2.5 text-sm text-muted-foreground">
                    <StorefrontIcon size={18} weight="fill" className="mt-0.5 shrink-0 text-primary-text" />
                    <span>
                      Panoga <span className="font-medium text-foreground">{selectedVertical.label}</span>{" "}
                      prihaja s pripravljenim katalogom storitev, ki ga lahko poljubno urejate.
                    </span>
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Sticky footer */}
      <footer className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {step > 1 ? (
            <Button variant="outline" onClick={goBack} disabled={creating} className="min-h-11">
              <ArrowLeftIcon size={16} weight="bold" className="mr-1.5" />
              Nazaj
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}

          {step < 3 ? (
            <Button onClick={goNext} className="min-h-11">
              Naprej
              <ArrowRightIcon size={16} weight="bold" className="ml-1.5" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={creating} className="min-h-11">
              {creating ? (
                <>
                  <SpinnerIcon size={16} className="mr-1.5 animate-spin" />
                  Ustvarjam salon …
                </>
              ) : (
                "Ustvari podjetje"
              )}
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
