import { Hono } from "hono"
import { prisma } from "../lib/prisma.js"
import { uploadToR2, deleteFromR2, isR2Configured } from "../lib/r2.js"
import { checkUpload, buildObjectKey, ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from "../lib/uploads.js"
import {
  sendSupervisionReviewedEmail,
  sendCoachInviteEmail,
  sendSignupApprovedEmail,
} from "../lib/email.js"
import { randomBytes } from "node:crypto"
import { getSettings, clampDays, daysFromNow } from "../lib/settings.js"
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
      cohort: s.enrollments[0]?.cohort?.name ?? "Sin CIC",
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
        ...(hasWindow ? { completeBy: daysFromNow((await getSettings()).testCompleteDays) } : {}),
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

  const trimmed = String(name ?? "").trim()
  if (!trimmed) return c.json({ error: "El nombre no puede estar vacío" }, 400)
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return c.json({ error: "Fecha de inicio inválida" }, 400)

  const cohort = await prisma.cohort.create({
    data: { name: trimmed, startDate: start, active: true },
    include: {
      enrollments: { include: { user: true } },
      _count: { select: { enrollments: true } },
    },
  })
  return c.json(cohort, 201)
})

/** PUT /supervisor/cohorts/:id — name, start date, active, Zoom link, permissions. */
supervisor.put("/cohorts/:id", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()

  // Whitelist: never hand the request body straight to Prisma (it would let a
  // caller rewrite `id`). Each field is optional so the active-toggle can send
  // just `{ active }` and the edit dialog just `{ name, startDate }`.
  const data: {
    name?: string
    startDate?: Date
    active?: boolean
    zoomUrl?: string | null
    clientsEnabled?: boolean
    testsEnabled?: boolean
  } = {}

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return c.json({ error: "El nombre no puede estar vacío" }, 400)
    data.name = name
  }
  if (body.startDate !== undefined) {
    const startDate = new Date(body.startDate)
    if (Number.isNaN(startDate.getTime())) return c.json({ error: "Fecha de inicio inválida" }, 400)
    data.startDate = startDate
  }
  if (body.active !== undefined) data.active = Boolean(body.active)
  if (body.clientsEnabled !== undefined) data.clientsEnabled = Boolean(body.clientsEnabled)
  if (body.testsEnabled !== undefined) data.testsEnabled = Boolean(body.testsEnabled)
  if (body.zoomUrl !== undefined) {
    const raw = String(body.zoomUrl ?? "").trim()
    if (raw === "") {
      data.zoomUrl = null
    } else if (!isSafeUrl(raw)) {
      return c.json({ error: "El link de Zoom debe empezar con http:// o https://" }, 400)
    } else {
      data.zoomUrl = raw
    }
  }

  if (Object.keys(data).length === 0) return c.json({ error: "Nada para actualizar" }, 400)

  const cohort = await prisma.cohort.update({
    where: { id },
    data,
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
   Modules — shared content (cards + links)

   The content of a module is the same for every cohort; what varies is WHEN
   each cohort gets to see it (see "Module releases" below). Nothing is
   uploaded: every resource is a link to Drive / Docs / Zoom / an article.
───────────────────────────────────────── */

/** Cards and their links always come back in display order. */
const moduleItemsInclude = {
  items: {
    orderBy: { orderIndex: "asc" as const },
    include: { links: { orderBy: { orderIndex: "asc" as const } } },
  },
}

/**
 * Only http(s) links are accepted. Without this a `javascript:` URL would be
 * rendered straight into an anchor href on the student page.
 */
function isSafeUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false
  try {
    const u = new URL(raw.trim())
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

/** GET /supervisor/modules */
supervisor.get("/modules", async (c) => {
  const modules = await prisma.module.findMany({
    orderBy: { orderIndex: "asc" },
    include: moduleItemsInclude,
  })
  return c.json(modules)
})

/** POST /supervisor/modules */
supervisor.post("/modules", async (c) => {
  const { title, description, videoUrl, orderIndex } = await c.req.json()

  const trimmed = String(title ?? "").trim()
  if (!trimmed) return c.json({ error: "El titulo no puede estar vacio" }, 400)

  const maxOrder = await prisma.module.aggregate({ _max: { orderIndex: true } })
  const nextOrder = orderIndex ?? (maxOrder._max.orderIndex ?? 0) + 1

  const created = await prisma.module.create({
    data: { title: trimmed, description, videoUrl, orderIndex: nextOrder, published: false },
    include: moduleItemsInclude,
  })
  return c.json(created, 201)
})

/** PUT /supervisor/modules/:id */
supervisor.put("/modules/:id", async (c) => {
  const id = c.req.param("id")
  const { title, description, videoUrl, orderIndex, published } = await c.req.json()

  const updated = await prisma.module.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title: String(title).trim() } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(videoUrl !== undefined ? { videoUrl } : {}),
      ...(orderIndex !== undefined ? { orderIndex } : {}),
      ...(published !== undefined ? { published: Boolean(published) } : {}),
    },
    include: moduleItemsInclude,
  })
  return c.json(updated)
})

