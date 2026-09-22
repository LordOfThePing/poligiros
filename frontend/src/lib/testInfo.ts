/** Display names for tests, keyed by TestType.
 *
 * The frontend is the source of truth for how tests are labeled in the UI —
 * the DB's `Test.title` is only shown as a fallback for unknown types. This
 * way a rename is a one-line frontend change and does not require re-running
 * `db:bootstrap`. */
export const TEST_TITLES: Record<string, string> = {
  ANCLAS_CARRERA: "Test de Anclas de Carrera",
  TABLERO_IDEAS: "Tablero de Ideas",
  PLAN_VITAL: "Plan Vital Integral®",
  PIRAMIDE_PROPOSITO: "Pirámide del Propósito",
  MODELO_NEGOCIO: "Desarrollo de idea de negocio/proyecto/trabajo",
  TAREAS_EXPLORACION: "Tareas a explorar",
}

export function testTitle(type: string | null | undefined, fallback = ""): string {
  if (!type) return fallback
  return TEST_TITLES[type] ?? fallback
}
