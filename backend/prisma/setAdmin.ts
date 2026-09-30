/**
 * Create or update the ADMIN (supergod) account — SAFE for production.
 *
 * The admin bypasses every role guard and can impersonate any user (see
 * backend/src/lib/auth.ts + backend/src/routes/admin.ts). Provisioned out of
 * band; no self-signup path leads here.
 *
 *   npm run db:set-admin -- --email me@x.com --password s3cret
 *   npm run db:set-admin -- --email me@x.com --password s3cret --name "Pepe"
 *
 * On the server, via the Makefile:
 *   make prod-admin EMAIL=pepe@example.com PASSWORD=s3cret
 */
import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const email = (arg("email") || process.env.ADMIN_EMAIL || "").trim().toLowerCase()
  const password = arg("password") || process.env.ADMIN_PASSWORD || ""
  const name = arg("name") || process.env.ADMIN_NAME || "Admin"

  if (!email || !password) {
    console.error("❌ Faltan datos. Pasá --email y --password (o ADMIN_EMAIL/ADMIN_PASSWORD en el .env).")
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
    update: {
      password: hash,
      role: Role.ADMIN,
      inviteToken: null,
      inviteExpiresAt: null,
      mustChangePassword: false,
    },
    create: {
      email,
      name,
      password: hash,
      role: Role.ADMIN,
    },
  })

  if (!existing) {
    console.log(`✅ Admin creado: ${user.email}`)
  } else if (existing.role !== Role.ADMIN) {
    console.log(`✅ Rol promovido a ADMIN y contraseña actualizada: ${user.email}`)
    console.log(`   (el rol anterior era ${existing.role})`)
  } else {
    console.log(`✅ Contraseña del admin actualizada: ${user.email}`)
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
