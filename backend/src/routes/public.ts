/**
 * Public routes — NO auth. Mounted at /public in index.ts.
 *
 * Self-signup goes through a SHARED LINK that expires: the supervisor generates
 * `/inscripcion/<token>`, it dies on its `expiresAt` (or when revoked), and only
 * then can somebody apply. No User row exists until the supervisor approves, so
 * a pending applicant cannot log in.
 */
import { Hono } from "hono"
import bcrypt from "bcryptjs"
import { prisma } from "../lib/prisma.js"
import { sendSignupReceivedEmail } from "../lib/email.js"
import { notifyTarget } from "../lib/notify.js"

const publicRoutes = new Hono()

/**
 * GET /public/config
 * Small, non-sensitive settings the frontend needs before/without a session,
 * sourced from the backend's own env so they can change without a Pages
 * rebuild. `supportPhone` is the developer's WhatsApp number shown in the
 * "Cómo usar la app" guide and the sidebar's Soporte button.
 */
publicRoutes.get("/config", (c) => {
  return c.json({ supportPhone: process.env.SUPPORT_PHONE || null })
})

/** Resolve a signup token, or explain why it is not usable. */
async function resolveLink(token: string) {
  const link = await prisma.signupLink.findUnique({
    where: { token },
    include: {
      cohort: { select: { id: true, name: true } },
      pool: { select: { id: true, name: true } },
    },
  })

  if (!link) return { ok: false as const, reason: "invalid" as const }
  if (link.disabled) return { ok: false as const, reason: "disabled" as const }
  if (link.expiresAt.getTime() < Date.now()) return { ok: false as const, reason: "expired" as const }
  return { ok: true as const, link }
}

/**
 * GET /public/signup/:token
 * Tells the form whether the link is alive, and which CIC it is bound to.
 * Returns 410 (Gone) for a dead link, mirroring the coachee token routes.
 */
publicRoutes.get("/signup/:token", async (c) => {
  const result = await resolveLink(c.req.param("token"))

  if (!result.ok) {
    return c.json(
      {
        state: result.reason,
        error:
          result.reason === "expired"
            ? "Este link de inscripción venció. Pedile uno nuevo a la coordinación."
            : "Este link de inscripción no es válido.",
      },
      410
    )
  }

  // A link bound to a cohort fixes the camada; an open one lets them choose.
  // A link bound to a pool fixes that instead — no cohort choice is offered.
  const cohorts = result.link.pool
    ? []
    : result.link.cohort
      ? [result.link.cohort]
      : await prisma.cohort.findMany({
          where: { active: true },
          orderBy: { startDate: "desc" },
          select: { id: true, name: true },
        })

  return c.json({
    state: "open",
    expiresAt: result.link.expiresAt,
    boundCohortId: result.link.cohort?.id ?? null,
    boundPoolId: result.link.pool?.id ?? null,
    boundPoolName: result.link.pool?.name ?? null,
    cohorts,
  })
})

/** POST /public/signup/:token */
publicRoutes.post("/signup/:token", async (c) => {
  const result = await resolveLink(c.req.param("token"))
  if (!result.ok) {
    return c.json({ error: "Este link de inscripción ya no está disponible." }, 410)
  }
  const link = result.link

  const { name, email, phone, especialidad, motivation, cohortId, password } =
    await c.req.json().catch(() => ({}) as Record<string, unknown>)

  const cleanName = String(name ?? "").trim()
  const cleanEmail = String(email ?? "").trim().toLowerCase()
  const cleanPassword = String(password ?? "")

  if (!cleanName) return c.json({ error: "Ingresá tu nombre" }, 400)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    return c.json({ error: "Ingresá un email válido" }, 400)
  }
  if (cleanPassword.length < 8) {
    return c.json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400)
  }

  // Deliberately vague: confirming which emails already have an account would
  // turn this public form into a way to enumerate the coaches.
  const genericOk = {
    ok: true,
    message: "Recibimos tu inscripción. Te vamos a avisar por email cuando sea aprobada.",
  }

  const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } })
  if (existingUser) return c.json(genericOk, 201)

  const existingPending = await prisma.signupRequest.findFirst({
    where: { email: cleanEmail, status: "PENDING" },
  })
  if (existingPending) return c.json(genericOk, 201)

  // A link bound to a cohort or a pool wins; otherwise accept only an active
  // cohort the form could legitimately have offered.
  let resolvedCohortId: string | null = link.cohortId
  if (!resolvedCohortId && !link.poolId && cohortId) {
    const cohort = await prisma.cohort.findFirst({
      where: { id: String(cohortId), active: true },
      select: { id: true },
    })
    if (cohort) resolvedCohortId = cohort.id
  }

  const created = await prisma.signupRequest.create({
    data: {
      name: cleanName,
      email: cleanEmail,
      phone: phone ? String(phone).trim() : null,
      especialidad: especialidad ? String(especialidad).trim() : null,
      motivation: motivation ? String(motivation).trim() : null,
      cohortId: resolvedCohortId,
      poolId: link.poolId,
      signupLinkId: link.id,
      passwordHash: await bcrypt.hash(cleanPassword, 12),
    },
    include: { cohort: { select: { name: true } }, pool: { select: { name: true } } },
  })

  const signupTo = await notifyTarget("signupRequest")
  for (const to of signupTo) {
    sendSignupReceivedEmail(
      to,
      created.name,
      created.email,
      created.cohort?.name ?? null
    ).catch(() => {})
  }

  return c.json(genericOk, 201)
})

export default publicRoutes
