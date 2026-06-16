import { Badge } from "@/components/ui/badge"
import { Sparkles } from "lucide-react"
import { formatShortDate } from "@/lib/date"
import { groupRankedAnchors } from "@/lib/anclas"
import { RawDataView } from "@/components/RawDataView"
import { ModeloNegocioResult } from "@/components/canvas/ModeloNegocioResult"

interface ResultsViewProps {
  testType: string
  responses: Record<string, unknown>
  coachFeedback: string | null
  completedAt: string
}

const ANCHOR_NAMES: Record<string, string> = {
  TF: "Técnico/Funcional", GG: "Gerencia General", AU: "Autonomía",
  SE: "Seguridad/Estabilidad", CE: "Creativo-Emprendedor", SC: "Servicio a la Causa",
  PD: "Puro Desafío", EV: "Estilo de Vida",
}

export default function ResultsView({ testType, responses, coachFeedback, completedAt }: ResultsViewProps) {
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
        <div className="space-y-6">
          <h2 className="font-serif text-2xl text-foreground">Tu Tablero de Ideas</h2>
          {(["saber", "querer", "sonar"] as const).map((col) => {
            const arr = responses[col] as string[] | undefined
            if (!arr || arr.filter(Boolean).length === 0) return null
            return (
              <div key={col}>
                <p className="text-sm font-medium capitalize mb-2">
                  {col === "sonar" ? "Soñar" : col.charAt(0).toUpperCase() + col.slice(1)}:
                </p>
                <ul className="space-y-1">
                  {arr.filter(Boolean).map((v: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground bg-white rounded border border-border px-3 py-2">• {v}</li>
                  ))}
                </ul>
              </div>
            )
          })}
          {(() => {
            const ideas = (responses.brainstormIdeas as string[] | undefined)?.filter(Boolean) ?? []
            const ai = (responses.aiIdeas as string[] | undefined)?.filter(Boolean) ?? []
            const selected = responses.selectedIdea as string | undefined
            const legacy = responses.brainstorming as string | undefined
            return (
              <>
                {ideas.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Tus ideas:</p>
                    <ol className="space-y-1 list-decimal list-inside">
                      {ideas.map((v, i) => (
                        <li key={i} className="text-sm text-muted-foreground">{v}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {ai.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Ideas sugeridas por IA:</p>
                    <ul className="space-y-1">
                      {ai.map((v, i) => (
                        <li key={i} className="text-sm text-muted-foreground">✨ {v}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selected && (
                  <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-xl p-4">
                    <p className="text-xs font-medium text-brand-accent mb-1">Idea elegida para desarrollar</p>
                    <p className="text-sm text-foreground">{selected}</p>
                  </div>
                )}
                {legacy && ideas.length === 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Brainstorming:</p>
                    <p className="text-sm text-muted-foreground bg-white rounded border border-border px-4 py-3 whitespace-pre-wrap">{legacy}</p>
                  </div>
                )}
              </>
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
