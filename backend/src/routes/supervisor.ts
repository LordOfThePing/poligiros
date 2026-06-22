import { Hono } from "hono"
import { prisma } from "../lib/prisma.js"
import { uploadToR2 } from "../lib/r2.js"
import { sendSupervisionReviewedEmail, sendCoachInviteEmail } from "../lib/email.js"
import { randomBytes } from "node:crypto"
import type { AppVariables } from "../lib/types.js"

const supervisor = new Hono<{ Variables: AppVariables }>()

/* ─────────────────────────────────────────
   Stats
───────────────────────────────────────── */

/** GET /supervisor/stats */
supervisor.get("/stats", async (c) => {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [activeStudents, pendingTests, pendingSupervisions, reviewsThisMonth] =
    await Promise.all([
      prisma.user.count({ where: { role: "STUDENT_COACH" } }),
      prisma.testAssignment.count({ where: { completedAt: null } }),
      prisma.supervisionRequest.count({ where: { status: "PENDING" } }),
      prisma.supervisionRequest.count({
        where: { status: "REVIEWED", reviewedAt: { gte: startOfMonth } },
      }),
    ])

  return c.json({
    activeStudents,
    pendingTests,
    pendingSupervisions,
    reviewsThisMonth,
  })
})

/* ─────────────────────────────────────────
   Activity feed
───────────────────────────────────────── */

/** GET /supervisor/activity */
supervisor.get("/activity", async (c) => {
  const [testResponses, supervisionRequests, sessionRecords] = await Promise.all([
    prisma.testResponse.findMany({
      take: 10,
      orderBy: { submittedAt: "desc" },
      include: {
        assignment: {
          include: {
            test: true,
            client: { include: { student: true } },
          },
        },
      },
    }),
    prisma.supervisionRequest.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        student: true,
        assignment: {
          include: { test: true, client: true },
        },
      },
    }),
    prisma.sessionRecord.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { student: true, client: true },
    }),
  ])

  type ActivityEvent = { type: string; description: string; date: Date }

  const events: ActivityEvent[] = [
    ...testResponses.map((r) => ({
      type: "test_submitted",
      description: `${r.assignment.client.student.name} envió el test "${r.assignment.test.title}" de ${r.assignment.client.name}`,
      date: r.submittedAt,
    })),
    ...supervisionRequests.map((s) => ({
      type: "supervision_sent",
      description: `${s.student.name} envió supervisión para "${s.assignment.test.title}" de ${s.assignment.client.name}`,
      date: s.createdAt,
    })),
    ...sessionRecords.map((s) => ({
      type: "session_recorded",
      description: `${s.student.name} registró la sesión #${s.sessionNum} con ${s.client.name}`,
      date: s.createdAt,
    })),
  ]

  events.sort((a, b) => b.date.getTime() - a.date.getTime())
  return c.json(events.slice(0, 10))
})

/* ─────────────────────────────────────────
   Students
───────────────────────────────────────── */

/** GET /supervisor/students */
supervisor.get("/students", async (c) => {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT_COACH" },
    include: {
      enrollments: { include: { cohort: true } },
      clients: {
        include: {
          assignments: { include: { response: true } },
        },
      },
      moduleProgress: true,
      sessionRecords: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  })

  const result = students.map((s) => {
    const totalTests = s.clients.reduce((sum, cl) => sum + cl.assignments.length, 0)
    const completedTests = s.clients.reduce(
      (sum, cl) => sum + cl.assignments.filter((a) => a.completedAt).length,
      0
    )

    return {
      id: s.id,
      name: s.name,
      email: s.email,
      cohort: s.enrollments[0]?.cohort?.name ?? "Sin SIC",
      clientCount: s.clients.length,
      testsSubmitted: completedTests,
      modulesCompleted: s.moduleProgress.length,
      pending: s.password === null, // invited but not yet registered
      lastActivity:
        s.sessionRecords[0]?.createdAt ??
        s.enrollments[0]?.enrolledAt ??
        s.createdAt,
    }
  })

  return c.json(result)
})

