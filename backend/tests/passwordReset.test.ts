import { beforeEach, describe, expect, it, vi } from "vitest"
import bcrypt from "bcryptjs"
import { signJWT } from "../src/lib/auth.js"

type Row = {
  id: string
  name: string
  email: string
  role: string
  password: string | null
  mustChangePassword: boolean
  resetTokenHash: string | null
  resetExpiresAt: Date | null
}

const { db, sendPasswordLinkEmail } = vi.hoisted(() => ({
  db: { users: [] as Row[] },
  sendPasswordLinkEmail: vi.fn(async () => {}),
}))

vi.mock("../src/lib/email.js", () => ({ sendPasswordLinkEmail }))

// Just enough of Prisma for these routes, over an in-memory list of users.
vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findFirst: async ({ where }: { where: { email: { equals: string } } }) =>
        db.users.find((u) => u.email.toLowerCase() === where.email.equals.toLowerCase()) ?? null,
      findUnique: async ({ where }: { where: Partial<Row> }) =>
        db.users.find((u) =>
          where.id ? u.id === where.id : u.resetTokenHash === where.resetTokenHash
        ) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) =>
        Object.assign(db.users.find((u) => u.id === where.id)!, data),
      updateMany: async ({
        where,
        data,
      }: {
        where: { resetTokenHash: string; resetExpiresAt: { gt: Date } }
        data: Partial<Row>
      }) => {
        const hits = db.users.filter(
          (u) =>
            u.resetTokenHash === where.resetTokenHash &&
            u.resetExpiresAt &&
            u.resetExpiresAt > where.resetExpiresAt.gt
        )
        hits.forEach((u) => Object.assign(u, data))
        return { count: hits.length }
      },
    },
  },
}))

const { default: auth } = await import("../src/routes/auth.js")

const post = (path: string, body: unknown, cookie?: string) =>
  auth.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  })

/** The token as it reached the inbox — the DB only ever holds its hash. */
function mailedToken(): string {
  const [, , link] = sendPasswordLinkEmail.mock.lastCall as unknown as [string, string, string]
  return link.split("/restablecer-password/")[1]
}

const user = () => db.users[0]

beforeEach(async () => {
  sendPasswordLinkEmail.mockClear()
  db.users = [
    {
      id: "u1",
      name: "Ana",
      email: "ana@x.com",
      role: "STUDENT_COACH",
      password: await bcrypt.hash("vieja-clave", 4),
      mustChangePassword: false,
      resetTokenHash: null,
      resetExpiresAt: null,
    },
  ]
})

