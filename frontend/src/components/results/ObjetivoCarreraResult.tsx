const FIELDS: { key: string; label: string }[] = [
  { key: "puesto", label: "Puesto / Rol / Función" },
  { key: "tareas", label: "Tareas" },
  { key: "area", label: "Área" },
  { key: "tipoOrganizacion", label: "Tipo de organización / Negocio" },
  { key: "rubro", label: "Rubro / Nicho" },
  { key: "condiciones", label: "Condiciones de satisfacción" },
  { key: "valores", label: "Valores centrales" },
]

export function ObjetivoCarreraResult({ responses }: { responses: Record<string, unknown> }) {
  const sintesis = typeof responses.sintesis === "string" ? responses.sintesis : ""

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl text-foreground">Objetivo de Carrera</h2>

      <div className="space-y-3">
        {FIELDS.map((f) => {
          const value = responses[f.key]
          if (typeof value !== "string" || !value.trim()) return null
          return (
            <div key={f.key} className="bg-white rounded-xl border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {f.label}
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
            </div>
          )
        })}
      </div>

      {sintesis && (
        <div className="bg-gray-900 text-white rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-2">Mi objetivo</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{sintesis}</p>
        </div>
      )}
    </div>
  )
}
