import { createHash, randomBytes } from "node:crypto"
import { prisma } from "./prisma.js"
import { sendPasswordLinkEmail } from "./email.js"

const LINK_TTL_MS = 60 * 60 * 1000 // 1 hour
/** Minimum gap between mails to one account, so the form can't flood an inbox. */
const RESEND_GAP_MS = 60 * 1000

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173"

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

type ResetTarget = {
  id: string
  name: string
  email: string
  password: string | null
  resetExpiresAt: Date | null
}

/**
 * Mints a link and mails it. A pending invite has no password to replace, so it
 * is skipped — that account activates through its invitation. Within the resend
 * gap the previous link stays valid and nothing is sent.
 */
export async function issuePasswordLink(user: ResetTarget): Promise<void> {
  if (!user.password) return

  const lastIssuedAt = user.resetExpiresAt ? user.resetExpiresAt.getTime() - LINK_TTL_MS : 0
  if (Date.now() - lastIssuedAt < RESEND_GAP_MS) return

  const token = randomBytes(32).toString("hex")
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetTokenHash: hashResetToken(token),
      resetExpiresAt: new Date(Date.now() + LINK_TTL_MS),
    },
  })

  sendPasswordLinkEmail(user.email, user.name, `${FRONTEND_URL}/restablecer-password/${token}`).catch(() => {})
}
