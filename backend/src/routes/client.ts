import { Hono } from "hono"
import { prisma } from "../lib/prisma.js"
import OpenAI from "openai"

const client = new Hono()

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const ANCHOR_NAMES: Record<string, string> = {
  TF: "Técnico/Funcional",
  GG: "Gerencia General",
  AU: "Autonomía",
  SE: "Seguridad/Estabilidad",
  CE: "Creativo-Empresario",
  SC: "Servicio a la Causa",
  PD: "Puro Desafío",
  EV: "Estilo de Vida",
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
 * POST /client/t/:token/ai-insight
 * Generate AI insight for Anclas de Carrera (token-scoped).
 */
client.post("/t/:token/ai-insight", async (c) => {
  const token = c.req.param("token")

  const assignment = await prisma.testAssignment.findUnique({
    where: { accessToken: token },
    include: { test: true },
  })

  if (!assignment) return c.json({ error: "invalid" }, 404)

  const { ranking, scores } = await c.req.json()
  const top3 = (ranking as string[]).slice(0, 3)

  // The insight is an optional enhancement — if there's no API key or OpenAI
  // errors, return a null insight (HTTP 200) so the client can still submit.
  if (!process.env.OPENAI_API_KEY) {
    return c.json({ insight: null })
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Sos un experto en coaching de carrera. Respondés en español rioplatense, de forma cálida, directa y personalizada. Máximo 4 oraciones.",
        },
        {
          role: "user",
          content: `Una persona completó el Test de Anclas de Carrera de Edgar Schein.
Sus top 3 anclas son:
1. ${ANCHOR_NAMES[top3[0]]} (${top3[0]}): ${scores[top3[0]]} puntos
2. ${ANCHOR_NAMES[top3[1]]} (${top3[1]}): ${scores[top3[1]]} puntos
3. ${ANCHOR_NAMES[top3[2]]} (${top3[2]}): ${scores[top3[2]]} puntos
Generá un insight personalizado sobre su perfil de carrera: qué tipo de trabajo, entorno y decisiones le darían más satisfacción a largo plazo.`,
        },
      ],
      max_tokens: 250,
    })

    const insight = completion.choices[0]?.message?.content ?? null
    return c.json({ insight })
  } catch (e) {
    console.error("ai-insight generation failed:", e)
    return c.json({ insight: null })
  }
})

export default client
