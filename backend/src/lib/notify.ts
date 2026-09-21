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
 * Where to send this event's notification, or `null` when it must not be sent —
 * either the event is switched off, or there is nobody to send it to.
 *
 * `to` is the primary recipient (env override or the supervisor). `bcc` is any
 * secondary email configured in the app, delivered as a real BCC on the same
 * message so the primary recipient never sees the address. Callers do one send:
 *   const target = await notifyTarget("submission")
 *   if (target) sendSomething(target.to, ..., target.bcc).catch(() => {})
 */
export async function notifyTarget(
  kind: NotifyKind
): Promise<{ to: string; bcc: string[] } | null> {
  const settings = await getSettings()
  if (!settings[SETTING_KEY[kind]]) return null

  const primary = await supervisorRecipient()
  if (!primary) return null

  const extra = settings.notifySecondaryEmail?.trim()
  // Avoid bcc'ing the primary to itself.
  const bcc = extra && extra !== primary ? [extra] : []
  return { to: primary, bcc }
}
