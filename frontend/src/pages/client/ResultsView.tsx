import { Badge } from "@/components/ui/badge"
import { Sparkles, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatShortDate } from "@/lib/date"
import { groupRankedAnchors } from "@/lib/anclas"
import { RawDataView } from "@/components/RawDataView"
import { ModeloNegocioResult } from "@/components/canvas/ModeloNegocioResult"
import { PV_SECTIONS } from "@/lib/planVital"

interface ResultsViewProps {
  testType: string
  responses: Record<string, unknown>
  coachFeedback: string | null
  completedAt: string
  footer?: React.ReactNode
}

const ANCHOR_NAMES: Record<string, string> = {
  TF: "Técnico/Funcional", GG: "Gerencia General", AU: "Autonomía",
  SE: "Seguridad/Estabilidad", CE: "Creativo-Emprendedor", SC: "Servicio a la Causa",
  PD: "Puro Desafío", EV: "Estilo de Vida",
}

const TABLERO_COLUMNS = [
  { key: "saber", rankKey: "saberRanking", title: "SABER", subtitle: "Mi experiencia específica", header: "bg-brand-accent" },
  { key: "querer", rankKey: "quererRanking", title: "QUERER", subtitle: "Acciones en las que fluyo", header: "bg-brand-secondary" },
  { key: "sonar", rankKey: "sonarRanking", title: "SOÑAR", subtitle: "Aspiraciones a futuro", header: "bg-indigo-600" },
] as const

export default function ResultsView({ testType, responses, coachFeedback, completedAt, footer }: ResultsViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Completado el {formatShortDate(completedAt)}</p>
      </div>

      {/* Test-specific results */}
      {testType === "ANCLAS_CARRERA" && Boolean(responses.scores) && (
        <div className="space-y-4">
          <h2 className="font-serif text-2xl text-foreground">Tus Anclas de Carrera</h2>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Ranking de anclas:</p>
            {groupRankedAnchors(
              responses.scores as Record<string, number>,
              responses.ranking as string[] | undefined,
            ).map((group) => (
              <div key={group.rank} className="flex items-start gap-3 text-sm bg-white rounded-lg border border-border px-4 py-3">
                <span className="w-5 text-muted-foreground font-medium shrink-0">{group.rank}.</span>
                <div className="flex-1 flex flex-wrap gap-x-4 gap-y-1">
                  {group.anchors.map((anchor) => (
                    <span key={anchor} className="flex items-center gap-2">
                      <span className="font-medium">{ANCHOR_NAMES[anchor]}</span>
                      <Badge variant="outline" className="text-xs">{anchor}</Badge>
                    </span>
                  ))}
                </div>
                <span className="font-medium text-brand-accent shrink-0">{group.score}</span>
              </div>
            ))}
          </div>
          {Boolean(responses.aiInsight) && (
            <div className="rounded-xl bg-gray-900 text-gray-100 p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-medium text-gray-300">Insight personalizado</span>
              </div>
              <p className="text-sm leading-relaxed">{responses.aiInsight as string}</p>
            </div>
          )}
          <RawDataView testType={testType} responses={responses} />
        </div>
      )}

      {testType === "TABLERO_IDEAS" && (
        <div className="flex flex-col lg:h-[calc(100vh-150px)] gap-0">
          <h2 className="font-serif text-2xl text-foreground shrink-0 mb-3">Tu Tablero de Ideas</h2>

          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            {/* Left: three columns — each with sticky header and independent scroll */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:h-full">
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
                    <ol className="mt-2 flex-1 lg:overflow-y-auto space-y-1.5 lg:pr-1">
                      {items.map((v, i) => {
                        const inTop3 = i < 3
                        return (
                          <li
                            key={i}
                            className={cn(
                              "flex items-center gap-2 text-sm bg-white rounded-lg border px-2.5 py-1.5 transition-colors",
                              inTop3 ? "border-border text-foreground" : "border-border/60 text-muted-foreground opacity-60",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium shrink-0",
                                inTop3 ? "text-white " + col.header : "bg-muted text-muted-foreground",
                              )}
                            >
                              {i + 1}
                            </span>
                            <span>{v}</span>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                )
              })}
            </div>

            {/* Right: brainstorming */}
            {(() => {
              const ideas = (responses.brainstormIdeas as string[] | undefined)?.filter(Boolean) ?? []
              const ai = (responses.aiIdeas as string[] | undefined)?.filter(Boolean) ?? []
              const selected = responses.selectedIdea as string | undefined
              const legacy = responses.brainstorming as string | undefined

              const Idea = ({ text, isAi }: { text: string; isAi?: boolean }) => {
                const active = selected === text
                return (
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      isAi && "border-dashed",
                      active
                        ? "border-brand-accent bg-brand-accent/10 text-foreground"
                        : "border-border bg-white text-muted-foreground",
                    )}
                  >
                    {isAi && <Sparkles className="h-3.5 w-3.5 text-brand-accent shrink-0" />}
                    <span className="flex-1">{text}</span>
                    {active && (
                      <span className="flex items-center gap-1 text-xs font-medium text-brand-accent shrink-0">
                        <Check className="h-4 w-4" /> Elegida
                      </span>
                    )}
                  </div>
                )
              }

              if (ideas.length === 0 && ai.length === 0 && !legacy) return <div />

              return (
                <div className="flex flex-col min-h-0">
                  <div className="bg-gray-800 text-white rounded-lg px-4 py-2.5 shrink-0">
                    <h3 className="font-serif text-base font-medium">Brainstorming</h3>
                    <p className="text-[0.7rem] mt-0.5 opacity-90 leading-tight">Ideas conectando las tres columnas — la elegida está resaltada</p>
                  </div>
                  <div className="mt-2 flex-1 space-y-2 lg:overflow-y-auto lg:pr-1">
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
              )
            })()}
          </div>

          {/* Pinned footer: tasks + optional action slot (e.g. edit button) */}
          {(() => {
            const tasks = (responses.explorationTasks as string[] | undefined)?.filter(Boolean) ?? []
            return (
              <div className="shrink-0 border-t border-border mt-3 pt-3 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Tareas de exploración
                  </p>
                  {tasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sin tareas registradas.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                      {tasks.map((t, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <span className="text-brand-accent shrink-0">○</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {footer && <div className="shrink-0 self-center sm:self-start">{footer}</div>}
              </div>
            )
          })()}
        </div>
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

      {/* Coach feedback */}
      {coachFeedback && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <p className="text-xs font-medium text-indigo-700 mb-2">Feedback de tu coach:</p>
          <p className="text-sm text-indigo-900 leading-relaxed">{coachFeedback}</p>
        </div>
      )}
    </div>
  )
}
