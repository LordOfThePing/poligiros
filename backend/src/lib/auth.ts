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

/** Middleware: reads httpOnly cookie "token", verifies JWT, sets c.var.user */
export const authMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const token = getCookie(c, "token")
  if (!token) return c.json({ error: "Unauthorized" }, 401)

  const payload = await verifyJWT(token)
  if (!payload) return c.json({ error: "Unauthorized" }, 401)

  c.set("user", payload)
  await next()
}

/** Role guard — use after authMiddleware */
export function requireRole(role: string): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    const user = c.get("user")
    if (!user || user.role !== role) return c.json({ error: "Forbidden" }, 403)
    await next()
  }
}
