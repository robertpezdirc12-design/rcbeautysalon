"use server"

import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { after } from "next/server"
import { auth, unstable_update } from "@/lib/auth/auth"
import { resolveActiveOrganizationId } from "@/lib/auth/memberships"
import { prisma } from "@/lib/prisma"
import { isReservedSlug, isSlugAvailable, slugify } from "@/lib/tenant"
import { PALETTES, verticalSiteContent, getVertical, presetStaffImage } from "@/lib/verticals"
import { seedOrganizationCatalog, seedProfileCategories } from "@/lib/verticals-seed"
import { listProfileOptions, getProfile, isCapabilityEnabled, GENERIC_PROFILE_ID } from "@/lib/profiles/registry"
import { validateSecondaryVertical } from "@/lib/profiles/secondary"
import { materializeProfileAssets } from "@/lib/profiles/materialize"
import { sanitizeSkdInput } from "@/lib/skd/catalog"
import { PALETTE_OPTIONS } from "@/lib/palettes-client"
// 2D-4: self-service onboarding now requires email verification (like
// registerUser) — a fresh business account is NOT verified in advance. The
// org is created and the owner verifies before first login.
import { sendVerificationEmail } from "@/lib/email/email-verification"
import {
  allowVerificationFallback,
  isEmailServiceConfigured,
} from "@/lib/email/config"
import { seedNewOrgModuleStates } from "@/lib/modules/seeding"

export interface CreateSalonInput {
  name: string
  slug: string
  /**
   * F1 #100 (AD-05): dejavnost ni obvezna. vertical je lahko prazen,
   * ko je verticalSkipped=true — potem platforma ustvari generično
   * osnovo brez zaklepa (moduli ostajajo prosto-vklopljivi).
   */
  vertical: string
  /** Optional secondary activity (E2-4): capability union, primary keeps terminology. */
  secondaryVertical: string | null
  palette: string
  ownerName: string
  email: string
  password: string
  /**
   * #100-nadaljevanje — javni kontaktni telefon (korak 2, neobvezen).
   * Gre v SalonConfig.phone in zadostuje kontaktni zahtevi objave.
   */
  contactPhone?: string | null
  /**
   * P2 #88 — optional second-level answers from /start step 2 (same shape
   * the guided-entry wizard persists): "solo" removes the staff step from
   * the activation checklist; onlineBooking "no" rewords the publish step.
   * Never blocking — unanswered fields stay null and the checklist keeps
   * its safe defaults.
   */
  teamSize?: "solo" | "small" | "team" | null
  onlineBooking?: "yes" | "no" | null
  /**
   * F1 #100 — SKD 2025 izbira (nasvet, ne zaklep): izbrane šifre iz
   * kataloga ("A".."V" sekcije, "area:<key>" področja), lastne oznake
   * in ekspliciten preskok dejavnosti. Strežnik sanitizira proti katalogu.
   */
  skdCodes?: string[]
  customTags?: string[]
  verticalSkipped?: boolean
}

export interface CreateSalonResult {
  success: boolean
  orgId?: string
  slug?: string
  salonName?: string
  error?: string
  /** 2D-4: set for fresh anonymous owners when no email service — the UI
   *  shows the verification link directly instead of claiming delivery. */
  verificationUrl?: string
  emailSent?: boolean
}

