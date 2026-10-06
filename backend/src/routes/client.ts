import { Hono } from "hono"
import { prisma } from "../lib/prisma.js"
import { generateAnclasInsight, generateTableroIdeas } from "../lib/ai.js"
import { sendTestCompletedToCoach, sendTestCompletedToClient } from "../lib/email.js"
import { applyPostReviewEdit, PostReviewEditError } from "../lib/postReviewEdit.js"
import { isR2Configured, uploadToR2 } from "../lib/r2.js"
import { buildCollageKey, checkUpload } from "../lib/uploads.js"

const client = new Hono()

/** Tablero data for the Modelo de Negocio pre-fill: the chosen idea + top brainstorm candidates. */
async function latestTableroData(
  clientId: string,
): Promise<{ selectedIdea: string; prefillIdeas: string[] }> {
  const tablero = await prisma.testAssignment.findFirst({
    where: { clientId, test: { type: "TABLERO_IDEAS" }, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    include: { response: true },
  })
  const r = (tablero?.response?.responses ?? {}) as Record<string, unknown>
  const selectedIdea = (r.selectedIdea ?? "") as string
  const userIdeas = Array.isArray(r.brainstormIdeas)
    ? (r.brainstormIdeas as string[]).filter(Boolean)
    : []
  const aiIdeas = Array.isArray(r.aiIdeas) ? (r.aiIdeas as string[]).filter(Boolean) : []
  // selectedIdea first, then remaining user brainstorm ideas, then AI ideas — up to 4
  const ordered = [
    selectedIdea,
    ...userIdeas.filter((x) => x !== selectedIdea),
    ...aiIdeas.filter((x) => x !== selectedIdea),
  ].filter(Boolean)
  return { selectedIdea, prefillIdeas: ordered.slice(0, 4) }
}

/** The idea the client picked in their most recent completed Tablero de Ideas, if any.
 *  Kept for backward compatibility with student.ts routes. */
export async function latestTableroIdea(clientId: string): Promise<string> {
  const { selectedIdea } = await latestTableroData(clientId)
  return selectedIdea
}

/**
 * Pirámide del Propósito data for the Objetivo de Carrera pre-fill: rol
 * (verbos que me representan) y valores (los tres centrales). Vacío si la
 * coachee aún no completó la Pirámide — el form lo deja editable igual.
 */
export async function latestPiramideData(
  clientId: string,
): Promise<{ rol: string; valores: string; propositoFinal: string }> {
  const piramide = await prisma.testAssignment.findFirst({
    where: { clientId, test: { type: "PIRAMIDE_PROPOSITO" }, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    include: { response: true },
  })
  const r = (piramide?.response?.responses ?? {}) as Record<string, unknown>
  return {
    rol: typeof r.rol === "string" ? r.rol : "",
    valores: typeof r.valores === "string" ? r.valores : "",
    propositoFinal: typeof r.propositoFinal === "string" ? r.propositoFinal : "",
  }
}

/**
 * Objetivo de Carrera data for the Plan de Acción pre-fill: la frase objetivo
 * armada en el test anterior. El coachee la puede editar igual.
 */
export async function latestObjetivoData(
  clientId: string,
): Promise<{ objetivoGeneral: string }> {
  const objetivo = await prisma.testAssignment.findFirst({
    where: { clientId, test: { type: "OBJETIVO_CARRERA" }, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    include: { response: true },
  })
  const r = (objetivo?.response?.responses ?? {}) as Record<string, unknown>
  const sintesis = typeof r.sintesis === "string" ? r.sintesis : ""
  return { objetivoGeneral: sintesis }
}

/** Token state machine helper */
function getAssignmentState(assignment: {
  completedAt: Date | null
  completeBy: Date | null
  resultsViewableUntil: Date | null
  accessRevokedAt: Date | null
}): "form" | "results" | "expired" | "revoked" {
  const now = new Date()

  // A pending test whose access was revoked by the supervisor can't be taken.
  if (assignment.completedAt === null && assignment.accessRevokedAt) return "revoked"

  if (assignment.completedAt === null) {
    if (assignment.completeBy && now > assignment.completeBy) return "expired"
    return "form"
  } else {
    if (assignment.resultsViewableUntil && now > assignment.resultsViewableUntil)
      return "expired"
    return "results"
  }
}

/**
 * GET /client/t/:token
 * Returns state machine result.
 */
client.get("/t/:token", async (c) => {
  const token = c.req.param("token")

  const assignment = await prisma.testAssignment.findUnique({
    where: { accessToken: token },
    include: {
      test: true,
      client: true,
      response: true,
      supervision: true,
    },
  })

  if (!assignment) return c.json({ error: "invalid" }, 404)

  const state = getAssignmentState(assignment)

  if (state === "expired") {
    return c.json({ state: "expired" }, 410)
  }

  if (state === "revoked") {
    return c.json({ state: "revoked", error: "Este test quedó suspendido." }, 403)
  }

  if (state === "form") {
    return c.json({
      state: "form",
      testType: assignment.test.type,
      assignmentId: assignment.id,
      title: assignment.test.title,
      // Modelo de Negocio pre-fills ideas from the client's latest Tablero brainstorm.
      ...(assignment.test.type === "MODELO_NEGOCIO"
        ? await latestTableroData(assignment.clientId)
        : {}),
      // Objetivo de Carrera: rol + valores de la Pirámide (siempre editables).
      ...(assignment.test.type === "OBJETIVO_CARRERA"
        ? { prefillPiramide: await latestPiramideData(assignment.clientId) }
        : {}),
      // Plan de Acción: objetivo general de la última Objetivo de Carrera.
      ...(assignment.test.type === "PLAN_ACCION"
        ? { prefillObjetivo: await latestObjetivoData(assignment.clientId) }
        : {}),
    })
  }

  // state === "results"
  return c.json({
    state: "results",
    testType: assignment.test.type,
    responses: assignment.response?.responses ?? null,
    coachFeedback: assignment.supervision?.coachFeedback ?? null,
    completedAt: assignment.completedAt,
    clientName: assignment.client.name,
    // Siempre editable: cada edición vuelve al tablero de Gaby — ya no hace
    // falta esperar su devolución (ver applyPostReviewEdit).
    canEdit: true,
  })
})

/**
 * POST /client/t/:token/upload
 * Subida de archivo para los tests que llevan un entregable binario (hoy
 * COLLAGE). Multipart, campo `file`. Mismo allowlist y cap que los uploads de
 * módulos (`checkUpload`); el MIME almacenado se deriva de la extensión, no
 * del header del browser. Devuelve `{ fileUrl, fileKey, fileName, mimeType,
 * sizeBytes }` para que el componente lo guarde adentro de `responses` al
 * hacer submit. No persiste nada por sí mismo — el blob queda en R2 pero
 * sólo pasa a ser "la respuesta" cuando el test se envía.
 */
client.post("/t/:token/upload", async (c) => {
  const token = c.req.param("token")

  const assignment = await prisma.testAssignment.findUnique({
    where: { accessToken: token },
    include: { test: true },
  })
  if (!assignment) return c.json({ error: "invalid" }, 404)
  if (assignment.test.type !== "COLLAGE") {
    return c.json({ error: "unsupported_test" }, 400)
  }

  const state = getAssignmentState(assignment)
  if (state === "expired") return c.json({ state: "expired" }, 410)
  if (state === "revoked") return c.json({ error: "revoked" }, 403)
  // Edición post-envío: también permitimos subir un archivo nuevo. applyPostReviewEdit
  // se encarga del resto cuando el submit llega por /edit.

  if (!isR2Configured()) {
    return c.json({ error: "La subida de archivos no está configurada (falta CLOUDFLARE_R2_*)." }, 503)
  }

  const form = await c.req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) return c.json({ error: "No se recibió ningún archivo" }, 400)

  const check = checkUpload(file.name, file.size)
  if (!check.ok) return c.json({ error: check.error }, 400)

  const key = buildCollageKey(assignment.id, file.name, check.extension)
  const buffer = Buffer.from(await file.arrayBuffer())

  let url: string
  try {
    url = await uploadToR2(key, buffer, check.mimeType)
  } catch {
    return c.json({ error: "No se pudo subir el archivo. Revisá la configuración de R2." }, 502)
  }

  return c.json({
    fileUrl: url,
    fileKey: key,
    fileName: file.name,
    mimeType: check.mimeType,
    sizeBytes: file.size,
  })
})

/**
 * POST /client/t/:token/submit
 * Submit test responses. Only valid while state === "form".
 */
client.post("/t/:token/submit", async (c) => {
  const token = c.req.param("token")

  const assignment = await prisma.testAssignment.findUnique({
    where: { accessToken: token },
    include: { client: { include: { student: true } }, test: true },
  })

  if (!assignment) return c.json({ error: "invalid" }, 404)

  const state = getAssignmentState(assignment)

  if (state === "expired") return c.json({ state: "expired" }, 410)
  if (state === "revoked") return c.json({ state: "revoked", error: "Este test quedó suspendido." }, 403)
  if (state === "results") return c.json({ error: "already_completed" }, 409)

  const { responses } = await c.req.json()

  const [testResponse] = await prisma.$transaction([
    prisma.testResponse.upsert({
      where: { assignmentId: assignment.id },
      update: { responses },
      create: { assignmentId: assignment.id, responses },
    }),
    prisma.testAssignment.update({
      where: { id: assignment.id },
      data: { completedAt: new Date() },
    }),
  ])

  // Fire-and-forget completion emails (fail silently so they never block submit)
  const resultsLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/t/${token}`
  sendTestCompletedToCoach(
    assignment.client.student.email,
    assignment.client.student.name,
    assignment.client.name,
    assignment.test.title,
  ).catch(() => {})
  if (assignment.client.email) {
    sendTestCompletedToClient(
      assignment.client.email,
      assignment.client.name,
      assignment.test.title,
      resultsLink,
    ).catch(() => {})
  }

  return c.json(testResponse)
})

/**
 * POST /client/t/:token/ai-insight — Anclas insight (token-scoped, best-effort).
 */
client.post("/t/:token/ai-insight", async (c) => {
  const assignment = await prisma.testAssignment.findUnique({
    where: { accessToken: c.req.param("token") },
  })
  if (!assignment) return c.json({ error: "invalid" }, 404)

  const { ranking, scores } = await c.req.json()
  const insight = await generateAnclasInsight(ranking, scores)
  return c.json({ insight })
})

/**
 * POST /client/t/:token/ai-ideas — Tablero idea cards (token-scoped, best-effort).
 */
client.post("/t/:token/ai-ideas", async (c) => {
  const assignment = await prisma.testAssignment.findUnique({
    where: { accessToken: c.req.param("token") },
  })
  if (!assignment) return c.json({ error: "invalid" }, 404)

  const body = await c.req.json()
  const ideas = await generateTableroIdeas(body)
  return c.json({ ideas })
})

/**
 * PUT /client/t/:token/edit
 * The coachee may fix their already-completed assignment as many times as they
 * like — see applyPostReviewEdit. Each save stamps `editedAt`/`editedBy` and
 * (if the supervisor had already reviewed it) sends it back for a re-review.
 */
client.put("/t/:token/edit", async (c) => {
  const token = c.req.param("token")

  const assignment = await prisma.testAssignment.findUnique({
    where: { accessToken: token },
  })

  if (!assignment) return c.json({ error: "invalid" }, 404)

  const state = getAssignmentState(assignment)
  if (state === "expired") return c.json({ state: "expired" }, 410)
  if (state === "form") return c.json({ error: "not_completed" }, 409)

  const { responses } = await c.req.json()

  try {
    const updated = await applyPostReviewEdit(assignment.id, responses, "coachee")
    return c.json(updated)
  } catch (e) {
    if (e instanceof PostReviewEditError) {
      return c.json({ error: e.code, message: e.message }, 409)
    }
    throw e
  }
})

export default client
