import { Hono } from "hono"
import { setCookie, deleteCookie, getCookie } from "hono/cookie"
import bcrypt from "bcryptjs"
import { loginUser, signJWT, verifyJWT } from "../lib/auth.js"
import { prisma } from "../lib/prisma.js"

const auth = new Hono()

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "None" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

/** POST /auth/login */
auth.post("/login", async (c) => {
  const { email, password } = await c.req.json()

  if (!email || !password) {
    return c.json({ error: "Email y contraseña requeridos" }, 400)
  }

  // Pending invite (no password yet) → tell the frontend to point them to the link.
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing && !existing.password) {
    return c.json({ error: "user_not_activated" }, 403)
  }

  const user = await loginUser(email, password)
  if (!user) {
    return c.json({ error: "Credenciales incorrectas" }, 401)
  }

  const token = await signJWT(user)
  setCookie(c, "token", token, COOKIE_OPTIONS)

  return c.json({ user })
})

/** POST /auth/logout */
auth.post("/logout", (c) => {
  deleteCookie(c, "token", { path: "/" })
  return c.json({ ok: true })
})

/** GET /auth/me */
auth.get("/me", async (c) => {
  const token = getCookie(c, "token")
  if (!token) return c.json({ error: "Unauthorized" }, 401)

  const payload = await verifyJWT(token)
  if (!payload) return c.json({ error: "Unauthorized" }, 401)

  // mustChangePassword lives on the row, not the JWT, so the coach is forced
  // onto the change-password screen even on the hydration call after a valid
  // login (loginUser runs DB-free).
  const dbUser = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { mustChangePassword: true, linkedUserId: true },
  })

  const linkedUser = dbUser?.linkedUserId
    ? await prisma.user.findUnique({
        where: { id: dbUser.linkedUserId },
        select: { id: true, name: true, role: true },
      })
    : null

  return c.json({
    id: payload.id,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    mustChangePassword: dbUser?.mustChangePassword ?? false,
    linkedUser,
  })
})

/**
 * POST /auth/switch — swap the session to this user's linked account (e.g. the
 * supervisor's own coach identity), no password required since it's the same
 * physical person already authenticated.
 */
auth.post("/switch", async (c) => {
  const token = getCookie(c, "token")
  if (!token) return c.json({ error: "Unauthorized" }, 401)

  const payload = await verifyJWT(token)
  if (!payload) return c.json({ error: "Unauthorized" }, 401)

  const me = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { linkedUserId: true },
  })
  if (!me?.linkedUserId) return c.json({ error: "No tenés una cuenta vinculada" }, 400)

  const target = await prisma.user.findUnique({ where: { id: me.linkedUserId } })
  if (!target) return c.json({ error: "Cuenta vinculada no encontrada" }, 404)

  const newPayload = { id: target.id, role: target.role, name: target.name, email: target.email }
  const newToken = await signJWT(newPayload)
  setCookie(c, "token", newToken, COOKIE_OPTIONS)
  return c.json({ user: newPayload })
})

/**
 * POST /auth/change-password — body: { currentPassword?, newPassword }
 * The logged-in coach chooses a fresh password. `currentPassword` is optional:
 * it is required only when the account was NOT reset by the supervisor, so
 * somebody else's opened session cannot silently change the password.
 */
auth.post("/change-password", async (c) => {
  const token = getCookie(c, "token")
  if (!token) return c.json({ error: "Unauthorized" }, 401)

  const payload = await verifyJWT(token)
  if (!payload) return c.json({ error: "Unauthorized" }, 401)

  const { newPassword, currentPassword } = await c.req.json().catch(() => ({}))
  const clean = String(newPassword ?? "")
  if (clean.length < 6) {
    return c.json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400)
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } })
  if (!user) return c.json({ error: "Not found" }, 404)

  // A coach who was force-reset by the supervisor may change it right away
  // (they are logging in with the fresh temporary password). Otherwise the
  // current password must be confirmed.
  const verified =
    user.mustChangePassword ||
    (user.password ? await bcrypt.compare(String(currentPassword ?? ""), user.password) : false)
  if (!verified) return c.json({ error: "Contraseña actual incorrecta" }, 400)

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(clean, 12), mustChangePassword: false },
  })

  return c.json({ ok: true })
})

/** GET /auth/register/:token — invite info for the registration page. */
auth.get("/register/:token", async (c) => {
  const user = await prisma.user.findUnique({ where: { inviteToken: c.req.param("token") } })
  if (!user) return c.json({ error: "invalid" }, 404)
  if (user.inviteExpiresAt && new Date() > user.inviteExpiresAt) return c.json({ error: "expired" }, 410)
  return c.json({ email: user.email, name: user.name })
})

/** POST /auth/register/:token — set password + profile, activate, and log in. */
auth.post("/register/:token", async (c) => {
  const user = await prisma.user.findUnique({ where: { inviteToken: c.req.param("token") } })
  if (!user) return c.json({ error: "invalid" }, 404)
  if (user.inviteExpiresAt && new Date() > user.inviteExpiresAt) return c.json({ error: "expired" }, 410)

  const { name, password, phone, especialidad, bio } = await c.req.json()
  if (!password || password.length < 6) {
    return c.json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400)
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: name?.trim() || user.name,
      password: await bcrypt.hash(password, 12),
      phone: phone ?? null,
      especialidad: especialidad ?? null,
      bio: bio ?? null,
      inviteToken: null,
      inviteExpiresAt: null,
    },
  })

  const payload = { id: updated.id, role: updated.role, name: updated.name, email: updated.email }
  const token = await signJWT(payload)
  setCookie(c, "token", token, COOKIE_OPTIONS)
  return c.json({ user: payload })
})

export default auth
