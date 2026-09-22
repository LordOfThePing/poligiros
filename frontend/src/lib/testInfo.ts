/** Display names + canonical order for tests, keyed by TestType.
 *
 * The frontend is the source of truth for how tests are labeled and ordered
 * in the UI — the DB's `Test.title` / `orderIndex` are only used as fallbacks
 * for unknown types. This way a rename or reorder is a one-line frontend
 * change and does not require re-running `db:bootstrap`.
 *
 * Order: Tareas a explorar and Desarrollo de idea are post-tests of Tablero,
 * so they sit right after it. */
export const TEST_TITLES: Record<string, string> = {
  ANCLAS_CARRERA: "Test de Anclas de Carrera",
  TABLERO_IDEAS: "Tablero de Ideas",
  TAREAS_EXPLORACION: "Tareas a explorar",
  MODELO_NEGOCIO: "Desarrollo de idea de negocio/proyecto/trabajo",
  PLAN_VITAL: "Plan Vital Integral®",
  PIRAMIDE_PROPOSITO: "Pirámide del Propósito",
}

/** Canonical display order. Insertion order of TEST_TITLES is the order. */
export const TEST_ORDER: string[] = Object.keys(TEST_TITLES)

export function testTitle(type: string | null | undefined, fallback = ""): string {
  if (!type) return fallback
  return TEST_TITLES[type] ?? fallback
}

/** Sort key: index in TEST_ORDER, or +∞ for unknown types (kept at the end). */
export function testOrderIndex(type: string | null | undefined): number {
  if (!type) return Number.POSITIVE_INFINITY
  const i = TEST_ORDER.indexOf(type)
  return i === -1 ? Number.POSITIVE_INFINITY : i
}