/** DELETE /supervisor/modules/:id — cascades to its cards, links, files and releases. */
supervisor.delete("/modules/:id", async (c) => {
  const id = c.req.param("id")

  const stored = await prisma.moduleLink.findMany({
    where: { item: { moduleId: id }, storageKey: { not: null } },
    select: { storageKey: true },
  })

  await prisma.module.delete({ where: { id } })
  await Promise.all(stored.map((l) => deleteFromR2(l.storageKey!).catch(() => {})))

  return c.json({ ok: true })
})

/* ── Cards inside a module ─────────────────────────────────────────────────── */

const ITEM_KINDS = ["TAREA", "BIBLIOGRAFIA", "PRESENTACION", "LINK", "RECURSO"] as const
type ItemKind = (typeof ITEM_KINDS)[number]

function asKind(value: unknown): ItemKind | undefined {
  return ITEM_KINDS.includes(value as ItemKind) ? (value as ItemKind) : undefined
}

/** POST /supervisor/modules/:id/items */
supervisor.post("/modules/:id/items", async (c) => {
  const moduleId = c.req.param("id")
  const { title, description, kind } = await c.req.json()

  const trimmed = String(title ?? "").trim()
  if (!trimmed) return c.json({ error: "El titulo no puede estar vacio" }, 400)

  const maxOrder = await prisma.moduleItem.aggregate({
    where: { moduleId },
    _max: { orderIndex: true },
  })

  const item = await prisma.moduleItem.create({
    data: {
      moduleId,
      title: trimmed,
      description: description ?? null,
      kind: asKind(kind) ?? "RECURSO",
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
    },
    include: { links: { orderBy: { orderIndex: "asc" } } },
  })
  return c.json(item, 201)
})

/** PUT /supervisor/module-items/:itemId */
supervisor.put("/module-items/:itemId", async (c) => {
  const id = c.req.param("itemId")
  const { title, description, kind, orderIndex } = await c.req.json()
  const parsedKind = asKind(kind)

  const item = await prisma.moduleItem.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title: String(title).trim() } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(parsedKind ? { kind: parsedKind } : {}),
      ...(orderIndex !== undefined ? { orderIndex } : {}),
    },
    include: { links: { orderBy: { orderIndex: "asc" } } },
  })
  return c.json(item)
})

/** DELETE /supervisor/module-items/:itemId — cascades to its links (and their files). */
supervisor.delete("/module-items/:itemId", async (c) => {
  const itemId = c.req.param("itemId")

  // The DB cascade would drop the rows and leave the R2 objects orphaned.
  const stored = await prisma.moduleLink.findMany({
    where: { itemId, storageKey: { not: null } },
    select: { storageKey: true },
  })

  await prisma.moduleItem.delete({ where: { id: itemId } })
  await Promise.all(stored.map((l) => deleteFromR2(l.storageKey!).catch(() => {})))

  return c.json({ ok: true })
})

/** PUT /supervisor/modules/:id/items/reorder — body: { ids: string[] } */
supervisor.put("/modules/:id/items/reorder", async (c) => {
  const moduleId = c.req.param("id")
  const { ids } = await c.req.json()
  if (!Array.isArray(ids)) return c.json({ error: "ids debe ser un array" }, 400)

  await prisma.$transaction(
    ids.map((id: string, i: number) =>
      prisma.moduleItem.updateMany({ where: { id, moduleId }, data: { orderIndex: i } })
    )
  )

  const items = await prisma.moduleItem.findMany({
    where: { moduleId },
    orderBy: { orderIndex: "asc" },
    include: { links: { orderBy: { orderIndex: "asc" } } },
  })
  return c.json(items)
})

/* ── Links hanging off a card ──────────────────────────────────────────────── */

