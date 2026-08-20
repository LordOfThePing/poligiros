import { prisma } from "./prisma.js"

/**
 * What a coach is allowed to do, derived from the cohorts they are enrolled in.
 *
 * The supervisor opens `practiceEnabled` per cohort: a coach first takes the
 * course, and only later gets to load coachees and run tests on them. A coach
 * enrolled in several CICs gets the union of their permissions — being allowed
 * somewhere is enough.
 *
 * Enrollment in an *inactive* cohort still counts. `Cohort.active` marks a
 * finished camada, and finishing the course should not revoke access to the
 * material a coach already had.
 */
export type CoachAccess = {
  cohortIds: string[]
  /** The CICs this coach belongs to, with names — for a CIC picker in the app. */
  cohorts: { id: string; name: string }[]
  /** May load coachees AND run tests on them — one permission, not two. */
  practiceEnabled: boolean
  /** Zoom links of the cohorts the coach belongs to, for the Programa page. */
  zoom: { cohortId: string; cohortName: string; url: string }[]
}

export async function getCoachAccess(userId: string): Promise<CoachAccess> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: { cohort: true },
  })

  return {
    cohortIds: enrollments.map((e) => e.cohortId),
    cohorts: enrollments.map((e) => ({ id: e.cohortId, name: e.cohort.name })),
    practiceEnabled: enrollments.some((e) => e.cohort.practiceEnabled),
    zoom: enrollments
      .filter((e) => e.cohort.zoomUrl)
      .map((e) => ({ cohortId: e.cohortId, cohortName: e.cohort.name, url: e.cohort.zoomUrl! })),
  }
}
