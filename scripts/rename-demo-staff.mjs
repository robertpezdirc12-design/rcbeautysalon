import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

// Apply the #15 demo-staff renames to the local DB (same values as seed.ts).
const renames = [
  { email: "laura@rcbeautysalon.org", name: "Maja Kovač" },
  { email: "maria@rcbeautysalon.org", name: "Sara Horvat" },
  { email: "sofia@rcbeautysalon.org", name: "Nina Zupan" },
  { email: "ana@rcbeautysalon.org", name: "Ana Novak" },
]

for (const r of renames) {
  const u = await db.user.update({ where: { email: r.email }, data: { name: r.name } })
  await db.staff.updateMany({ where: { userId: u.id }, data: { name: r.name } })
  console.log(`renamed -> ${r.name} (${r.email})`)
}

const staff = await db.staff.findMany({ where: { email: { in: renames.map((r) => r.email) } }, select: { name: true } })
console.log("staff now:", staff.map((s) => s.name).join(", "))
await db.$disconnect()
