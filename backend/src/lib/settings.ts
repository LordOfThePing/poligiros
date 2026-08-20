import { prisma } from "./prisma.js"

/**
 * App-wide settings live in a single row (id "singleton"). The migration seeds
 * it, but `getSettings` upserts defensively so a database restored from an
 * older dump still works.
 */
export type Settings = {
  testCompleteDays: number
  testResultsDays: number
  signupLinkDays: number
  notifySignupRequest: boolean
  notifySupervisionRequest: boolean
  notifySubmission: boolean
  notifySessionRecorded: boolean
  /// Optional second address that also receives the supervisor notifications.
  notifySecondaryEmail: string | null
}

const DEFAULTS: Settings = {
  testCompleteDays: 14,
  testResultsDays: 365,
  signupLinkDays: 30,
  notifySignupRequest: true,
  notifySupervisionRequest: true,
  notifySubmission: true,
  notifySessionRecorded: true,
  notifySecondaryEmail: null,
}

export async function getSettings(): Promise<Settings> {
  const row = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", ...DEFAULTS },
  })

  return {
    testCompleteDays: row.testCompleteDays,
    testResultsDays: row.testResultsDays,
    signupLinkDays: row.signupLinkDays,
    notifySignupRequest: row.notifySignupRequest,
    notifySupervisionRequest: row.notifySupervisionRequest,
    notifySubmission: row.notifySubmission,
    notifySessionRecorded: row.notifySessionRecorded,
    notifySecondaryEmail: row.notifySecondaryEmail,
  }
}

/** Clamp to something sane — a 0-day link would be dead on arrival. */
export function clampDays(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(3650, Math.max(1, Math.round(n)))
}

const DAY_MS = 24 * 60 * 60 * 1000

export function daysFromNow(days: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + days * DAY_MS)
}
