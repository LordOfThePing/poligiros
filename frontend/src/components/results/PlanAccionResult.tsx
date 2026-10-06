type Objetivo = {
  titulo?: string
  accion?: string
  recursos?: string
  tiempo?: string
  soporte?: string
}

export function PlanAccionResult({ responses }: { responses: Record<string, unknown> }) {
  const estrategia = typeof responses.estrategia === "string" ? responses.estrategia : ""
  const objetivoGeneral =
    typeof responses.objetivoGeneral === "string" ? responses.objetivoGeneral : ""
  const objetivos = Array.isArray(responses.objetivos) ? (responses.objetivos as Objetivo[]) : []

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl text-foreground">Plan de Acción</h2>

      {estrategia && (
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Estrategia
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{estrategia}</p>
        </div>
      )}

      {objetivoGeneral && (
        <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-xl p-4">
          <p className="text-xs font-medium text-brand-accent uppercase tracking-wide mb-1">
            Objetivo general
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{objetivoGeneral}</p>
        </div>
      )}

      {objetivos.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-serif text-lg text-foreground">Objetivos específicos</h3>
          {objetivos.map((o, i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-brand-accent text-white text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm font-serif text-foreground">
                  {o.titulo?.trim() || `Objetivo ${i + 1}`}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Field label="Acción" value={o.accion} />
                <Field label="Recursos" value={o.recursos} />
                <Field label="Tiempo" value={o.tiempo} />
                <Field label="Soporte / Feedback" value={o.soporte} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null
  return (
    <div>
      <p className="text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  )
}
