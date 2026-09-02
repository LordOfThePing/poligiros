import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { apiJson } from "@/lib/api"
import { LoadingBadge } from "@/components/LoadingBadge"
import ResultsView from "@/pages/client/ResultsView"

/**
 * Standalone, full-viewport view of one supervision request's result — no
 * sidebar, no dialog. Opened in a new tab (see the "Ver vista completa" link
 * on SupervisionDetailPage for Tablero de Ideas): that test's layout scrolls
 * inside a viewport-height column, which only renders correctly at a real
 * full page, never nested inside a modal or a narrow card.
 */
export default function SupervisionResultPage() {
  const { id } = useParams<{ id: string }>()
  const [req, setReq] = useState<any>(null)

  useEffect(() => {
    apiJson<any[]>("/supervisor/supervision")
      .then((all) => setReq(all.find((r) => r.id === id) ?? null))
      .catch(() => setReq(null))
  }, [id])

  if (req === null) return <LoadingBadge />

  const responses = req.assignment?.response?.responses
  const testType = req.assignment?.test?.type

  return (
    <div className="min-h-screen bg-brand-bg p-4 lg:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <Link
          to={`/supervisor/supervision/${id}`}
          className="no-print inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a la supervisión
        </Link>
        {responses && testType && (
          <ResultsView
            testType={testType}
            responses={responses}
            coachFeedback={req.coachFeedback ?? req.assignment.supervision?.coachFeedback ?? null}
            completedAt={req.assignment.completedAt}
          />
        )}
      </div>
    </div>
  )
}
