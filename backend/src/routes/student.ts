import { Hono } from "hono"
import { randomBytes } from "crypto"
import { prisma } from "../lib/prisma.js"
import {
  sendSupervisionSubmittedEmail,
  sendSessionRecordedEmail,
} from "../lib/email.js"
import { generateAnclasInsight, generateTableroIdeas } from "../lib/ai.js"
import { latestTableroIdea } from "./client.js"
import { getCoachAccess } from "../lib/cohort.js"
import { getSettings, daysFromNow } from "../lib/settings.js"
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

  const access = await getCoachAccess(user.id)
  if (!access.clientsEnabled) {
    return c.json({ error: "Todavia no tenes habilitada la carga de coachees en tu CIC" }, 403)
  }

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
        include: {
          test: true,
          response: true,
          supervision: true,
          resetRequests: { orderBy: { createdAt: "desc" }, take: 1 },
        },
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
  const access = await getCoachAccess(user.id)
  if (!access.testsEnabled) {
    return c.json({ error: "Todavia no tenes habilitados los tests en tu CIC" }, 403)
  }

  const clientRecord = await prisma.client.findFirst({
    where: { id, studentId: user.id },
  })
  if (!clientRecord) return c.json({ error: "Not found" }, 404)

  const test = await prisma.test.findUnique({ where: { id: testId } })
  if (!test) return c.json({ error: "Test not assignable" }, 400)

  const accessToken = randomBytes(32).toString("base64url")
  const now = new Date()
  const settings = await getSettings()
  const completeBy = daysFromNow(settings.testCompleteDays, now)
  const resultsViewableUntil = daysFromNow(settings.testResultsDays, now)

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

  const access = await getCoachAccess(user.id)
  if (!access.testsEnabled) {
    return c.json({ error: "Todavia no tenes habilitados los tests en tu CIC" }, 403)
  }

  // Verify assignment belongs to one of this student's clients
  const assignment = await prisma.testAssignment.findFirst({
    where: { id, client: { studentId: user.id } },
  })
  if (!assignment) return c.json({ error: "Not found" }, 404)

  const accessToken = randomBytes(32).toString("base64url")
  const { testCompleteDays } = await getSettings()
  const completeBy = daysFromNow(testCompleteDays)

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

/** GET /student/sessions/:id — a single record the coach owns. */
student.get("/sessions/:id", async (c) => {
  const user = c.get("user")
  const record = await prisma.sessionRecord.findFirst({
    where: { id: c.req.param("id"), studentId: user.id },
    include: { client: true },
  })
  if (!record) return c.json({ error: "Not found" }, 404)
  return c.json(record)
})

