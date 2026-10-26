// Primitivas visuales de la Pirámide del Propósito compartidas por el form
// (`PiramideTest`) y el read-only (`PiramideResult`). Vivir en un solo lugar
// evita que el resumen de la vista de resultados se desfase del test cuando
// se tocan colores, niveles o labels.

export type PillKey = "rol" | "valores" | "fortalezas" | "contextos"
export const PILL_KEYS: PillKey[] = ["rol", "valores", "fortalezas", "contextos"]

export type PiramidePools = Record<PillKey, string[]>
export type PiramideSelected = Record<PillKey, string[]>

export const LEVELS: {
  key: string
  label: string
  color: string
  points: string
  cy: number
  rightX: number
}[] = [
  { key: "especialidad", label: "ESPECIALIDAD", color: "#2D6A4F", points: "40,10 60,10 55,30 45,30", cy: 20, rightX: 57.5 },
  { key: "contextos", label: "CONTEXTOS", color: "#3D8A6A", points: "45,30 55,30 62,50 38,50", cy: 40, rightX: 58.5 },
  { key: "fortalezas", label: "FORTALEZAS", color: "#4EA87F", points: "38,50 62,50 68,70 32,70", cy: 60, rightX: 65 },
  { key: "valores", label: "VALORES", color: "#60C595", points: "32,70 68,70 74,90 26,90", cy: 80, rightX: 71 },
  { key: "rol", label: "ROL", color: "#73D9AB", points: "26,90 74,90 80,110 20,110", cy: 100, rightX: 77 },
]

export const RECAP_ROWS: { key: PillKey; label: string; color: string }[] = [
  { key: "contextos", label: "CONTEXTOS", color: "#3D8A6A" },
  { key: "fortalezas", label: "FORTALEZAS", color: "#4EA87F" },
  { key: "valores", label: "VALORES", color: "#60C595" },
  { key: "rol", label: "ROL", color: "#73D9AB" },
]

export function PyramidSVG({
  active,
  onLevel,
}: {
  active?: string
  onLevel?: (k: string) => void
}) {
  // viewBox recortado — el original 0 0 140 120 dejaba ~10 unidades de
  // padding vacío arriba y abajo del contenido (polígonos y=10→110), que se
  // percibía como espacio de más arriba de la pirámide.
  const interactive = Boolean(onLevel)
  // El ancho máximo y el centrado van en un div, no en el <svg>: html2canvas
  // dibuja mal un <svg> con `max-width` + `margin: auto` (sale corrido y
  // recortado en el PDF).
  return (
    <div className="w-full max-w-sm mx-auto">
      <svg viewBox="0 6 140 108" className="block w-full h-auto" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.1))" }}>
        {LEVELS.map((level) => {
          const isActive = active === level.key
          return (
            <g
              key={level.key}
              onClick={interactive ? () => onLevel?.(level.key) : undefined}
              className={interactive ? "cursor-pointer" : undefined}
            >
              <polygon
                points={level.points}
                fill={isActive ? "#1E4D38" : level.color}
                stroke="white"
                strokeWidth="1"
                className="transition-all duration-200"
              />
              <line
                x1={level.rightX}
                y1={level.cy}
                x2={83}
                y2={level.cy}
                stroke={isActive ? "#1E4D38" : level.color}
                strokeWidth="0.6"
                opacity="0.7"
              />
              <text
                x={85}
                y={level.cy + 2}
                textAnchor="start"
                fill={isActive ? "#1E4D38" : "#1F2937"}
                fontSize="6"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {level.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function SelectionRecap({
  selected,
  exportCopy = false,
}: {
  selected: PiramideSelected
  /** PDF capture: sin `truncate` — html2canvas recorta el texto de las pills. */
  exportCopy?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Tus 3 por sección
      </p>
      {RECAP_ROWS.map((row) => (
        <div key={row.key} className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: row.color }}
            />
            <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">
              {row.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-4.5" style={{ paddingLeft: "1.125rem" }}>
            {selected[row.key].length === 0 ? (
              <span className="text-xs text-muted-foreground italic">—</span>
            ) : (
              selected[row.key].map((s) => (
                <span
                  key={s}
                  className={
                    exportCopy
                      ? "inline-block rounded-full bg-muted text-foreground text-[11px] px-2 py-0.5"
                      : "inline-block rounded-full bg-muted text-foreground text-[11px] px-2 py-0.5 max-w-[14rem] truncate"
                  }
                  title={s}
                >
                  {s}
                </span>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