/** Public availability check used by the onboarding wizard (debounced, client-side). */
export async function checkSlugAvailability(slug: string): Promise<{ available: boolean }> {
  const normalized = slugify(slug ?? "")
  if (!normalized) return { available: false }
  return { available: await isSlugAvailable(normalized) }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Creates a complete business tenant in one logical flow:
 * Organization -> User (ADMIN) + Staff + WorkingHours -> catalog seed ->
 * profile asset materialization (forms + workflows) -> staff services ->
 * SalonConfig (site content, locale, booking policy).
 *
 * P1 #40 (onboarding audit 2026-11): prijavljen uporabnik ne ustvari
 * novega računa — podjetje se pripne njegovi OBSTOJEČI seji (e-pošta
 * iz seje je avtoritativna, gesla se ne sprašuje, vloga se povzdigne
 * na ADMIN, seja se osveži prek unstable_update). Anonimni obiskovalci
 * ustvarijo nov račun kot prej.
 */
export async function createSalonOrganization(input: CreateSalonInput): Promise<CreateSalonResult> {
  try {
    // --- Validation (friendly Slovenian messages) ---
    const name = (input.name ?? "").trim()
    if (name.length < 2) {
      return { success: false, error: "Ime podjetja mora imeti vsaj 2 znaka." }
    }

    const slug = slugify(input.slug ?? "")
    if (!slug || slug.length < 2) {
      return { success: false, error: "Vnesite veljaven URL naslov (vsaj 2 znaka)." }
    }
    if (isReservedSlug(slug)) {
      return { success: false, error: "Ta URL naslov je rezerviran. Izberite drugega." }
    }
    if (!(await isSlugAvailable(slug))) {
      return { success: false, error: "Ta URL naslov je že zaseden. Izberite drugega." }
    }

    // F1 #100 (AD-05): dejavnost ni obvezna — ekspliciten preskok ustvari
    // generično osnovo. Brez preskoka ostane validacija profila kot doslej.
    const verticalSkipped = input.verticalSkipped === true && !input.vertical
    const profileId = verticalSkipped ? GENERIC_PROFILE_ID : input.vertical

    // Validate the activity profile against the single-source registry
    // (EPIC #1) — the profile determines modules, terminology, forms and
    // workflows, not just appearance.
    const profile = listProfileOptions().find((p) => p.id === profileId)
    if (!profile) {
      return { success: false, error: "Izberite veljavno dejavnost." }
    }

    // Secondary activity (E2-4): same pure rules as the settings action —
    // unknown ids and same-as-primary are rejected before any write.
    // F1: ob preskoku dejavnosti sekundarna ni smiselna (potihem izpraznjena).
    const secondaryCode = verticalSkipped
      ? "OK"
      : validateSecondaryVertical(input.vertical, input.secondaryVertical)
    if (secondaryCode === "UNKNOWN_PROFILE") {
      return { success: false, error: "Izberite veljavno dodatno dejavnost." }
    }
    if (secondaryCode === "SAME_PROFILE") {
      return {
        success: false,
        error: "Dodatna dejavnost mora biti različna od primarne dejavnosti.",
      }
    }
    const secondaryVertical = verticalSkipped ? null : input.secondaryVertical || null

    const palette = PALETTES[input.palette] ? input.palette : undefined
    if (!palette) {
      return { success: false, error: "Izberite veljavno barvno paleto." }
    }

    const ownerName = (input.ownerName ?? "").trim()
    if (ownerName.length < 2) {
      return { success: false, error: "Vnesite ime in priimek lastnika." }
    }

    // --- #40: kdor je prijavljen, NE ustvarja novega računa. ---
    // E-pošta iz seje je avtoritativna (vnos iz obrazca se ignorira),
    // gesla ne zahtevamo, organizacija se pripne obstoječemu uporabniku.
    const session = await auth()
    const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? null
    const sessionUserId = session?.user?.id ?? null
    const authed = Boolean(sessionEmail && sessionUserId)

    let email: string
    let passwordHash: string | null = null
    let linkUserId: string | null = null // obstoječ uporabnik, ki dobi organizacijo
    let createdUserId: string | null = null // NOV uporabnik (počisti se ob napaki)
    let additionalOrg = false // #100 8.A (M3): dodatno podjetje istega računa
    // 2D-4: e-poštna verifikacija novega lastniškega računa — postavi se v
    // anonimni veji (kot registerUser), UI pa jo predstavi uporabniku.
    let verificationUrl: string | undefined

    if (authed) {
      email = sessionEmail!
      const me = await prisma.user.findUnique({
        where: { email },
        select: { id: true, organizationId: true },
      })
      if (!me) {
        return {
          success: false,
          error: "Seja ni več veljavna. Prijavite se znova in poskusite še enkrat.",
        }
      }
      // #100 8.A (M3): lastnik z več dejavnostmi — en račun lahko vodi
      // več podjetij. Dodatno podjetje = novo članstvo (ADMIN); staff
      // vrstica se ustvari samo za PRVO podjetje (limitacija v1, brez
      // spreminjanja Staff.userId unique). Session po ustvarjanju
      // preklopi na novo podjetje.
      additionalOrg = Boolean(me.organizationId)
      linkUserId = me.id
    } else {
      const rawEmail = (input.email ?? "").trim().toLowerCase()
      if (!EMAIL_REGEX.test(rawEmail)) {
        return { success: false, error: "Vnesite veljaven e-poštni naslov." }
      }
      email = rawEmail

      const password = input.password ?? ""
      if (password.length < 8) {
        return { success: false, error: "Geslo mora imeti vsaj 8 znakov." }
      }

      const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
      if (existingUser) {
        // #40: jasna pot naprej namesto slepe ulice.
        return {
          success: false,
          error:
            "Ta e-pošta je že registrirana. Prijavite se in ustvarite podjetje iz svojega računa, ali uporabite drug e-poštni naslov.",
        }
      }
      passwordHash = await bcrypt.hash(password, 12)
    }

    const paletteOption = PALETTE_OPTIONS.find((p) => p.id === palette)

    // P2 #47: profil, ki IZKLOPI osebje (npr. čebelarstvo), NE seje staff
    // vrstice — prej je onboarding brezpogojno ustvaril lastnika kot osebje,
    // javna stran pa prikazala sekcijo "Naša ekipa", ki je lastnik ne more
    // urejati (dashboard nima staff vhoda). Profili z osebjem ostanejo
    // nespremenjeni (lastnik = prvi član osebja).
    const staffEnabled = isCapabilityEnabled(getProfile(profile.id), "staff")

    // --- Tenant creation ---
    // New tenants start UNPUBLISHED (EPIC #3 E3-1): the site is a private
    // owner preview until they publish it from Settings.
    // P2 #42: verticalChosenAt se zapiše TU — dejavnost je bila izbrana v
    // čarovniku /start, dashboard je zato NE vpraša ponovno (vrata
    // "Kaj počnete?" visijo natanko na tem polju).
    // P2 #88: odgovora iz koraka 2 (velikost tima, spletna rezervacija)
    // se shranita v onboardingAnswers — dashboard kontrolni seznam ju
    // bere od prvega dne (solo brez koraka osebja, "no" preformulira
    // korak objave). Whitelist vrednosti: neznan vnos = neobvezani odgovor.
    const teamSize =
      input.teamSize === "solo" || input.teamSize === "small" || input.teamSize === "team"
        ? input.teamSize
        : null
    const onlineBooking =
      input.onlineBooking === "yes" || input.onlineBooking === "no" ? input.onlineBooking : null
    const onboardingAnswers =
      teamSize || onlineBooking ? { ...(teamSize ? { teamSize } : {}), ...(onlineBooking ? { onlineBooking } : {}) } : undefined

    // F1 #100: SKD izbira je nasvet — sanitizacija proti katalogu (neznane
    // vrednosti tiho izpustimo, omejitve števila/dolžine proti zlorabi).
    const skd = sanitizeSkdInput(input.skdCodes, input.customTags)

    // VSTOPNA IZKUŠNJA (2026-11): novi tenant začne z opt-in moduli —
  // required jedro aktivno, ostalo izklopljeno dokler lastnik ne doda.
  // #1318 atomsko: org + začetna stanja modulov V ENO transakcijo, da org
  // nikoli ne obstaja brez svojega module-seeda (ali polovično). Prej je bil
  // seed v ločenem try/catch zunaj transakcije — prekinjen seed je pustil org
  // z manjkajočimi vrsticami. Zdaj je ali vse ali nič (fail-open v varno
  // je nadomestil novi loadStates default ali-ob-ali — glej modules.ts).
  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        slug,
        name,
        vertical: profile.id,
        secondaryVertical,
        palette,
        publishState: "DRAFT",
        // P2 #42 + F1: časovni žig samo pri DEJANSKI izbiri dejavnosti —
        // preskok pusti null (razlika B) in označi verticalSkipped.
        ...(verticalSkipped ? {} : { verticalChosenAt: new Date() }),
        verticalSkipped,
        ...(skd.codes.length > 0 ? { skdCodes: skd.codes } : {}),
        ...(skd.tags.length > 0 ? { customTags: skd.tags } : {}),
        ...(onboardingAnswers ? { onboardingAnswers } : {}),
      },
    })
    // Seed v ISTI transakciji kot kreacija org — atomično (vse ali nič).
    try {
      await seedNewOrgModuleStates(created.id, profile.id, secondaryVertical, undefined, tx)
    } catch (err) {
      console.error("[onboarding] seedNewOrgModuleStates pade:", err)
      throw err // prekliči cel transakcijo → org se NE ustvari
    }
    return created
  })

  let staffId: string | null = null
  try {
    if (linkUserId) {
        // #100 8.A (M1): članstvo za NOVO podjetje (backfill pokrije stare;
        // vsaka nova kreacija ga ustvari takoj — isDefault samo za prvo).
        await prisma.organizationMember.create({
          data: {
            organizationId: org.id,
            userId: linkUserId,
            role: "ADMIN",
            isDefault: !additionalOrg,
          },
        })
        // #40 — obstoječ račun: povzdigni v lastnika + ustvari Staff profil.
        // Račun NIKOLI ne pobrišemo v čiščenju (je lastnost uporabnika).
        // P2 #47: staff vrstica se ustvari SAMO, ko profil omogoča osebje.
        // #100 8.A: za DODATNO podjetje staff vrstica se ne ustvari
        // (Staff.userId je 1:1 — limitacija v1; lastnik upravlja kot ADMIN).
        if (staffEnabled && !additionalOrg) {
          const staffImage = presetStaffImage(profile.id)
          const staff = await prisma.staff.create({
            data: {
              userId: linkUserId,
              organizationId: org.id,
              name: ownerName,
              email,
              isActive: true,
              ...(staffImage ? { image: staffImage } : {}),
              workingHours: {
                create: [
                  { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", isActive: true },
                  { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", isActive: true },
                  { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", isActive: true },
                  { dayOfWeek: 4, startTime: "09:00", endTime: "18:00", isActive: true },
                  { dayOfWeek: 5, startTime: "09:00", endTime: "18:00", isActive: true },
                  { dayOfWeek: 6, startTime: "09:00", endTime: "13:00", isActive: true },
                ],
              },
            },
          })
          staffId = staff.id
        }
        await prisma.user.update({
          where: { id: linkUserId },
          data: { role: "ADMIN", organizationId: org.id },
        })
        // Seja dobi novo vlogo + organizacijo TAKOJ (brez ponovne prijave).
        // #40: payload gre kot user patch — jwt callback (trigger update) ga
        // prepiše v token.
        await unstable_update({ user: { role: "ADMIN", organizationId: org.id } })
      } else {
        // Anonimen obiskovalec — nov lastniški račun (staff profil samo, ko
        // profil omogoča osebje — P2 #47).
        // 2D-4: račun se ustvari BREZ emailVerified — lastnik mora e-pošto
        // najprej potrditi (authorize blokira nepreverjene prijave), enako
        // kot registerUser. Org je ustvarjena, dejavnost/zaloga ni izgubljena.
        const user = await prisma.user.create({
          data: {
            name: ownerName,
            email,
            password: passwordHash!,
            role: "ADMIN",
            organizationId: org.id,
            ...(staffEnabled
              ? {
                  staffs: {
                    create: {
                      name: ownerName,
                      email,
                      isActive: true,
                      organizationId: org.id,
                      // Preset portrait for the activity (test/demo realism, EPIC #4
                      // visual pass). undefined -> Prisma leaves image null and the
                      // public staff card renders the initials fallback.
                      ...(presetStaffImage(profile.id)
                        ? { image: presetStaffImage(profile.id) }
                        : {}),
                      workingHours: {
                        create: [
                          { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", isActive: true },
                          { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", isActive: true },
                          { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", isActive: true },
                          { dayOfWeek: 4, startTime: "09:00", endTime: "18:00", isActive: true },
                          { dayOfWeek: 5, startTime: "09:00", endTime: "18:00", isActive: true },
                          { dayOfWeek: 6, startTime: "09:00", endTime: "13:00", isActive: true },
                        ],
                      },
                    },
                  },
                }
              : {}),
          },
          include: { staffs: { select: { id: true } } },
        })
        createdUserId = user.id
        staffId = user.staffs[0]?.id ?? null

        // #100 F2.1 + 2D-1L: tudi NOV račun (anonimna registracija) dobi ADMIN
        // članstvo takoj — brez njega uporabnik ne bi mogel vstopiti v svoj�
        // workspace (bil bi vezan nanj le prek legacy organizationId). Enako kot
        // v veji za obstoječi račun (zgoraj): vloga ADMIN, isDefault za prvo
        // podjetje. Idempotentno (skipDuplicates na @@unique[organizationId,
        // userId]) — varno ob retry, brez podvajanja.
        await prisma.organizationMember.createMany({
          data: {
            organizationId: org.id,
            userId: user.id,
            role: "ADMIN",
            isDefault: !additionalOrg, // v anonimni veji je vedno prvo (default)
          },
          skipDuplicates: true,
        })

        // 2D-4: novi lastniški račun zahteva e-poštno verifikacijo pred prvo
        // prijavo (authorize blokira nepreverjene). Ustvarimo 24-urni, enkratni
        // token (enako registerUser). Org/dejavnost so že ustvarjene — uporabnik
        // po potrditvi samo logira in vstopi v svoj poslovni prostor.
        const verificationToken = crypto.randomBytes(32).toString("hex")
        await prisma.verificationToken.create({
          data: {
            identifier: email,
            token: verificationToken,
            expires: new Date(Date.now() + 86400000), // 24h
          },
        })
        after(async () => {
          await sendVerificationEmail(email, verificationToken)
        })
        if (!isEmailServiceConfigured() && allowVerificationFallback()) {
          verificationUrl = `/verify-email?token=${verificationToken}`
        }
      }

      // Sample categories + services + products for the chosen activity.
      // NOTE (E2-4): catalog seeds, forms/workflows materialization and the
      // site content snapshot remain PRIMARY-only — the secondary activity
      // contributes capability modules (the union), never duplicated
      // terminology or definitions. The owner can add catalog items of the
      // second activity manually in the shared modules.
      // SKD #118: SKD-grouped profiles (e.g. skd-f-construction) carry a
      // dedicated vertical preset under `catalog.seedVerticalId` distinct
      // from the profile id — seed from THAT so the tenant gets the real
      // activity catalog (construction), not the generic fallback.
      const seedVertical = profile.catalog?.seedVerticalId ?? profile.id
      await seedOrganizationCatalog(org.id, seedVertical)

      // F5.2.3: podjetje z več dejavnostmi ob ustvarjanju — sekundarna
      // dejavnost prav tako prispeva svoje predloge kategorij (idempotentno).
      if (secondaryVertical) {
        try {
          await seedProfileCategories(org.id, secondaryVertical)
        } catch (err) {
          console.error("onboarding: seedProfileCategories failed", err)
        }
      }

      // Materialize profile-owned definitions (forms + workflows) so the
      // owner can customize them per-tenant without code (EPIC #1 §4).
      await materializeProfileAssets(org.id, profile.id)

      // Assign every created service to the owner's staff profile
      const services = await prisma.service.findMany({
        where: { organizationId: org.id },
        select: { id: true },
      })
      if (staffId && services.length > 0) {
        // (lokalna const: TS ne oži `let` znotraj zaprtja map callbacka)
        const sid = staffId
        await prisma.staffService.createMany({
          data: services.map((s) => ({ staffId: sid, serviceId: s.id })),
          skipDuplicates: true,
        })
      }

      // Salon configuration with profile-driven defaults (locale, currency,
      // timezone come from the activity preset — no more hardcoded values).
      const preset = getVertical(seedVertical)
      await prisma.salonConfig.create({
        data: {
          organizationId: org.id,
          name,
          email,
          // #100-nadaljevanje: javni kontaktni telefon iz čarovnika (neobvezen).
          phone: input.contactPhone?.trim() || null,
          country: "SI",
          currency: preset.currency || "EUR",
          locale: preset.locale || "sl",
          timezone: preset.timezone || "Europe/Ljubljana",
          bookingDeposit: 10,
          cancellationPolicy: "Odpoved možna najkasneje 24 ur pred terminom.",
          siteContent: verticalSiteContent(seedVertical) as unknown as object,
          primaryColor: paletteOption?.primary ?? "#000000",
          secondaryColor: "#ffffff",
          accentColor: paletteOption?.accent ?? "#d4af37",
        },
      })
    } catch (innerError) {
      // Best-effort cleanup so a failed signup never leaves a half-created
      // tenant. #40: LASTNIŠKEGA računa ne pobrišemo — samo nov ustvarjenega.
      if (createdUserId) {
        await prisma.user.delete({ where: { id: createdUserId } }).catch(() => undefined)
      }
      await prisma.organization.delete({ where: { id: org.id } }).catch(() => undefined)
      // 2D-4 (reviewer finding): če novi anonimni lastnik že dobil verification
      // token in nato poznejši korak (katalog/assets/config) pade, pospravi
      // osatojni token — uporabnik+org se pobrideta, token smeti pa ne sme.
      if (email && linkUserId === null) {
        await prisma.verificationToken.deleteMany({ where: { identifier: email } }).catch(() => undefined)
      }
      throw innerError
    }

    return {
      success: true,
      orgId: org.id,
      slug,
      salonName: name,
      // 2D-4: za sveže anonimnega lastnika UX potrebuje presekano e-pošto.
      ...(verificationUrl ? { verificationUrl } : {}),
      emailSent: verificationUrl ? false : undefined,
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(",")
        : String(error.meta?.target ?? "")
      if (target.includes("email")) {
        return {
          success: false,
          error:
            "Ta e-pošta je že registrirana. Prijavite se in ustvarite podjetje iz svojega računa, ali uporabite drug e-poštni naslov.",
        }
      }
      if (target.includes("slug")) {
        return { success: false, error: "Ta URL naslov je že zaseden. Izberite drugega." }
      }
      return { success: false, error: "Ti podatki so že v uporabi. Preverite vnesene podatke." }
    }
    console.error("Business onboarding error:", error)
    return {
      success: false,
      error: "Pri ustvarjanju podjetja je prišlo do napake. Poskusite znova.",
    }
  }
}

/**
 * Kako stranke stopijo v stik prek spletne strani za izbrano panogo?
 *
 * Čarovnik je doslej vsem panogam ponudil »Da — spletna rezervacija«, tudi
 * šiviljstvu, kjer javna stran ponuja povpraševanje in ne koledarja. Tu
 * vrnemo dejanski način iz profilnega registra, da vprašanje v čarovniku
 * obljubi to, kar stran res počne.
 */
export async function getVerticalContactMode(
  verticalId: string
): Promise<"booking" | "inquiry" | "order"> {
  const profile = getProfile(verticalId)
  const mode = profile.website?.ctaMode
  return mode === "inquiry" || mode === "order" ? mode : "booking"
}

// ============================================================
// SELF-SERVICE: ensure the signed-in user has a workspace
// (EPIC #4 / Google self-service onboarding)
//
// After Google sign-in a brand-new user has no organization.
// This helper auto-creates (if none) or resolves/selects (if
// one exists) a workspace so the post-login flow is smooth.
// Idempotent: safe to call multiple times.
// ============================================================

export type EnsureSelfServiceWorkspaceResult =
  | { ok: true; organizationId: string; created: boolean }
  | { ok: false; error: string }

export async function ensureSelfServiceWorkspace(): Promise<EnsureSelfServiceWorkspaceResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, error: "Za nadaljevanje se prijavite." }
  }

  // Resolve active workspace from memberships first (authoritative).
  const activeOrgId = await resolveActiveOrganizationId(
    session.user.id,
    session.user.organizationId ?? null
  )
  if (activeOrgId) {
    // Keep session in sync if it points elsewhere / is missing.
    if (session.user.organizationId !== activeOrgId || session.user.role === "CLIENTE") {
      // If the user is only CLIENTE at user-level but owns/manages a workspace,
      // promote to ADMIN so they can access the business dashboard.
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: activeOrgId },
        select: { role: true },
      })
      const nextRole =
        membership && (membership.role === "OWNER" || membership.role === "ADMIN" || membership.role === "MANAGER")
          ? "ADMIN"
          : (session.user.role as string)
      await unstable_update({
        user: {
          role: nextRole as "ADMIN" | "CLIENTE" | "STAFF",
          organizationId: activeOrgId,
        },
      })
    }
    return { ok: true, organizationId: activeOrgId, created: false }
  }

  // No active membership — auto-provision a starter workspace for self-service.
  // Only when the user has no memberships at all (avoid creating a stray org
  // for someone who belongs to an inactive workspace by mistake).
  const membershipCount = await prisma.organizationMember.count({
    where: { userId: session.user.id },
  })
  if (membershipCount > 0) {
    // Has memberships but none resolved as active — let caller route to picker.
    return { ok: false, error: "NO_ACTIVE_WORKSPACE" }
  }

  const displayName =
    session.user.name?.trim() ||
    session.user.email?.split("@")[0]?.trim() ||
    "Moj prostor"

  const baseName = displayName.length >= 2 ? displayName : "Moj prostor"
  const orgName = baseName.length > 80 ? baseName.slice(0, 80).trim() : baseName

  // Generate a unique, available slug.
  const baseSlug = slugify(orgName) || `moj-prostor-${session.user.id.slice(-6)}`
  let slug = baseSlug.slice(0, 50)
  if (slug.length < 2) slug = `moj-prostor-${session.user.id.slice(-6)}`
  if (isReservedSlug(slug)) slug = `${slug}-biz`
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${slug.slice(0, Math.max(2, 46 - String(i).length))}-${i}`
    if (!isReservedSlug(candidate) && (await isSlugAvailable(candidate))) {
      slug = candidate
      break
    }
    if (i === 19) {
      slug = `${slug.slice(0, 40)}-${crypto.randomBytes(3).toString("hex")}`
    }
  }

  // Pick a sensible default palette.
  const defaultPalette =
    (PALETTES && (PALETTES["sage"] ? "sage" : Object.keys(PALETTES)[0])) || "sage"

  const result = await createSalonOrganization({
    name: orgName,
    slug,
    palette: defaultPalette,
    vertical: "",
    verticalSkipped: true,
    secondaryVertical: null,
    ownerName: displayName,
    email: session.user.email ?? "",
    password: "",
  })

  if (!result.success || !result.orgId) {
    return {
      ok: false,
      error:
        result.error ??
        "Samodejna ustvaritev poslovnega prostora ni uspela. Poskusite znova.",
    }
  }

  return { ok: true, organizationId: result.orgId, created: true }
}
