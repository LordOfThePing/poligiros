import { Hono } from "hono"
import { randomBytes } from "crypto"
import { prisma } from "../lib/prisma.js"
import {
  sendSupervisionSubmittedEmail,
  sendSessionRecordedEmail,
  sendSubmissionReceivedEmail,
} from "../lib/email.js"
import { generateAnclasInsight, generateTableroIdeas } from "../lib/ai.js"
import { latestTableroIdea } from "./client.js"
import { getCoachAccess } from "../lib/cohort.js"
import { getSettings, daysFromNow } from "../lib/settings.js"
import { notifyTarget } from "../lib/notify.js"
import { isR2Configured, uploadToR2, deleteFromR2 } from "../lib/r2.js"
import type { AppVariables } from "../lib/types.js"

const student = new Hono<{ Variables: AppVariables }>()

/** Max bytes for a comment photo. */
const COMMENT_IMAGE_MAX_BYTES = 25 * 1024 * 1024
function imageMaxBytes() {
  return COMMENT_IMAGE_MAX_BYTES
}
/** Collision-proof R2 key for a comment photo. */
function buildCommentImageKey(itemId: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "jpg"
  return `comments/${itemId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
}

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
  if (!access.practiceEnabled) {
    return c.json({ error: "Todavia no tenes habilitada la practica con coachees en tu CIC" }, 403)
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
  if (!access.practiceEnabled) {
    return c.json({ error: "Todavia no tenes habilitada la practica con coachees en tu CIC" }, 403)
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
      // Refresh token and windows on re-assign, and clear any prior revocation.
      accessToken,
      completeBy,
      resultsViewableUntil,
      accessRevokedAt: null,
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
  if (!access.practiceEnabled) {
    return c.json({ error: "Todavia no tenes habilitada la practica con coachees en tu CIC" }, 403)
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

  // Fire-and-forget email(s) to supervisor / any secondary address
  const supervisionTo = await notifyTarget("supervisionRequest")
  for (const to of supervisionTo) {
    sendSupervisionSubmittedEmail(
      to,
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

  // Fire-and-forget email(s) to supervisor / any secondary address
  const sessionTo = await notifyTarget("sessionRecorded")
  for (const to of sessionTo) {
    sendSessionRecordedEmail(
      to,
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

/**
 * GET /student/notifications — badge counts for the coach sidebar. Things
 * waiting on her: tests still to complete, and supervision feedback awaiting her
 * on tests she already sent in.
 */
student.get("/notifications", async (c) => {
  const user = c.get("user")
  const myClient = await prisma.client.findUnique({ where: { userId: user.id } })

  const [pendingTests, pendingFeedback] = await Promise.all([
    // Self-tests assigned but not yet completed, excluding any whose access
    // Gaby revoked (they should no longer show as "pending" in the badge).
    myClient
      ? prisma.testAssignment.count({
          where: { clientId: myClient.id, completedAt: null, accessRevokedAt: null },
        })
      : Promise.resolve(0),
    // Supervisions she sent that Gaby has not reviewed yet.
    prisma.supervisionRequest.count({ where: { studentId: user.id, status: "PENDING" } }),
  ])
  return c.json({ pendingTests, pendingFeedback })
})

/** Module ids released to this coach (optionally for a single cohort). */
async function releasedModuleIds(userId: string, cohortId?: string): Promise<string[]> {
  const access = await getCoachAccess(userId)
  const ids = cohortId ? (access.cohortIds.includes(cohortId) ? [cohortId] : []) : access.cohortIds
  if (ids.length === 0) return []

  const releases = await prisma.moduleRelease.findMany({
    where: {
      cohortId: { in: ids },
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
    // deleteMany never throws when there is no matching row, so this does not
    // spam the logs (plain `.delete` would raise "Record to delete does not
    // exist", which Prisma logs even when caught).
    await prisma.moduleProgress.deleteMany({
      where: { userId, moduleId },
    })
  }
}

/** GET /student/modules */
student.get("/modules", async (c) => {
  const user = c.get("user")
  // Optional: show only a specific CIC the coach is enrolled in.
  const cohortId = c.req.query("cohortId") || undefined

  const moduleIds = await releasedModuleIds(user.id, cohortId)
  if (moduleIds.length === 0) return c.json([])

  const modules = await prisma.module.findMany({
    where: { id: { in: moduleIds }, published: true },
    orderBy: { orderIndex: "asc" },
    include: {
      items: {
        orderBy: { orderIndex: "asc" },
        include: {
          links: { orderBy: { orderIndex: "asc" } },
          test: { select: { id: true, type: true, title: true } },
        },
      },
    },
  })

  // The coach takes tests against their own coach-as-coachee Client.
  const mySubmissions = await prisma.moduleItemSubmission.findMany({
    where: { userId: user.id, item: { moduleId: { in: moduleIds } } },
  })
  const submissionByItem = new Map(mySubmissions.map((s) => [s.itemId, s]))

  const myClient = await prisma.client.findUnique({ where: { userId: user.id } })
  const myAssignments = myClient
    ? await prisma.testAssignment.findMany({
        where: { clientId: myClient.id },
        select: { id: true, testId: true, completedAt: true, accessRevokedAt: true },
      })
    : []

  // For the coach's OWN tests, the supervision feedback goes to the coach themself.
  // Surface it on the TEST card so they can read it right there.
  const assignmentIds = myAssignments.map((a) => a.id)
  const mySupervisions = assignmentIds.length
    ? await prisma.supervisionRequest.findMany({
        where: { assignmentId: { in: assignmentIds }, studentId: user.id },
        select: { assignmentId: true, supervisorNotes: true, coachFeedback: true, reviewedAt: true },
      })
    : []
  const supervisionByAssignment = new Map(mySupervisions.map((s) => [s.assignmentId, s]))

  const assignmentByTest = new Map(myAssignments.map((a) => [a.testId, a]))

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
      const items = m.items.map((i) => {
        const assignment = i.testId ? assignmentByTest.get(i.testId) : undefined
        const submission = submissionByItem.get(i.id)
        // The coach's own test supervision feedback, if any (read from the item).
        const ownSupervision = assignment ? supervisionByAssignment.get(assignment.id) : undefined
        return {
          ...i,
          completed: doneItems.has(i.id),
          // Only meaningful for kind = TEST: where the coach stands on it.
          assignmentId: assignment?.id ?? null,
          submitted: Boolean(assignment?.completedAt),
          // A still-pending TEST whose access Gaby revoked can't be taken.
          revoked: Boolean(assignment && !assignment.completedAt && assignment.accessRevokedAt),
          // For a TEST the coach took on themself: the supervisor's feedback.
          supervision: ownSupervision
            ? {
                feedback: ownSupervision.coachFeedback || ownSupervision.supervisorNotes,
                reviewedAt: ownSupervision.reviewedAt,
              }
            : null,
          // Only meaningful for kind = ENTREGA.
          submission: submission
            ? {
                id: submission.id,
                text: submission.text,
                submittedAt: submission.submittedAt,
                feedback: submission.feedback,
                reviewedAt: submission.reviewedAt,
              }
            : null,
        }
      })
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
    select: { id: true, moduleId: true, kind: true, module: { select: { published: true } } },
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
  if (item.kind === "TEST" || item.kind === "ENTREGA") {
    return c.json({ error: "Este ítem se completa enviándolo, no a mano" }, 400)
  }

  await prisma.moduleItemProgress.upsert({
    where: { userId_itemId: { userId: user.id, itemId } },
    update: {},
    create: { userId: user.id, itemId },
  })
  await syncModuleProgress(user.id, item.moduleId)

  return c.json({ ok: true, completed: true })
})

/**
 * POST /student/module-items/:itemId/start
 * Opens the test behind a TEST card: makes sure the coach has an assignment on
 * their own coach-as-coachee Client and hands back its id, so the front can go
 * straight to the existing take-test screen.
 *
 * The assignment is created lazily here rather than fanned out to everybody at
 * release time: a cohort of 30 coaches would otherwise get 30 rows per test the
 * moment Gaby ticks a module, most of them never opened.
 */
student.post("/module-items/:itemId/start", async (c) => {
  const user = c.get("user")
  const itemId = c.req.param("itemId")

  const item = await findReleasedItem(user.id, itemId)
  if (!item) return c.json({ error: "Contenido no disponible" }, 403)

  const full = await prisma.moduleItem.findUnique({
    where: { id: itemId },
    select: { kind: true, testId: true },
  })
  if (!full || full.kind !== "TEST" || !full.testId) {
    return c.json({ error: "Este ítem no es un test" }, 400)
  }

  // The coach-as-coachee Client normally exists (seed / invite / signup), but a
  // coach enrolled by hand may not have one yet.
  let myClient = await prisma.client.findUnique({ where: { userId: user.id } })
  if (!myClient) {
    const supervisor = await prisma.user.findFirst({ where: { role: "SUPERVISOR" } })
    if (!supervisor) return c.json({ error: "No hay supervisora configurada" }, 503)
    myClient = await prisma.client.create({
      data: { studentId: supervisor.id, userId: user.id, name: user.name, email: user.email },
    })
  }

  const assignment = await prisma.testAssignment.upsert({
    where: { testId_clientId: { testId: full.testId, clientId: myClient.id } },
    update: {},
    // No accessToken/completeBy: the coach takes it logged in, not by magic link.
    create: { testId: full.testId, clientId: myClient.id, assignedBy: myClient.studentId },
  })

  // A revoked, still-pending self-test can't be taken again until re-opened.
  if (!assignment.completedAt && assignment.accessRevokedAt) {
    return c.json({ error: "test_revoked" }, 403)
  }

  return c.json({ assignmentId: assignment.id, completed: Boolean(assignment.completedAt) })
})

/**
 * PUT /student/module-items/:itemId/submission — body: { text }
 *
 * Hand in (or correct) an ENTREGA card. The row existing IS the submission, and
 * it is what marks the card complete. The coach may keep editing until the
 * supervisor reviews it; after that it is frozen so the feedback keeps matching
 * the text it was written about.
 */
student.put("/module-items/:itemId/submission", async (c) => {
  const user = c.get("user")
  const itemId = c.req.param("itemId")

  const item = await findReleasedItem(user.id, itemId)
  if (!item) return c.json({ error: "Contenido no disponible" }, 403)
  if (item.kind !== "ENTREGA") return c.json({ error: "Este ítem no pide entrega" }, 400)

  const { text } = await c.req.json().catch(() => ({}))
  const clean = String(text ?? "").trim()
  if (!clean) return c.json({ error: "Escribí tu entrega antes de enviarla" }, 400)

  const existing = await prisma.moduleItemSubmission.findUnique({
    where: { userId_itemId: { userId: user.id, itemId } },
  })
  if (existing?.reviewedAt) {
    return c.json({ error: "Gaby ya devolvió esta entrega, no se puede editar" }, 409)
  }

  const submission = await prisma.moduleItemSubmission.upsert({
    where: { userId_itemId: { userId: user.id, itemId } },
    update: { text: clean },
    create: { userId: user.id, itemId, text: clean },
  })

  await prisma.moduleItemProgress.upsert({
    where: { userId_itemId: { userId: user.id, itemId } },
    update: {},
    create: { userId: user.id, itemId },
  })
  await syncModuleProgress(user.id, item.moduleId)

  // Only tell the supervisor the first time; edits before review are not news.
  if (!existing) {
    const submissionTo = await notifyTarget("submission")
    const card = await prisma.moduleItem.findUnique({
      where: { id: itemId },
      select: { title: true, module: { select: { title: true } } },
    })
    if (card) {
      for (const to of submissionTo) {
        sendSubmissionReceivedEmail(to, user.name, card.module.title, card.title).catch(() => {})
      }
    }
  }

  return c.json(submission)
})

/** DELETE /student/module-items/:itemId/complete — untick it. */
student.delete("/module-items/:itemId/complete", async (c) => {
  const user = c.get("user")
  const itemId = c.req.param("itemId")

  const item = await findReleasedItem(user.id, itemId)
  if (!item) return c.json({ error: "Contenido no disponible" }, 403)

  if (item.kind === "TEST" || item.kind === "ENTREGA") {
    return c.json({ error: "Este ítem se completa enviándolo, no a mano" }, 400)
  }

  await prisma.moduleItemProgress
    .delete({ where: { userId_itemId: { userId: user.id, itemId } } })
    .catch(() => {})
  await syncModuleProgress(user.id, item.moduleId)

  return c.json({ ok: true, completed: false })
})

/* ─────────────────────────────────────────
   Module-item discussions (comments + photo upload). Both the coach and the
   supervisor post on the same thread; the coach reaches it from their class
   page.
───────────────────────────────────────── */

/** GET /student/module-items/:id/comments */
student.get("/module-items/:id/comments", async (c) => {
  const user = c.get("user")
  const itemId = c.req.param("id")
  const item = await findReleasedItem(user.id, itemId)
  if (!item) return c.json({ error: "Contenido no disponible" }, 403)

  const comments = await prisma.moduleItemComment.findMany({
    where: { itemId },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  })
  return c.json(comments)
})

/**
 * POST /student/module-items/:id/comments — JSON { text } or multipart with
 * `text` + optional `image` file. A comment needs at least text or a photo.
 */
student.post("/module-items/:id/comments", async (c) => {
  const user = c.get("user")
  const itemId = c.req.param("id")
  const item = await findReleasedItem(user.id, itemId)
  if (!item) return c.json({ error: "Contenido no disponible" }, 403)

  const contentType = c.req.header("content-type") ?? ""
  let text = ""
  let imageUrl: string | null = null
  let imageKey: string | null = null

  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.formData()
    text = String(form.get("text") ?? "").trim()
    const file = form.get("image")
    if (file instanceof File) {
      if (!isR2Configured()) {
        return c.json({ error: "La subida de imágenes no está configurada." }, 503)
      }
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
        return c.json({ error: "Solo se aceptan imágenes (png, jpg, webp, gif)." }, 400)
      }
      if (file.size > imageMaxBytes()) {
        return c.json({ error: "La imagen supera el máximo permitido." }, 400)
      }
      const key = buildCommentImageKey(itemId, file.name)
      const buffer = Buffer.from(await file.arrayBuffer())
      try {
        imageUrl = await uploadToR2(key, buffer, file.type)
        imageKey = key
      } catch {
        return c.json({ error: "No se pudo subir la imagen. Revisá la configuración." }, 502)
      }
    }
  } else {
    const body = await c.req.json().catch(() => ({}))
    text = String(body.text ?? "").trim()
  }

  if (!text && !imageUrl) {
    return c.json({ error: "Escribí un comentario o adjuntá una imagen." }, 400)
  }

  const comment = await prisma.moduleItemComment.create({
    data: {
      itemId,
      userId: user.id,
      text,
      imageUrl,
      imageKey,
    },
    include: { user: { select: { id: true, name: true, role: true } } },
  })
  return c.json(comment, 201)
})

/** DELETE /student/module-items/:id/comments/:commentId — only the author may delete. */
student.delete("/module-items/:id/comments/:commentId", async (c) => {
  const user = c.get("user")
  const itemId = c.req.param("id")
  const commentId = c.req.param("commentId")
  const item = await findReleasedItem(user.id, itemId)
  if (!item) return c.json({ error: "Contenido no disponible" }, 403)

  const comment = await prisma.moduleItemComment.findFirst({ where: { id: commentId, itemId } })
  if (!comment) return c.json({ error: "Not found" }, 404)
  if (comment.userId !== user.id) {
    return c.json({ error: "Solo el autor puede eliminar su comentario" }, 403)
  }

  await prisma.moduleItemComment.delete({ where: { id: commentId } })
  if (comment.imageKey) deleteFromR2(comment.imageKey).catch(() => {})
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
  // Feedback from Gaby on the coach's own test, if any.
  const ids = assignments.map((a) => a.id)
  const supervisions = ids.length
    ? await prisma.supervisionRequest.findMany({
        where: { assignmentId: { in: ids }, studentId: user.id },
        select: { assignmentId: true, coachFeedback: true, supervisorNotes: true },
      })
    : []
  const supervisionByAssignment = new Map(supervisions.map((s) => [s.assignmentId, s]))

  return c.json(
    assignments.map((a) => {
      const sv = supervisionByAssignment.get(a.id)
      return {
        ...a,
        revoked: a.completedAt === null && Boolean(a.accessRevokedAt),
        feedback: sv ? sv.coachFeedback || sv.supervisorNotes : null,
      }
    })
  )
})

/** GET /student/my-tests/:id */
student.get("/my-tests/:id", async (c) => {
  const user = c.get("user")
  const assignment = await loadMyAssignment(user.id, c.req.param("id"))
  if (!assignment) return c.json({ error: "Not found" }, 404)
  // Modelo de Negocio pre-fills the idea from the coach's latest Tablero.
  const prefillIdea =
    assignment.test.type === "MODELO_NEGOCIO" ? await latestTableroIdea(assignment.clientId) : undefined
  return c.json({
    ...assignment,
    revoked: assignment.completedAt === null && Boolean(assignment.accessRevokedAt),
    prefillIdea,
  })
})

/** POST /student/my-tests/:id/submit */
student.post("/my-tests/:id/submit", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")
  const assignment = await loadMyAssignment(user.id, id)
  if (!assignment) return c.json({ error: "Not found" }, 404)
  if (assignment.completedAt) return c.json({ error: "already_completed" }, 409)
  if (assignment.accessRevokedAt) return c.json({ error: "test_revoked" }, 403)

  const { responses } = await c.req.json()
  const [testResponse] = await prisma.$transaction([
    prisma.testResponse.upsert({
      where: { assignmentId: id },
      update: { responses },
      create: { assignmentId: id, responses },
    }),
    prisma.testAssignment.update({ where: { id }, data: { completedAt: new Date() } }),
  ])

  await markTestItemsDone(user.id, assignment.testId)
  await openSupervisionForOwnTest(user.id, id)

  return c.json(testResponse)
})

/**
 * A TEST card is completed by submitting it, so mirror that into the item
 * progress the Programa screen counts.
 */
async function markTestItemsDone(userId: string, testId: string) {
  const released = await releasedModuleIds(userId)
  if (released.length === 0) return

  const items = await prisma.moduleItem.findMany({
    where: { testId, kind: "TEST", moduleId: { in: released } },
    select: { id: true, moduleId: true },
  })

  for (const item of items) {
    await prisma.moduleItemProgress.upsert({
      where: { userId_itemId: { userId, itemId: item.id } },
      update: {},
      create: { userId, itemId: item.id },
    })
    await syncModuleProgress(userId, item.moduleId)
  }
}

/**
 * The coach taking their own test is the same flow as a coachee taking one, so
 * it lands in the supervisor queue automatically — the coach has nobody to
 * "send it to supervision" on their behalf.
 */
async function openSupervisionForOwnTest(userId: string, assignmentId: string) {
  const existing = await prisma.supervisionRequest.findUnique({ where: { assignmentId } })
  if (existing) return

  const assignment = await prisma.testAssignment.findUnique({
    where: { id: assignmentId },
    include: { test: true, client: true },
  })
  // Only for the coach-as-coachee case; a real coachee is sent by their coach.
  if (!assignment || assignment.client.userId !== userId) return

  await prisma.supervisionRequest.create({
    data: { assignmentId, studentId: userId },
  })

  const ownTestTo = await notifyTarget("supervisionRequest")
  const coach = await prisma.user.findUnique({ where: { id: userId } })
  if (coach) {
    for (const to of ownTestTo) {
      sendSupervisionSubmittedEmail(
        to,
        coach.name,
        assignment.client.name,
        assignment.test.title
      ).catch(() => {})
    }
  }
}

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
