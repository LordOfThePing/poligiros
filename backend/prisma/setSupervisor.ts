/**
 * Create or update the supervisor account (Gaby) — SAFE for production.
 *
 * Unlike `seed.ts` (which WIPES every table before inserting demo data), this
 * script only touches the one User row. Use it to set Gaby's login on a live
 * database, or to reset her password later.
 *
 *   npm run db:set-supervisor                                  # reads .env
 *   npm run db:set-supervisor -- --email a@b.com --password s3cret
 *   npm run db:set-supervisor -- --email a@b.com --password s3cret --name "Gabriela Kyriazis"
 *
 * On the server, via the Makefile:
 *   make prod-supervisor                                       # reads .env
 *   make prod-supervisor EMAIL=gaby@poligiros.com PASSWORD=s3cret
 *
 * Behaviour:
 *   - email not found        → creates a SUPERVISOR user
 *   - email found            → updates the password (and promotes to SUPERVISOR)
 *   - another SUPERVISOR exists under a different email → warns, since the app
 *     picks the notification recipient with findFirst({ role: "SUPERVISOR" })
 */
import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

/** Minimal `--flag value` parser (no dependency needed). */
function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const email = (arg("email") || process.env.SUPERVISOR_EMAIL || "").trim().toLowerCase()
  const password = arg("password") || process.env.SUPERVISOR_PASSWORD || ""
  const name = arg("name") || process.env.SUPERVISOR_NAME || "Gabriela Kyriazis"

  if (!email || !password) {
    console.error("❌ Faltan datos. Pasá --email y --password, o definí")
    console.error("   SUPERVISOR_EMAIL y SUPERVISOR_PASSWORD en el .env de la raíz.")
    process.exit(1)
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`❌ Email inválido: ${email}`)
    process.exit(1)
  }
  if (password.length < 8) {
    console.error("❌ La contraseña debe tener al menos 8 caracteres.")
    process.exit(1)
  }

  const hash = await bcrypt.hash(password, 12)
  const existing = await prisma.user.findUnique({ where: { email } })

  const user = await prisma.user.upsert({
    where: { email },
    // Promote to SUPERVISOR and clear any dangling invite token.
    update: { password: hash, role: Role.SUPERVISOR, inviteToken: null, inviteExpiresAt: null },
    create: { email, name, password: hash, role: Role.SUPERVISOR },
  })

  if (!existing) {
    console.log(`✅ Supervisor creado: ${user.email}`)
  } else if (existing.role !== Role.SUPERVISOR) {
    console.log(`✅ Contraseña actualizada y rol promovido a SUPERVISOR: ${user.email}`)
    console.log(`   (el rol anterior era ${existing.role})`)
  } else {
    console.log(`✅ Contraseña del supervisor actualizada: ${user.email}`)
  }

  const others = await prisma.user.findMany({
    where: { role: Role.SUPERVISOR, email: { not: email } },
    select: { email: true },
  })
  if (others.length > 0) {
    console.warn("⚠️  Hay más de un SUPERVISOR en la base:")
    for (const o of others) console.warn(`     - ${o.email}`)
    console.warn("   Los emails de notificación usan findFirst({ role: SUPERVISOR }),")
    console.warn("   así que puede que no lleguen a la cuenta que acabás de configurar.")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
