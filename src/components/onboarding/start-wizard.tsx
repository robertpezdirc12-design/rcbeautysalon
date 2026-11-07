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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import {
  SKD_AREAS,
  SKD_MODULE_LABELS,
  SKD_SECTIONS,
  suggestModulesForSkd,
} from "@/lib/skd/catalog"
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

// lastnik (7. 11. 2026): 12 kartic → EN spustni meni, razporejen po logiki
// imenika (SKD 2025 področja). "Univerzalno" je posebna skupina na dnu —
// ni področje, ampak železna osnova platforme.
const ACTIVITY_GROUP_MAP: { areaKey: string | null; ids: string[] }[] = [
  { areaKey: "beauty", ids: ["beauty", "frizer", "barber", "nails", "cosmetica", "massage", "epilation"] },
  { areaKey: "vehicles", ids: ["tire-service", "mehanik"] },
  { areaKey: "crafts", ids: ["seamstress"] },
  { areaKey: "agriculture", ids: ["beekeeping"] },
  { areaKey: null, ids: ["generic"] },
]

const GROUPED_ACTIVITIES = ACTIVITY_GROUP_MAP.map(({ areaKey, ids }) => ({
  label:
    areaKey != null
      ? SKD_AREAS.find((a) => a.key === areaKey)?.name ?? "Drugo"
      : "Univerzalno",
  options: ids
    .map((id) => ACTIVITY_OPTIONS.find((v) => v.id === id))
    .filter((v): v is (typeof ACTIVITY_OPTIONS)[number] => !!v),
})).filter((g) => g.options.length > 0)

