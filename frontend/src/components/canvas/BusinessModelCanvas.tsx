import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ChevronDown, Plus, X, RotateCcw } from "lucide-react"
import { InfoHint } from "./InfoHint"
import { INSTRUCTIONS, resolveCanvasBlocks, type CanvasConfig } from "./canvasModel"

interface Props {
  /** The idea being developed — rendered as the canvas title. */
  idea: string
  content: Record<string, string>
  /** Omit (or pass readOnly) to render a non-editable view. */
  onChange?: (key: string, value: string) => void
  readOnly?: boolean
  /** Label customization (add / remove / rename blocks). */
  config?: CanvasConfig
  /** When provided (and not readOnly), enables label editing UI. */
  onConfigChange?: (config: CanvasConfig) => void
  /** Storytelling / description below the canvas. */
  story?: string
  onStoryChange?: (value: string) => void
}

// Presentational Business Model Canvas. Shared by the client's editable workspace
// and the read-only coach/supervisor view (SupervisionDetailPage).
export function BusinessModelCanvas({
  idea,
  content,
  onChange,
  readOnly,
  config,
  onConfigChange,
  story,
  onStoryChange,
}: Props) {
  const { base, extra, hidden } = resolveCanvasBlocks(config)
  const editingLabels = !readOnly && !!onConfigChange

  const renameBlock = (key: string, label: string) =>
    onConfigChange?.({ ...config, labels: { ...config?.labels, [key]: label } })

  const removeBaseBlock = (key: string) =>
    onConfigChange?.({ ...config, hidden: [...(config?.hidden ?? []), key] })

  const restoreBaseBlock = (key: string) =>
    onConfigChange?.({ ...config, hidden: (config?.hidden ?? []).filter((k) => k !== key) })

  const addExtraBlock = () =>
    onConfigChange?.({
      ...config,
      extra: [...(config?.extra ?? []), { key: `extra-${Date.now()}`, label: "Nuevo bloque" }],
    })

  const removeExtraBlock = (key: string) =>
    onConfigChange?.({ ...config, extra: (config?.extra ?? []).filter((e) => e.key !== key) })

  const renameExtraBlock = (key: string, label: string) =>
    onConfigChange?.({
      ...config,
      extra: (config?.extra ?? []).map((e) => (e.key === key ? { ...e, label } : e)),
    })

  function BlockHeader({
    blockKey,
    label,
    question,
    onRemove,
    onRename,
  }: {
    blockKey: string
    label: string
    question: string
    onRemove?: () => void
    onRename?: (v: string) => void
  }) {
    if (editingLabels && onRename) {
      return (
        <div className="mb-2 flex items-center gap-1">
          <Input
            value={label}
            onChange={(e) => onRename(e.target.value)}
            className="h-7 flex-1 border-0 bg-white/70 px-1.5 text-xs font-semibold focus-visible:ring-1"
            aria-label={`Nombre del bloque ${blockKey}`}
          />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Quitar bloque"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )
    }
    return (
      <div className="mb-2 flex items-start justify-between gap-1.5">
        <p className="text-xs font-semibold leading-tight text-foreground">{label}</p>
        {question && <InfoHint text={question} className="mt-0.5 shrink-0" />}
      </div>
    )
  }

  function BlockBody({ blockKey, question }: { blockKey: string; question: string }) {
    const value = content[blockKey] ?? ""
    if (readOnly) {
      return (
        <p className="flex-1 whitespace-pre-wrap text-sm leading-snug text-foreground/90">
          {value.trim() || <span className="text-muted-foreground">—</span>}
        </p>
      )
    }
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange?.(blockKey, e.target.value)}
        placeholder={question || "Escribí acá..."}
        className="min-h-[110px] flex-1 resize-none border-0 bg-white/70 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-1"
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* Title band — the chosen idea is the canvas title (per reference image).
          The "Contá tu idea" description sits here so the client frames the idea
          before filling the canvas diagram below. */}
      <div className="space-y-3 rounded-xl border border-border bg-sky-50/70 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Modelo de Negocios</p>
          <h3 className="font-serif text-2xl text-foreground">
            {idea?.trim() || "Tu idea"}
          </h3>
        </div>
        {(!readOnly || (story && story.trim())) && (
          <div>
            <p className="mb-1 text-sm font-medium text-foreground">Contá tu idea</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Describí tu modelo en un breve relato: el problema que resolvés, cómo encajan las piezas y por qué te entusiasma.
            </p>
            {readOnly ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {story?.trim() || <span className="text-muted-foreground">—</span>}
              </p>
            ) : (
              <Textarea
                value={story ?? ""}
                onChange={(e) => onStoryChange?.(e.target.value)}
                placeholder="Ej: Quiero ayudar a pequeñas pymes a ordenar sus finanzas..."
                className="min-h-[100px] bg-white text-sm"
              />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {/* Instrucciones — collapsible side panel with the exercise theory. */}
        <Collapsible defaultOpen className="lg:w-60 lg:shrink-0">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <CollapsibleTrigger className="group flex w-full items-center justify-between text-left">
              <span className="font-serif text-base text-foreground">Instrucciones</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-snug text-foreground/80">
                {INSTRUCTIONS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {editingLabels && (
                <p className="mt-3 border-t border-amber-200 pt-3 text-xs leading-snug text-foreground/70">
                  Podés renombrar, quitar o agregar bloques para adaptar el lienzo a tu idea.
                </p>
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>

        <div className="flex-1 space-y-3">
          {/* Canvas grid — desktop uses grid-template-areas (.bmc-grid); mobile stacks. */}
          <div className="bmc-grid">{/* layout defined in index.css */}
            {base.map((b) => (
              <div
                key={b.key}
                className={cn("flex flex-col rounded-xl border p-3", b.tint)}
                style={{ gridArea: b.area }}
              >
                <BlockHeader
                  blockKey={b.key}
                  label={b.label}
                  question={b.question}
                  onRemove={editingLabels ? () => removeBaseBlock(b.key) : undefined}
                  onRename={editingLabels ? (v) => renameBlock(b.key, v) : undefined}
                />
                <BlockBody blockKey={b.key} question={b.question} />
              </div>
            ))}
          </div>

          {/* Custom (added) blocks — stacked responsive grid below the canvas. */}
          {extra.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {extra.map((b) => (
                <div key={b.key} className={cn("flex flex-col rounded-xl border p-3", b.tint)}>
                  <BlockHeader
                    blockKey={b.key}
                    label={b.label}
                    question={b.question}
                    onRemove={editingLabels ? () => removeExtraBlock(b.key) : undefined}
                    onRename={editingLabels ? (v) => renameExtraBlock(b.key, v) : undefined}
                  />
                  <BlockBody blockKey={b.key} question={b.question} />
                </div>
              ))}
            </div>
          )}

          {/* Customization controls. */}
          {editingLabels && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addExtraBlock}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-brand-accent/50 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar bloque
              </button>
              {hidden.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => restoreBaseBlock(b.key)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> {b.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