describe("olvidé mi contraseña", () => {
  it("mails a link, and stores only its hash", async () => {
    const res = await post("/password-reset/request", { email: " ANA@x.com " })
    expect(res.status).toBe(200)
    expect(sendPasswordLinkEmail).toHaveBeenCalledTimes(1)
    expect(user().resetTokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(user().resetTokenHash).not.toBe(mailedToken())
  })

  it("answers the same for an unknown email and sends nothing", async () => {
    const known = await post("/password-reset/request", { email: "ana@x.com" })
    const unknown = await post("/password-reset/request", { email: "nadie@x.com" })
    expect(unknown.status).toBe(known.status)
    expect(await unknown.json()).toEqual(await known.json())
    expect(sendPasswordLinkEmail).toHaveBeenCalledTimes(1)
  })

  it("skips a pending invite, which has no password yet", async () => {
    user().password = null
    await post("/password-reset/request", { email: "ana@x.com" })
    expect(sendPasswordLinkEmail).not.toHaveBeenCalled()
  })

  it("does not send twice within the resend gap", async () => {
    await post("/password-reset/request", { email: "ana@x.com" })
    const first = user().resetTokenHash
    await post("/password-reset/request", { email: "ana@x.com" })
    expect(sendPasswordLinkEmail).toHaveBeenCalledTimes(1)
    expect(user().resetTokenHash).toBe(first)
  })

  it("replaces the old link once the gap has passed", async () => {
    await post("/password-reset/request", { email: "ana@x.com" })
    const oldToken = mailedToken()
    user().resetExpiresAt = new Date(user().resetExpiresAt!.getTime() - 2 * 60 * 1000)
    await post("/password-reset/request", { email: "ana@x.com" })

    expect(sendPasswordLinkEmail).toHaveBeenCalledTimes(2)
    expect((await auth.request(`/password-reset/${oldToken}`)).status).toBe(404)
    expect((await auth.request(`/password-reset/${mailedToken()}`)).status).toBe(200)
  })
})

describe("elegir la contraseña nueva", () => {
  async function requestLink() {
    await post("/password-reset/request", { email: "ana@x.com" })
    return mailedToken()
  }

  it("changes the password and burns the link", async () => {
    const token = await requestLink()
    user().mustChangePassword = true

    expect((await post(`/password-reset/${token}`, { password: "clave-nueva" })).status).toBe(200)
    expect(await bcrypt.compare("clave-nueva", user().password!)).toBe(true)
    expect(user().mustChangePassword).toBe(false)
    expect(user().resetTokenHash).toBeNull()

    expect((await post(`/password-reset/${token}`, { password: "otra-clave" })).status).toBe(410)
    expect(await bcrypt.compare("clave-nueva", user().password!)).toBe(true)
    expect((await auth.request(`/password-reset/${token}`)).status).toBe(404)
  })

  it("rejects an expired link", async () => {
    const token = await requestLink()
    const before = user().password
    user().resetExpiresAt = new Date(Date.now() - 1000)

    expect((await auth.request(`/password-reset/${token}`)).status).toBe(410)
    expect((await post(`/password-reset/${token}`, { password: "clave-nueva" })).status).toBe(410)
    expect(user().password).toBe(before)
  })

  it("rejects an unknown token", async () => {
    expect((await auth.request("/password-reset/inventado")).status).toBe(404)
    expect((await post("/password-reset/inventado", { password: "clave-nueva" })).status).toBe(410)
  })

  it("rejects a short password and keeps the link alive", async () => {
    const token = await requestLink()
    expect((await post(`/password-reset/${token}`, { password: "123" })).status).toBe(400)
    expect((await auth.request(`/password-reset/${token}`)).status).toBe(200)
  })
})

describe("cambio desde Configuración", () => {
  const session = async () =>
    `token=${await signJWT({ id: "u1", role: "STUDENT_COACH", name: "Ana", email: "ana@x.com" })}`

  it("needs a session", async () => {
    expect((await post("/password-change/request", {})).status).toBe(401)
  })

  it("mails the link to the account's own address", async () => {
    const res = await post("/password-change/request", {}, await session())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, email: "ana@x.com" })
    expect(sendPasswordLinkEmail).toHaveBeenCalledWith(
      "ana@x.com",
      "Ana",
      expect.stringContaining("/restablecer-password/")
    )
  })

  it("is refused to an impersonating admin", async () => {
    db.users.push({ ...user(), id: "a1", email: "admin@x.com", role: "ADMIN" })
    const admin = await signJWT({ id: "a1", role: "ADMIN", name: "Admin", email: "admin@x.com" })
    // authMiddleware loads the target with `findUnique` by id, as the mock does.
    const res = await post("/password-change/request", {}, `token=${admin}; impersonate=u1`)
    expect(res.status).toBe(403)
    expect(sendPasswordLinkEmail).not.toHaveBeenCalled()
  })

  it("no longer changes the password without the mail", async () => {
    const res = await post("/change-password", { newPassword: "clave-nueva", currentPassword: "vieja-clave" }, await session())
    expect(res.status).toBe(403)
    expect(await bcrypt.compare("vieja-clave", user().password!)).toBe(true)
  })

  it("still lets a coach reset by the supervisor pick one right away", async () => {
    user().mustChangePassword = true
    const res = await post("/change-password", { newPassword: "clave-nueva" }, await session())
    expect(res.status).toBe(200)
    expect(user().mustChangePassword).toBe(false)
  })
})
