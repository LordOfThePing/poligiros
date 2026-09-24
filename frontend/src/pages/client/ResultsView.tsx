import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatShortDate } from "@/lib/date"
import { AnclasResult } from "@/components/results/AnclasResult"
import { RawDataView } from "@/components/RawDataView"
import { ModeloNegocioResult } from "@/components/canvas/ModeloNegocioResult"
import { PV_SECTIONS } from "@/lib/planVital"
import { DownloadResultPdf } from "@/components/DownloadResultPdf"

interface ResultsViewProps {
  testType: string
  responses: Record<string, unknown>
  coachFeedback: string | null
  completedAt: string
  footer?: React.ReactNode
  /** Skip the download/print bar — used when this view is itself the exported copy. */
  hideExport?: boolean
  /**
   * Tablero de Ideas only: fill the rest of the viewport (on desktop) with the
   * footer pinned to its foot and each column scrolling inside its own box,
   * instead of growing the page. Only correct on a real full-page view — the
   * client's results page, the coach's own test, the supervisor's "vista
   * completa". Everywhere else (an embedded card, a supervisor modal, the
   * off-screen PDF/print capture) it would clip content that never gets seen,
   * so those pass `false` to let it grow naturally.
   */
  constrainHeight?: boolean
  /** Who took the test — printed on the downloaded PDF and used in its filename. */
  personName?: string | null
  /**
   * This render IS the PDF/print capture: a fixed, non-responsive layout. The
   * capture box is 900px wide, but Tailwind breakpoints follow the browser
   * window, so the responsive classes would squeeze the columns on a desktop.
   */
  exportCopy?: boolean
}

const TABLERO_COLUMNS = [
  { key: "saber", rankKey: "saberRanking", title: "SABER", subtitle: "Mi experiencia específica", header: "bg-brand-accent" },
  { key: "querer", rankKey: "quererRanking", title: "QUERER", subtitle: "Acciones en las que fluyo", header: "bg-brand-secondary" },
  { key: "sonar", rankKey: "sonarRanking", title: "SOÑAR", subtitle: "Aspiraciones a futuro", header: "bg-indigo-600" },
] as const

