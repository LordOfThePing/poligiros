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

export default client
