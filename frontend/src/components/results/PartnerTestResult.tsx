import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, Loader2, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiJson } from "@/lib/api"
import ResultsView from "@/pages/client/ResultsView"
import type { DuplaCandidate } from "@/lib/modules"

type PartnerResult = {
  coach: { id: string; name: string }
  completed: boolean
  completedAt?: string
  testType?: string
  responses?: Record<string, unknown> | null
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
                hideExport
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
    </div>
  )
}
