import { Hono } from "hono"
import { setCookie, deleteCookie } from "hono/cookie"
import { prisma } from "../lib/prisma.js"
import type { AppVariables } from "../lib/types.js"

const admin = new Hono<{ Variables: AppVariables }>()

/**
 * The impersonation cookie mirrors the auth cookie (httpOnly, cross-site) so
 * the frontend can pick it up on the next XHR without ever touching JS.
 */
const IMPERSONATE_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "None" as const,
  path: "/",
  maxAge: 60 * 60 * 8, // 8h — impersonation is short-lived on purpose
}

/**
 * Gate: a caller here is either a real admin OR an admin currently
 * impersonating. In the impersonation case c.var.user is the target and
 * c.var.admin holds the real identity — either one lets us reach the admin
 * endpoints (otherwise starting impersonation would evict the admin from
 * their own panel).
 */
admin.use("/*", async (c, next) => {
  const user = c.get("user")
  const asAdmin = c.get("admin")
  const ok = user?.role === "ADMIN" || asAdmin?.role === "ADMIN"
  if (!ok) return c.json({ error: "Forbidden" }, 403)
  await next()
})

/**
 * GET /admin/users — every registered user (supervisor + coaches). Coachees
 * (Clients) don't live here because they don't have a login; use /admin/coachees
 * to grab their magic links instead.
 */
admin.get("/users", async (c) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      password: true, // just to expose "pending invite" state
      enrollments: { select: { cohort: { select: { id: true, name: true } } } },
      poolMemberships: { select: { pool: { select: { id: true, name: true } } } },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  })

  return c.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      pending: !u.password,
      cohorts: u.enrollments.map((e) => e.cohort),
      pools: u.poolMemberships.map((m) => m.pool),
    }))
  )
})

/**
 * GET /admin/coachees — every Client with the still-valid magic link the admin
 * can hand-open to see the coachee's world. There is no session to impersonate
 * for a coachee: the link IS their credential.
 */
admin.get("/coachees", async (c) => {
  const assignments = await prisma.testAssignment.findMany({
    where: { accessToken: { not: null } },
    orderBy: { assignedAt: "desc" },
    select: {
      id: true,
      accessToken: true,
      completeBy: true,
      resultsViewableUntil: true,
      completedAt: true,
      test: { select: { title: true, type: true } },
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          student: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })
  return c.json(assignments)
})

/**
 * POST /admin/impersonate/:userId — sets the impersonation cookie. From the
 * next request onwards authMiddleware substitutes c.var.user for this user.
 * The admin JWT itself is untouched, so DELETE /admin/impersonate is enough
 * to return to admin identity.
 */
admin.post("/impersonate/:userId", async (c) => {
  const target = await prisma.user.findUnique({
    where: { id: c.req.param("userId") },
    select: { id: true, name: true, email: true, role: true },
  })
  if (!target) return c.json({ error: "not_found" }, 404)
  if (target.role === "ADMIN") return c.json({ error: "cannot_impersonate_admin" }, 400)

  setCookie(c, "impersonate", target.id, IMPERSONATE_COOKIE)
  return c.json({ user: target })
})

/** DELETE /admin/impersonate — clear the cookie, back to admin. */
admin.delete("/impersonate", (c) => {
  deleteCookie(c, "impersonate", { path: "/" })
  return c.json({ ok: true })
})

export default admin