/** PUT /student/sessions/:id — the coach edits their own session record. */
student.put("/sessions/:id", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")

  const existing = await prisma.sessionRecord.findFirst({
    where: { id, studentId: user.id },
  })
  if (!existing) return c.json({ error: "Not found" }, 404)

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

  // If the client is being reassigned, verify it still belongs to this coach.
  if (clientId && clientId !== existing.clientId) {
    const clientRecord = await prisma.client.findFirst({
      where: { id: clientId, studentId: user.id },
    })
    if (!clientRecord) return c.json({ error: "Client not found" }, 404)
  }

  const updated = await prisma.sessionRecord.update({
    where: { id },
    data: {
      ...(clientId ? { clientId } : {}),
      ...(sessionNum != null && sessionNum !== "" ? { sessionNum: parseInt(sessionNum) } : {}),
      coacheeName,
      coacheeAge,
      coacheeSex,
      coacheeWorks,
      coacheePosition: coacheeWorks ? coacheePosition : null,
      ...(sessionDate ? { sessionDate: new Date(sessionDate) } : {}),
      mainOutputs,
      toolsAndResults,
      conclusions,
    },
    include: { client: true },
  })

  return c.json(updated)
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

   A module is visible when it is published (not a draft) AND released to one
   of the cohorts the coach belongs to. There is no sequential lock any more:
   the supervisor releasing a class IS the gate.

   The unit the coach ticks off is the ITEM. Module-level completion is derived
   (a module with items, all of them done) and mirrored into ModuleProgress so
   the supervisor Panel and the alumno detail keep reporting the same thing.
───────────────────────────────────────── */

/** GET /student/access — what this coach is allowed to do, plus Zoom links. */
student.get("/access", async (c) => {
  const user = c.get("user")
  return c.json(await getCoachAccess(user.id))
})

/** Module ids released to this coach right now. */
async function releasedModuleIds(userId: string): Promise<string[]> {
  const access = await getCoachAccess(userId)
  if (access.cohortIds.length === 0) return []

  const releases = await prisma.moduleRelease.findMany({
    where: {
      cohortId: { in: access.cohortIds },
      released: true,
      // A scheduled opening in the future keeps the module hidden.
      OR: [{ availableFrom: null }, { availableFrom: { lte: new Date() } }],
    },
    select: { moduleId: true },
  })

  return [...new Set(releases.map((r) => r.moduleId))]
}

/**
 * Keep ModuleProgress in step with the item ticks: present when the module has
 * items and every one of them is done, absent otherwise.
 */
async function syncModuleProgress(userId: string, moduleId: string) {
  const items = await prisma.moduleItem.findMany({
    where: { moduleId },
    select: { id: true },
  })

  const done = items.length
    ? await prisma.moduleItemProgress.count({
        where: { userId, itemId: { in: items.map((i) => i.id) } },
      })
    : 0

  const complete = items.length > 0 && done === items.length

  if (complete) {
    await prisma.moduleProgress.upsert({
      where: { userId_moduleId: { userId, moduleId } },
      update: {},
      create: { userId, moduleId },
    })
  } else {
    await prisma.moduleProgress
      .delete({ where: { userId_moduleId: { userId, moduleId } } })
      .catch(() => {}) // not there is the desired state anyway
  }
}

/** GET /student/modules */
student.get("/modules", async (c) => {
  const user = c.get("user")

  const moduleIds = await releasedModuleIds(user.id)
  if (moduleIds.length === 0) return c.json([])

  const modules = await prisma.module.findMany({
    where: { id: { in: moduleIds }, published: true },
    orderBy: { orderIndex: "asc" },
    include: {
      items: {
        orderBy: { orderIndex: "asc" },
        include: { links: { orderBy: { orderIndex: "asc" } } },
      },
    },
  })

  const allItemIds = modules.flatMap((m) => m.items.map((i) => i.id))
  const progress = allItemIds.length
    ? await prisma.moduleItemProgress.findMany({
        where: { userId: user.id, itemId: { in: allItemIds } },
        select: { itemId: true },
      })
    : []

  const doneItems = new Set(progress.map((p) => p.itemId))

  return c.json(
    modules.map((m) => {
      const items = m.items.map((i) => ({ ...i, completed: doneItems.has(i.id) }))
      return {
        ...m,
        items,
        // Derived, so it can never disagree with the checkboxes on screen.
        completed: items.length > 0 && items.every((i) => i.completed),
      }
    })
  )
})

/** Guard: the item must belong to a module released to this coach. */
async function findReleasedItem(userId: string, itemId: string) {
  const item = await prisma.moduleItem.findUnique({
    where: { id: itemId },
    select: { id: true, moduleId: true, module: { select: { published: true } } },
  })
  if (!item || !item.module.published) return null

  const moduleIds = await releasedModuleIds(userId)
  return moduleIds.includes(item.moduleId) ? item : null
}

/** POST /student/module-items/:itemId/complete */
student.post("/module-items/:itemId/complete", async (c) => {
  const user = c.get("user")
  const itemId = c.req.param("itemId")

  const item = await findReleasedItem(user.id, itemId)
  if (!item) return c.json({ error: "Contenido no disponible" }, 403)

  await prisma.moduleItemProgress.upsert({
    where: { userId_itemId: { userId: user.id, itemId } },
    update: {},
    create: { userId: user.id, itemId },
  })
  await syncModuleProgress(user.id, item.moduleId)

  return c.json({ ok: true, completed: true })
})

/** DELETE /student/module-items/:itemId/complete — untick it. */
student.delete("/module-items/:itemId/complete", async (c) => {
  const user = c.get("user")
  const itemId = c.req.param("itemId")

  const item = await findReleasedItem(user.id, itemId)
  if (!item) return c.json({ error: "Contenido no disponible" }, 403)

  await prisma.moduleItemProgress
    .delete({ where: { userId_itemId: { userId: user.id, itemId } } })
    .catch(() => {})
  await syncModuleProgress(user.id, item.moduleId)

  return c.json({ ok: true, completed: false })
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

/* ─────────────────────────────────────────
   Test reset requests (coach asks; supervisor approves)
───────────────────────────────────────── */

/** POST /student/assignments/:id/reset-request — ask to wipe a completed test. */
student.post("/assignments/:id/reset-request", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")
  const { reason } = await c.req.json().catch(() => ({ reason: undefined }))

  // The coach may request resets for clients they own or their own self-tests.
  const assignment = await prisma.testAssignment.findFirst({
    where: { id, client: { OR: [{ studentId: user.id }, { userId: user.id }] } },
  })
  if (!assignment) return c.json({ error: "Not found" }, 404)
  if (!assignment.completedAt) return c.json({ error: "El test no está completado" }, 400)

  const pending = await prisma.testResetRequest.findFirst({
    where: { assignmentId: id, status: "PENDING" },
  })
  if (pending) return c.json({ error: "Ya hay una solicitud pendiente" }, 409)

  const request = await prisma.testResetRequest.create({
    data: { assignmentId: id, requestedById: user.id, reason: reason || null },
  })
  return c.json(request, 201)
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
