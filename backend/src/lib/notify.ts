import { prisma } from "./prisma.js"
import { getSettings } from "./settings.js"

/**
 * Supervisor notifications: who they go to, and whether each event sends one.
 *
 * Recipient resolution puts `SUPERVISOR_NOTIFY_EMAIL` first so notifications can
 * go to a shared inbox (or be redirected while testing) without touching the
 * account Gaby logs in with. Falls back to the SUPERVISOR user.
 */
export type NotifyKind =
  | "signupRequest"
  | "supervisionRequest"
  | "submission"
  | "sessionRecorded"

const SETTING_KEY: Record<NotifyKind, keyof Awaited<ReturnType<typeof getSettings>>> = {
  signupRequest: "notifySignupRequest",
  supervisionRequest: "notifySupervisionRequest",
  submission: "notifySubmission",
  sessionRecorded: "notifySessionRecorded",
}

export async function supervisorRecipient(): Promise<string | null> {
  const override = process.env.SUPERVISOR_NOTIFY_EMAIL?.trim()
  if (override) return override

  const supervisor = await prisma.user.findFirst({
    where: { role: "SUPERVISOR" },
    select: { email: true },
  })
  return supervisor?.email ?? null
}

/**
 * The addresses to notify for this event, or an empty array when it must not be
 * sent — either the event is switched off, or there is nobody to send it to.
 *
 * This is the primary (env override or the supervisor) plus any secondary email
 * configured in the app. Callers send one email per address:
 *   const to = await notifyTarget("submission")
 *   for (const addr of to) sendSomething(addr, ...).catch(() => {})
 */
export async function notifyTarget(kind: NotifyKind): Promise<string[]> {
  const settings = await getSettings()
  if (!settings[SETTING_KEY[kind]]) return []

  const primary = await supervisorRecipient()
  if (!primary) return []

  const extra = settings.notifySecondaryEmail?.trim()
  // Avoid sending a duplicate when the secondary equals the primary.
  return extra && extra !== primary ? [primary, extra] : [primary]
}