/** POST /supervisor/module-items/:itemId/links */
supervisor.post("/module-items/:itemId/links", async (c) => {
  const itemId = c.req.param("itemId")
  const { title, url } = await c.req.json()

  if (!isSafeUrl(url)) return c.json({ error: "El link debe empezar con http:// o https://" }, 400)
  const trimmedTitle = String(title ?? "").trim()

  const maxOrder = await prisma.moduleLink.aggregate({
    where: { itemId },
    _max: { orderIndex: true },
  })

  const link = await prisma.moduleLink.create({
    data: {
      itemId,
      title: trimmedTitle || url.trim(),
      url: url.trim(),
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
    },
  })
  return c.json(link, 201)
})

/** PUT /supervisor/module-links/:linkId */
supervisor.put("/module-links/:linkId", async (c) => {
  const id = c.req.param("linkId")
  const { title, url, orderIndex } = await c.req.json()

  if (url !== undefined && !isSafeUrl(url)) {
    return c.json({ error: "El link debe empezar con http:// o https://" }, 400)
  }

  const link = await prisma.moduleLink.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title: String(title).trim() } : {}),
      ...(url !== undefined ? { url: String(url).trim() } : {}),
      ...(orderIndex !== undefined ? { orderIndex } : {}),
    },
  })
  return c.json(link)
})

/** DELETE /supervisor/module-links/:linkId — also removes the R2 object it owns. */
supervisor.delete("/module-links/:linkId", async (c) => {
  const id = c.req.param("linkId")
  const link = await prisma.moduleLink.findUnique({ where: { id } })
  if (!link) return c.json({ ok: true })

  await prisma.moduleLink.delete({ where: { id } })
  // Best effort: a leftover blob is harmless, a failed request is not.
  if (link.storageKey) await deleteFromR2(link.storageKey).catch(() => {})

  return c.json({ ok: true })
})

/**
 * POST /supervisor/module-items/:itemId/files
 * Upload a document as material. Multipart, field `file` (+ optional `title`).
 */
supervisor.post("/module-items/:itemId/files", async (c) => {
  const itemId = c.req.param("itemId")

  if (!isR2Configured()) {
    return c.json({ error: "La subida de archivos no está configurada (falta CLOUDFLARE_R2_*)." }, 503)
  }

  const item = await prisma.moduleItem.findUnique({ where: { id: itemId } })
  if (!item) return c.json({ error: "Ítem no encontrado" }, 404)

  const form = await c.req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) return c.json({ error: "No se recibió ningún archivo" }, 400)

  const check = checkUpload(file.name, file.size)
  if (!check.ok) return c.json({ error: check.error }, 400)

  const key = buildObjectKey(itemId, file.name, check.extension)
  const buffer = Buffer.from(await file.arrayBuffer())

  let url: string
  try {
    // Store the MIME we derived from the extension, never the one the browser
    // claimed, so the bucket cannot be made to serve active content.
    url = await uploadToR2(key, buffer, check.mimeType)
  } catch {
    return c.json({ error: "No se pudo subir el archivo. Revisá la configuración de R2." }, 502)
  }

  const maxOrder = await prisma.moduleLink.aggregate({
    where: { itemId },
    _max: { orderIndex: true },
  })

  const title = String(form.get("title") ?? "").trim() || file.name

  const link = await prisma.moduleLink.create({
    data: {
      itemId,
      title,
      url,
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
      storageKey: key,
      mimeType: check.mimeType,
      sizeBytes: file.size,
    },
  })
  return c.json(link, 201)
})

/** GET /supervisor/upload-limits — so the UI can state what it accepts. */
supervisor.get("/upload-limits", (c) =>
  c.json({
    enabled: isR2Configured(),
    extensions: ALLOWED_EXTENSIONS,
    maxBytes: MAX_UPLOAD_BYTES,
  })
)

/* ─────────────────────────────────────────
   Module releases — per-cohort visibility
───────────────────────────────────────── */

/**
 * GET /supervisor/cohorts/:id/releases
 * Every module with its release state for this cohort. A module with no row
 * yet comes back as released:false, so the UI can render the full grid.
 */
supervisor.get("/cohorts/:id/releases", async (c) => {
  const cohortId = c.req.param("id")

  const [modules, releases] = await Promise.all([
    prisma.module.findMany({
      orderBy: { orderIndex: "asc" },
      include: { _count: { select: { items: true } } },
    }),
    prisma.moduleRelease.findMany({ where: { cohortId } }),
  ])

  const byModule = new Map(releases.map((r) => [r.moduleId, r]))

  return c.json(
    modules.map((m) => ({
      moduleId: m.id,
      title: m.title,
      orderIndex: m.orderIndex,
      published: m.published,
      itemCount: m._count.items,
      released: byModule.get(m.id)?.released ?? false,
      availableFrom: byModule.get(m.id)?.availableFrom ?? null,
    }))
  )
})