/** Grupirani SelectItem-i — skupna uporaba za glavno in dodatno dejavnost. */
function GroupedActivityItems({ excludeId }: { excludeId?: string | null }) {
  return (
    <>
      {GROUPED_ACTIVITIES.map((group) => (
        <SelectGroup key={group.label}>
          <SelectLabel>{group.label}</SelectLabel>
          {group.options
            .filter((v) => v.id !== excludeId)
            .map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.label}
              </SelectItem>
            ))}
        </SelectGroup>
      ))}
    </>
  )
}

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
  initialVertical = null,
}: {
  authedEmail?: string | null
  authedName?: string | null
  /** P1 #66: deep-link preselect — /start?vertical=<id> (validated upstream). */
  initialVertical?: string | null
}) {
  const router = useRouter()
  const authed = Boolean(authedEmail)
  const authedDisplayName =
    authedName && authedName.trim().length >= 2 ? authedName.trim() : null

  const [step, setStep] = useState(1)
  const [creating, setCreating] = useState(false)

  // Step 1 — vertical & palette
  // P1 #66: deep-link preselect — the landing's trade cards land here with
  // the activity already chosen; "Naprej" is enabled immediately.
  const [vertical, setVertical] = useState<string | null>(initialVertical)
  const [secondary, setSecondary] = useState<string | null>(null)
  // #81: `palette` is the owner's EXPLICIT override; the effective value
  // follows the activity's preset so a deep-linked activity alone is enough
  // to advance (the palette picker lives in step 2 — it must not gate step 1).
  const [palette, setPalette] = useState<string | null>(null)
  const effectivePalette =
    palette ?? ACTIVITY_OPTIONS.find((v) => v.id === vertical)?.palette ?? null

  // Step 2 — salon details
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle")
  // #100-nadaljevanje — javni kontaktni telefon (korak 2): neobvezen; gre v
  // SalonConfig.phone in zadostuje "kontaktni kanal" vratam objave.
  const [contactPhone, setContactPhone] = useState("")

  // P2 #88 — second-level answers (step 2): optional, never blocking.
  // "solo" removes the staff step from the activation checklist;
  // onlineBooking "no" rewords the publish step — the same answers the
  // guided-entry wizard persists on Organization.onboardingAnswers.
  const [teamSize, setTeamSize] = useState<"solo" | "small" | "team" | null>(null)
  const [onlineBooking, setOnlineBooking] = useState<"yes" | "no" | null>(null)

  // F1 #100 — SKD 2025 izbira (nasvet, ne zaklep) + ekspliciten preskok
  // dejavnosti. Preskok ustvari generično osnovo; module lastnik ureja
  // kasneje (modules-configurator) — nič ni zaklenjeno.
  const [skdCodes, setSkdCodes] = useState<string[]>([])
  const [customTags, setCustomTags] = useState<string[]>([])
  const [skdSearch, setSkdSearch] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [skippedVertical, setSkippedVertical] = useState(false)
  // lastnik (7. 11. 2026): SKD katalog je zložljiv — privzeto zaprt.
  const [skdOpen, setSkdOpen] = useState(false)

  const skdSuggestions = useMemo(
    () => suggestModulesForSkd(skdCodes),
    [skdCodes]
  )
  const skdFiltered = useMemo(() => {
    const q = skdSearch.trim().toLowerCase()
    if (!q) return { areas: SKD_AREAS, sections: SKD_SECTIONS }
    return {
      areas: SKD_AREAS.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.sections.some((s) => s.toLowerCase() === q)
      ),
      sections: SKD_SECTIONS.filter(
        (s) =>
          s.name.toLowerCase().includes(q) || s.code.toLowerCase() === q
      ),
    }
  }, [skdSearch])

  function toggleSkdCode(code: string) {
    setSkdCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  function addCustomTag() {
    const value = tagInput.trim().slice(0, 40)
    if (!value) return
    setCustomTags((prev) => (prev.includes(value) ? prev : [...prev, value].slice(0, 10)))
    setTagInput("")
  }

  // F1: preskok = izbira brez dejavnosti (generična osnova). SKD oznake
  // ostanejo — so nasvet za kasnejše urejanje modulov, ne panoga.
  function skipActivity() {
    setSkippedVertical(true)
    setVertical(null)
    setSecondary(null)
  }

  function unSkipActivity() {
    setSkippedVertical(false)
  }

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
    () => PALETTE_OPTIONS.find((p) => p.id === effectivePalette) ?? null,
    [effectivePalette]
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
      contactPhone,
      teamSize,
      onlineBooking,
      skdCodes,
      customTags,
      verticalSkipped: skippedVertical,
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
      pristine.email === data.email &&
      pristine.contactPhone === data.contactPhone &&
      pristine.teamSize === data.teamSize &&
      pristine.onlineBooking === data.onlineBooking &&
      pristine.skdCodes.length === data.skdCodes.length &&
      pristine.skdCodes.every((c, i) => c === data.skdCodes[i]) &&
      pristine.customTags.length === data.customTags.length &&
      pristine.customTags.every((c, i) => c === data.customTags[i]) &&
      pristine.verticalSkipped === data.verticalSkipped
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
  }, [step, vertical, secondary, palette, name, slug, slugTouched, ownerName, email, contactPhone, teamSize, onlineBooking, skdCodes, customTags, skippedVertical, resumeOffer])

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
    // #100-nadaljevanje: telefon se obnovi z osnutkom (korak 2).
    // #40: e-pošta prijavljenega uporabnika je avtoritativna — osnutek je
    // ne more preglasiti.
    setEmail(authedEmail ?? d.email)
    // P2 #88: drugonivojski odgovori se obnovita skupaj z osnutkom.
    setContactPhone(d.contactPhone)
    setTeamSize(d.teamSize)
    setOnlineBooking(d.onlineBooking)
    // F1 #100: SKD izbira in preskok se obnovita z osnutkom.
    setSkdCodes(d.skdCodes)
    setCustomTags(d.customTags)
    setSkippedVertical(d.verticalSkipped)
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
    // F1: izbira dejavnosti razveljavi preskok (nasprotna pot ostaja).
    setSkippedVertical(false)
    // Secondary must always differ from the primary (E2-4) — reset on change.
    setSecondary((prev) => (prev === id ? null : prev))
    const preset = ACTIVITY_OPTIONS.find((v) => v.id === id)
    if (preset) setPalette(preset.palette)
  }

  function validateStep(current: number): boolean {
    if (current === 1) {
      // F1 #100 (AD-05): dejavnost ni obvezna — veljavna sta izbira panoge
      // ali ekspliciten preskok.
      if (!vertical && !skippedVertical) {
        toast.error("Izberite panogo ali preskočite dejavnost.", {
          description: "Preskok ustvari generično osnovo — module nastavite kasneje.",
        })
        return false
      }
      // #81: no palette gate here — the picker is rendered in step 2, and a
      // deep-linked activity already carries its preset palette forward.
      return true
    }
    if (current === 2) {
      if (name.trim().length < 2) {
        toast.error("Ime podjetja mora imeti vsaj 2 znaka.")
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
      // #81: safety net — with an activity chosen the preset always provides
      // a palette, so this can only fail if the state is corrupted.
      if (!effectivePalette) {
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
        // F1 #100: ob preskoku je vertical prazen (strežnik vzame generic).
        vertical: vertical ?? "",
        secondaryVertical: secondary,
        palette: effectivePalette!,
        ownerName: ownerName.trim(),
        // #40: prijavljen uporabnik — e-pošta iz seje, gesla ni (strežnik
        // poveže obstoječi račun in ne ustvari novega).
        email: (authed ? authedEmail! : email).trim(),
        password: authed ? "" : password,
        // #100-nadaljevanje: javni kontaktni telefon (neobvezen).
        contactPhone: contactPhone.trim() || undefined,
        // P2 #88: odgovora iz koraka 2 — neobvezna, nikoli ne blokirata.
        teamSize,
        onlineBooking,
        // F1 #100: SKD izbira je nasvet; preskok je ekspliciten.
        skdCodes,
        customTags,
        verticalSkipped: skippedVertical,
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
            {/* lastnik (7. 11. 2026): kartice → EN spustni meni po skupinah
                imenika (SKD področja); izbrana dejavnost dobi povzetek spodaj. */}
            <div className="mt-6 max-w-xl">
              <Select value={vertical ?? undefined} onValueChange={(v) => selectVertical(v)}>
                <SelectTrigger
                  aria-label="Izberite dejavnost"
                  className="min-h-12 w-full text-base"
                >
                  <SelectValue placeholder="Izberite dejavnost (npr. frizer, mehanik …)" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <GroupedActivityItems />
                </SelectContent>
              </Select>

              {selectedVertical && (
                <div
                  role="status"
                  className="mt-3 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
                >
                  <span className="mt-0.5 flex shrink-0 items-center">
                    <span
                      className="h-5 w-5 rounded-full ring-1 ring-border"
                      style={{ backgroundColor: selectedPalette?.primary ?? "#000000" }}
                    />
                    <span
                      className="-ml-2 h-5 w-5 rounded-full ring-1 ring-border"
                      style={{ backgroundColor: selectedPalette?.accent ?? "#d4af37" }}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold leading-tight">
                      {selectedVertical.label}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {selectedVertical.description}
                    </span>
                  </span>
                </div>
              )}
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
                    <SelectContent className="max-h-80">
                      <SelectItem value="none">Brez dodatne dejavnosti</SelectItem>
                      <GroupedActivityItems excludeId={vertical} />
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* F1 #100 — SKD 2025 katalog (nasvet, ne zaklep; AD-05):
                iskanje, več izbir, lastne oznake in preskok. Izbira le
                PREDLAGA module — vklop/izklop ostane pri lastniku. */}
            <div className="mt-6 rounded-xl border bg-muted/30 p-4 sm:p-5">
              {/* lastnik (7. 11. 2026): SKD katalog + preskok združeni v
                  zložljivo sekcijo — korak 1 ostane kompaktzen (meni + povzetek). */}
              <button
                type="button"
                onClick={() => setSkdOpen((o) => !o)}
                aria-expanded={skdOpen}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span>
                  <span className="block text-sm font-semibold">
                    Ne najdete svoje dejavnosti? — SKD 2025 katalog (neobvezno)
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    Iskanje po uradni klasifikaciji, več izbir hkrati, lastne
                    oznake ali preskok. Nič ni vklopljeno brez vaše potrditve.
                  </span>
                </span>
                <span aria-hidden="true" className="text-muted-foreground text-lg">
                  {skdOpen ? "−" : "+"}
                </span>
              </button>

              {skdOpen && (
              <>

              {skippedVertical && (
                <div
                  role="status"
                  className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"
                >
                  <p className="font-medium">Dejavnost preskočena.</p>
                  <p className="text-muted-foreground mt-0.5">
                    Dobili boste generično osnovo (vse osnovne module lahko
                    prižgete ali ugasnete v nastavitvah). Lahko pa vseeno
                    izberete dejavnost spodaj.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={unSkipActivity}
                  >
                    Vseeno izberem dejavnost
                  </Button>
                </div>
              )}

              <div className="mt-4 space-y-4">
                <Input
                  type="search"
                  value={skdSearch}
                  onChange={(e) => setSkdSearch(e.target.value)}
                  placeholder="Iščite področje ali sekcijo (npr. frizer, trgovina, S …)"
                  aria-label="Iskanje po SKD 2025 katalogu"
                  maxLength={60}
                />

                {skdCodes.length > 0 && (
                  <div className="flex flex-wrap gap-2" aria-label="Izbrane SKD oznake">
                    {skdCodes.map((code) => {
                      const label = code.startsWith("area:")
                        ? SKD_AREAS.find((a) => a.key === code.slice(5))?.name ?? code
                        : SKD_SECTIONS.find((s) => s.code === code)?.name ?? code
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleSkdCode(code)}
                          className="border-primary bg-primary/10 text-foreground inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
                          aria-label={`Odstrani ${label}`}
                        >
                          <span className="truncate">{label}</span>
                          <span aria-hidden="true">×</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {skdFiltered.areas.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Področja
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {skdFiltered.areas.map((a) => {
                        const code = `area:${a.key}`
                        const isSelected = skdCodes.includes(code)
                        return (
                          <button
                            key={a.key}
                            type="button"
                            onClick={() => toggleSkdCode(code)}
                            aria-pressed={isSelected}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isSelected && "border-primary bg-primary/10 font-medium"
                            )}
                          >
                            {a.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {skdFiltered.sections.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Sekcije SKD 2025
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {skdFiltered.sections.map((s) => {
                        const isSelected = skdCodes.includes(s.code)
                        return (
                          <button
                            key={s.code}
                            type="button"
                            onClick={() => toggleSkdCode(s.code)}
                            aria-pressed={isSelected}
                            title={s.name}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isSelected && "border-primary bg-primary/10 font-medium"
                            )}
                          >
                            <span className="font-mono font-semibold">{s.code}</span>{" "}
                            <span className="text-muted-foreground">
                              {s.name.length > 34 ? `${s.name.slice(0, 34)}…` : s.name}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {skdFiltered.areas.length === 0 && skdFiltered.sections.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Ni zadetkov. Lahko dodate lastno oznako spodaj.
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="skd-tag">Lastna oznaka (neobvezno)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="skd-tag"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addCustomTag()
                        }
                      }}
                      placeholder="npr. vulkanizer po meri"
                      maxLength={40}
                    />
                    <Button type="button" variant="outline" onClick={addCustomTag}>
                      Dodaj
                    </Button>
                  </div>
                  {customTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {customTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setCustomTags((prev) => prev.filter((t) => t !== tag))
                          }
                          className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                          aria-label={`Odstrani oznako ${tag}`}
                        >
                          {tag}
                          <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {skdSuggestions.length > 0 && (
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Predlogi modulov (samo nasvet — vklopite, kar potrebujete)
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {skdSuggestions.map((m) => (
                        <li key={m} className="flex items-center gap-1">
                          <SparkleIcon size={14} className="text-primary" aria-hidden="true" />
                          {SKD_MODULE_LABELS[m]}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!skippedVertical && (
                  <div className="border-t pt-3">
                    <Button type="button" variant="ghost" size="sm" onClick={skipActivity}>
                      Preskoči dejavnost — želim generično osnovo
                    </Button>
                  </div>
                )}
              </div>
              </>
              )}
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

              <div className="space-y-2">
                <Label htmlFor="contact-phone">
                  Kontaktni telefon <span className="text-muted-foreground font-normal">(neobvezen)</span>
                </Label>
                <Input
                  id="contact-phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="npr. 041 234 567"
                  maxLength={24}
                  autoComplete="tel"
                  inputMode="tel"
                  disabled={creating}
                />
                <p className="text-sm text-muted-foreground">
                  Javno objavljen na vaši spletni strani — stranke ga vidijo ob objavi.
                </p>
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

              {/* P2 #88 — drugonivojski odgovori (neobvezna, nikoli ne
                  blokirata): prilagodita kontrolni seznam namestitve.
                  Isti dve vprašanji kot vodeni vstop na dashboardu. */}
              <div className="rounded-xl border bg-muted/30 p-4 sm:p-5">
                <h2 className="text-sm font-semibold">Nekaj o vašem podjetju (neobvezno)</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Odgovora prilagodita kontrolni seznam namestitve. Preskok je v redu.
                </p>

                {/* Q1 — velikost tima */}
                <p className="mt-4 text-sm font-medium">Koliko ljudi dela pri vas?</p>
                <div
                  role="radiogroup"
                  aria-label="Koliko ljudi dela pri vas?"
                  className="mt-2 flex flex-wrap gap-2"
                >
                  {(
                    [
                      ["solo", "Samo jaz"],
                      ["small", "2–5"],
                      ["team", "6 ali več"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={teamSize === value}
                      onClick={() => setTeamSize(value)}
                      disabled={creating}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        teamSize === value
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "hover:border-primary/40"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {teamSize === "solo" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Razumevano — kontrolni seznam ne bo zahteval dodajanja osebja.
                  </p>
                )}

                {/* Q2 — spletna rezervacija */}
                <p className="mt-5 text-sm font-medium">
                  Želite, da stranke termine rezervirajo prek spleta (24/7)?
                </p>
                <div
                  role="radiogroup"
                  aria-label="Želite, da stranke termine rezervirajo prek spleta (24/7)?"
                  className="mt-2 flex flex-wrap gap-2"
                >
                  {(
                    [
                      ["yes", "Da — spletna rezervacija"],
                      ["no", "Ne — po dogovoru"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={onlineBooking === value}
                      onClick={() => setOnlineBooking(value)}
                      disabled={creating}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        onlineBooking === value
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "hover:border-primary/40"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {onlineBooking === "no" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Objava strani bo še vedno priporočena — brez obljub o spletnih rezervacijah.
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
                : "S tem računom upravljate svoje podjetje, rezervacije in trgovino."}
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
                  Ustvarjam vašo stran …
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
