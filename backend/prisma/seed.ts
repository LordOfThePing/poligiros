import { PrismaClient, Role, TestType } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // ── 0. Wipe everything (children → parents) for a clean reseed ─────────────
  await prisma.supervisionRequest.deleteMany()
  await prisma.testResponse.deleteMany()
  await prisma.testAssignment.deleteMany()
  await prisma.sessionRecord.deleteMany()
  await prisma.moduleProgress.deleteMany()
  await prisma.material.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.client.deleteMany()
  await prisma.module.deleteMany()
  await prisma.cohort.deleteMany()
  await prisma.test.deleteMany()
  await prisma.user.deleteMany()

  // ── 1. Supervisor (Gaby) ───────────────────────────────────────────────────
  const supervisorEmail = process.env.SUPERVISOR_EMAIL || "gaby@poligiros.com"
  const supervisorPassword = process.env.SUPERVISOR_PASSWORD || "supervisor123"
  const gaby = await prisma.user.create({
    data: {
      email: supervisorEmail,
      name: "Gabriela Kyriazis",
      password: await bcrypt.hash(supervisorPassword, 12),
      role: Role.SUPERVISOR,
    },
  })

  // ── 2. Four Tests ──────────────────────────────────────────────────────────
  await prisma.test.createMany({
    data: [
      { type: TestType.ANCLAS_CARRERA, title: "Test de Anclas de Carrera", description: "Identificá tus anclas de carrera según la metodología de Edgar Schein.", orderIndex: 1 },
      { type: TestType.TABLERO_IDEAS, title: "Tablero de Ideas", description: "Explorá tus saberes, deseos y aspiraciones para generar nuevas ideas profesionales.", orderIndex: 2 },
      { type: TestType.PLAN_VITAL, title: "Plan Vital Integral®", description: "Próximamente disponible.", orderIndex: 3 },
      { type: TestType.PIRAMIDE_PROPOSITO, title: "Pirámide del Propósito", description: "Construí tu propósito profesional de forma estructurada.", orderIndex: 4 },
    ],
  })

  // ── 3. Active cohort ───────────────────────────────────────────────────────
  const cohort = await prisma.cohort.create({
    data: { name: "Cohorte Demo", startDate: new Date("2025-01-01"), active: true },
  })

  // ── 4. Five generic coaches, each with a coach-as-coachee Client owned by Gaby ─
  // Gaby is the coach of the coaches: they take tests logged-in, and their
  // assignments live on a Client record whose `userId` points back at them.
  const coachPassword = process.env.COACH_PASSWORD || "coach123"
  const coachHash = await bcrypt.hash(coachPassword, 12)
  const coaches = [
    { name: "Juan", email: "juan@poligiros.com" },
    { name: "María", email: "maria@poligiros.com" },
    { name: "Carlos", email: "carlos@poligiros.com" },
    { name: "Sofía", email: "sofia@poligiros.com" },
    { name: "Diego", email: "diego@poligiros.com" },
  ]

  for (const c of coaches) {
    const coach = await prisma.user.create({
      data: { email: c.email, name: c.name, password: coachHash, role: Role.STUDENT_COACH },
    })
    await prisma.enrollment.create({ data: { userId: coach.id, cohortId: cohort.id } })
    // Coach-as-coachee: owned by Gaby, linked to the coach's own User.
    await prisma.client.create({
      data: { studentId: gaby.id, userId: coach.id, name: c.name, email: c.email },
    })
  }

  console.log("✅ Seed completado:")
  console.log(`   Supervisor: ${supervisorEmail} / ${supervisorPassword}`)
  for (const c of coaches) {
    console.log(`   Coach:      ${c.email} / ${coachPassword}  (${c.name})`)
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
