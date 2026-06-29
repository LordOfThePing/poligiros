import { BusinessModelCanvas } from "./BusinessModelCanvas"
import { JOB_FIELDS, FREELANCE_FIELDS, type CanvasConfig } from "./canvasModel"

type Kind = "CANVAS" | "JOB" | "FREELANCE"

interface IdeaEntry {
  horizon?: "short" | "long"
  selectedIdea: string
  kind: Kind
  content: Record<string, string>
  story?: string
  canvas?: CanvasConfig
}

function IdeaSection({ entry, horizonLabel }: { entry: IdeaEntry; horizonLabel?: string }) {
  const { selectedIdea, kind, content, story, canvas } = entry

  if (kind === "CANVAS") {
    return (
      <div className="space-y-2">
        {horizonLabel && (
          <p className="text-xs font-medium text-brand-accent uppercase tracking-wide">{horizonLabel}</p>
        )}
        <BusinessModelCanvas readOnly idea={selectedIdea} content={content} config={canvas} story={story} />
      </div>
    )
  }

  const fields = kind === "JOB" ? JOB_FIELDS : FREELANCE_FIELDS
  const heading = kind === "JOB" ? "Puesto de trabajo" : "Freelance / Autónomo"
  return (
    <div className="space-y-4">
      {horizonLabel && (
        <p className="text-xs font-medium text-brand-accent uppercase tracking-wide">{horizonLabel}</p>
      )}
      <div className="rounded-xl border border-border bg-sky-50/70 px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{heading}</p>
        <h3 className="font-serif text-2xl text-foreground">{selectedIdea?.trim() || "Tu idea"}</h3>
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
        {story?.trim() && (
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

// Read-only view of a submitted "Exploración" test.
// Handles both new shape { ideas: [...] } and old shape { kind, selectedIdea, content }.
export function ModeloNegocioResult({ responses }: { responses: any }) {
  // New shape
  if (Array.isArray(responses?.ideas) && responses.ideas.length > 0) {
    const ideas: IdeaEntry[] = responses.ideas
    const showHorizon = ideas.length > 1
    return (
      <div className="space-y-10">
        {ideas.map((entry, i) => {
          const label = showHorizon
            ? entry.horizon === "long"
              ? "Largo plazo"
              : "Corto / mediano plazo"
            : undefined
          return <IdeaSection key={i} entry={entry} horizonLabel={label} />
        })}
      </div>
    )
  }

  // Old shape backward compat
  const kind = responses?.kind as Kind | undefined
  if (!kind) return <p className="text-sm text-muted-foreground">Sin contenido todavía.</p>
  return (
    <IdeaSection
      entry={{
        selectedIdea: (responses?.selectedIdea ?? "") as string,
        kind,
        content: (responses?.content ?? {}) as Record<string, string>,
        story: (responses?.story ?? "") as string,
        canvas: responses?.canvas as CanvasConfig | undefined,
      }}
    />
  )
}
