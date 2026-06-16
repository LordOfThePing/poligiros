import { Hono } from "hono"
import { randomBytes } from "crypto"
import { prisma } from "../lib/prisma.js"
import {
  sendSupervisionSubmittedEmail,
  sendSessionRecordedEmail,
} from "../lib/email.js"
import { generateAnclasInsight, generateTableroIdeas } from "../lib/ai.js"
import { latestTableroIdea } from "./client.js"
import type { AppVariables } from "../lib/types.js"

const student = new Hono<{ Variables: AppVariables }>()

/* ─────────────────────────────────────────
   Clients
───────────────────────────────────────── */

/** GET /student/clients */
student.get("/clients", async (c) => {
  const user = c.get("user")

  const clients = await prisma.client.findMany({
    where: { studentId: user.id },
    include: {
      assignments: {
        include: { test: true, response: true, supervision: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return c.json(clients)
})

/** POST /student/clients */
student.post("/clients", async (c) => {
  const user = c.get("user")
  const { name, email } = await c.req.json()

  const clientRecord = await prisma.client.create({
    data: { studentId: user.id, name, email },
    include: {
      assignments: { include: { test: true, response: true, supervision: true } },
    },
  })

  return c.json(clientRecord, 201)
})

/** GET /student/clients/:id */
student.get("/clients/:id", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")

  const clientRecord = await prisma.client.findFirst({
    where: { id, studentId: user.id },
    include: {
      assignments: {
        include: { test: true, response: true, supervision: true },
        orderBy: { assignedAt: "asc" },
      },
      sessions: { orderBy: { sessionNum: "asc" } },
    },
  })

  if (!clientRecord) return c.json({ error: "Not found" }, 404)
  return c.json(clientRecord)
})

/* ─────────────────────────────────────────
   Assign test to client (A1: generates magic-link token)
───────────────────────────────────────── */

/** POST /student/clients/:id/assign */
student.post("/clients/:id/assign", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")
  const { testId } = await c.req.json()

  // Verify client belongs to this student
  const clientRecord = await prisma.client.findFirst({
    where: { id, studentId: user.id },
  })
  if (!clientRecord) return c.json({ error: "Not found" }, 404)

  // Don't allow PLAN_VITAL
  const test = await prisma.test.findUnique({ where: { id: testId } })
  if (!test || test.type === "PLAN_VITAL") {
    return c.json({ error: "Test not assignable" }, 400)
  }

  const accessToken = randomBytes(32).toString("base64url")
  const now = new Date()
  const completeBy = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const resultsViewableUntil = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

  const assignment = await prisma.testAssignment.upsert({
    where: { testId_clientId: { testId, clientId: id } },
    update: {
      // Refresh token and windows on re-assign
      accessToken,
      completeBy,
      resultsViewableUntil,
    },
    create: {
      testId,
      clientId: id,
      assignedBy: user.id,
      accessToken,
      completeBy,
      resultsViewableUntil,
    },
    include: { test: true, response: true, supervision: true },
  })

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173"
  const link = `${frontendUrl}/t/${assignment.accessToken}`

  return c.json({ assignment, link }, 201)
})

/* ─────────────────────────────────────────
   Resend magic link (regenerate token)
───────────────────────────────────────── */

/** POST /student/assignments/:id/resend */
student.post("/assignments/:id/resend", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")

  // Verify assignment belongs to one of this student's clients
  const assignment = await prisma.testAssignment.findFirst({
    where: { id, client: { studentId: user.id } },
  })
  if (!assignment) return c.json({ error: "Not found" }, 404)

  const accessToken = randomBytes(32).toString("base64url")
  const completeBy = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  const updated = await prisma.testAssignment.update({
    where: { id },
    data: { accessToken, completeBy },
  })

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173"
  const link = `${frontendUrl}/t/${updated.accessToken}`

  return c.json({ link })
})

/* ─────────────────────────────────────────
   Supervision
───────────────────────────────────────── */

/** GET /student/supervision */
student.get("/supervision", async (c) => {
  const user = c.get("user")

  const clientsOfStudent = await prisma.client.findMany({
    where: { studentId: user.id },
    select: { id: true },
  })
  const clientIds = clientsOfStudent.map((c) => c.id)

  const [toSend, history] = await Promise.all([
    prisma.testAssignment.findMany({
      where: {
        clientId: { in: clientIds },
        completedAt: { not: null },
        supervision: null,
      },
      include: { test: true, client: true, response: true },
      orderBy: { completedAt: "desc" },
    }),
    prisma.supervisionRequest.findMany({
      where: { studentId: user.id },
      include: {
        assignment: {
          include: { test: true, client: true, response: true },
        },
        supervisor: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return c.json({ toSend, history })
})

/** POST /student/supervision */
student.post("/supervision", async (c) => {
  const user = c.get("user")
  const { assignmentId, studentNotes } = await c.req.json()

  // Verify assignment belongs to this student's client
  const assignment = await prisma.testAssignment.findFirst({
    where: {
      id: assignmentId,
      client: { studentId: user.id },
      completedAt: { not: null },
    },
    include: { test: true, client: true },
  })
  if (!assignment) return c.json({ error: "Assignment not found" }, 404)

  const request = await prisma.supervisionRequest.create({
    data: {
      assignmentId,
      studentId: user.id,
      studentNotes,
    },
    include: {
      assignment: { include: { test: true, client: true } },
    },
  })

  // Fire-and-forget email to supervisor
  const supervisor = await prisma.user.findFirst({ where: { role: "SUPERVISOR" } })
  if (supervisor) {
    sendSupervisionSubmittedEmail(
      supervisor.email,
      user.name,
      assignment.client.name,
      assignment.test.title
    ).catch(() => {})
  }

  return c.json(request, 201)
})

/* ─────────────────────────────────────────
   Session records
───────────────────────────────────────── */

/** GET /student/sessions */
student.get("/sessions", async (c) => {
  const user = c.get("user")

  const sessions = await prisma.sessionRecord.findMany({
    where: { studentId: user.id },
    include: { client: true },
    orderBy: { createdAt: "desc" },
  })

  return c.json(sessions)
})

/** POST /student/sessions */
student.post("/sessions", async (c) => {
  const user = c.get("user")
  const body = await c.req.json()
  const {
    clientId,
    sessionNum,
    coacheeName,
    coacheeAge,
    coacheeSex,
    coacheeWorks,
    coacheePosition,
    sessionDate,
    mainOutputs,
    toolsAndResults,
    conclusions,
  } = body

  // Verify client belongs to this student
  const clientRecord = await prisma.client.findFirst({
    where: { id: clientId, studentId: user.id },
  })
  if (!clientRecord) return c.json({ error: "Client not found" }, 404)

  const record = await prisma.sessionRecord.create({
    data: {
      studentId: user.id,
      clientId,
      sessionNum: parseInt(sessionNum),
      coacheeName,
      coacheeAge,
      coacheeSex,
      coacheeWorks,
      coacheePosition: coacheeWorks ? coacheePosition : null,
      sessionDate: new Date(sessionDate),
      mainOutputs,
      toolsAndResults,
      conclusions,
    },
    include: { client: true, student: true },
  })

  // Fire-and-forget email to supervisor
  const supervisor = await prisma.user.findFirst({ where: { role: "SUPERVISOR" } })
  if (supervisor) {
    sendSessionRecordedEmail(
      supervisor.email,
      record.student.name,
      record.client.name,
      record.sessionNum
    ).catch(() => {})
  }

  return c.json(record, 201)
})

/* ─────────────────────────────────────────
   Modules (student view)
───────────────────────────────────────── */

/** GET /student/modules */
student.get("/modules", async (c) => {
  const user = c.get("user")

  const [modules, progress] = await Promise.all([
    prisma.module.findMany({
      where: { published: true },
      orderBy: { orderIndex: "asc" },
      include: { materials: true },
    }),
    prisma.moduleProgress.findMany({
      where: { userId: user.id },
    }),
  ])

  const completedIds = new Set(progress.map((p) => p.moduleId))

  const result = modules.map((m, idx) => ({
    ...m,
    completed: completedIds.has(m.id),
    locked: idx > 0 && !completedIds.has(modules[idx - 1].id),
  }))

  return c.json(result)
})

/** POST /student/modules/:id/complete */
student.post("/modules/:id/complete", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")

  await prisma.moduleProgress.upsert({
    where: { userId_moduleId: { userId: user.id, moduleId: id } },
    update: {},
    create: { userId: user.id, moduleId: id },
  })

  return c.json({ ok: true })
})

/* ─────────────────────────────────────────
   Coach self-tests — the coach takes tests logged-in. Their assignments live on
   a coach-as-coachee Client (Client.userId === the coach's own User id, owned by
   the supervisor). Authorize every route by that link.
───────────────────────────────────────── */

async function loadMyAssignment(userId: string, id: string) {
  return prisma.testAssignment.findFirst({
    where: { id, client: { userId } },
    include: { test: true, response: true },
  })
}

/** GET /student/my-tests */
student.get("/my-tests", async (c) => {
  const user = c.get("user")
  const myClient = await prisma.client.findUnique({ where: { userId: user.id } })
  if (!myClient) return c.json([])

  const assignments = await prisma.testAssignment.findMany({
    where: { clientId: myClient.id },
    include: { test: true, response: true },
    orderBy: { assignedAt: "asc" },
  })
  return c.json(assignments)
})

/** GET /student/my-tests/:id */
student.get("/my-tests/:id", async (c) => {
  const user = c.get("user")
  const assignment = await loadMyAssignment(user.id, c.req.param("id"))
  if (!assignment) return c.json({ error: "Not found" }, 404)
  // Modelo de Negocio pre-fills the idea from the coach's latest Tablero.
  const prefillIdea =
    assignment.test.type === "MODELO_NEGOCIO" ? await latestTableroIdea(assignment.clientId) : undefined
  return c.json({ ...assignment, prefillIdea })
})

/** POST /student/my-tests/:id/submit */
student.post("/my-tests/:id/submit", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")
  const assignment = await loadMyAssignment(user.id, id)
  if (!assignment) return c.json({ error: "Not found" }, 404)
  if (assignment.completedAt) return c.json({ error: "already_completed" }, 409)

  const { responses } = await c.req.json()
  const [testResponse] = await prisma.$transaction([
    prisma.testResponse.upsert({
      where: { assignmentId: id },
      update: { responses },
      create: { assignmentId: id, responses },
    }),
    prisma.testAssignment.update({ where: { id }, data: { completedAt: new Date() } }),
  ])
  return c.json(testResponse)
})

/** POST /student/my-tests/:id/ai-insight */
student.post("/my-tests/:id/ai-insight", async (c) => {
  const user = c.get("user")
  const assignment = await loadMyAssignment(user.id, c.req.param("id"))
  if (!assignment) return c.json({ error: "Not found" }, 404)
  const { ranking, scores } = await c.req.json()
  return c.json({ insight: await generateAnclasInsight(ranking, scores) })
})

/** POST /student/my-tests/:id/ai-ideas */
student.post("/my-tests/:id/ai-ideas", async (c) => {
  const user = c.get("user")
  const assignment = await loadMyAssignment(user.id, c.req.param("id"))
  if (!assignment) return c.json({ error: "Not found" }, 404)
  const body = await c.req.json()
  return c.json({ ideas: await generateTableroIdeas(body) })
})

/** PUT /student/responses/:assignmentId — coach edits a coachee's result. */
student.put("/responses/:assignmentId", async (c) => {
  const user = c.get("user")
  const id = c.req.param("assignmentId")
  // Coach may edit results of clients they own (studentId) or their own self-tests.
  const assignment = await prisma.testAssignment.findFirst({
    where: { id, client: { OR: [{ studentId: user.id }, { userId: user.id }] } },
  })
  if (!assignment) return c.json({ error: "Not found" }, 404)
  const { responses } = await c.req.json()
  const updated = await prisma.testResponse.update({
    where: { assignmentId: id },
    data: { responses },
  })
  return c.json(updated)
})

export default student