/** GET /supervisor/students/:id */
supervisor.get("/students/:id", async (c) => {
  const id = c.req.param("id")

  const student = await prisma.user.findUnique({
    where: { id },
    include: {
      enrollments: { include: { cohort: true } },
      clients: {
        include: {
          assignments: {
            include: { test: true, response: true, supervision: true },
          },
          sessions: { orderBy: { sessionNum: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      moduleProgress: {
        include: { module: true },
        orderBy: { completedAt: "asc" },
      },
      supervisionRequests: {
        include: {
          assignment: { include: { test: true, client: true } },
          supervisor: true,
        },
        orderBy: { createdAt: "desc" },
      },
      sessionRecords: {
        include: { client: true },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!student) return c.json({ error: "Not found" }, 404)
  // Never leak the password hash / invite token; expose a `pending` flag instead.
  const { password, inviteToken, ...safe } = student
  return c.json({ ...safe, pending: password === null })
})

/* ─────────────────────────────────────────
   Supervision
───────────────────────────────────────── */

/** GET /supervisor/supervision */
supervisor.get("/supervision", async (c) => {
  const requests = await prisma.supervisionRequest.findMany({
    include: {
      student: true,
      supervisor: true,
      assignment: {
        include: { test: true, client: true, response: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return c.json(requests)
})

/** POST /supervisor/supervision/:id/review */
supervisor.post("/supervision/:id/review", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")
  const { supervisorNotes, coachFeedback } = await c.req.json()

  const request = await prisma.supervisionRequest.update({
    where: { id },
    data: {
      supervisorId: user.id,
      supervisorNotes,
      coachFeedback,
      status: "REVIEWED",
      reviewedAt: new Date(),
    },
    include: {
      student: true,
      assignment: { include: { test: true, client: true } },
    },
  })

  // Fire-and-forget email to student
  sendSupervisionReviewedEmail(
    request.student.email,
    request.assignment.client.name,
    request.assignment.test.title,
    supervisorNotes ?? ""
  ).catch(() => {})

  return c.json(request)
})

/* ─────────────────────────────────────────
   Test reset requests (coach asks; supervisor approves → wipes the result)
───────────────────────────────────────── */

/** GET /supervisor/reset-requests — pending requests to wipe a submitted test. */
supervisor.get("/reset-requests", async (c) => {
  const requests = await prisma.testResetRequest.findMany({
    where: { status: "PENDING" },
    include: {
      requestedBy: true,
      assignment: { include: { test: true, client: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return c.json(requests)
})

/** POST /supervisor/reset-requests/:id/approve — wipe the result + reopen the test. */
supervisor.post("/reset-requests/:id/approve", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")

  const request = await prisma.testResetRequest.findUnique({
    where: { id },
    include: { assignment: true },
  })
  if (!request) return c.json({ error: "Not found" }, 404)
  if (request.status !== "PENDING") return c.json({ error: "Solicitud ya resuelta" }, 409)

  const assignmentId = request.assignmentId
  const hasWindow = Boolean(request.assignment.completeBy)

  await prisma.$transaction([
    prisma.testResponse.deleteMany({ where: { assignmentId } }),
    prisma.supervisionRequest.deleteMany({ where: { assignmentId } }),
    prisma.testAssignment.update({
      where: { id: assignmentId },
      data: {
        completedAt: null,
        // Re-open the magic-link window so the coachee can retake it.
        ...(hasWindow ? { completeBy: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) } : {}),
      },
    }),
    prisma.testResetRequest.update({
      where: { id },
      data: { status: "APPROVED", reviewedById: user.id, reviewedAt: new Date() },
    }),
  ])

  return c.json({ ok: true })
})

/** POST /supervisor/reset-requests/:id/reject */
supervisor.post("/reset-requests/:id/reject", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")

  const request = await prisma.testResetRequest.findUnique({ where: { id } })
  if (!request) return c.json({ error: "Not found" }, 404)
  if (request.status !== "PENDING") return c.json({ error: "Solicitud ya resuelta" }, 409)

  const updated = await prisma.testResetRequest.update({
    where: { id },
    data: { status: "REJECTED", reviewedById: user.id, reviewedAt: new Date() },
  })
  return c.json(updated)
})

/* ─────────────────────────────────────────
   Cohorts
───────────────────────────────────────── */

/** GET /supervisor/cohorts */
supervisor.get("/cohorts", async (c) => {
  const cohorts = await prisma.cohort.findMany({
    orderBy: { startDate: "desc" },
    include: {
      enrollments: { include: { user: true } },
      _count: { select: { enrollments: true } },
    },
  })
  return c.json(cohorts)
})

/** POST /supervisor/cohorts */
supervisor.post("/cohorts", async (c) => {
  const { name, startDate } = await c.req.json()

  const cohort = await prisma.cohort.create({
    data: { name, startDate: new Date(startDate), active: true },
    include: {
      enrollments: { include: { user: true } },
      _count: { select: { enrollments: true } },
    },
  })
  return c.json(cohort, 201)
})

/** PUT /supervisor/cohorts/:id */
supervisor.put("/cohorts/:id", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()

  const cohort = await prisma.cohort.update({
    where: { id },
    data: body,
    include: {
      enrollments: { include: { user: true } },
      _count: { select: { enrollments: true } },
    },
  })
  return c.json(cohort)
})

/** POST /supervisor/cohorts/:id/enroll */
supervisor.post("/cohorts/:id/enroll", async (c) => {
  const id = c.req.param("id")
  const { email } = await c.req.json()

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return c.json({ error: "Usuario no encontrado con ese email" }, 404)
  }
  if (user.role !== "STUDENT_COACH") {
    return c.json({ error: "El usuario no es un student coach" }, 400)
  }

  const enrollment = await prisma.enrollment.upsert({
    where: { userId_cohortId: { userId: user.id, cohortId: id } },
    update: {},
    create: { userId: user.id, cohortId: id },
    include: { user: true },
  })

  return c.json(enrollment, 201)
})

/* ─────────────────────────────────────────
   Modules
───────────────────────────────────────── */

/** GET /supervisor/modules */
supervisor.get("/modules", async (c) => {
  const modules = await prisma.module.findMany({
    orderBy: { orderIndex: "asc" },
    include: { materials: true },
  })
  return c.json(modules)
})

/** POST /supervisor/modules */
supervisor.post("/modules", async (c) => {
  const body = await c.req.json()
  const { title, description, videoUrl, orderIndex } = body

  const maxOrder = await prisma.module.aggregate({ _max: { orderIndex: true } })
  const nextOrder = orderIndex ?? (maxOrder._max.orderIndex ?? 0) + 1

  const module = await prisma.module.create({
    data: { title, description, videoUrl, orderIndex: nextOrder, published: false },
    include: { materials: true },
  })
  return c.json(module, 201)
})

/** PUT /supervisor/modules/:id */
supervisor.put("/modules/:id", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()
  const { title, description, videoUrl, orderIndex, published } = body

  const module = await prisma.module.update({
    where: { id },
    data: { title, description, videoUrl, orderIndex, published },
    include: { materials: true },
  })
  return c.json(module)
})

/** DELETE /supervisor/modules/:id */
supervisor.delete("/modules/:id", async (c) => {
  const id = c.req.param("id")
  await prisma.module.delete({ where: { id } })
  return c.json({ ok: true })
})

/** POST /supervisor/modules/:id/materials */
supervisor.post("/modules/:id/materials", async (c) => {
  const id = c.req.param("id")
  const formData = await c.req.formData()
  const file = formData.get("file") as File
  const title = formData.get("title") as string

  if (!file) return c.json({ error: "No file" }, 400)

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const key = `modules/${id}/${Date.now()}-${file.name}`
  const fileUrl = await uploadToR2(key, buffer, file.type)

  const material = await prisma.material.create({
    data: {
      moduleId: id,
      title: title || file.name,
      fileUrl,
      fileType: file.type,
    },
  })
  return c.json(material, 201)
})

/* ─────────────────────────────────────────
   Module progress
───────────────────────────────────────── */

/** GET /supervisor/module-progress */
supervisor.get("/module-progress", async (c) => {
  const totalStudents = await prisma.user.count({ where: { role: "STUDENT_COACH" } })

  const modules = await prisma.module.findMany({
    where: { published: true },
    orderBy: { orderIndex: "asc" },
    include: { _count: { select: { progress: true } } },
  })

  const result = modules.map((m) => ({
    id: m.id,
    title: m.title,
    completedCount: m._count.progress,
    percentage:
      totalStudents > 0
        ? Math.round((m._count.progress / totalStudents) * 100)
        : 0,
  }))

  return c.json(result)
})

/* ─────────────────────────────────────────
   Sessions (supervisor view)
───────────────────────────────────────── */

/** GET /supervisor/sessions */
supervisor.get("/sessions", async (c) => {
  const studentId = c.req.query("studentId")
  const clientId = c.req.query("clientId")

  const sessions = await prisma.sessionRecord.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: { student: true, client: true },
    orderBy: { createdAt: "desc" },
  })
  return c.json(sessions)
})

/* ─────────────────────────────────────────
   Tests (shared listing)
───────────────────────────────────────── */

/** GET /supervisor/tests */
supervisor.get("/tests", async (c) => {
  const tests = await prisma.test.findMany({ orderBy: { orderIndex: "asc" } })
  return c.json(tests)
})

/* ─────────────────────────────────────────
   Coach tests — Gaby is the coaches' coach. Assignments live on each coach's
   coach-as-coachee Client (Client.userId === coach, owned by the supervisor).
───────────────────────────────────────── */

/** GET /supervisor/coaches/:userId/tests — the coach's own test assignments */
supervisor.get("/coaches/:userId/tests", async (c) => {
  const coachClient = await prisma.client.findUnique({
    where: { userId: c.req.param("userId") },
    include: {
      assignments: { include: { test: true, response: true }, orderBy: { assignedAt: "asc" } },
    },
  })
  return c.json(coachClient?.assignments ?? [])
})

/** POST /supervisor/coaches/:userId/assign — assign a test to a coach */
supervisor.post("/coaches/:userId/assign", async (c) => {
  const supervisorUser = c.get("user")
  const coachUserId = c.req.param("userId")
  const { testId } = await c.req.json()

  const coachClient = await prisma.client.findUnique({ where: { userId: coachUserId } })
  if (!coachClient) return c.json({ error: "El coach no tiene perfil de coachee" }, 404)

  const test = await prisma.test.findUnique({ where: { id: testId } })
  if (!test || test.type === "PLAN_VITAL") return c.json({ error: "Test not assignable" }, 400)

  // Logged-in flow: no magic-link token; the coach takes it in their dashboard.
  const assignment = await prisma.testAssignment.upsert({
    where: { testId_clientId: { testId, clientId: coachClient.id } },
    update: { assignedBy: supervisorUser.id },
    create: { testId, clientId: coachClient.id, assignedBy: supervisorUser.id },
    include: { test: true, response: true },
  })
  return c.json(assignment, 201)
})

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const inviteLink = (token: string) =>
  `${process.env.FRONTEND_URL || "http://localhost:5173"}/invite/${token}`

/** POST /supervisor/coaches/invite — create a pending coach + invite link. */
supervisor.post("/coaches/invite", async (c) => {
  const supervisorUser = c.get("user")
  const { email, name, cohortId } = await c.req.json()
  if (!email || !name) return c.json({ error: "Nombre y email requeridos" }, 400)

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return c.json({ error: "Ya existe un usuario con ese email" }, 400)

  const inviteToken = randomBytes(32).toString("base64url")
  const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS)

  const coach = await prisma.user.create({
    data: { email, name, role: "STUDENT_COACH", password: null, inviteToken, inviteExpiresAt },
  })
  if (cohortId) {
    await prisma.enrollment.create({ data: { userId: coach.id, cohortId } }).catch(() => {})
  }
  // Coach-as-coachee Client (so the coach can take tests later), owned by the supervisor.
  await prisma.client.create({
    data: { studentId: supervisorUser.id, userId: coach.id, name, email },
  })

  const link = inviteLink(inviteToken)
  sendCoachInviteEmail(email, name, link).catch(() => {})
  return c.json({ coach: { id: coach.id, name, email }, link }, 201)
})

/** POST /supervisor/coaches/:userId/resend-invite — regenerate the link. */
supervisor.post("/coaches/:userId/resend-invite", async (c) => {
  const userId = c.req.param("userId")
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return c.json({ error: "Not found" }, 404)
  if (user.password) return c.json({ error: "El coach ya está registrado" }, 400)

  const inviteToken = randomBytes(32).toString("base64url")
  await prisma.user.update({
    where: { id: userId },
    data: { inviteToken, inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  })
  const link = inviteLink(inviteToken)
  sendCoachInviteEmail(user.email, user.name, link).catch(() => {})
  return c.json({ link })
})

/** PUT /supervisor/responses/:assignmentId — supervisor edits any result. */
supervisor.put("/responses/:assignmentId", async (c) => {
  const id = c.req.param("assignmentId")
  const { responses } = await c.req.json()
  const existing = await prisma.testResponse.findUnique({ where: { assignmentId: id } })
  if (!existing) return c.json({ error: "Not found" }, 404)
  const updated = await prisma.testResponse.update({
    where: { assignmentId: id },
    data: { responses },
  })
  return c.json(updated)
})

export default supervisor
