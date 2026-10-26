import { PyramidSVG, SelectionRecap, PILL_KEYS, type PillKey, type PiramideSelected } from "./shared"

// Vista read-only de la Pirámide del Propósito. Replica el layout del paso 3
// del test (pirámide + resumen a la izquierda, especialidad a la derecha, y
// el propósito final abajo) para que el coachee reconozca el formato que
// completó. Sin estados editables — el botón "Editar" lo pone el padre.

function parseList(value: unknown): string[] {
  if (typeof value !== "string") return []
  return value.split(",").map((s) => s.trim()).filter(Boolean)
}

function buildSelected(responses: Record<string, unknown>): PiramideSelected {
  const sel: PiramideSelected = { rol: [], valores: [], fortalezas: [], contextos: [] }
  for (const k of PILL_KEYS as PillKey[]) {
    sel[k] = parseList(responses[k])
  }
  return sel
}

function buildEspecialidades(
  responses: Record<string, unknown>,
  contextos: string[],
): Record<string, string> {
  const map: Record<string, string> = {}
  const stored = responses.especialidadPorContexto
  if (stored && typeof stored === "object") {
    for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) map[k] = v
    }
  }
  if (Object.keys(map).length > 0) return map
  // Legacy: `especialidad` como string "a, b, c" ligada por posición a los
  // contextos.
  if (typeof responses.especialidad === "string") {
    const parts = responses.especialidad.split(",").map((s) => s.trim())
    contextos.forEach((c, i) => {
      if (parts[i]) map[c] = parts[i]
    })
  }
  return map
}

export function PiramideResult({
  responses,
  exportCopy = false,
}: {
  responses: Record<string, unknown>
  /**
   * Esta render ES la captura del PDF: layout fijo de 2 columnas. Los
   * breakpoints de Tailwind siguen al ancho de la ventana, no al de la caja de
   * 900px — en un celular apilarían todo y html2canvas desarma la pirámide.
   */
  exportCopy?: boolean
}) {
  const selected = buildSelected(responses)
  const especialidades = buildEspecialidades(responses, selected.contextos)
  const propositoFinal =
    typeof responses.propositoFinal === "string" ? responses.propositoFinal : ""

  // Si una entrada no tiene especialidad guardada igual la mostramos vacía —
  // es información útil (el contexto quedó sin cubrir).
  const contextosToShow =
    selected.contextos.length > 0
      ? selected.contextos
      : Object.keys(especialidades)

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl text-foreground">Tu Pirámide del Propósito</h2>

      <div
        className={
          exportCopy
            ? "grid grid-cols-2 gap-8 items-start"
            : "grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start"
        }
      >
        <div className={exportCopy ? "space-y-4" : "space-y-4 lg:sticky lg:top-8"}>
          <PyramidSVG />
          <SelectionRecap selected={selected} exportCopy={exportCopy} />
        </div>

        <div className="bg-white rounded-xl border border-border p-5 space-y-4">
          <h3 className="font-serif text-lg text-foreground">Mi especialidad</h3>
          {contextosToShow.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Sin especialidades registradas.</p>
          ) : (
            <div className="space-y-3">
              {contextosToShow.map((contexto) => (
                <div key={contexto} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        exportCopy
                          ? "rounded-full bg-brand-accent/15 text-brand-accent text-xs font-medium uppercase tracking-wide px-2 py-0.5"
                          : "rounded-full bg-brand-accent/15 text-brand-accent text-xs font-medium uppercase tracking-wide px-2 py-0.5 max-w-full truncate"
                      }
                      title={contexto}
                    >
                      {contexto}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      → especialidad
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {especialidades[contexto]?.trim() || (
                      <span className="italic text-muted-foreground">—</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {propositoFinal && (
        <div className="bg-gray-900 text-white rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Mi propósito</p>
          <p className="text-sm leading-relaxed">{propositoFinal}</p>
        </div>
      )}
    </div>
  )
}