/** PUT /supervisor/cohorts/:id/releases/:moduleId — body: { released?, availableFrom? } */
supervisor.put("/cohorts/:id/releases/:moduleId", async (c) => {
  const cohortId = c.req.param("id")
  const moduleId = c.req.param("moduleId")
  const { released, availableFrom } = await c.req.json()

  let from: Date | null | undefined
  if (availableFrom !== undefined) {
    if (availableFrom === null || availableFrom === "") {
      from = null
    } else {
      const parsed = new Date(availableFrom)
      if (Number.isNaN(parsed.getTime())) return c.json({ error: "Fecha invalida" }, 400)
      from = parsed
    }
  }

  const release = await prisma.moduleRelease.upsert({
    where: { moduleId_cohortId: { moduleId, cohortId } },
    update: {
      ...(released !== undefined ? { released: Boolean(released) } : {}),
      ...(from !== undefined ? { availableFrom: from } : {}),
    },
    create: {
      moduleId,
      cohortId,
      released: Boolean(released ?? false),
      availableFrom: from ?? null,
    },
  })
  return c.json(release)
})

/**
 * POST /supervisor/cohorts/:id/releases/copy — body: { fromCohortId }
 * Mirrors another cohort release state, so a new CIC does not have to be
 * ticked module by module.
 */
supervisor.post("/cohorts/:id/releases/copy", async (c) => {
  const cohortId = c.req.param("id")
  const { fromCohortId } = await c.req.json()

  if (!fromCohortId || fromCohortId === cohortId) {
    return c.json({ error: "Elegi un CIC de origen distinto" }, 400)
  }

  const source = await prisma.moduleRelease.findMany({ where: { cohortId: fromCohortId } })

  await prisma.$transaction(
    source.map((r) =>
      prisma.moduleRelease.upsert({
        where: { moduleId_cohortId: { moduleId: r.moduleId, cohortId } },
        update: { released: r.released, availableFrom: r.availableFrom },
        create: {
          moduleId: r.moduleId,
          cohortId,
          released: r.released,
          availableFrom: r.availableFrom,
        },
      })
    )
  )

  return c.json({ ok: true, copied: source.length })
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
  if (!test) return c.json({ error: "Test not assignable" }, 400)

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

/* ─────────────────────────────────────────
   Cohort roster helpers
───────────────────────────────────────── */

/**
 * GET /supervisor/cohorts/:id/emails
 * The enrolled coaches, ready to paste into a Zoom invite. Returns both the
 * list and a pre-joined string so the UI can just copy it.
 */
supervisor.get("/cohorts/:id/emails", async (c) => {
  const cohortId = c.req.param("id")

  const enrollments = await prisma.enrollment.findMany({
    where: { cohortId },
    include: { user: { select: { name: true, email: true, password: true } } },
    orderBy: { user: { name: "asc" } },
  })

  const people = enrollments.map((e) => ({
    name: e.user.name,
    email: e.user.email,
    // Invited but never finished registering — their inbox may not be watched.
    pending: e.user.password === null,
  }))

  return c.json({
    count: people.length,
    people,
    emails: people.map((p) => p.email).join(", "),
  })
})

/* ─────────────────────────────────────────
   Signup requests (public form -> supervisor approval)
───────────────────────────────────────── */

/** GET /supervisor/signups?status=PENDING */
supervisor.get("/signups", async (c) => {
  const status = c.req.query("status")
  const valid = ["PENDING", "APPROVED", "REJECTED"] as const
  const filter = valid.includes(status as (typeof valid)[number])
    ? (status as (typeof valid)[number])
    : undefined

  const signups = await prisma.signupRequest.findMany({
    where: filter ? { status: filter } : {},
    include: { cohort: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })

  // Never ship the stored password hash to the browser.
  return c.json(signups.map(({ passwordHash, ...rest }) => rest))
})

/**
 * POST /supervisor/signups/:id/approve
 * Creates the real User from the request (reusing the password they chose, so
 * they can log in immediately), enrolls them, and gives them the
 * coach-as-coachee Client that the invite flow also creates.
 */
supervisor.post("/signups/:id/approve", async (c) => {
  const supervisorUser = c.get("user")
  const id = c.req.param("id")

  const signup = await prisma.signupRequest.findUnique({ where: { id } })
  if (!signup) return c.json({ error: "Solicitud no encontrada" }, 404)
  if (signup.status !== "PENDING") return c.json({ error: "La solicitud ya fue resuelta" }, 400)

  const clash = await prisma.user.findUnique({ where: { email: signup.email } })
  if (clash) return c.json({ error: "Ya existe un usuario con ese email" }, 400)

  const created = await prisma.$transaction(async (tx) => {
    const coach = await tx.user.create({
      data: {
        email: signup.email,
        name: signup.name,
        password: signup.passwordHash,
        role: "STUDENT_COACH",
        phone: signup.phone,
        especialidad: signup.especialidad,
      },
    })

    if (signup.cohortId) {
      await tx.enrollment.create({ data: { userId: coach.id, cohortId: signup.cohortId } })
    }

    await tx.client.create({
      data: {
        studentId: supervisorUser.id,
        userId: coach.id,
        name: signup.name,
        email: signup.email,
      },
    })

    await tx.signupRequest.update({
      where: { id },
      data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: supervisorUser.id },
    })

    return coach
  })

  sendSignupApprovedEmail(signup.email, signup.name).catch(() => {})

  return c.json({ ok: true, coach: { id: created.id, name: created.name, email: created.email } })
})

/** POST /supervisor/signups/:id/reject — body: { note? } */
supervisor.post("/signups/:id/reject", async (c) => {
  const supervisorUser = c.get("user")
  const id = c.req.param("id")
  const { note } = await c.req.json().catch(() => ({ note: undefined }))

  const signup = await prisma.signupRequest.findUnique({ where: { id } })
  if (!signup) return c.json({ error: "Solicitud no encontrada" }, 404)
  if (signup.status !== "PENDING") return c.json({ error: "La solicitud ya fue resuelta" }, 400)

  await prisma.signupRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedById: supervisorUser.id,
      reviewNote: note ? String(note).trim() : null,
    },
  })

  return c.json({ ok: true })
})

