/**
 * #105 — ZAČASNA emergency ruta za čiščenje produkcijske baze.
 *
 * Varnost:
 *  - samo POST
 *  - zahteva header `x-fix-key` === process.env.FIX_KEY (timing-safe primerjava)
 *  - FIX_KEY je 48-znakovni naključni hex, ustvarjen izključno za ta poseg
 *  - ruta se po uporabi ODSTRANI iz repozitorija (ločen commit) in FIX_KEY izbriše
 *
 * Naloge (query param `task`):
 *  - scan   : evidence vrstic z vzorcem (defacer.id | raxor404) čez vse javne tabele
 *  - users  : seznam vseh uporabnikov (pregled neznanih računov)
 *  - clean  : popravek prizadetih Products (name/sku/isActive) — isti učinek kot
 *             `APPLY=1 node scripts/cleanup-suspicious-product.mjs`
 *  - rotate : nova gesla za seed skupine (ADMIN/STAFF/CLIENTE) — bcrypt cost 12,
 *             isti učinek kot `APPLY=1 node scripts/rotate-seed-passwords.mjs`
 *
 * Vir: issues #105, runbook v scripts/cleanup-suspicious-product.mjs in
 * scripts/rotate-seed-passwords.mjs (obema enaka logika, tu prilagojena runtime-u).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { randomBytes, timingSafeEqual } from 'crypto'

const NEEDLES = ['defacer.id', 'raxor404']
const FIX_NAME = 'Anti-Aging Facial Serum'
const FIX_SKU = 'SRM-001'

/** Skupine za rotacijo gesel — identično scripts/rotate-seed-passwords.mjs. */
const GROUPS = [
  { name: 'ADMIN', emails: ['admin@rcbeautysalon.org'] },
  {
    name: 'STAFF',
    emails: [
      'laura@rcbeautysalon.org',
      'maria@rcbeautysalon.org',
      'sofia@rcbeautysalon.org',
      'ana@rcbeautysalon.org',
    ],
  },
  {
    name: 'CLIENTE',
    emails: ['cliente@rcbeautysalon.org', 'emily@example.com', 'michael@example.com'],
  },
] as const

const INSENSITIVE_OR = NEEDLES.map((n) => ({ contains: n, mode: 'insensitive' as const }))

function flag(text: unknown): string[] {
  if (typeof text !== 'string') return []
  return NEEDLES.filter((n) => text.toLowerCase().includes(n.toLowerCase()))
}

function checkKey(req: NextRequest): boolean {
  const expected = process.env.FIX_KEY
  const provided = req.headers.get('x-fix-key') ?? ''
  if (!expected || expected.length === 0) return false
  if (provided.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'))
  } catch {
    return false
  }
}

function evidence(
  row: { id: string; createdAt: Date; updatedAt: Date; organizationId?: string | null },
  fields: string[],
  extra: Record<string, unknown> = {}
) {
  return {
    id: row.id,
    organizationId: row.organizationId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extra,
    matchedFields: fields,
  }
}

async function scanProducts() {
  const rows = await prisma.product.findMany({
    where: { OR: INSENSITIVE_OR.flatMap((c) => [{ name: c }, { sku: c }, { description: c }]) },
  })
  return rows.map((row) => {
    const fields = [
      flag(row.name).length > 0 && ['name'],
      flag(row.sku).length > 0 && ['sku'],
      flag(row.description).length > 0 && ['description'],
    ]
      .filter(Boolean)
      .flat() as string[]
    return evidence(row, fields, {
      name: row.name,
      sku: row.sku,
      isActive: row.isActive,
      presetSeed: row.presetSeed,
    })
  })
}

async function scanOthers() {
  const out: Record<string, unknown[]> = {}

  const services = await prisma.service.findMany({
    where: { OR: INSENSITIVE_OR.flatMap((c) => [{ name: c }, { description: c }]) },
    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  out.services = services.map((r) =>
    evidence(
      r,
      [
        flag(r.name).length > 0 && 'name',
        flag(r.description).length > 0 && 'description',
      ].filter(Boolean) as string[],
      { name: r.name }
    )
  )

  const categories = await prisma.category.findMany({
    where: { OR: INSENSITIVE_OR.map((c) => ({ name: c })) },
    select: { id: true, organizationId: true, name: true, createdAt: true, updatedAt: true },
  })
  out.categories = categories.map((r) => evidence(r, ['name'], { name: r.name }))

  const staff = await prisma.staff.findMany({
    where: { OR: INSENSITIVE_OR.map((c) => ({ name: c })) },
    select: { id: true, organizationId: true, name: true, createdAt: true, updatedAt: true },
  })
  out.staff = staff.map((r) => evidence(r, ['name'], { name: r.name }))

  const orgs = await prisma.organization.findMany({
    where: { OR: INSENSITIVE_OR.map((c) => ({ name: c })) },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  })
  out.organizations = orgs.map((r) => evidence(r, ['name'], { name: r.name }))

  const forms = await prisma.formDefinition.findMany({
    where: { OR: INSENSITIVE_OR.map((c) => ({ name: c })) },
    select: { id: true, organizationId: true, name: true, createdAt: true, updatedAt: true },
  })
  out.formDefinitions = forms.map((r) => evidence(r, ['name'], { name: r.name }))

  const reviews = await prisma.review.findMany({
    where: { OR: INSENSITIVE_OR.map((c) => ({ comment: c })) },
    select: { id: true, organizationId: true, comment: true, createdAt: true, updatedAt: true },
  })
  out.reviews = reviews.map((r) => evidence(r, ['comment'], { comment: r.comment }))

  return out
}

async function listUsers() {
  const rows = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      organizationId: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  return rows
}

async function cleanProducts() {
  const affected = await scanProducts()
  const fixed: Array<{ id: string; name: string; sku: string | null; isActive: boolean }> = []
  for (const row of affected) {
    const updated = await prisma.product.update({
      where: { id: row.id },
      data: { name: FIX_NAME, sku: FIX_SKU, isActive: false },
      select: { id: true, name: true, sku: true, isActive: true },
    })
    fixed.push(updated)
  }
  return { affectedCount: affected.length, fixed }
}

async function rotatePasswords() {
  const generated: Array<{ group: string; email: string; password: string }> = []
  const updated: string[] = []
  for (const group of GROUPS) {
    for (const email of group.emails) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, role: true },
      })
      if (!user) {
        generated.push({ group: group.name, email, password: '(NE OBSTAJA — preskočeno)' })
        continue
      }
      const plain = randomBytes(12).toString('base64url')
      const hashed = await hash(plain, 12)
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
      generated.push({ group: group.name, email, password: plain })
      updated.push(email)
    }
  }
  return { rotatedCount: updated.length, generated }
}

export async function POST(req: NextRequest) {
  if (!checkKey(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const task = req.nextUrl.searchParams.get('task')

  try {
    switch (task) {
      case 'scan': {
        const products = await scanProducts()
        const others = await scanOthers()
        const othersTotal = Object.values(others).reduce((s, r) => s + r.length, 0)
        return NextResponse.json({ task, products, others, othersTotal })
      }
      case 'users':
        return NextResponse.json({ task: 'users', users: await listUsers() })
      case 'clean': {
        const result = await cleanProducts()
        return NextResponse.json({ task: 'clean', ...result })
      }
      case 'rotate': {
        const result = await rotatePasswords()
        return NextResponse.json({ task: 'rotate', ...result })
      }
      default:
        return NextResponse.json({ error: 'unknown task' }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
