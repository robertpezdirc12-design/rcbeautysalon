#!/usr/bin/env node
/**
 * #105 — Rotacija gesel seed računov (incidentni runbook, evidence-first).
 *
 * Vzrok: prisma/seed.ts vsebuje JAVNO objavljena gesla (admin123/staff123/cliente123),
 * repo je javen. Če produkcijska baza vsebuje te račune s temi gesli, je to
 * najverjetnejši vektor vnosa za XSS payload (issue #105).
 *
 * RABA:
 *   DRY-RUN (privzeto, nič ne spremeni — samo evidenca):
 *     DATABASE_URL="postgres://…" node scripts/rotate-seed-passwords.mjs
 *
 *   APPLY (zapiše nova gesla):
 *     a) samodejna močna gesla (izpisana ENKRAT na koncu):
 *        DATABASE_URL="postgres://…" APPLY=1 node scripts/rotate-seed-passwords.mjs
 *     b) lastna gesla (min. 12 znakov):
 *        DATABASE_URL="postgres://…" APPLY=1 \
 *          ADMIN_PASSWORD="…" STAFF_PASSWORD="…" CLIENTE_PASSWORD="…" \
 *          node scripts/rotate-seed-passwords.mjs
 *
 * Opombe:
 *  - STAFF_PASSWORD velja za vse 4 staff račune (laura/maria/sofia/ana), kot v seed.
 *  - Gesla se hashirajo z bcryptjs, cost 12 — enako kot prisma/seed.ts.
 *  - Skript NE ustvarja računov in NE briše ničesar; posodobi samo `password`
 *    pri znanih seed e-poštnih naslovih.
 *  - Po APPLY preveri prijavo in SHRANI izpisana gesla (izpisek je enkraten).
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import crypto from 'node:crypto'

const GROUPS = [
  {
    key: 'ADMIN',
    env: 'ADMIN_PASSWORD',
    label: 'Admin',
    emails: ['admin@rcbeautysalon.org'],
  },
  {
    key: 'STAFF',
    env: 'STAFF_PASSWORD',
    label: 'Staff',
    emails: [
      'laura@rcbeautysalon.org',
      'maria@rcbeautysalon.org',
      'sofia@rcbeautysalon.org',
      'ana@rcbeautysalon.org',
    ],
  },
  {
    key: 'CLIENTE',
    env: 'CLIENTE_PASSWORD',
    label: 'Client',
    emails: [
      'cliente@rcbeautysalon.org',
      'emily@example.com',
      'michael@example.com',
    ],
  },
]

const APPLY = process.env.APPLY === '1'
const MIN_LEN = 12

function generatePassword() {
  // 16 znakov base64url (~96 bitov entropije) — varno za prijavne obrazce.
  return crypto.randomBytes(12).toString('base64url')
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Napaka: manjka DATABASE_URL.')
    process.exit(1)
  }

  const prisma = new PrismaClient()

  try {
    const allEmails = GROUPS.flatMap((g) => g.emails)
    const users = await prisma.user.findMany({
      where: { email: { in: allEmails } },
      select: { email: true, role: true, password: true, updatedAt: true },
    })
    const byEmail = new Map(users.map((u) => [u.email, u]))

    console.log('── Users: ', users.length, 'od', allEmails.length, 'seed računov najdenih ──')
    for (const g of GROUPS) {
      console.log(`\n[${g.label}]`)
      for (const email of g.emails) {
        const u = byEmail.get(email)
        if (!u) {
          console.log(`  - ${email} → NI v bazi (preskočen)`)
          continue
        }
        console.log(
          `  - ${email} | role=${u.role} | ima geslo: ${u.password ? 'DA' : 'NE'} | updatedAt: ${u.updatedAt.toISOString()}`,
        )
      }
    }

    if (!APPLY) {
      console.log('\nDRY-RUN: nič ni bilo spremenjeno.')
      console.log('Za popravilo: DATABASE_URL="…" APPLY=1 [ADMIN_PASSWORD=… STAFF_PASSWORD=… CLIENTE_PASSWORD=…] node scripts/rotate-seed-passwords.mjs')
      return
    }

    // Pripravi gesla po skupinah (validacija PRED kakršnimkoli zapisom).
    const plainByGroup = new Map()
    for (const g of GROUPS) {
      const provided = process.env[g.env]
      if (provided !== undefined && provided.length < MIN_LEN) {
        console.error(`Napaka: ${g.env} ima ${provided.length} znakov, zahtevano je najmanj ${MIN_LEN}. Nič ni bilo spremenjeno.`)
        process.exit(1)
      }
      plainByGroup.set(g.key, provided ?? generatePassword())
    }

    console.log('\n── APPLY: posodabljam gesla (bcrypt, cost 12) ──')
    let updated = 0
    for (const g of GROUPS) {
      const plain = plainByGroup.get(g.key)
      const passwordHash = await hash(plain, 12)
      for (const email of g.emails) {
        if (!byEmail.has(email)) continue
        await prisma.user.update({ where: { email }, data: { password: passwordHash } })
        updated++
      }
    }
    console.log(`── Users: ${updated} posodobljenih ──`)

    console.log('\n════════ NOVA GESLA (izpisano SAMO tukaj — shrani zdaj!) ════════')
    for (const g of GROUPS) {
      console.log(`[${g.label}] ${g.env}${process.env[g.env] ? ' (tvoja vrednost)' : ' (samodejno generirano)'}`)
      for (const email of g.emails) {
        if (!byEmail.has(email)) continue
        console.log(`  ${email}  →  ${plainByGroup.get(g.key)}`)
      }
    }
    console.log('═════════════════════════════════════════════════════════════════')
    console.log('\nNaslednji korak: preveri prijavo z novim geslom in izpisek shrani v geslovnik.')
    console.log('Prihodnji re-seed ne bo povrnil javnih gesel, če nastaviš SEED_ADMIN_PASSWORD / SEED_STAFF_PASSWORD / SEED_CLIENTE_PASSWORD (glej prisma/seed.ts).')
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main().catch((err) => {
  console.error('Napaka:', err?.message ?? err)
  process.exit(1)
})
