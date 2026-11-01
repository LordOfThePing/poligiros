import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: {
    users: [] as { id: string; email: string }[],
    clients: [] as { userId: string; email: string }[],
  },
}))

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    client: {
      updateMany: async ({ where, data }: { where: { userId: string }; data: { email: string } }) =>
        db.clients.filter((c) => c.userId === where.userId).forEach((c) => (c.email = data.email)),
    },
    user: {
      findMany: async () => db.users,
      findUnique: async ({ where }: { where: { email: string } }) =>
        db.users.find((u) => u.email === where.email) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { email: string } }) => {
        db.users.find((u) => u.id === where.id)!.email = data.email
      },
    },
  },
}))

const { normalizeEmail, repairUserEmails } = await import("../src/lib/normalizeEmail.js")

describe("normalizeEmail", () => {
  it.each([
    [" gaby@x.com ", "plain spaces"],
    [" gaby@x.com", "a non-breaking space"],
    ["​gaby@x.com", "a zero-width space"],
    ["‪gaby@x.com‬", "direction marks from a contact card"],
    ["﻿GABY@x.com", "a BOM and capitals"],
  ])("cleans %j (%s)", (raw) => {
    expect(normalizeEmail(raw)).toBe("gaby@x.com")
  })

  it("keeps the characters an address may contain", () => {
    expect(normalizeEmail("gaby+coach_1.k@x-y.com")).toBe("gaby+coach_1.k@x-y.com")
  })
})

describe("repairUserEmails", () => {
  beforeEach(() => {
    db.users = []
    db.clients = []
  })

  it("cleans a dirty row and its Client copy", async () => {
    db.users = [{ id: "g", email: " gaby@x.com" }]
    db.clients = [{ userId: "g", email: " gaby@x.com" }]
    await repairUserEmails()
    expect(db.users[0].email).toBe("gaby@x.com")
    expect(db.clients[0].email).toBe("gaby@x.com")
  })

  it("leaves a row alone when its clean address is taken", async () => {
    db.users = [
      { id: "a", email: " gaby@x.com" },
      { id: "b", email: "gaby@x.com" },
    ]
    await repairUserEmails()
    expect(db.users[0].email).toBe(" gaby@x.com")
  })
})
