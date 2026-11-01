import { beforeEach, describe, expect, it, vi } from "vitest"
import bcrypt from "bcryptjs"
import { Hono } from "hono"
import { authMiddleware, signJWT } from "../src/lib/auth.js"
import type { AppVariables } from "../src/lib/types.js"

type Row = {
  id: string
  name: string
  email: string
  role: string
  password: string | null
  mustChangePassword: boolean
  resetTokenHash: string | null
  resetExpiresAt: Date | null
  inviteToken?: string | null
  linkedUserId?: string | null
}

const { db } = vi.hoisted(() => ({
  db: { users: [] as Row[], clients: [] as { userId: string; email: string }[] },
}))

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    client: {
      updateMany: async ({ where, data }: { where: { userId: string }; data: { email: string } }) => {
        const hits = db.clients.filter((c) => c.userId === where.userId)
        hits.forEach((c) => Object.assign(c, data))
        return { count: hits.length }
      },
    },
    user: {
      findFirst: async ({ where }: { where: { email: { equals: string }; id: { not: string } } }) =>
        db.users.find(
          (u) => u.email.toLowerCase() === where.email.equals && u.id !== where.id.not
        ) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) =>
        db.users.find((u) => u.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) =>
        Object.assign(db.users.find((u) => u.id === where.id)!, data),
    },
  },
}))

const { default: adminRoutes } = await import("../src/routes/admin.js")

// Same wiring as src/index.ts: the sub-app relies on authMiddleware running first.
const app = new Hono<{ Variables: AppVariables }>()
app.use("/admin/*", authMiddleware)
app.route("/admin", adminRoutes)

const row = (id: string, role: string, password: string | null): Row => ({
  id,
  name: id,
  email: `${id}@x.com`,
  role,
  password,
  mustChangePassword: false,
  resetTokenHash: null,
  resetExpiresAt: null,
})

const find = (id: string) => db.users.find((u) => u.id === id)!

