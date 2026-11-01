import { Hono } from "hono"
import { setCookie, deleteCookie, getCookie } from "hono/cookie"
import bcrypt from "bcryptjs"
import { randomBytes } from "node:crypto"
import { authMiddleware, findUserByEmail, loginUser, signJWT, verifyJWT } from "../lib/auth.js"
import { prisma } from "../lib/prisma.js"
import { hashResetToken, issuePasswordLink } from "../lib/passwordReset.js"
import type { AppVariables } from "../lib/types.js"

const auth = new Hono<{ Variables: AppVariables }>()

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "None" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

/* ─────────────────────────────────────────
   Google OAuth (opt-in)
   Requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + PUBLIC_API_URL. Only logs
   in users that ALREADY exist and have completed registration — no auto-signup.
───────────────────────────────────────── */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173"
const PUBLIC_API_URL =
  process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3001}`
const GOOGLE_REDIRECT_URI = `${PUBLIC_API_URL}/auth/google/callback`

const isGoogleConfigured = () => !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)

/**
 * Round-trip token that carries the post-login `callbackUrl` from /start to
 * /callback and lets us verify the response was for the request we started.
 * Kept in an httpOnly Lax cookie so it survives Google's top-level redirect.
 */
const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Lax" as const,
  path: "/auth/google",
  maxAge: 60 * 10,
}

function safeCallback(raw: string | undefined | null): string {
  if (!raw || !raw.startsWith("/")) return "/"
  return raw
}

/** GET /auth/google/start?callbackUrl=/foo → 302 to Google */
auth.get("/google/start", (c) => {
  if (!isGoogleConfigured()) {
    return c.redirect(`${FRONTEND_URL}/login?googleError=disabled`)
  }
  const callbackUrl = safeCallback(c.req.query("callbackUrl"))
  const nonce = randomBytes(16).toString("hex")
  const state = `${nonce}|${encodeURIComponent(callbackUrl)}`

  setCookie(c, "oauth_state", state, OAUTH_STATE_COOKIE_OPTIONS)

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  })
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
})

/** GET /auth/google/callback — Google redirects here with `code` + `state` */
auth.get("/google/callback", async (c) => {
  const code = c.req.query("code")
  const stateParam = c.req.query("state")
  const stateCookie = getCookie(c, "oauth_state")
  deleteCookie(c, "oauth_state", { path: "/auth/google" })

  const bail = (err: string, email?: string) => {
    const q = new URLSearchParams({ googleError: err })
    if (email) q.set("email", email)
    return c.redirect(`${FRONTEND_URL}/login?${q.toString()}`)
  }

  if (!isGoogleConfigured()) return bail("disabled")
  if (!code || !stateParam || !stateCookie || stateParam !== stateCookie) return bail("state")

  const callbackUrl = safeCallback(decodeURIComponent(stateCookie.split("|")[1] ?? "/"))

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  })
  if (!tokenRes.ok) return bail("token")
  const tokens = (await tokenRes.json().catch(() => ({}))) as { access_token?: string }
  if (!tokens.access_token) return bail("token")

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!infoRes.ok) return bail("userinfo")
  const info = (await infoRes.json().catch(() => ({}))) as {
    email?: string
    email_verified?: boolean
    name?: string
  }

  const email = (info.email ?? "").trim().toLowerCase()
  if (!email || info.email_verified === false) return bail("email")

  const user = await findUserByEmail(email)
  if (!user) return bail("not_found", email)
  if (!user.password) return bail("not_activated")

  const payload = { id: user.id, role: user.role, name: user.name, email: user.email }
  const jwt = await signJWT(payload)
  setCookie(c, "token", jwt, COOKIE_OPTIONS)

  return c.redirect(`${FRONTEND_URL}${callbackUrl}`)
})

/** POST /auth/login */
auth.post("/login", async (c) => {
  const { email, password } = await c.req.json()

  if (!email || !password) {
    return c.json({ error: "Email y contraseña requeridos" }, 400)
  }

  // Pending invite (no password yet) → tell the frontend to point them to the link.
  const existing = await findUserByEmail(String(email))
  if (existing && !existing.password) {
    return c.json({ error: "user_not_activated" }, 403)
  }

  const user = await loginUser(String(email), String(password))
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

  // If the caller is an admin currently impersonating someone (see
  // authMiddleware), hydrate as the TARGET user — the whole frontend then
  // renders exactly what that user would see — and expose the real admin
  // identity separately so the banner can offer "Volver".
  const impersonateId = payload.role === "ADMIN" ? getCookie(c, "impersonate") : null
  const effectiveId = impersonateId || payload.id

  const dbUser = await prisma.user.findUnique({
    where: { id: effectiveId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      mustChangePassword: true,
      linkedUserId: true,
    },
  })
  if (!dbUser) return c.json({ error: "Unauthorized" }, 401)

  const linkedUser = dbUser.linkedUserId
    ? await prisma.user.findUnique({
        where: { id: dbUser.linkedUserId },
        select: { id: true, name: true, role: true },
      })
    : null

  const impersonatedBy =
    impersonateId && dbUser.id !== payload.id
      ? { id: payload.id, name: payload.name, email: payload.email }
      : null

  return c.json({
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    // Only the account's owner can clear the flag, so an impersonating admin
    // must not be sent to a screen that would answer 403.
    mustChangePassword: impersonatedBy ? false : dbUser.mustChangePassword,
    linkedUser,
    /** Real admin identity when impersonating; null otherwise. */
    impersonatedBy,
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
 * POST /auth/change-password — body: { newPassword }
 * Only for a coach force-reset by the supervisor, who is logged in with the
 * temporary password. Any other change goes through the mailed link, so an
 * opened session alone cannot change the password.
 */
auth.post("/change-password", async (c) => {
  const token = getCookie(c, "token")
  if (!token) return c.json({ error: "Unauthorized" }, 401)

  const payload = await verifyJWT(token)
  if (!payload) return c.json({ error: "Unauthorized" }, 401)

  const { newPassword } = await c.req.json().catch(() => ({}))
  const clean = String(newPassword ?? "")
  if (clean.length < 6) {
    return c.json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400)
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } })
  if (!user) return c.json({ error: "Not found" }, 404)
  if (!user.mustChangePassword) {
    return c.json({ error: "Pedí el cambio desde Configuración: te llega un link por mail" }, 403)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(clean, 12), mustChangePassword: false },
  })

  return c.json({ ok: true })
})

/**
 * POST /auth/password-reset/request — body: { email }
 * "Olvidé mi contraseña". Answers the same whether or not the account exists,
 * so it cannot be used to enumerate coaches.
 */
auth.post("/password-reset/request", async (c) => {
  const { email } = await c.req.json().catch(() => ({}))
  const clean = String(email ?? "").trim()
  if (!clean) return c.json({ error: "Email requerido" }, 400)

  const user = await prisma.user.findFirst({
    where: { email: { equals: clean, mode: "insensitive" } },
  })
  if (user) await issuePasswordLink(user)

  return c.json({ ok: true })
})

/**
 * POST /auth/password-change/request — the same link, from Configuración. It
 * goes to the account's own address. An impersonating admin cannot trigger it:
 * the mail would land on a user who never asked for it.
 */
auth.post("/password-change/request", authMiddleware, async (c) => {
  if (c.get("admin")) {
    return c.json({ error: "No disponible mientras ves la app como otro usuario" }, 403)
  }

  const user = await prisma.user.findUnique({ where: { id: c.get("user").id } })
  if (!user) return c.json({ error: "Not found" }, 404)
  await issuePasswordLink(user)

  return c.json({ ok: true, email: user.email })
})

/** GET /auth/password-reset/:token — link check for the new-password page. */
auth.get("/password-reset/:token", async (c) => {
  const user = await prisma.user.findUnique({
    where: { resetTokenHash: hashResetToken(c.req.param("token")) },
  })
  if (!user) return c.json({ error: "invalid" }, 404)
  if (!user.resetExpiresAt || new Date() > user.resetExpiresAt) {
    return c.json({ error: "expired" }, 410)
  }
  return c.json({ email: user.email })
})

/**
 * POST /auth/password-reset/:token — body: { password }
 * The expiry and the clearing of the token share one UPDATE, so two submits of
 * the same link cannot both win. Using it also lifts a pending supervisor
 * reset: the mail already proved who is asking.
 */
auth.post("/password-reset/:token", async (c) => {
  const { password } = await c.req.json().catch(() => ({}))
  const clean = String(password ?? "")
  if (clean.length < 6) {
    return c.json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400)
  }

  const { count } = await prisma.user.updateMany({
    where: {
      resetTokenHash: hashResetToken(c.req.param("token")),
      resetExpiresAt: { gt: new Date() },
    },
    data: {
      password: await bcrypt.hash(clean, 12),
      mustChangePassword: false,
      resetTokenHash: null,
      resetExpiresAt: null,
    },
  })
  if (count === 0) return c.json({ error: "expired" }, 410)

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
