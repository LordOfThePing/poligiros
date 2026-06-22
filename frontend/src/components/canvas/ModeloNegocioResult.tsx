import { BusinessModelCanvas } from "./BusinessModelCanvas"
import { JOB_FIELDS, FREELANCE_FIELDS, type CanvasConfig } from "./canvasModel"

// Read-only view of a submitted "Exploración" test, for the client's results page
// and the supervisor/coach review. Branches on the chosen kind.
export function ModeloNegocioResult({ responses }: { responses: any }) {
  const idea = (responses?.selectedIdea ?? "") as string
  const kind = responses?.kind as "CANVAS" | "JOB" | "FREELANCE" | undefined
  const content = (responses?.content ?? {}) as Record<string, string>
  const story = (responses?.story ?? "") as string
  const config = (responses?.canvas ?? undefined) as CanvasConfig | undefined

  if (kind === "CANVAS") {
    return <BusinessModelCanvas readOnly idea={idea} content={content} config={config} story={story} />
  }

  if (kind === "JOB" || kind === "FREELANCE") {
    const fields = kind === "JOB" ? JOB_FIELDS : FREELANCE_FIELDS
    const heading = kind === "JOB" ? "Puesto de trabajo" : "Freelance / Autónomo"
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-sky-50/70 px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{heading}</p>
          <h3 className="font-serif text-2xl text-foreground">{idea?.trim() || "Tu idea"}</h3>
        </div>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <p className="text-xs font-medium text-muted-foreground mb-1">{f.label}</p>
              <p className="whitespace-pre-wrap rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground/90">
                {content[f.key]?.trim() || <span className="text-muted-foreground">—</span>}
              </p>
            </div>
          ))}
          {story.trim() && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Relato de la idea</p>
              <p className="whitespace-pre-wrap rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground/90">
                {story}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return <p className="text-sm text-muted-foreground">Sin contenido todavía.</p>
}