/* ─────────────────────────────────────────
   Settings — configurable link lifetimes
───────────────────────────────────────── */

/** GET /supervisor/settings */
supervisor.get("/settings", async (c) => {
  return c.json(await getSettings())
})

/** PUT /supervisor/settings — body: { testCompleteDays?, testResultsDays?, signupLinkDays? } */
supervisor.put("/settings", async (c) => {
  const body = await c.req.json()
  const current = await getSettings()

  const data = {
    testCompleteDays: clampDays(body.testCompleteDays ?? current.testCompleteDays, current.testCompleteDays),
    testResultsDays: clampDays(body.testResultsDays ?? current.testResultsDays, current.testResultsDays),
    signupLinkDays: clampDays(body.signupLinkDays ?? current.signupLinkDays, current.signupLinkDays),
  }

  const row = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  })

  return c.json({
    testCompleteDays: row.testCompleteDays,
    testResultsDays: row.testResultsDays,
    signupLinkDays: row.signupLinkDays,
  })
})

/* ─────────────────────────────────────────
   Signup links — expiring public invitations
───────────────────────────────────────── */

/** GET /supervisor/signup-links */
supervisor.get("/signup-links", async (c) => {
  const links = await prisma.signupLink.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      cohort: { select: { id: true, name: true } },
      _count: { select: { requests: true } },
    },
  })
  return c.json(links)
})

/** POST /supervisor/signup-links — body: { cohortId?, days? } */
supervisor.post("/signup-links", async (c) => {
  const { cohortId, days } = await c.req.json().catch(() => ({}))
  const settings = await getSettings()
  const lifetime = clampDays(days ?? settings.signupLinkDays, settings.signupLinkDays)

  const link = await prisma.signupLink.create({
    data: {
      token: randomBytes(24).toString("base64url"),
      cohortId: cohortId || null,
      expiresAt: daysFromNow(lifetime),
    },
    include: {
      cohort: { select: { id: true, name: true } },
      _count: { select: { requests: true } },
    },
  })
  return c.json(link, 201)
})

/** POST /supervisor/signup-links/:id/disable — revoke before it expires. */
supervisor.post("/signup-links/:id/disable", async (c) => {
  const link = await prisma.signupLink.update({
    where: { id: c.req.param("id") },
    data: { disabled: true },
    include: {
      cohort: { select: { id: true, name: true } },
      _count: { select: { requests: true } },
    },
  })
  return c.json(link)
})

/** DELETE /supervisor/signup-links/:id */
supervisor.delete("/signup-links/:id", async (c) => {
  await prisma.signupLink.delete({ where: { id: c.req.param("id") } })
  return c.json({ ok: true })
})

export default supervisor
