import { Hono } from "hono"
import { setCookie, deleteCookie, getCookie } from "hono/cookie"
import { loginUser, signJWT, verifyJWT } from "../lib/auth.js"

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

  return c.json({
    id: payload.id,
    name: payload.name,
    email: payload.email,
    role: payload.role,
  })
})

export default auth
