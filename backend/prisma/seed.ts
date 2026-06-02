import { PrismaClient, Role, TestType } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // 1. Supervisor
  const supervisorEmail = process.env.SUPERVISOR_EMAIL || "gaby@poligiros.com"
  const supervisorPassword = process.env.SUPERVISOR_PASSWORD || "supervisor123"

  await prisma.user.upsert({
    where: { email: supervisorEmail },
    update: {},
    create: {
      email: supervisorEmail,
      name: "Gabriela Kyriazis",
      password: await bcrypt.hash(supervisorPassword, 12),
      role: Role.SUPERVISOR,
    },
  })

  // 2. Four Tests
  const tests = [
    {
      type: TestType.ANCLAS_CARRERA,
      title: "Test de Anclas de Carrera",
      description: "Identificá tus anclas de carrera según la metodología de Edgar Schein.",
      orderIndex: 1,
    },
    {
      type: TestType.TABLERO_IDEAS,
      title: "Tablero de Ideas",
      description: "Explorá tus saberes, deseos y aspiraciones para generar nuevas ideas profesionales.",
      orderIndex: 2,
    },
    {
      type: TestType.PLAN_VITAL,
      title: "Plan Vital Integral®",
      description: "Próximamente disponible.",
      orderIndex: 3,
    },
    {
      type: TestType.PIRAMIDE_PROPOSITO,
      title: "Pirámide del Propósito",
      description: "Construí tu propósito profesional de forma estructurada.",
      orderIndex: 4,
    },
  ]

  for (const test of tests) {
    await prisma.test.upsert({
      where: { type: test.type },
      update: {},
      create: test,
    })
  }

  // 3. Active Cohort
  const cohort = await prisma.cohort.upsert({
    where: { id: "cohort-demo" },
    update: {},
    create: {
      id: "cohort-demo",
      name: "Cohorte Demo",
      startDate: new Date("2025-01-01"),
      active: true,
    },
  })

  // 4. Two Student Coaches
  const student1 = await prisma.user.upsert({
    where: { email: "alumna1@demo.com" },
    update: {},
    create: {
      email: "alumna1@demo.com",
      name: "Ana García",
      password: await bcrypt.hash("alumna123", 12),
      role: Role.STUDENT_COACH,
    },
  })

  const student2 = await prisma.user.upsert({
    where: { email: "alumna2@demo.com" },
    update: {},
    create: {
      email: "alumna2@demo.com",
      name: "Laura Martínez",
      password: await bcrypt.hash("alumna123", 12),
      role: Role.STUDENT_COACH,
    },
  })

  // Enroll students in cohort
  await prisma.enrollment.upsert({
    where: { userId_cohortId: { userId: student1.id, cohortId: cohort.id } },
    update: {},
    create: { userId: student1.id, cohortId: cohort.id },
  })

  await prisma.enrollment.upsert({
    where: { userId_cohortId: { userId: student2.id, cohortId: cohort.id } },
    update: {},
    create: { userId: student2.id, cohortId: cohort.id },
  })

  // 5. Two plain Client records (no linked user accounts — A1 magic-link model)
  await prisma.client.upsert({
    where: { id: "client-demo-1" },
    update: {},
    create: {
      id: "client-demo-1",
      studentId: student1.id,
      name: "Carlos López",
      email: "cliente1@demo.com",
    },
  })

  await prisma.client.upsert({
    where: { id: "client-demo-2" },
    update: {},
    create: {
      id: "client-demo-2",
      studentId: student2.id,
      name: "María Fernández",
      email: "cliente2@demo.com",
    },
  })

  console.log("✅ Seed completado:")
  console.log(`   Supervisor: ${supervisorEmail} / ${supervisorPassword}`)
  console.log("   Student 1:  alumna1@demo.com / alumna123")
  console.log("   Student 2:  alumna2@demo.com / alumna123")
  console.log("   Client 1:   Carlos López (no login — magic-link only)")
  console.log("   Client 2:   María Fernández (no login — magic-link only)")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
