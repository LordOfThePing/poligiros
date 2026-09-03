/** What the logged-in coach is allowed to do, from GET /student/access.
 *  The supervisor opens these per CIC: first they take the course, later they
 *  get to load coachees and run tests. A coach can also get the same practice
 *  access through a CoachPool ("coaches certificados") — a module-less group
 *  for coaches who already finished a CIC. */
export type TestType =
  | "ANCLAS_CARRERA"
  | "TABLERO_IDEAS"
  | "PLAN_VITAL"
  | "PIRAMIDE_PROPOSITO"
  | "MODELO_NEGOCIO"
  | "TAREAS_EXPLORACION"

export type CoachAccess = {
  cohortIds: string[]
  /** The CICs this coach belongs to (id + name) — powers a CIC picker. */
  cohorts: { id: string; name: string }[]
  /** True when at least one CIC granted practice. */
  practiceEnabled: boolean
  poolIds: string[]
  /** The coach pools this coach belongs to (id + name). */
  pools: { id: string; name: string }[]
  /** May load coachees AND run tests on them — from a CIC or a pool. */
  canPractice: boolean
  /** null = every catalog test (CIC-based access). Otherwise the union of
   *  tests enabled across the coach's pools — [] means none are assignable yet. */
  enabledTestTypes: TestType[] | null
  zoom: { cohortId: string; cohortName: string; url: string }[]
}
