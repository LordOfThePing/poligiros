import { SignJWT, jwtVerify } from "jose"
import bcrypt from "bcryptjs"
import type { MiddlewareHandler } from "hono"
import { getCookie } from "hono/cookie"
import type { AppVariables } from "./types.js"
// prisma is imported lazily inside loginUser so the JWT/middleware path stays
// free of the DB client (keeps auth verification unit-testable without Prisma).

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "change-me-in-production"
)

export interface JWTPayload {
  id: string
  role: string
  name: string
  email: string
}

export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET)
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function loginUser(
  email: string,
  password: string
): Promise<JWTPayload | null> {
  const { prisma } = await import("./prisma.js")
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.password) return null // null password = pending invite

  const match = await bcrypt.compare(password, user.password)
  if (!match) return null

  return { id: user.id, role: user.role, name: user.name, email: user.email }
}

/**
 * Middleware: reads httpOnly cookie "token", verifies JWT, sets c.var.user.
 *
 * Impersonation: when the caller is an ADMIN and the "impersonate" cookie
 * carries a target user id, load that user from the DB and expose them as
 * c.var.user instead — so every downstream guard, route and query behaves as
 * if the impersonated user were logged in. The real admin identity is kept
 * on c.var.admin, and any invalid/missing target silently falls back to the
 * admin (no 5xx on a stale cookie).
 */
export const authMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const token = getCookie(c, "token")
  if (!token) return c.json({ error: "Unauthorized" }, 401)

  const payload = await verifyJWT(token)
  if (!payload) return c.json({ error: "Unauthorized" }, 401)

  if (payload.role === "ADMIN") {
    const targetId = getCookie(c, "impersonate")
    if (targetId) {
      const { prisma } = await import("./prisma.js")
      const target = await prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true, role: true, name: true, email: true },
      })
      if (target) {
        c.set("admin", payload)
        c.set("user", target as JWTPayload)
        await next()
        return
      }
    }
  }

  c.set("user", payload)
  await next()
}

/**
 * Role guard — use after authMiddleware. ADMIN is a wildcard: it passes every
 * role check. Impersonation still narrows the acting role (c.var.user.role is
 * the target's role, not ADMIN), so an admin impersonating a coach hits the
 * same guards the coach does.
 */
export function requireRole(role: string): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    const user = c.get("user")
    if (!user) return c.json({ error: "Forbidden" }, 403)
    if (user.role !== role && user.role !== "ADMIN") {
      return c.json({ error: "Forbidden" }, 403)
    }
    await next()
  }
}
