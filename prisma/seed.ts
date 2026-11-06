import { PrismaClient, Prisma } from '@prisma/client'
import { hash } from 'bcryptjs'
import { addDays, setHours, setMinutes } from 'date-fns'
// P1 #18 (audit-2026-11): default media centralized in one module
import { DEFAULT_CATALOG_IMAGES, DEFAULT_DEMO_MEDIA } from '../src/lib/default-assets'

const prisma = new PrismaClient()

/**
 * Legacy demo seed helper — seeded services have no organization and the
 * Service slug is now unique PER ORGANIZATION (EPIC #1: same-vertical tenants
 * must not collide), so upsert manually by the nullable-org + slug pair.
 */
async function serviceUpsert(args: {
  where: { slug: string }
  update: Prisma.ServiceUncheckedUpdateInput
  create: Prisma.ServiceUncheckedCreateInput
}) {
  const existing = await prisma.service.findFirst({
    where: { slug: args.where.slug, organizationId: null },
  })
  if (existing) {
    return prisma.service.update({ where: { id: existing.id }, data: args.update })
  }
  return prisma.service.create({ data: args.create })
}

async function main() {
  console.log('🌱 Seeding database...')

  // ============================================
  // 1. SALON CONFIGURATION
  // ============================================
  console.log('Creating salon configuration...')
  const salonConfig = await prisma.salonConfig.upsert({
    where: { id: 'salon_config' },
    update: {},
    create: {
      id: 'salon_config',
      name: 'Salon harmonija (demo)',
      email: 'info@rcbeautysalon.org',
      phone: '+386 40 123 456',
      address: 'Slovenska ulica 5',
      city: 'Ljubljana',
      state: '',
      zipCode: '1000',
      country: 'SI',
      timezone: 'Europe/Ljubljana',
      currency: 'EUR',
      locale: 'sl',
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
      accentColor: '#d4af37',
      bookingDeposit: 50.0,
      depositRefundable: false,
      minBookingAdvance: 0,
      maxBookingAdvance: 30,
      cancellationPolicy:
        'Odjava najkasneje 24 ur pred terminom. Polog (50 €) ni vračljiv.',
    },
  })
  console.log(`✅ Salon: ${salonConfig.name}`)

  // ============================================
  // 2. USERS (Authentication)
  // ============================================
  console.log('\nCreating users...')

  // ADMIN (no staff/customer profile)
  // #105: gesla se lahko prekrijejo prek env (SEED_*_PASSWORD) — javna defaults ostanejo samo za lokalni razvoj.
  const adminPlain = process.env.SEED_ADMIN_PASSWORD ?? 'admin123'
  const adminPassword = await hash(adminPlain, 12)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@rcbeautysalon.org' },
    update: {},
    create: {
      name: 'Admin (demo)',
      email: 'admin@rcbeautysalon.org',
      password: adminPassword,
      role: 'ADMIN',
      emailVerified: new Date(),
    },
  })
  console.log(`✅ Admin: ${adminUser.email}`)

  // STAFF USERS (all staff can login)
  const staffPlain = process.env.SEED_STAFF_PASSWORD ?? 'staff123'
  const staffPassword = await hash(staffPlain, 12)

  const lauraUser = await prisma.user.upsert({
    where: { email: 'laura@rcbeautysalon.org' },
    update: {},
    create: {
      name: 'Maja Kovač',
      email: 'laura@rcbeautysalon.org',
      password: staffPassword,
      role: 'STAFF',
      emailVerified: new Date(),
    },
  })

  const mariaUser = await prisma.user.upsert({
    where: { email: 'maria@rcbeautysalon.org' },
    update: {},
    create: {
      name: 'Sara Horvat',
      email: 'maria@rcbeautysalon.org',
      password: staffPassword,
      role: 'STAFF',
      emailVerified: new Date(),
    },
  })

  const sofiaUser = await prisma.user.upsert({
    where: { email: 'sofia@rcbeautysalon.org' },
    update: {},
    create: {
      name: 'Nina Zupan',
      email: 'sofia@rcbeautysalon.org',
      password: staffPassword,
      role: 'STAFF',
      emailVerified: new Date(),
    },
  })

  const anaUser = await prisma.user.upsert({
    where: { email: 'ana@rcbeautysalon.org' },
    update: {},
    create: {
      name: 'Ana Novak',
      email: 'ana@rcbeautysalon.org',
      password: staffPassword,
      role: 'STAFF',
      emailVerified: new Date(),
    },
  })
  console.log(`✅ Staff Users: 4`)

  // CLIENT USERS (with Customer profiles)
  const clientPlain = process.env.SEED_CLIENTE_PASSWORD ?? 'cliente123'
  const clientPassword = await hash(clientPlain, 12)
  const clientUser = await prisma.user.upsert({
    where: { email: 'cliente@rcbeautysalon.org' },
    update: {},
    create: {
      name: 'John Doe',
      email: 'cliente@rcbeautysalon.org',
      password: clientPassword,
      role: 'CLIENTE',
      emailVerified: new Date(),
    },
  })

  const emilyUser = await prisma.user.upsert({
    where: { email: 'emily@example.com' },
    update: {},
    create: {
      name: 'Emily Johnson',
      email: 'emily@example.com',
      password: clientPassword,
      role: 'CLIENTE',
      emailVerified: new Date(),
    },
  })

  const michaelUser = await prisma.user.upsert({
    where: { email: 'michael@example.com' },
    update: {},
    create: {
      name: 'Michael Chen',
      email: 'michael@example.com',
      password: clientPassword,
      role: 'CLIENTE',
      emailVerified: new Date(),
    },
  })
  console.log(`✅ Client Users: 3`)

  // ============================================
  // 3. CATEGORIES
  // ============================================
  console.log('\nCreating categories...')
  const hairCategory = await prisma.category.upsert({
    where: { id: 'seed-category-hair' },
    update: {},
    create: { id: 'seed-category-hair', name: 'Frizerske storitve', slug: 'hair' },
  })

  const nailsCategory = await prisma.category.upsert({
    where: { id: 'seed-category-nails' },
    update: {},
    create: { id: 'seed-category-nails', name: 'Nohti', slug: 'nails' },
  })

  const facialCategory = await prisma.category.upsert({
    where: { id: 'seed-category-facial' },
    update: {},
    create: { id: 'seed-category-facial', name: 'Obraz in koža', slug: 'facial' },
  })

  const massageCategory = await prisma.category.upsert({
    where: { id: 'seed-category-massage' },
    update: {},
    create: { id: 'seed-category-massage', name: 'Masaža in spa', slug: 'massage' },
  })

  const productsCategory = await prisma.category.upsert({
    where: { id: 'seed-category-products' },
    update: {},
    create: { id: 'seed-category-products', name: 'Kozmetični izdelki', slug: 'products' },
  })
  console.log('✅ Categories: 5')

  // ============================================
  // 4. SERVICES (Enhanced with images and featured)
  // ============================================
  console.log('\nCreating services...')
  const haircut = await serviceUpsert({
    where: { slug: 'haircut-style' },
    update: {
      imageUrl: DEFAULT_CATALOG_IMAGES.haircut,
    },
    create: {
      name: 'Striženje in oblikovanje',
      slug: 'haircut-style',
      description: 'Profesionalno striženje, prilagojeno obliki obraza in vašemu življenjskemu slogu, zaključeno z oblikovanjem za urejen videz.',
      duration: 60,
      price: 75.0,
      imageUrl: DEFAULT_CATALOG_IMAGES.haircut,
      categoryId: hairCategory.id,
      isActive: true,
      isFeatured: true,
      order: 1,
    },
  })

  const coloring = await serviceUpsert({
    where: { slug: 'hair-coloring' },
    update: {
      imageUrl: DEFAULT_CATALOG_IMAGES.coloring,
    },
    create: {
      name: 'Barvanje las',
      slug: 'hair-coloring',
      description: 'Barvanje celotne glave s premium izdelki. Vključuje barvni posvet, nanos barve in regeneracijski tretmaj.',
      duration: 120,
      price: 150.0,
      imageUrl: DEFAULT_CATALOG_IMAGES.coloring,
      categoryId: hairCategory.id,
      isActive: true,
      isFeatured: true,
      order: 2,
    },
  })

  const highlights = await serviceUpsert({
    where: { slug: 'highlights' },
    update: {
      imageUrl: DEFAULT_CATALOG_IMAGES.highlights,
    },
    create: {
      name: 'Prameni in balayage',
      slug: 'highlights',
      description: 'Naravni prameni ali ročno naslikan balayage za dimenzijo in globino las.',
      duration: 150,
      price: 180.0,
      imageUrl: DEFAULT_CATALOG_IMAGES.highlights,
      categoryId: hairCategory.id,
      isActive: true,
      isFeatured: false,
    },
  })

  const keratin = await serviceUpsert({
    where: { slug: 'keratin-treatment' },
    update: {
      imageUrl: DEFAULT_CATALOG_IMAGES.hairTreatment,
    },
    create: {
      name: 'Keratin glajenje',
      slug: 'keratin-treatment',
      description: 'Glajevalni keratin tretmaj, ki odpravi frizz in skrajša čas oblikovanja do 3 mesecev.',
      duration: 180,
      price: 250.0,
      imageUrl: DEFAULT_CATALOG_IMAGES.hairTreatment,
      categoryId: hairCategory.id,
      isActive: true,
      isFeatured: false,
    },
  })

  const manicure = await serviceUpsert({
    where: { slug: 'manicure' },
    update: {
      imageUrl: DEFAULT_CATALOG_IMAGES.manicure,
    },
    create: {
      name: 'Klasična manikira',
      slug: 'manicure',
      description: 'Klasična manikira z oblikovanjem nohtov, nego kožice, masažo rok in lakiranjem.',
      duration: 45,
      price: 35.0,
      imageUrl: DEFAULT_CATALOG_IMAGES.manicure,
      categoryId: nailsCategory.id,
      isActive: true,
      isFeatured: true,
      order: 3,
    },
  })

  const pedicure = await serviceUpsert({
    where: { slug: 'pedicure' },
    update: {
      imageUrl: DEFAULT_CATALOG_IMAGES.spaPedicure,
    },
    create: {
      name: 'Spa pedikura',
      slug: 'pedicure',
      description: 'Sproščujoča spa pedikura s kopeljo za stopala, pilingom, masažo in lakiranjem. Idealna za utrujena stopala.',
      duration: 60,
      price: 50.0,
      imageUrl: DEFAULT_CATALOG_IMAGES.spaPedicure,
      categoryId: nailsCategory.id,
      isActive: true,
      isFeatured: true,
      order: 4,
    },
  })

  const gelNails = await serviceUpsert({
    where: { slug: 'gel-nails' },
    update: {
      imageUrl: DEFAULT_CATALOG_IMAGES.gelManicure,
    },
    create: {
      name: 'Gel manikira',
      slug: 'gel-nails',
      description: 'Trajna gel manikira z utrjevanjem pod LED svetilko. Zdrži do 3 tedne brez razpok.',
      duration: 60,
      price: 55.0,
      imageUrl: DEFAULT_CATALOG_IMAGES.gelManicure,
      categoryId: nailsCategory.id,
      isActive: true,
      isFeatured: false,
    },
  })

  const facial = await serviceUpsert({
    where: { slug: 'facial-treatment' },
    update: {
      imageUrl: DEFAULT_CATALOG_IMAGES.deepClean,
    },
    create: {
      name: 'Poglobljeno čiščenje obraza',
      slug: 'facial-treatment',
      description: 'Profesionalni tretmaj obraza s poglobljenim čiščenjem, pilingom, ekstrakcijo in hidratantno masko za sijočo kožo.',
      duration: 90,
      price: 120.0,
      imageUrl: DEFAULT_CATALOG_IMAGES.deepClean,
      categoryId: facialCategory.id,
      isActive: true,
      isFeatured: true,
      order: 5,
    },
  })

  const antiAging = await serviceUpsert({
    where: { slug: 'anti-aging-facial' },
    update: {
      imageUrl: DEFAULT_CATALOG_IMAGES.antiAging,
    },
    create: {
      name: 'Anti-aging tretmaj obraza',
      slug: 'anti-aging-facial',
      description: 'Napreden anti-aging tretmaj s peptidi in dvigom kolagena za zmanjšanje drobnih gub in bolj čvrsto kožo.',
      duration: 75,
      price: 140.0,
      imageUrl: DEFAULT_CATALOG_IMAGES.antiAging,
      categoryId: facialCategory.id,
      isActive: true,
      isFeatured: false,
    },
  })

  const microdermabrasion = await serviceUpsert({
    where: { slug: 'microdermabrasion' },
    update: {
      imageUrl: DEFAULT_CATALOG_IMAGES.facial,
    },
    create: {
      name: 'Mikrodermabrazija',
      slug: 'microdermabrasion',
      description: 'Neinvaziven piling, ki razkrije bolj gladko in mlajše izgledajočo kožo.',
      duration: 60,
      price: 110.0,
      imageUrl: DEFAULT_CATALOG_IMAGES.facial,
      categoryId: facialCategory.id,
      isActive: true,
      isFeatured: false,
    },
  })

  const massage = await serviceUpsert({
    where: { slug: 'relaxing-massage' },
    update: {
      imageUrl: DEFAULT_CATALOG_IMAGES.massage,
    },
    create: {
      name: 'Sproščujoča masaža',
      slug: 'relaxing-massage',
      description: 'Masaža celega telesa, ki sprošča napetosti, izboljša prekrvavitev in prinese globinsko sprostitev.',
      duration: 60,
      price: 90.0,
      imageUrl: DEFAULT_CATALOG_IMAGES.massage,
      categoryId: massageCategory.id,
      isActive: true,
      isFeatured: false,
    },
  })

  const hotStone = await serviceUpsert({
    where: { slug: 'hot-stone-massage' },
    update: {
      imageUrl: DEFAULT_CATALOG_IMAGES.hotStone,
    },
    create: {
      name: 'Masaža s toplimi kamni',
      slug: 'hot-stone-massage',
      description: 'Terapevtska masaža s segretimi kamni, ki stopi stres in mišično napetost.',
      duration: 90,
      price: 130.0,
      imageUrl: DEFAULT_CATALOG_IMAGES.hotStone,
      categoryId: massageCategory.id,
      isActive: true,
      isFeatured: false,
    },
  })
  console.log('✅ Services: 12 (5 featured)')

  // ============================================
  // 5. STAFF PROFILES (all with login)
  // ============================================
  console.log('\nCreating staff profiles...')

  const staffLaura = await prisma.staff.upsert({
    where: { userId: lauraUser.id },
    update: {
      name: 'Maja Kovač',
      image: DEFAULT_DEMO_MEDIA.staffLaura,
    },
    create: {
      name: 'Maja Kovač',
      email: 'laura@rcbeautysalon.org',
      phone: '+386 41 100 101',
      bio: 'Višja frizerka z več kot 15 leti izkušenj, specializirana za striženje, barvanje in keratin glajenje',
      image: DEFAULT_DEMO_MEDIA.staffLaura,
      isActive: true,
      userId: lauraUser.id,
    },
  })

  const staffMaria = await prisma.staff.upsert({
    where: { userId: mariaUser.id },
    update: {
      name: 'Sara Horvat',
      image: DEFAULT_DEMO_MEDIA.staffMaria,
    },
    create: {
      name: 'Sara Horvat',
      email: 'maria@rcbeautysalon.org',
      phone: '+386 41 111 222',
      bio: 'Izkušena barvarka in balayage specialistka s strastjo do naravnih pramenov',
      image: DEFAULT_DEMO_MEDIA.staffMaria,
      isActive: true,
      userId: mariaUser.id,
    },
  })

  const staffSofia = await prisma.staff.upsert({
    where: { userId: sofiaUser.id },
    update: {
      name: 'Nina Zupan',
      image: DEFAULT_DEMO_MEDIA.staffSofia,
    },
    create: {
      name: 'Nina Zupan',
      email: 'sofia@rcbeautysalon.org',
      phone: '+386 41 333 444',
      bio: 'Certificirana tehničarka za nohte, specializirana za gel manikiro, nail art in spa pedikuro',
      image: DEFAULT_DEMO_MEDIA.staffSofia,
      isActive: true,
      userId: sofiaUser.id,
    },
  })

  const staffAna = await prisma.staff.upsert({
    where: { userId: anaUser.id },
    update: {
      name: 'Ana Novak',
      image: DEFAULT_DEMO_MEDIA.staffAna,
    },
    create: {
      name: 'Ana Novak',
      email: 'ana@rcbeautysalon.org',
      phone: '+386 41 555 666',
      bio: 'Licencirana kozmetičarka in masažerka, specializirana za anti-aging tretmaje in terapevtske masaže',
      image: DEFAULT_DEMO_MEDIA.staffAna,
      isActive: true,
      userId: anaUser.id,
    },
  })
  console.log('✅ Staff: 4 (all with login access)')

  // ============================================
  // 6. CUSTOMER PROFILES
  // ============================================
  console.log('\nCreating customer profiles...')

  const customerJohn = await prisma.customer.upsert({
    where: { userId: clientUser.id },
    update: {},
    create: {
      name: 'John Doe',
      email: 'cliente@rcbeautysalon.org',
      phone: '+386 40 200 202',
      notes: 'Redna stranka, za striženje raje izbere Laro',
      userId: clientUser.id,
    },
  })

  const customerEmily = await prisma.customer.upsert({
    where: { userId: emilyUser.id },
    update: {},
    create: {
      name: 'Emily Johnson',
      email: 'emily@example.com',
      phone: '+386 40 300 303',
      notes: 'Obožuje tretmaje obraza in spa tretmaje',
      userId: emilyUser.id,
    },
  })

  const customerMichael = await prisma.customer.upsert({
    where: { userId: michaelUser.id },
    update: {},
    create: {
      name: 'Michael Chen',
      email: 'michael@example.com',
      phone: '+386 40 400 404',
      userId: michaelUser.id,
    },
  })

  // Walk-in customer (no account)
  const customerJessica = await prisma.customer.upsert({
    where: { id: 'customer_jessica' },
    update: {},
    create: {
      id: 'customer_jessica',
      name: 'Jessica Smith',
      email: 'jessica@example.com',
      phone: '+386 40 777 888',
      notes: 'Stranka brez predhodne prijave, raje pride zjutraj',
    },
  })
  console.log('✅ Customers: 4 (3 with accounts, 1 walk-in)')

  // ============================================
  // 7. STAFF SERVICES (assign services to staff)
  // ============================================
  console.log('\nAssigning services to staff...')

  await prisma.staffService.deleteMany({})

  await prisma.staffService.createMany({
    data: [
      // Laura - Hair services
      { staffId: staffLaura.id, serviceId: haircut.id },
      { staffId: staffLaura.id, serviceId: coloring.id },
      { staffId: staffLaura.id, serviceId: highlights.id },
      { staffId: staffLaura.id, serviceId: keratin.id },
      // Maria - Hair services
      { staffId: staffMaria.id, serviceId: haircut.id },
      { staffId: staffMaria.id, serviceId: coloring.id },
      { staffId: staffMaria.id, serviceId: highlights.id },
      // Sofia - Nail services
      { staffId: staffSofia.id, serviceId: manicure.id },
      { staffId: staffSofia.id, serviceId: pedicure.id },
      { staffId: staffSofia.id, serviceId: gelNails.id },
      // Ana - Facial and Massage services
      { staffId: staffAna.id, serviceId: facial.id },
      { staffId: staffAna.id, serviceId: antiAging.id },
      { staffId: staffAna.id, serviceId: microdermabrasion.id },
      { staffId: staffAna.id, serviceId: massage.id },
      { staffId: staffAna.id, serviceId: hotStone.id },
    ],
  })
  console.log('✅ Staff services assigned')

  // ============================================
  // 8. WORKING HOURS (Monday-Friday, 9am-6pm)
  // ============================================
  console.log('\nCreating working hours...')

  await prisma.workingHours.deleteMany({})

  const workingHoursData = []
  const allStaff = [staffLaura, staffMaria, staffSofia, staffAna]

  for (const staff of allStaff) {
    // Monday (1) to Friday (5)
    for (let day = 1; day <= 5; day++) {
      workingHoursData.push({
        staffId: staff.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      })
    }
  }

  await prisma.workingHours.createMany({
    data: workingHoursData,
  })
  console.log('✅ Working hours: 20 entries (4 staff x 5 days)')

  // ============================================
  // 9. REVIEWS / TESTIMONIALS
  // ============================================
  console.log('\nCreating service reviews...')

  await prisma.review.deleteMany({})

  // P2 #75: ocene zdaj pripadajo najemniku (organizationId NOT NULL).
  // Legacy demo vrstice nimajo najemnika — demo- predpona je notranji
  // najemnik (izključen iz sitemap/SEO), podatki pa ostanejo dekorativni.
  const demoReviewOrg = await prisma.organization.upsert({
    where: { slug: 'demo-salon' },
    update: {},
    create: { slug: 'demo-salon', name: 'Demo Salon', vertical: 'beauty', plan: 'free' },
    select: { id: true },
  })

  await prisma.review.createMany({
    data: [
      {
        rating: 5,
        comment: 'Lara mi je naredila najboljše striženje, kar ga imam! Resnično je prisluhnila, kar sem želela, rezultat pa je popoln. Toplo priporočam!',
        serviceId: haircut.id,
        userId: customerJohn.userId!,
        organizationId: demoReviewOrg.id,
        isActive: true,
      },
      {
        rating: 5,
        comment: 'Marija je čudežna z barvo! Moj balayage izgleda tako naravno in lepo. Pohvale dobim na vseh straneh.',
        serviceId: coloring.id,
        userId: customerEmily.userId!,
        organizationId: demoReviewOrg.id,
        isActive: true,
      },
      {
        rating: 5,
        comment: 'Tretmaj obraza je bil neverjeten! Moja koža je neverjetno mehka in osvežena. Ana res zna svoje.',
        serviceId: facial.id,
        userId: customerMichael.userId!,
        organizationId: demoReviewOrg.id,
        isActive: true,
      },
      {
        rating: 5,
        comment: 'Najboljša pedikura, kar sem jih imela! Sofija je izjemno natančna, masaža pa je bila nebeška. Zagotovo se vračam!',
        serviceId: pedicure.id,
        userId: customerEmily.userId!,
        organizationId: demoReviewOrg.id,
        isActive: true,
      },
      {
        rating: 4,
        comment: 'Odlična storitev in prijazno osebje. Gel manikira je zdržala 3 tedne brez razpok!',
        serviceId: gelNails.id,
        userId: customerJohn.userId!,
        organizationId: demoReviewOrg.id,
        isActive: true,
      },
    ],
  })
  console.log('✅ Reviews: 5')

  // ============================================
  // 10. SERVICE GALLERY (Before/After photos)
  // ============================================
  console.log('\nCreating service gallery...')

  await prisma.serviceGallery.deleteMany({})

  await prisma.serviceGallery.createMany({
    data: [
      { imageUrl: 'gallery/hair-1', caption: 'Beautiful balayage transformation', order: 1, serviceId: coloring.id },
      { imageUrl: 'gallery/hair-2', caption: 'Before and after haircut', order: 2, serviceId: haircut.id },
      { imageUrl: 'gallery/nails-1', caption: 'Gel manicure with nail art', order: 1, serviceId: gelNails.id },
      { imageUrl: 'gallery/facial-1', caption: 'Glowing skin after facial treatment', order: 1, serviceId: facial.id },
      { imageUrl: 'gallery/hair-3', caption: 'Keratin treatment results', order: 1, serviceId: keratin.id },
    ],
  })
  console.log('✅ Gallery: 5 images')

  // ============================================
  // 11. SERVICE FAQs
  // ============================================
  console.log('\nCreating service FAQs...')

  await prisma.serviceFAQ.deleteMany({})

  await prisma.serviceFAQ.createMany({
    data: [
      {
        question: 'Kako dolgo zdrži barva?',
        answer: 'Ob pravilni negi barva zdrži 4–6 tednov. Priporočamo šampon in balzam za barvane lase.',
        order: 1,
        serviceId: coloring.id,
      },
      {
        question: 'Kaj naj naredim pred prihodom na striženje?',
        answer: 'Če je mogoče, pridite s čistimi in suhimi lasmi. Če imate določen slog v mislih, prinesite sliko za navdih!',
        order: 1,
        serviceId: haircut.id,
      },
      {
        question: 'Kako pogosto naj hodim na tretmaj obraza?',
        answer: 'Za najboljše rezultate priporočamo tretmaj obraza enkrat na mesec. Pogostost pa je odvisna od vašega tipa kože in potreb.',
        order: 1,
        serviceId: facial.id,
      },
      {
        question: 'Kako dolgo zdrži gel manikira?',
        answer: 'Pri pravilni negi gel manikira tipično zdrži 2–3 tedne brez razpok.',
        order: 1,
        serviceId: gelNails.id,
      },
      {
        question: 'Ali si lahko umijem lase po keratin tretmaju?',
        answer: 'Po tretmaju počakajte 72 ur, preden si umijete lase, da se keratin popolnoma utrdi.',
        order: 1,
        serviceId: keratin.id,
      },
    ],
  })
  console.log('✅ FAQs: 5')

  // ============================================
  // 12. SAMPLE APPOINTMENTS (for testing)
  // ============================================
  console.log('\nCreating sample appointments...')

  await prisma.appointment.deleteMany({})

  const today = new Date()
  const tomorrow = addDays(today, 1)
  const dayAfterTomorrow = addDays(today, 2)
  const nextWeek = addDays(today, 7)
  const twoDaysAgo = addDays(today, -2)
  const threeDaysAgo = addDays(today, -3)
  const lastWeek = addDays(today, -7)
  const twoWeeksAgo = addDays(today, -14)

  // === FUTURE APPOINTMENTS ===

  // Tomorrow - Confirmed (paid)
  await prisma.appointment.create({
    data: {
      staffId: staffLaura.id,
      customerId: customerJohn.id,
      startTime: setMinutes(setHours(tomorrow, 10), 0),
      endTime: setMinutes(setHours(tomorrow, 11), 0),
      status: 'CONFIRMED',
      notes: 'Redno striženje – raje krajše na straneh',
      totalPrice: 75.0,
      depositAmount: 50.0,
      depositPaid: true,
      services: {
        create: [{ serviceId: haircut.id }],
      },
    },
  })

  // Tomorrow - Confirmed (paid) - Another client
  await prisma.appointment.create({
    data: {
      staffId: staffSofia.id,
      customerId: customerEmily.id,
      startTime: setMinutes(setHours(tomorrow, 14), 0),
      endTime: setMinutes(setHours(tomorrow, 15), 0),
      status: 'CONFIRMED',
      totalPrice: 55.0,
      depositAmount: 50.0,
      depositPaid: true,
      services: {
        create: [{ serviceId: gelNails.id }],
      },
    },
  })

  // Day after tomorrow - Pending payment
  await prisma.appointment.create({
    data: {
      staffId: staffAna.id,
      customerId: customerMichael.id,
      startTime: setMinutes(setHours(dayAfterTomorrow, 11), 0),
      endTime: setMinutes(setHours(dayAfterTomorrow, 12), 30),
      status: 'PENDING',
      totalPrice: 120.0,
      depositAmount: 50.0,
      depositPaid: false,
      services: {
        create: [{ serviceId: facial.id }],
      },
    },
  })

  // Next week - Confirmed (multiple services)
  await prisma.appointment.create({
    data: {
      staffId: staffMaria.id,
      customerId: customerEmily.id,
      startTime: setMinutes(setHours(nextWeek, 10), 0),
      endTime: setMinutes(setHours(nextWeek, 14), 30),
      status: 'CONFIRMED',
      notes: 'Popolna barvna prenova',
      totalPrice: 330.0,
      depositAmount: 50.0,
      depositPaid: true,
      services: {
        create: [
          { serviceId: coloring.id },
          { serviceId: highlights.id },
        ],
      },
    },
  })

  // === PAST APPOINTMENTS ===

  // 2 days ago - Completed
  await prisma.appointment.create({
    data: {
      staffId: staffSofia.id,
      customerId: customerEmily.id,
      startTime: setMinutes(setHours(twoDaysAgo, 11), 0),
      endTime: setMinutes(setHours(twoDaysAgo, 12), 0),
      status: 'COMPLETED',
      totalPrice: 50.0,
      depositAmount: 50.0,
      depositPaid: true,
      services: {
        create: [{ serviceId: pedicure.id }],
      },
    },
  })

  // 3 days ago - Completed
  await prisma.appointment.create({
    data: {
      staffId: staffLaura.id,
      customerId: customerMichael.id,
      startTime: setMinutes(setHours(threeDaysAgo, 15), 0),
      endTime: setMinutes(setHours(threeDaysAgo, 16), 0),
      status: 'COMPLETED',
      totalPrice: 75.0,
      depositAmount: 50.0,
      depositPaid: true,
      services: {
        create: [{ serviceId: haircut.id }],
      },
    },
  })

  // Last week - NO_SHOW (client didn't show up, lost deposit)
  await prisma.appointment.create({
    data: {
      staffId: staffAna.id,
      customerId: customerJessica.id,
      startTime: setMinutes(setHours(lastWeek, 14), 0),
      endTime: setMinutes(setHours(lastWeek, 15), 30),
      status: 'NO_SHOW',
      notes: 'Stranka ni prišla – polog izpade',
      totalPrice: 130.0,
      depositAmount: 50.0,
      depositPaid: true,
      services: {
        create: [{ serviceId: hotStone.id }],
      },
    },
  })

  // Last week - CANCELLED by client
  await prisma.appointment.create({
    data: {
      staffId: staffMaria.id,
      customerId: customerJohn.id,
      startTime: setMinutes(setHours(lastWeek, 10), 0),
      endTime: setMinutes(setHours(lastWeek, 12), 0),
      status: 'CANCELLED',
      notes: 'Preklicala stranka – nujni primer',
      totalPrice: 150.0,
      depositAmount: 50.0,
      depositPaid: true,
      services: {
        create: [{ serviceId: coloring.id }],
      },
    },
  })

  // 2 weeks ago - Completed
  await prisma.appointment.create({
    data: {
      staffId: staffSofia.id,
      customerId: customerJohn.id,
      startTime: setMinutes(setHours(twoWeeksAgo, 16), 0),
      endTime: setMinutes(setHours(twoWeeksAgo, 17), 0),
      status: 'COMPLETED',
      totalPrice: 35.0,
      depositAmount: 50.0,
      depositPaid: true,
      services: {
        create: [{ serviceId: manicure.id }],
      },
    },
  })

  // 2 weeks ago - Completed (walk-in guest)
  await prisma.appointment.create({
    data: {
      staffId: staffAna.id,
      guestName: 'Sarah Williams',
      guestEmail: 'sarah.w@example.com',
      guestPhone: '+386 40 999 000',
      startTime: setMinutes(setHours(twoWeeksAgo, 11), 0),
      endTime: setMinutes(setHours(twoWeeksAgo, 12), 0),
      status: 'COMPLETED',
      totalPrice: 90.0,
      depositAmount: 50.0,
      depositPaid: true,
      services: {
        create: [{ serviceId: massage.id }],
      },
    },
  })

  console.log('✅ Appointments: 10 (4 future, 6 past)')
  console.log('   → Future: 3 CONFIRMED, 1 PENDING')
  console.log('   → Past: 4 COMPLETED, 1 NO_SHOW, 1 CANCELLED')

  // ============================================
  // 13. PRODUCTS
  // ============================================
  console.log('\nCreating products...')

  await prisma.product.deleteMany({})

  await prisma.product.createMany({
    data: [
      {
        name: 'Premium šampon za lase',
        description: 'Profesionalni šampon brez sulfatov za vse tipe las. Nežno čisti in ohranja naravna olja.',
        price: 28.0,
        compareAtPrice: 35.0,
        sku: 'SHP-001',
        stockQuantity: 50,
        images: [DEFAULT_DEMO_MEDIA.productShampoo],
        categoryId: productsCategory.id,
        isActive: true,
        isFeatured: true,
      },
      {
        name: 'Regeneracijski tretmaj za lase',
        description: 'Intenziven regeneracijski tretmaj, ki popravi poškodovane lase in jim da sijaj. Za najboljše rezultate uporabljajte tedensko.',
        price: 32.0,
        compareAtPrice: 40.0,
        sku: 'CND-001',
        stockQuantity: 45,
        images: [DEFAULT_DEMO_MEDIA.productConditioner],
        categoryId: productsCategory.id,
        isActive: true,
        isFeatured: true,
      },
      {
        name: 'Anti-aging serum za obraz',
        description: 'Zmogljiv anti-aging serum z vitaminom C, hialuronsko kislino in peptidi. Zmanjšuje drobne gube in posvetli kožo.',
        price: 65.0,
        compareAtPrice: 80.0,
        sku: 'SRM-001',
        stockQuantity: 30,
        images: [DEFAULT_DEMO_MEDIA.productFacialSerum],
        categoryId: productsCategory.id,
        isActive: true,
        isFeatured: true,
      },
      {
        name: 'Set premium lakov za nohte',
        description: 'Set 5 dolgotrajnih lakov za nohte v modernih barvah. Formula odporna na razpokanje.',
        price: 45.0,
        sku: 'NPL-001',
        stockQuantity: 25,
        images: [DEFAULT_DEMO_MEDIA.productNailPolish],
        categoryId: productsCategory.id,
        isActive: true,
        isFeatured: false,
      },
      {
        name: 'Hidratantna krema za obraz',
        description: 'Krema z 24-urno hidracijo in zaščito SPF 30. Popolna za vsakodnevno uporabo.',
        price: 42.0,
        compareAtPrice: 55.0,
        sku: 'FCR-001',
        stockQuantity: 35,
        images: [DEFAULT_DEMO_MEDIA.productFaceCream],
        categoryId: productsCategory.id,
        isActive: true,
        isFeatured: false,
      },
      {
        name: 'Serum za rast las',
        description: 'Spodbuja rast las in krepi lasne mešičke. Vidni rezultati v 8–12 tednih.',
        price: 58.0,
        sku: 'HGS-001',
        stockQuantity: 20,
        images: [DEFAULT_DEMO_MEDIA.productHairSerum],
        categoryId: productsCategory.id,
        isActive: true,
        isFeatured: false,
      },
    ],
  })
  console.log('✅ Products: 6 (3 featured)')

  // Get products for orders
  const products = await prisma.product.findMany()
  const shampoo = products.find(p => p.sku === 'SHP-001')!
  const conditioner = products.find(p => p.sku === 'CND-001')!
  const serum = products.find(p => p.sku === 'SRM-001')!
  const nailPolish = products.find(p => p.sku === 'NPL-001')!
  const faceCream = products.find(p => p.sku === 'FCR-001')!
  const hairSerum = products.find(p => p.sku === 'HGS-001')!

  // ============================================
  // 14. SAMPLE ORDERS (for testing)
  // ============================================
  console.log('\nCreating sample orders...')

  await prisma.order.deleteMany({})

  // Order 1 - COMPLETED (picked up) - 1 week ago
  await prisma.order.create({
    data: {
      customerId: customerJohn.id,
      subtotal: 60.0,
      tax: 4.95,
      total: 64.95,
      status: 'COMPLETED',
      stripePaymentIntentId: 'pi_test_completed_1',
      createdAt: lastWeek,
      items: {
        create: [
          { productId: shampoo.id, quantity: 1, price: 28.0 },
          { productId: conditioner.id, quantity: 1, price: 32.0 },
        ],
      },
    },
  })

  // Order 2 - COMPLETED - 2 weeks ago
  await prisma.order.create({
    data: {
      customerId: customerEmily.id,
      subtotal: 107.0,
      tax: 8.83,
      total: 115.83,
      status: 'COMPLETED',
      stripePaymentIntentId: 'pi_test_completed_2',
      createdAt: twoWeeksAgo,
      items: {
        create: [
          { productId: serum.id, quantity: 1, price: 65.0 },
          { productId: faceCream.id, quantity: 1, price: 42.0 },
        ],
      },
    },
  })

  // Order 3 - PAID (ready for pickup) - yesterday
  const yesterday = addDays(today, -1)
  await prisma.order.create({
    data: {
      customerId: customerMichael.id,
      subtotal: 58.0,
      tax: 4.79,
      total: 62.79,
      status: 'PAID',
      stripePaymentIntentId: 'pi_test_paid_1',
      createdAt: yesterday,
      items: {
        create: [
          { productId: hairSerum.id, quantity: 1, price: 58.0 },
        ],
      },
    },
  })

  // Order 4 - PENDING (not paid yet) - today
  await prisma.order.create({
    data: {
      customerId: customerEmily.id,
      subtotal: 73.0,
      tax: 6.02,
      total: 79.02,
      status: 'PENDING',
      createdAt: today,
      items: {
        create: [
          { productId: shampoo.id, quantity: 1, price: 28.0 },
          { productId: nailPolish.id, quantity: 1, price: 45.0 },
        ],
      },
    },
  })

  // Order 5 - CANCELLED - 3 days ago
  await prisma.order.create({
    data: {
      customerId: customerJohn.id,
      subtotal: 65.0,
      tax: 5.36,
      total: 70.36,
      status: 'CANCELLED',
      notes: 'Stranka si je premislila',
      createdAt: threeDaysAgo,
      items: {
        create: [
          { productId: serum.id, quantity: 1, price: 65.0 },
        ],
      },
    },
  })

  // Order 6 - COMPLETED (guest order) - 5 days ago
  const fiveDaysAgo = addDays(today, -5)
  await prisma.order.create({
    data: {
      guestName: 'Amanda Wilson',
      guestEmail: 'amanda.w@example.com',
      guestPhone: '+386 40 888 777',
      subtotal: 135.0,
      tax: 11.14,
      total: 146.14,
      status: 'COMPLETED',
      stripePaymentIntentId: 'pi_test_guest_1',
      createdAt: fiveDaysAgo,
      items: {
        create: [
          { productId: shampoo.id, quantity: 1, price: 28.0 },
          { productId: conditioner.id, quantity: 1, price: 32.0 },
          { productId: serum.id, quantity: 1, price: 65.0 },
          { productId: faceCream.id, quantity: 1, price: 42.0 },
        ],
      },
    },
  })

  console.log('✅ Orders: 6')
  console.log('   → 3 COMPLETED, 1 PAID, 1 PENDING, 1 CANCELLED')

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(60))
  console.log('✨ Seeding completed successfully!')
  console.log('='.repeat(60))
  console.log('\n📋 COMPLETE DATABASE SUMMARY:')
  console.log(`\n🏢 Salon: ${salonConfig.name}`)
  console.log(`   📍 ${salonConfig.address}, ${salonConfig.city}, ${salonConfig.state}`)
  console.log(`   📞 ${salonConfig.phone}`)
  console.log(`   💵 Deposit: $${salonConfig.bookingDeposit.toFixed(2)} (non-refundable)`)

  console.log('\n👥 USERS (Login Credentials):')
  console.log(`   🔑 Admin: admin@rcbeautysalon.org / ${process.env.SEED_ADMIN_PASSWORD ? '(nastavljeno prek SEED_ADMIN_PASSWORD)' : 'admin123'}`)
  console.log(`      → Full dashboard access`)
  console.log(`   👨‍💼 Staff (password: ${process.env.SEED_STAFF_PASSWORD ? '(nastavljeno prek SEED_STAFF_PASSWORD)' : 'staff123'}):`)
  console.log(`      • laura@rcbeautysalon.org - ${staffLaura.name}`)
  console.log(`      • maria@rcbeautysalon.org - ${staffMaria.name}`)
  console.log(`      • sofia@rcbeautysalon.org - ${staffSofia.name}`)
  console.log(`      • ana@rcbeautysalon.org - ${staffAna.name}`)
  console.log(`   👤 Clients (password: ${process.env.SEED_CLIENTE_PASSWORD ? '(nastavljeno prek SEED_CLIENTE_PASSWORD)' : 'cliente123'}):`)
  console.log(`      • cliente@rcbeautysalon.org - ${customerJohn.name}`)
  console.log(`      • emily@example.com - ${customerEmily.name}`)
  console.log(`      • michael@example.com - ${customerMichael.name}`)

  console.log('\n📊 DATABASE STATISTICS:')
  console.log(`   ✨ Categories: 5`)
  console.log(`   💇 Services: 12 (5 featured)`)
  console.log(`   👥 Staff: 4 (all with login)`)
  console.log(`   🙋 Customers: 4 (3 with accounts, 1 walk-in)`)
  console.log(`   ⭐ Reviews: 5`)
  console.log(`   📸 Gallery Images: 5`)
  console.log(`   ❓ FAQs: 5`)
  console.log(`   📅 Appointments: 10 (4 future, 6 past)`)
  console.log(`      → Future: 3 CONFIRMED, 1 PENDING`)
  console.log(`      → Past: 4 COMPLETED, 1 NO_SHOW, 1 CANCELLED`)
  console.log(`   🛍️  Products: 6 (3 featured)`)
  console.log(`   🛒 Orders: 6`)
  console.log(`      → 3 COMPLETED, 1 PAID, 1 PENDING, 1 CANCELLED`)
  console.log(`   🕐 Working Hours: 20 entries (Mon-Fri, 9am-6pm)`)

  console.log('\n🌐 CLOUDINARY IMAGES NEEDED:')
  console.log(`   Services: services/haircut, services/coloring, services/highlights, etc.`)
  console.log(`   Staff: staff/laura-thompson, staff/maria-rodriguez, staff/sofia-martinez, staff/ana-garcia`)
  console.log(`   Products: products/shampoo-premium, products/conditioner, products/serum, etc.`)
  console.log(`   Gallery: gallery/hair-1, gallery/hair-2, gallery/nails-1, etc.`)
  console.log('')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
