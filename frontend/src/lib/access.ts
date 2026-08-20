/** What the logged-in coach is allowed to do, from GET /student/access.
 *  The supervisor opens these per CIC: first they take the course, later they
 *  get to load coachees and run tests. */
export type CoachAccess = {
  cohortIds: string[]
  /** The CICs this coach belongs to (id + name) — powers a CIC picker. */
  cohorts: { id: string; name: string }[]
  /** May load coachees AND run tests on them — one permission, not two. */
  practiceEnabled: boolean
  zoom: { cohortId: string; cohortName: string; url: string }[]
}