export default function ResultsView({
  testType, responses, coachFeedback, completedAt, footer, hideExport, constrainHeight = true,
  personName, exportCopy = false,
}: ResultsViewProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  // Tablero on a full page at desktop width: everything below the columns
  // (feedback, PDF) moves into its pinned footer, so nothing sits off-screen.
  const fillViewport = constrainHeight && testType === "TABLERO_IDEAS" && isDesktop

  const exportBar = hideExport ? null : (
    <DownloadResultPdf
      testType={testType}
      responses={responses}
      coachFeedback={coachFeedback}
      completedAt={completedAt}
      personName={personName}
    />
  )

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Completado el {formatShortDate(completedAt)}</p>
      </div>

      {/* Test-specific results */}
      {testType === "ANCLAS_CARRERA" && Boolean(responses.scores) && (
        <AnclasResult
          scores={responses.scores as Record<string, number>}
          aiInsight={(responses.aiInsight as string | undefined) ?? null}
        />
      )}

      {testType === "TABLERO_IDEAS" && (
        <TableroResult
          responses={responses}
          footer={footer}
          fill={fillViewport}
          exportCopy={exportCopy}
          coachFeedback={coachFeedback}
          exportBar={exportBar}
        />
      )}

      {testType === "PIRAMIDE_PROPOSITO" && (
        <div className="space-y-4">
          <h2 className="font-serif text-2xl text-foreground">Tu Pirámide del Propósito</h2>
          {(["rol", "valores", "fortalezas", "contextos", "especialidad"] as const).map((field) => (
            responses[field] ? (
              <div key={field} className="bg-white rounded-xl border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{field}</p>
                <p className="text-sm text-foreground">{responses[field] as string}</p>
              </div>
            ) : null
          ))}
          {Boolean(responses.propositoFinal) && (
            <div className="bg-gray-900 text-white rounded-xl p-5">
              <p className="text-xs text-gray-400 mb-2">Mi propósito</p>
              <p className="text-sm leading-relaxed">{responses.propositoFinal as string}</p>
            </div>
          )}
          <RawDataView testType={testType} responses={responses} />
        </div>
      )}

      {/* Modelo de Negocio — read-only canvas / job research */}
      {testType === "MODELO_NEGOCIO" && <ModeloNegocioResult responses={responses} />}

      {/* Tareas de exploración — post-Tablero tasks */}
      {testType === "TAREAS_EXPLORACION" && (
        <div className="bg-white rounded-xl border border-border p-5 space-y-3">
          <h2 className="font-serif text-2xl text-foreground">Tareas a explorar</h2>
          {(() => {
            const tasks = (responses.tasks as string[] | undefined)?.filter(Boolean) ?? []
            return tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sin tareas registradas.</p>
            ) : (
              <ul className="space-y-1.5">
                {tasks.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-brand-accent shrink-0 mt-0.5">○</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )
          })()}
        </div>
      )}

      {testType === "PLAN_VITAL" && (
        <div className="space-y-4">
          <h2 className="font-serif text-2xl text-foreground">Plan Vital Integral</h2>
          {PV_SECTIONS.map((s) => {
            const val = responses[s.key] as string | undefined
            if (!val?.trim()) return null
            return (
              <div key={s.key} className={cn("rounded-xl border p-4 space-y-2", s.border, s.bg)}>
                <div className="flex items-center gap-2">
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shrink-0", s.color)}>
                    {s.num}
                  </span>
                  <p className={cn("text-sm font-semibold", s.text)}>{s.title}</p>
                </div>
                <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", s.text)}>{val}</p>
              </div>
            )
          })}
          {Array.isArray(responses.estimulos) && (responses.estimulos as string[]).filter(Boolean).length > 0 && (
            <div className="rounded-xl border border-brand-accent/30 bg-brand-accent/5 p-4 space-y-2">
              <p className="text-sm font-semibold text-brand-accent">Estímulos</p>
              <ul className="space-y-1">
                {(responses.estimulos as string[]).filter(Boolean).map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-brand-accent shrink-0 mt-0.5">·</span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action slot (e.g. the one-shot post-review edit button). Tablero pins it
          into its own footer row above; every other test gets it here. */}
      {footer && testType !== "TABLERO_IDEAS" && (
        <div className="no-print flex justify-end">{footer}</div>
      )}

      {/* Coach feedback */}
      {coachFeedback && !fillViewport && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <p className="text-xs font-medium text-indigo-700 mb-2">Feedback de tu coach:</p>
          <p className="text-sm text-indigo-900 leading-relaxed">{coachFeedback}</p>
        </div>
      )}

      {/* Download as PDF */}
      {exportBar && !fillViewport && (
        <div className="no-print flex justify-end pt-2">{exportBar}</div>
      )}
    </div>
  )
}


function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [query])
  return matches
}

/** Gap left under the Tablero when it fills the viewport. */
const FILL_BOTTOM_GAP = 16

/**
 * Height that makes the element end exactly at the bottom of the viewport,
 * measured from where it actually starts — so it does not depend on whatever
 * the page renders above it (back link, date, top bar). `null` when disabled.
 */
function useFillViewportHeight(ref: React.RefObject<HTMLElement>, enabled: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!enabled) {
      setHeight(null)
      return
    }
    const update = () => {
      const el = ref.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      setHeight(Math.max(420, window.innerHeight - top - FILL_BOTTOM_GAP))
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [ref, enabled])
  return height
}

/**
 * Tablero de Ideas results. With `fill`, it is a fixed-height frame: title on
 * top, a footer pinned at the foot (exploration tasks, coach feedback, actions)
 * and, in between, one column per list where the title box stays put and only
 * the content box below it scrolls. Without `fill` it just grows with its
 * content (mobile, embedded cards, the PDF capture).
 */
