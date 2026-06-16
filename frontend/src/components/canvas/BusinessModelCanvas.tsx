import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import { InfoHint } from "./InfoHint"
import { CANVAS_BLOCKS, INSTRUCTIONS } from "./canvasModel"

interface Props {
  /** The idea being developed — rendered as the canvas title. */
  idea: string
  content: Record<string, string>
  /** Omit (or pass readOnly) to render a non-editable view. */
  onChange?: (key: string, value: string) => void
  readOnly?: boolean
}

// Presentational Business Model Canvas. Shared by the client's editable workspace
// (DevelopIdea) and the read-only coach/supervisor view (SupervisionDetailPage).
export function BusinessModelCanvas({ idea, content, onChange, readOnly }: Props) {
  return (
    <div className="space-y-3">
      {/* Title band — the chosen idea is the canvas title (per reference image). */}
      <div className="rounded-xl border border-border bg-sky-50/70 px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Modelo de Negocios</p>
        <h3 className="font-serif text-2xl text-foreground">
          {idea?.trim() || "Tu idea"}
        </h3>
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
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Canvas grid — desktop uses grid-template-areas (.bmc-grid); mobile stacks. */}
        <div className="bmc-grid flex-1">{/* layout defined in index.css */}
          {CANVAS_BLOCKS.map((b) => {
            const value = content[b.key] ?? ""
            return (
              <div
                key={b.key}
                className={cn("flex flex-col rounded-xl border p-3", b.tint)}
                style={{ gridArea: b.area }}
              >
                <div className="mb-2 flex items-start justify-between gap-1.5">
                  <p className="text-xs font-semibold leading-tight text-foreground">{b.label}</p>
                  <InfoHint text={b.question} className="mt-0.5 shrink-0" />
                </div>
                {readOnly ? (
                  <p className="flex-1 whitespace-pre-wrap text-sm leading-snug text-foreground/90">
                    {value.trim() || <span className="text-muted-foreground">—</span>}
                  </p>
                ) : (
                  <Textarea
                    value={value}
                    onChange={(e) => onChange?.(b.key, e.target.value)}
                    placeholder={b.question}
                    className="min-h-[110px] flex-1 resize-none border-0 bg-white/70 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-1"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
