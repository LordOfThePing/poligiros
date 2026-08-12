/**
 * Seed the test catalog on a fresh production database — SAFE to re-run.
 *
 * The five `Test` rows are reference data: without them the coach cannot assign
 * anything. `seed.ts` also creates them, but it WIPES every table first and adds
 * demo coaches/clients, so it must never run against a live database. This
 * script only upserts the catalog (keyed on the unique `type`), leaving all
 * user data untouched.
 *
 *   npm run db:bootstrap
 *
 * On the server the Makefile runs this together with the supervisor setup:
 *   make prod-bootstrap
 *
 * Cohorts are NOT created here — the supervisor creates them from the UI, and
 * a coach invite works without one.
 *
 * Keep this list in sync with the catalog in `seed.ts`.
 */
import { PrismaClient, TestType } from "@prisma/client"

const prisma = new PrismaClient()

const TEST_CATALOG = [
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
  {
    type: TestType.MODELO_NEGOCIO,
    title: "Exploración",
    description:
      "Explorá tu idea como un Modelo de Negocios Canvas, un camino freelance/autónomo o investigando un puesto de trabajo.",
    orderIndex: 5,
  },
]

async function main() {
  for (const t of TEST_CATALOG) {
    await prisma.test.upsert({
      where: { type: t.type },
      update: { title: t.title, description: t.description, orderIndex: t.orderIndex },
      create: t,
    })
  }

  const count = await prisma.test.count()
  console.log(`✅ Catálogo de tests listo (${count} tests).`)
  console.log("   PLAN_VITAL es un placeholder permanente — la ruta de asignación lo saltea.")

  const supervisors = await prisma.user.count({ where: { role: "SUPERVISOR" } })
  if (supervisors === 0) {
    console.warn("⚠️  No hay ningún SUPERVISOR todavía. Creá el login de Gaby con:")
    console.warn("     make prod-supervisor EMAIL=... PASSWORD=...")
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
