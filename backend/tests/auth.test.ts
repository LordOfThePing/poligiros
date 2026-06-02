import { describe, it, expect } from "vitest"
import { SignJWT } from "jose"
import { Hono } from "hono"
import { signJWT, verifyJWT, authMiddleware } from "../src/lib/auth.js"

// Must match vitest.config env JWT_SECRET so tokens we forge here verify against
// the same key the auth module loaded.
const SECRET = new TextEncoder().encode("test-secret-key")
const payload = { id: "u1", role: "SUPERVISOR", name: "Gaby", email: "g@x.com" }

function expiredToken() {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 10) // already past
    .sign(SECRET)
}

describe("JWT helpers", () => {
  it("signs and verifies a valid token round-trip", async () => {
    const token = await signJWT(payload)
    const result = await verifyJWT(token)
    expect(result).toMatchObject({ id: "u1", role: "SUPERVISOR" })
  })

  it("returns null for a malformed token", async () => {
    expect(await verifyJWT("not-a-jwt")).toBeNull()
  })

  it("returns null for a token signed with the wrong secret", async () => {
    const foreign = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode("a-different-secret"))
    expect(await verifyJWT(foreign)).toBeNull()
  })

  it("returns null for an expired token", async () => {
    expect(await verifyJWT(await expiredToken())).toBeNull()
  })
})

describe("authMiddleware", () => {
  const app = new Hono()
  app.use("*", authMiddleware)
  app.get("/protected", (c) => c.json({ ok: true }))

  it("401 when the cookie is missing", async () => {
    const res = await app.request("/protected")
    expect(res.status).toBe(401)
  })

  it("401 when the token is expired", async () => {
    const res = await app.request("/protected", {
      headers: { Cookie: `token=${await expiredToken()}` },
    })
    expect(res.status).toBe(401)
  })

  it("200 when the cookie holds a valid token", async () => {
    const token = await signJWT(payload)
    const res = await app.request("/protected", {
      headers: { Cookie: `token=${token}` },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
