/**
 * Multi-tenant seed:
 *  1. Creates the default organization (org_rcbeauty) and attaches ALL existing rows to it.
 *  2. Creates two extra demo salons (frizer + nails) with own palette/catalog/content.
 * Safe to run multiple times (idempotent).
 *
 * Run: bunx tsx scripts/seed-orgs.ts
 */
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const DEFAULT_ORG_ID = "org_rcbeauty"

async function main() {
  // ---------- 1. Default organization (legacy demo, slug rc-beauty) ----------
  let defaultOrg = await prisma.organization.findUnique({ where: { slug: "rc-beauty" } })
  if (!defaultOrg) {
    defaultOrg = await prisma.organization.create({
      data: {
        id: DEFAULT_ORG_ID,
        slug: "rc-beauty",
        name: "Salon harmonija (demo)",
        vertical: "beauty",
        palette: "rose",
      },
    })
  }

  // Attach legacy rows
  const { default: prismaClient } = { default: prisma }
  void prismaClient

  await prisma.salonConfig.updateMany({ where: { organizationId: null }, data: { organizationId: defaultOrg.id } })
  await prisma.category.updateMany({ where: { organizationId: null }, data: { organizationId: defaultOrg.id } })
  await prisma.service.updateMany({ where: { organizationId: null }, data: { organizationId: defaultOrg.id } })
  await prisma.product.updateMany({ where: { organizationId: null }, data: { organizationId: defaultOrg.id } })
  await prisma.staff.updateMany({ where: { organizationId: null }, data: { organizationId: defaultOrg.id } })
  await prisma.customer.updateMany({ where: { organizationId: null }, data: { organizationId: defaultOrg.id } })
  await prisma.appointment.updateMany({ where: { organizationId: null }, data: { organizationId: defaultOrg.id } })
  await prisma.order.updateMany({ where: { organizationId: null }, data: { organizationId: defaultOrg.id } })

  // Users: admins & staff belong to the default org
  await prisma.user.updateMany({ where: { role: "ADMIN", organizationId: null }, data: { organizationId: defaultOrg.id } })
  await prisma.user.updateMany({ where: { role: "STAFF", organizationId: null }, data: { organizationId: defaultOrg.id } })

  // Default config: SI-ify + site content defaults
  const { verticalSiteContent } = await import("../src/lib/verticals")
  const existingConfig = await prisma.salonConfig.findFirst({ where: { organizationId: defaultOrg.id } })
  if (existingConfig) {
    await prisma.salonConfig.update({
      where: { id: existingConfig.id },
      data: {
        siteContent: verticalSiteContent("beauty") as unknown as object,
        currency: "EUR",
        locale: "sl",
        timezone: "Europe/Ljubljana",
      },
    })
  }

  // ---------- 2. Demo salons ----------
  const password = await bcrypt.hash("demo1234", 12)

  await ensureSalon({
    slug: "studio-nika",
    name: "Frizerski studio Nika",
    vertical: "frizer",
    palette: "amber",
    ownerName: "Nika Novak",
    ownerEmail: "nika@demo.si",
    password,
    city: "Ljubljana",
    phone: "+386 40 123 456",
    email: "info@studionika.si",
    deposit: 10,
  })

  await ensureSalon({
    slug: "nail-studio-luna",
    name: "Nail Studio Luna",
    vertical: "nails",
    palette: "violet",
    ownerName: "Luna Kos",
    ownerEmail: "luna@demo.si",
    password,
    city: "Maribor",
    phone: "+386 31 987 654",
    email: "info@nailstudio.si",
    deposit: 5,
  })

  console.log("✔ Multi-tenant seed complete")
  console.log("  Default org: /s/rc-beauty")
  console.log("  Demo frizer: /s/studio-nika  (nika@demo.si / demo1234)")
  console.log("  Demo nails:  /s/nail-studio-luna  (luna@demo.si / demo1234)")
}

interface SalonSpec {
  slug: string
  name: string
  vertical: string
  palette: string
  ownerName: string
  ownerEmail: string
  password: string
  city: string
  phone: string
  email: string
  deposit: number
}

async function ensureSalon(spec: SalonSpec) {
  const existing = await prisma.organization.findUnique({ where: { slug: spec.slug } })
  if (existing) return

  const { getVertical, seedOrganizationCatalog, verticalSiteContent } = await import("../src/lib/verticals")
  const preset = getVertical(spec.vertical)

  const org = await prisma.organization.create({
    data: { slug: spec.slug, name: spec.name, vertical: spec.vertical, palette: spec.palette },
  })

  // Owner user + staff profile (owner can be booked as a professional)
  const owner = await prisma.user.create({
    data: {
      name: spec.ownerName,
      email: spec.ownerEmail,
      password: spec.password,
      role: "ADMIN",
      emailVerified: new Date(),
      organizationId: org.id,
    },
  })

  const staff = await prisma.staff.create({
    data: {
      name: spec.ownerName,
      email: spec.ownerEmail,
      bio: `Lastnik${spec.vertical === "frizer" ? "a" : "ca"} in specialist${spec.vertical === "frizer" ? "" : "inja"} z dolgoletnimi izkušnjami.`,
      isActive: true,
      userId: owner.id,
      organizationId: org.id,
    },
  })

  // Working hours Mon–Fri 9–18, Sat 9–13
  for (const [day, active] of [1, 2, 3, 4, 5, 6, 0].entries()) {
    await prisma.workingHours.create({
      data: {
        staffId: staff.id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: day === 6 ? "13:00" : "18:00",
        isActive: true,
      },
    })
    void active
  }

  // Assign all services to the owner-staff
  await seedOrganizationCatalog(org.id, spec.vertical)
  const services = await prisma.service.findMany({ where: { organizationId: org.id }, select: { id: true } })
  for (const svc of services) {
    await prisma.staffService.create({ data: { staffId: staff.id, serviceId: svc.id } })
  }

  // Salon config with vertical content
  await prisma.salonConfig.create({
    data: {
      organizationId: org.id,
      name: spec.name,
      email: spec.email,
      phone: spec.phone,
      city: spec.city,
      country: "SI",
      currency: preset.currency,
      locale: preset.locale,
      timezone: preset.timezone,
      bookingDeposit: spec.deposit,
      cancellationPolicy: "Odpoved možna najkasneje 24 ur pred terminom.",
      siteContent: verticalSiteContent(spec.vertical) as unknown as object,
    },
  })

  console.log(`✔ Salon created: ${spec.name} -> /s/${spec.slug}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
