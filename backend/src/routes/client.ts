import { Hono } from "hono"
import { prisma } from "../lib/prisma.js"
import { generateAnclasInsight, generateTableroIdeas } from "../lib/ai.js"

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

/** Token state machine helper */
function getAssignmentState(assignment: {
  completedAt: Date | null
  completeBy: Date | null
  resultsViewableUntil: Date | null
}): "form" | "results" | "expired" {
  const now = new Date()

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
    })
  }

  // state === "results"
  return c.json({
    state: "results",
    testType: assignment.test.type,
    responses: assignment.response?.responses ?? null,
    coachFeedback: assignment.supervision?.coachFeedback ?? null,
    completedAt: assignment.completedAt,
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
  })

  if (!assignment) return c.json({ error: "invalid" }, 404)

  const state = getAssignmentState(assignment)

  if (state === "expired") return c.json({ state: "expired" }, 410)
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
 * Update responses for an already-completed assignment (coachee self-edit).
 * Only valid while state === "results" (completedAt is set).
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

  const updated = await prisma.testResponse.upsert({
    where: { assignmentId: assignment.id },
    update: { responses },
    create: { assignmentId: assignment.id, responses },
  })

  return c.json(updated)
})

export default client