async function post(targetId: string, body: unknown, asId = "admin", asRole = "ADMIN") {
  const token = await signJWT({ id: asId, role: asRole, name: asId, email: `${asId}@x.com` } as never)
  return app.request(`/admin/users/${targetId}/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `token=${token}` },
    body: JSON.stringify(body),
  })
}

beforeEach(async () => {
  const hash = await bcrypt.hash("vieja-clave", 4)
  db.users = [
    row("admin", "ADMIN", hash),
    row("gaby", "SUPERVISOR", hash),
    row("ana", "STUDENT_COACH", hash),
    row("invitada", "STUDENT_COACH", null),
  ]
  db.clients = [{ userId: "ana", email: "ana@x.com" }]
})

describe("POST /admin/users/:id/password", () => {
  it("sets the typed password on the supervisor, forcing a change by default", async () => {
    const res = await post("gaby", { password: "nueva-clave" })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, password: "nueva-clave" })
    expect(await bcrypt.compare("nueva-clave", find("gaby").password!)).toBe(true)
    expect(find("gaby").mustChangePassword).toBe(true)
  })

  it("saves a typed password verbatim, since login does not trim", async () => {
    await post("ana", { password: " con espacios " })
    expect(await bcrypt.compare(" con espacios ", find("ana").password!)).toBe(true)
  })

  it("treats a blank password as none given", async () => {
    const { password } = await (await post("ana", { password: "   " })).json()
    expect(password.trim()).toBe(password)
    expect(password.length).toBeGreaterThanOrEqual(6)
  })

  it("leaves the password as definitive when mustChange is false", async () => {
    await post("ana", { password: "nueva-clave", mustChange: false })
    expect(find("ana").mustChangePassword).toBe(false)
  })

  it("generates a password when none is given and returns it", async () => {
    const res = await post("ana", {})
    const { password } = await res.json()
    expect(password.length).toBeGreaterThanOrEqual(6)
    expect(await bcrypt.compare(password, find("ana").password!)).toBe(true)
  })

  it("voids a mailed reset link still alive", async () => {
    find("ana").resetTokenHash = "abc"
    find("ana").resetExpiresAt = new Date(Date.now() + 60_000)
    await post("ana", { password: "nueva-clave" })
    expect(find("ana").resetTokenHash).toBeNull()
    expect(find("ana").resetExpiresAt).toBeNull()
  })

  it("rejects a typed password that is too short", async () => {
    const res = await post("ana", { password: "corta" })
    expect(res.status).toBe(400)
    expect(await bcrypt.compare("vieja-clave", find("ana").password!)).toBe(true)
  })

  it("refuses the admin's own account", async () => {
    const res = await post("admin", { password: "nueva-clave" })
    expect(res.status).toBe(400)
    expect(await bcrypt.compare("vieja-clave", find("admin").password!)).toBe(true)
  })

  it("refuses a pending invite and an unknown user", async () => {
    expect((await post("invitada", { password: "nueva-clave" })).status).toBe(400)
    expect(find("invitada").password).toBeNull()
    expect((await post("nadie", { password: "nueva-clave" })).status).toBe(404)
  })

  it("is forbidden to the supervisor and to coaches", async () => {
    expect((await post("ana", { password: "nueva-clave" }, "gaby", "SUPERVISOR")).status).toBe(403)
    expect((await post("gaby", { password: "nueva-clave" }, "ana", "STUDENT_COACH")).status).toBe(403)
    expect(await bcrypt.compare("vieja-clave", find("gaby").password!)).toBe(true)
  })
})

describe("PUT /admin/users/:id/email", () => {
  async function put(targetId: string, body: unknown, asId = "admin", asRole = "ADMIN") {
    const token = await signJWT({ id: asId, role: asRole, name: asId, email: `${asId}@x.com` } as never)
    return app.request(`/admin/users/${targetId}/email`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: `token=${token}` },
      body: JSON.stringify(body),
    })
  }

  it("stores the address trimmed and lowercase", async () => {
    const res = await put("gaby", { email: "  Gaby.Nueva@X.com " })
    expect(res.status).toBe(200)
    expect(find("gaby").email).toBe("gaby.nueva@x.com")
  })

  it("keeps the link between two accounts when both addresses change", async () => {
    find("gaby").linkedUserId = "ana"
    find("ana").linkedUserId = "gaby"
    await put("gaby", { email: "gaby2@x.com" })
    await put("ana", { email: "ana2@x.com" })
    expect(find("gaby").linkedUserId).toBe("ana")
    expect(find("ana").linkedUserId).toBe("gaby")
  })

  it("syncs the coach-as-coachee Client copy", async () => {
    await put("ana", { email: "ana2@x.com" })
    expect(db.clients[0].email).toBe("ana2@x.com")
  })

  it("voids links mailed to the old inbox", async () => {
    find("ana").resetTokenHash = "abc"
    find("ana").resetExpiresAt = new Date(Date.now() + 60_000)
    find("invitada").inviteToken = "tok"
    await put("ana", { email: "ana2@x.com" })
    await put("invitada", { email: "invitada2@x.com" })
    expect(find("ana").resetTokenHash).toBeNull()
    expect(find("invitada").inviteToken).toBeNull()
  })

  it("does nothing when the address is the same", async () => {
    find("ana").resetTokenHash = "abc"
    expect((await put("ana", { email: "ANA@x.com" })).status).toBe(200)
    expect(find("ana").resetTokenHash).toBe("abc")
  })

  it("rejects a taken address, ignoring case", async () => {
    const res = await put("ana", { email: "GABY@x.com" })
    expect(res.status).toBe(409)
    expect(find("ana").email).toBe("ana@x.com")
  })

  it("rejects an invalid address and an unknown user", async () => {
    expect((await put("ana", { email: "no-es-un-mail" })).status).toBe(400)
    expect((await put("nadie", { email: "x@x.com" })).status).toBe(404)
  })

  it("lets the admin change their own", async () => {
    expect((await put("admin", { email: "yo@x.com" })).status).toBe(200)
    expect(find("admin").email).toBe("yo@x.com")
  })

  it("is forbidden to the supervisor and to coaches", async () => {
    expect((await put("ana", { email: "a@x.com" }, "gaby", "SUPERVISOR")).status).toBe(403)
    expect((await put("gaby", { email: "a@x.com" }, "ana", "STUDENT_COACH")).status).toBe(403)
    expect(find("gaby").email).toBe("gaby@x.com")
  })
})
