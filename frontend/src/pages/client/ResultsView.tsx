import { Badge } from "@/components/ui/badge"
import { Sparkles } from "lucide-react"
import { formatShortDate } from "@/lib/date"

interface ResultsViewProps {
  testType: string
  responses: Record<string, unknown>
  coachFeedback: string | null
  completedAt: string
}

const ANCHOR_NAMES: Record<string, string> = {
  TF: "Técnico/Funcional", GG: "Gerencia General", AU: "Autonomía",
  SE: "Seguridad/Estabilidad", CE: "Creativo-Empresario", SC: "Servicio a la Causa",
  PD: "Puro Desafío", EV: "Estilo de Vida",
}

export default function ResultsView({ testType, responses, coachFeedback, completedAt }: ResultsViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Completado el {formatShortDate(completedAt)}</p>
      </div>

      {/* Test-specific results */}
      {testType === "ANCLAS_CARRERA" && Boolean(responses.ranking) && (
        <div className="space-y-4">
          <h2 className="font-serif text-2xl text-foreground">Tus Anclas de Carrera</h2>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Ranking de anclas:</p>
            {(responses.ranking as string[]).map((anchor: string, i: number) => (
              <div key={anchor} className="flex items-center gap-3 text-sm bg-white rounded-lg border border-border px-4 py-3">
                <span className="w-5 text-muted-foreground font-medium">{i + 1}.</span>
                <span className="flex-1 font-medium">{ANCHOR_NAMES[anchor]}</span>
                <Badge variant="outline" className="text-xs">{anchor}</Badge>
                <span className="font-medium text-brand-accent">
                  {(responses.scores as Record<string, number>)?.[anchor]}/6
                </span>
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
          {Boolean(responses.brainstorming) && (
            <div>
              <p className="text-sm font-medium mb-2">Brainstorming:</p>
              <p className="text-sm text-muted-foreground bg-white rounded border border-border px-4 py-3 whitespace-pre-wrap">
                {responses.brainstorming as string}
              </p>
            </div>
          )}
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
