"use server"

import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { auth, unstable_update } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { isReservedSlug, isSlugAvailable, slugify } from "@/lib/tenant"
import { PALETTES, seedOrganizationCatalog, verticalSiteContent, getVertical, presetStaffImage } from "@/lib/verticals"
import { listProfileOptions } from "@/lib/profiles/registry"
import { validateSecondaryVertical } from "@/lib/profiles/secondary"
import { materializeProfileAssets } from "@/lib/profiles/materialize"
import { PALETTE_OPTIONS } from "@/lib/palettes-client"

export interface CreateSalonInput {
  name: string
  slug: string
  vertical: string
  /** Optional secondary activity (E2-4): capability union, primary keeps terminology. */
  secondaryVertical: string | null
  palette: string
  ownerName: string
  email: string
  password: string
}

export interface CreateSalonResult {
  success: boolean
  slug?: string
  salonName?: string
  error?: string
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

    // Validate the activity profile against the single-source registry
    // (EPIC #1) — the profile determines modules, terminology, forms and
    // workflows, not just appearance.
    const profile = listProfileOptions().find((p) => p.id === input.vertical)
    if (!profile) {
      return { success: false, error: "Izberite veljavno dejavnost." }
    }

    // Secondary activity (E2-4): same pure rules as the settings action —
    // unknown ids and same-as-primary are rejected before any write.
    const secondaryCode = validateSecondaryVertical(input.vertical, input.secondaryVertical)
    if (secondaryCode === "UNKNOWN_PROFILE") {
      return { success: false, error: "Izberite veljavno dodatno dejavnost." }
    }
    if (secondaryCode === "SAME_PROFILE") {
      return {
        success: false,
        error: "Dodatna dejavnost mora biti različna od primarne dejavnosti.",
      }
    }
    const secondaryVertical = input.secondaryVertical || null

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
      // Model je ena organizacija na račun — druga podjetja zahtevajo
      // drug račun (jasno povedano, brez molka prepisa povezave).
      if (me.organizationId) {
        return {
          success: false,
          error:
            "Vaš račun že upravlja drugo podjetje. Za dodatno podjetje uporabite ločen račun.",
        }
      }
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

    // --- Tenant creation ---
    // New tenants start UNPUBLISHED (EPIC #3 E3-1): the site is a private
    // owner preview until they publish it from Settings.
    // P2 #42: verticalChosenAt se zapiše TU — dejavnost je bila izbrana v
    // čarovniku /start, dashboard je zato NE vpraša ponovno (vrata
    // "Kaj počnete?" visijo natanko na tem polju).
    const org = await prisma.organization.create({
      data: {
        slug,
        name,
        vertical: profile.id,
        secondaryVertical,
        palette,
        publishState: "DRAFT",
        verticalChosenAt: new Date(),
      },
    })

    let staffId: string | null = null
    try {
      if (linkUserId) {
        // #40 — obstoječ račun: povzdigni v lastnika + ustvari Staff profil.
        // Račun NIKOLI ne pobrišemo v čiščenju (je lastnost uporabnika).
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
        await prisma.user.update({
          where: { id: linkUserId },
          data: { organizationId: org.id, role: "ADMIN" },
        })
        staffId = staff.id
        // Seja dobi novo vlogo + organizacijo TAKOJ (brez ponovne prijave).
        // #40: payload gre kot user patch — jwt callback (trigger update) ga
        // prepiše v token.
        await unstable_update({ user: { role: "ADMIN", organizationId: org.id } })
      } else {
        // Anonimen obiskovalec — nov lastniški račun s Staff profilom.
        const user = await prisma.user.create({
          data: {
            name: ownerName,
            email,
            password: passwordHash!,
            role: "ADMIN",
            emailVerified: new Date(),
            organizationId: org.id,
            staff: {
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
          },
          include: { staff: { select: { id: true } } },
        })
        createdUserId = user.id
        staffId = user.staff?.id ?? null
      }

      // Sample categories + services + products for the chosen activity.
      // NOTE (E2-4): catalog seeds, forms/workflows materialization and the
      // site content snapshot remain PRIMARY-only — the secondary activity
      // contributes capability modules (the union), never duplicated
      // terminology or definitions. The owner can add catalog items of the
      // second activity manually in the shared modules.
      await seedOrganizationCatalog(org.id, profile.id)

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
      const preset = getVertical(profile.id)
      await prisma.salonConfig.create({
        data: {
          organizationId: org.id,
          name,
          email,
          country: "SI",
          currency: preset.currency || "EUR",
          locale: preset.locale || "sl",
          timezone: preset.timezone || "Europe/Ljubljana",
          bookingDeposit: 10,
          cancellationPolicy: "Odpoved možna najkasneje 24 ur pred terminom.",
          siteContent: verticalSiteContent(profile.id) as unknown as object,
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
      throw innerError
    }

    return { success: true, slug, salonName: name }
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
