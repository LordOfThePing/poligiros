import { Hono } from "hono"
import { prisma } from "../lib/prisma.js"
import { generateAnclasInsight, generateTableroIdeas } from "../lib/ai.js"

const client = new Hono()

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
 * GET /client/t/:token/develop — the post-test workspace for the chosen idea.
 * Returns the selected idea plus any saved (user-authored) canvas/job content.
 */
client.get("/t/:token/develop", async (c) => {
  const assignment = await prisma.testAssignment.findUnique({
    where: { accessToken: c.req.param("token") },
    include: { response: true, development: true },
  })
  if (!assignment) return c.json({ error: "invalid" }, 404)
  const responses = (assignment.response?.responses ?? {}) as Record<string, unknown>
  const selectedIdea = (assignment.development?.selectedIdea ?? responses.selectedIdea ?? "") as string
  return c.json({
    selectedIdea,
    kind: assignment.development?.kind ?? null,
    content: assignment.development?.content ?? {},
  })
})

/** PUT /client/t/:token/develop — save the user-authored canvas / job research. */
client.put("/t/:token/develop", async (c) => {
  const assignment = await prisma.testAssignment.findUnique({
    where: { accessToken: c.req.param("token") },
    include: { response: true },
  })
  if (!assignment) return c.json({ error: "invalid" }, 404)
  const { kind, content, selectedIdea: bodyIdea } = await c.req.json()
  const responses = (assignment.response?.responses ?? {}) as Record<string, unknown>
  const existing = await prisma.ideaDevelopment.findUnique({ where: { assignmentId: assignment.id } })
  // The user can edit the idea in the workspace; fall back to the saved value,
  // then to the Tablero's chosen idea when the body omits it.
  const selectedIdea = (bodyIdea ?? existing?.selectedIdea ?? responses.selectedIdea ?? "") as string
  const dev = await prisma.ideaDevelopment.upsert({
    where: { assignmentId: assignment.id },
    update: { kind, content, selectedIdea },
    create: { assignmentId: assignment.id, kind, content, selectedIdea },
  })
  return c.json(dev)
})

export default client
