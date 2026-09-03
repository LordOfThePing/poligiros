import { prisma } from "./prisma.js"
import type { TestType } from "@prisma/client"

/**
 * What a coach is allowed to do, derived from the cohorts they are enrolled in
 * and the coach pools ("coaches certificados") they belong to.
 *
 * The supervisor opens `practiceEnabled` per cohort: a coach first takes the
 * course, and only later gets to load coachees and run tests on them. A coach
 * enrolled in several CICs gets the union of their permissions — being allowed
 * somewhere is enough.
 *
 * A CoachPool is a separate, module-less group for coaches who already
 * finished a CIC and keep practising: membership itself grants access, and
 * `CoachPool.enabledTests` caps which tests a pool-only coach may assign.
 *
 * Enrollment in an *inactive* cohort still counts. `Cohort.active` marks a
 * finished camada, and finishing the course should not revoke access to the
 * material a coach already had. Pool membership works the same way.
 */
export type CoachAccess = {
  cohortIds: string[]
  /** The CICs this coach belongs to, with names — for a CIC picker in the app. */
  cohorts: { id: string; name: string }[]
  /** True when at least one cohort has granted CIC practice. */
  practiceEnabled: boolean
  poolIds: string[]
  /** The coach pools this coach belongs to, with names. */
  pools: { id: string; name: string }[]
  /** May load coachees AND run tests on them — from a cohort or a pool. */
  canPractice: boolean
  /** null = every catalog test (cohort-based access). Otherwise the union of
   *  enabledTests across the coach's pools — [] means nothing is assignable yet. */
  enabledTestTypes: TestType[] | null
  /** Zoom links of the cohorts the coach belongs to, for the Programa page. */
  zoom: { cohortId: string; cohortName: string; url: string }[]
}

export async function getCoachAccess(userId: string): Promise<CoachAccess> {
  const [enrollments, poolMemberships] = await Promise.all([
    prisma.enrollment.findMany({ where: { userId }, include: { cohort: true } }),
    prisma.poolMembership.findMany({ where: { userId }, include: { pool: true } }),
  ])

  const practiceEnabled = enrollments.some((e) => e.cohort.practiceEnabled)
  const enabledTestTypes = practiceEnabled
    ? null
    : [...new Set(poolMemberships.flatMap((m) => m.pool.enabledTests))]

  return {
    cohortIds: enrollments.map((e) => e.cohortId),
    cohorts: enrollments.map((e) => ({ id: e.cohortId, name: e.cohort.name })),
    practiceEnabled,
    poolIds: poolMemberships.map((m) => m.poolId),
    pools: poolMemberships.map((m) => ({ id: m.poolId, name: m.pool.name })),
    canPractice: practiceEnabled || poolMemberships.length > 0,
    enabledTestTypes,
    zoom: enrollments
      .filter((e) => e.cohort.zoomUrl)
      .map((e) => ({ cohortId: e.cohortId, cohortName: e.cohort.name, url: e.cohort.zoomUrl! })),
  }
}