function TableroResult({
  responses, footer, fill, exportCopy, coachFeedback, exportBar,
}: {
  responses: Record<string, unknown>
  footer?: React.ReactNode
  fill: boolean
  exportCopy: boolean
  coachFeedback: string | null
  exportBar: React.ReactNode
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const height = useFillViewportHeight(rootRef, fill)

  // The box under each title. In fill mode it is the thing that scrolls.
  const listBox = cn(
    "mt-2",
    fill && "flex-1 min-h-0 overflow-y-auto rounded-lg border border-border bg-white/60 p-2",
  )

  const ideas = (responses.brainstormIdeas as string[] | undefined)?.filter(Boolean) ?? []
  const ai = (responses.aiIdeas as string[] | undefined)?.filter(Boolean) ?? []
  const selected = responses.selectedIdea as string | undefined
  const legacy = responses.brainstorming as string | undefined
  const tasks = (responses.explorationTasks as string[] | undefined)?.filter(Boolean) ?? []

  const Idea = ({ text, isAi }: { text: string; isAi?: boolean }) => {
    const active = selected === text
    return (
      <div
        className={cn(
          "flex items-center space-x-2 rounded-lg border px-3 py-2 text-sm transition-colors",
          isAi && "border-dashed",
          active
            ? "border-brand-accent bg-brand-accent/10 text-foreground"
            : "border-border bg-white text-muted-foreground",
        )}
      >
        {isAi && <Sparkles className="h-3.5 w-3.5 text-brand-accent shrink-0" />}
        <span className="flex-1">{text}</span>
        {active && (
          <span className="flex items-center space-x-1 text-xs font-medium text-brand-accent shrink-0">
            <Check className="h-4 w-4" /> Elegida
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className="flex flex-col"
      style={fill && height !== null ? { height } : undefined}
    >
      <h2 className="font-serif text-2xl text-foreground shrink-0 mb-3">Tu Tablero de Ideas</h2>

      <div
        className={cn(
          // Export: brainstorming goes under the columns, full width, instead
          // of a 340px side column that would leave ~150px per list.
          exportCopy ? "grid grid-cols-1 gap-5" : "grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6",
          fill && "flex-1 min-h-0 grid-rows-[minmax(0,1fr)]",
        )}
      >
        {/* Left: three columns — title box fixed, content box scrolls */}
        <div
          className={cn(
            "tablero-print-columns grid gap-4",
            exportCopy ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3",
            fill && "min-h-0 grid-rows-[minmax(0,1fr)]",
          )}
        >
          {TABLERO_COLUMNS.map((col) => {
            const ranked = (responses[col.rankKey] as string[] | undefined)?.filter(Boolean)
            const raw = (responses[col.key] as string[] | undefined)?.filter(Boolean)
            const items = ranked && ranked.length > 0 ? ranked : raw ?? []
            if (items.length === 0) return null
            return (
              <div key={col.key} className="flex flex-col min-h-0">
                <div className={cn("text-white rounded-lg px-3 py-2 shrink-0", col.header)}>
                  <h3 className="font-serif text-base font-medium">{col.title}</h3>
                  <p className="text-[0.7rem] mt-0.5 opacity-90 leading-tight">{col.subtitle}</p>
                </div>
                <ol className={cn(listBox, "space-y-1.5")}>
                  {items.map((v, i) => {
                    const inTop3 = i < 3
                    return (
                      <li
                        key={i}
                        className={cn(
                          // space-x (margin-based), not gap — html2canvas doesn't
                          // account for flex `gap`, which shifts the number badge
                          // and text out of place in the downloaded PDF.
                          "flex items-center space-x-2 text-sm bg-white rounded-lg border px-2.5 py-1.5 transition-colors",
                          inTop3 ? "border-border text-foreground" : "border-border/60 text-muted-foreground opacity-60",
                        )}
                      >
                        {/* Centred by line-height, not flex: html2canvas draws
                            flex-centred text a few px low in the PDF. */}
                        <span
                          className={cn(
                            "inline-block h-5 w-5 rounded-full text-center text-xs leading-5 font-medium shrink-0",
                            inTop3 ? "text-white " + col.header : "bg-muted text-muted-foreground",
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="leading-snug">{v}</span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )
          })}
        </div>

        {/* Right: brainstorming */}
        {ideas.length === 0 && ai.length === 0 && !legacy ? (
          <div />
        ) : (
          <div className="tablero-print-brainstorm flex flex-col min-h-0">
            <div className="bg-gray-800 text-white rounded-lg px-4 py-2.5 shrink-0">
              <h3 className="font-serif text-base font-medium">Brainstorming</h3>
              <p className="text-[0.7rem] mt-0.5 opacity-90 leading-tight">Ideas conectando las tres columnas — la elegida está resaltada</p>
            </div>
            <div className={cn(listBox, "space-y-2")}>
              {ideas.map((v, i) => (
                <Idea key={`b-${i}`} text={v} />
              ))}
              {ai.map((v, i) => (
                <Idea key={`a-${i}`} text={v} isAi />
              ))}
              {legacy && ideas.length === 0 && (
                <p className="text-sm text-muted-foreground bg-white rounded-lg border border-border px-3 py-2 whitespace-pre-wrap">{legacy}</p>
              )}
              {selected && !ideas.includes(selected) && !ai.includes(selected) && (
                <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-xl p-3">
                  <p className="text-xs font-medium text-brand-accent mb-1">Idea elegida para desarrollar</p>
                  <p className="text-sm text-foreground">{selected}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer: tasks + action slot; in fill mode also the coach feedback and
          the PDF button, so the frame's foot holds everything below the columns. */}
      <div className="shrink-0 border-t border-border mt-3 pt-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              Tareas de exploración
            </p>
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin tareas registradas.</p>
            ) : (
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {tasks.map((t, i) => (
                  <li key={i} className="flex items-center space-x-1.5 text-sm text-muted-foreground">
                    <span className="text-brand-accent shrink-0">○</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {(footer || (fill && exportBar)) && (
            <div className="no-print shrink-0 flex items-center gap-2 self-center sm:self-start">
              {footer}
              {fill && exportBar}
            </div>
          )}
        </div>
        {fill && coachFeedback && (
          // Capped so a long devolución never pushes the columns off the frame.
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 max-h-28 overflow-y-auto">
            <p className="text-xs font-medium text-indigo-700 mb-1">Feedback de tu coach:</p>
            <p className="text-sm text-indigo-900 leading-relaxed">{coachFeedback}</p>
          </div>
        )}
      </div>
    </div>
  )
}
