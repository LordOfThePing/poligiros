/** What the logged-in coach is allowed to do, from GET /student/access.
 *  The supervisor opens these per CIC: first they take the course, later they
 *  get to load coachees and run tests. */
export type CoachAccess = {
  cohortIds: string[]
  clientsEnabled: boolean
  testsEnabled: boolean
  zoom: { cohortId: string; cohortName: string; url: string }[]
}
