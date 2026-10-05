import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, Loader2, Users, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiJson } from "@/lib/api"
import { Markdown } from "@/components/Markdown"
import ResultsView from "@/pages/client/ResultsView"
import type { DuplaCandidate } from "@/lib/modules"

type PartnerResult = {
  coach: { id: string; name: string }
  completed: boolean
  completedAt?: string
  testType?: string
  responses?: Record<string, unknown> | null
}

type DuplaTest = {
  assignmentId: string
  testType: string
  completedAt: string
  responses: Record<string, unknown>
}

type DuplaSubmission = {
  id: string
  itemId: string
  itemTitle: string
  moduleId: string
  moduleTitle: string
  text: string
  submittedAt: string
}

type DuplaAll = {
  coach: { id: string; name: string }
  tests: DuplaTest[]
  submissions: DuplaSubmission[]
}

const TEST_LABEL: Record<string, string> = {
  ANCLAS_CARRERA: "Anclas de Carrera",
  TABLERO_IDEAS: "Tablero de Ideas",
  PLAN_VITAL: "Plan Vital Integral",
  PIRAMIDE_PROPOSITO: "Pirámide del Propósito",
  MODELO_NEGOCIO: "Modelo de Negocio",
  TAREAS_EXPLORACION: "Tareas de Exploración",
}

/**
 * Reusable "ver el resultado de mi dupla" widget. Picks a partner of the same
 * CIC (or takes one preselected by the caller) and shows that partner's result
 * for the test tied to this card (`ModuleItem.testId`) to prepare a devolución.
 * Generic across test types via `ResultsView`.
 */
export function PartnerTestResult({
  itemId,
  partnerId,
  partnerLabel,
  triggerLabel = "Ver el resultado de",
}: {
  /** The released module item this lives on (used to fetch candidates + result). */
  itemId: string
  /** Optional preselected dupla partner. When omitted, a picker is shown. */
  partnerId?: string
  /** Optional static label for the button (e.g. the partner's name). */
  partnerLabel?: string
  triggerLabel?: string
}) {
  const { toast } = useToast()
  const [candidates, setCandidates] = useState<DuplaCandidate[]>([])
  const [coacheeId, setCoacheeId] = useState(partnerId ?? "")
  const [result, setResult] = useState<PartnerResult | null>(null)
  const [loadingResult, setLoadingResult] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [extras, setExtras] = useState<DuplaAll | null>(null)
  const [loadingExtras, setLoadingExtras] = useState(false)
  const [showExtras, setShowExtras] = useState(false)
  const [openTestId, setOpenTestId] = useState<string | null>(null)
  const [openSubmissionId, setOpenSubmissionId] = useState<string | null>(null)

  useEffect(() => {
    if (partnerId) return // preselected, no list needed
    setLoadingCandidates(true)
    apiJson<{ candidates: DuplaCandidate[] }>(`/student/module-items/${itemId}/dupla`)
      .then((r) => setCandidates(r.candidates))
      .catch(() => {})
      .finally(() => setLoadingCandidates(false))
  }, [itemId, partnerId])

  // Reset whenever the partner changes.
  useEffect(() => {
    setResult(null)
    setShowResult(false)
    setExtras(null)
    setShowExtras(false)
    setOpenTestId(null)
    setOpenSubmissionId(null)
  }, [coacheeId])

  async function loadResult() {
    if (!coacheeId) return
    setShowResult(true)
    if (result) return
    setLoadingResult(true)
    try {
      setResult(await apiJson<PartnerResult>(`/student/module-items/${itemId}/dupla/${coacheeId}`))
    } catch {
      setResult(null)
      toast({ title: "No se pudo ver el resultado de tu dupla", variant: "destructive" })
    }
    setLoadingResult(false)
  }

  async function loadExtras() {
    if (!coacheeId) return
    setShowExtras(true)
    if (extras) return
    setLoadingExtras(true)
    try {
      setExtras(await apiJson<DuplaAll>(`/student/dupla/${coacheeId}/all`))
    } catch {
      setExtras(null)
      toast({ title: "No se pudieron cargar los entregables de tu dupla", variant: "destructive" })
    }
    setLoadingExtras(false)
  }

  const partnerName = partnerLabel ?? candidates.find((c) => c.id === coacheeId)?.name

  return (
    <div className="space-y-3">
      {!partnerId && (
        <select
          value={coacheeId}
          onChange={(e) => setCoacheeId(e.target.value)}
          disabled={loadingCandidates}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="">Elegí tu compañero/a de dupla</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <button
          onClick={() => (showResult ? setShowResult(false) : loadResult())}
          className="flex items-center gap-2 text-sm text-foreground"
          disabled={!coacheeId}
        >
          {showResult ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Users className="h-4 w-4 text-brand-accent" />
          {triggerLabel} {partnerName ?? "tu dupla"}
        </button>

        {showResult && (
          <div className="mt-3">
            {loadingResult ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
              </p>
            ) : result?.completed && result.responses && result.testType ? (
              <ResultsView
                testType={result.testType}
                responses={result.responses}
                coachFeedback={null}
                completedAt={result.completedAt ?? new Date().toISOString()}
                personName={partnerName}
                constrainHeight={false}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no completó ese test. Pedile que lo haga antes de la sesión: sin eso no vas a
                poder darle la devolución.
              </p>
            )}
          </div>
        )}
      </div>

      {coacheeId && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <button
            onClick={() => (showExtras ? setShowExtras(false) : loadExtras())}
            className="flex items-center gap-2 text-sm text-foreground"
          >
            {showExtras ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <FileText className="h-4 w-4 text-brand-accent" />
            Ver otros entregables de {partnerName ?? "tu dupla"} (Plan de Negocios, Collage, Objetivo de Carrera, Plan de Acción…)
          </button>

          {showExtras && (
            <div className="mt-3 space-y-3">
              {loadingExtras ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
                </p>
              ) : extras ? (
                <>
                  {extras.tests.length === 0 && extras.submissions.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Tu dupla todavía no entregó nada.
                    </p>
                  )}

                  {extras.tests.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tests</p>
                      {extras.tests.map((t) => {
                        const open = openTestId === t.assignmentId
                        return (
                          <div key={t.assignmentId} className="rounded border border-border bg-white">
                            <button
                              onClick={() => setOpenTestId(open ? null : t.assignmentId)}
                              className="w-full flex items-center gap-2 text-left text-sm px-3 py-2"
                            >
                              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <span className="font-medium">{TEST_LABEL[t.testType] ?? t.testType}</span>
                            </button>
                            {open && (
                              <div className="border-t border-border p-3">
                                <ResultsView
                                  testType={t.testType}
                                  responses={t.responses}
                                  coachFeedback={null}
                                  completedAt={t.completedAt}
                                  personName={partnerName}
                                  constrainHeight={false}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {extras.submissions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entregas</p>
                      {extras.submissions.map((s) => {
                        const open = openSubmissionId === s.id
                        return (
                          <div key={s.id} className="rounded border border-border bg-white">
                            <button
                              onClick={() => setOpenSubmissionId(open ? null : s.id)}
                              className="w-full flex items-start gap-2 text-left text-sm px-3 py-2"
                            >
                              {open ? <ChevronDown className="h-4 w-4 mt-0.5" /> : <ChevronRight className="h-4 w-4 mt-0.5" />}
                              <span className="flex-1">
                                <span className="font-medium">{s.itemTitle}</span>
                                <span className="text-muted-foreground"> · {s.moduleTitle}</span>
                              </span>
                            </button>
                            {open && (
                              <div className="border-t border-border p-3">
                                <Markdown>{s.text}</Markdown>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
