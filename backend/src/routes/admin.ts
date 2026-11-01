import { Hono } from "hono"
import { setCookie, deleteCookie } from "hono/cookie"
import bcrypt from "bcryptjs"
import { randomBytes } from "node:crypto"
import { findUserByEmail } from "../lib/auth.js"
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
      linkedUserId: true,
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
      linked: !!u.linkedUserId,
      cohorts: u.enrollments.map((e) => e.cohort),
      pools: u.poolMemberships.map((m) => m.pool),
    }))
  )
})

/**
 * POST /admin/users/:id/password — body: { password?, mustChange? }
 * Sets the password of any other account, supervisor included. Without a
 * `password` a random one is generated; either way it comes back in the
 * response and the admin hands it over — nothing is mailed. `mustChange`
 * (default true) sends the user to /cambiar-password on their next page load.
 * A mailed reset link still alive is voided, or it could overwrite this one.
 */
admin.post("/users/:id/password", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json().catch(() => ({}))
  // Saved exactly as typed: login compares verbatim, so trimming here would
  // reject the very password the admin just set.
  const raw = String(body.password ?? "")
  const typed = raw.trim() ? raw : ""
  if (typed && typed.length < 6) {
    return c.json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400)
  }

  const realAdmin = c.get("admin") ?? c.get("user")
  if (id === realAdmin.id) {
    return c.json({ error: "Tu propia contraseña se cambia desde tu tarjeta de contraseña" }, 400)
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, password: true },
  })
  if (!target) return c.json({ error: "Usuario no encontrado" }, 404)
  if (!target.password) {
    return c.json({ error: "Este usuario todavía no se registró. Reenviale la invitación." }, 400)
  }

  const password = typed || randomBytes(9).toString("base64url")
  await prisma.user.update({
    where: { id },
    data: {
      password: await bcrypt.hash(password, 12),
      mustChangePassword: body.mustChange !== false,
      resetTokenHash: null,
      resetExpiresAt: null,
    },
  })

  return c.json({ ok: true, password })
})

/**
 * POST /admin/login-check — body: { email, password }
 * Answers why a login works or not, using the same lookup and comparison as
 * /auth/login, without opening a session or changing anything. Exists so a
 * failed login can be diagnosed from the panel instead of from the server.
 */
admin.post("/login-check", async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const found = await findUserByEmail(String(body.email ?? ""))
  if (!found) return c.json({ found: false })

  return c.json({
    found: true,
    account: { name: found.name, email: found.email, role: found.role, linked: !!found.linkedUserId },
    pending: !found.password,
    mustChange: found.mustChangePassword,
    passwordOk: found.password
      ? await bcrypt.compare(String(body.password ?? ""), found.password)
      : false,
  })
})

/**
 * PUT /admin/users/:id/email — body: { email }
 * Changes the login address of any account, the admin's own included. Accounts
 * reference each other by id, so a linked account (User.linkedUserId) survives
 * this untouched. Links already mailed went to the old inbox, so a live
 * password link and a pending invite are voided: the invite has to be resent.
 * Stored lowercase because /auth/login and Google look the email up verbatim.
 */
admin.put("/users/:id/email", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json().catch(() => ({}))
  const email = String(body.email ?? "").trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.json({ error: "Email inválido" }, 400)
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  })
  if (!target) return c.json({ error: "Usuario no encontrado" }, 404)
  if (email === target.email) return c.json({ ok: true, email })

  const clash = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, id: { not: id } },
    select: { id: true },
  })
  if (clash) return c.json({ error: "Ya existe un usuario con ese email" }, 409)

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          email,
          resetTokenHash: null,
          resetExpiresAt: null,
          inviteToken: null,
          inviteExpiresAt: null,
        },
      }),
      // A coach's coach-as-coachee Client keeps its own copy of the address.
      prisma.client.updateMany({ where: { userId: id }, data: { email } }),
    ])
  } catch (err) {
    // Lost the race against another write of the same address.
    if ((err as { code?: string }).code === "P2002") {
      return c.json({ error: "Ya existe un usuario con ese email" }, 409)
    }
    throw err
  }

  return c.json({ ok: true, email })
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
