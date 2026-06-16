import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { apiJson } from "@/lib/api"
import { sessionTestApi } from "@/lib/testApi"
import AnclasTest from "@/pages/client/tests/AnclasTest"
import TableroTest from "@/pages/client/tests/TableroTest"
import PiramideTest from "@/pages/client/tests/PiramideTest"
import { ModeloNegocioTest } from "@/pages/client/tests/ModeloNegocioTest"
import ResultsView from "@/pages/client/ResultsView"

type Assignment = {
  id: string
  completedAt: string | null
  test: { type: string; title: string }
  response: { responses: Record<string, unknown> } | null
  prefillIdea?: string
}

export default function StudentTakeTestPage() {
  const { id } = useParams<{ id: string }>()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiJson<Assignment>(`/student/my-tests/${id}`)
      .then(setAssignment)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-muted-foreground text-sm py-8">Cargando...</div>
  if (!assignment) return <div className="text-muted-foreground text-sm py-8">Test no encontrado.</div>

  const back = (
    <Link to="/student/my-tests" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
      <ArrowLeft className="h-4 w-4" /> Volver a Mis Tests
    </Link>
  )

  // Modelo de Negocio renders a wide canvas; other tests stay narrow.
  const wide = assignment.test.type === "MODELO_NEGOCIO"
  const widthClass = wide ? "max-w-6xl" : "max-w-2xl"

  // Completed → read-only results
  if (assignment.completedAt && assignment.response) {
    return (
      <div className={`${widthClass} mx-auto`}>
        {back}
        <ResultsView
          testType={assignment.test.type}
          responses={assignment.response.responses}
          coachFeedback={null}
          completedAt={assignment.completedAt}
        />
      </div>
    )
  }

  // Pending → take it (session transport)
  const api = sessionTestApi(assignment.id)
  const t = assignment.test.type
  return (
    <div className={`${widthClass} mx-auto`}>
      {back}
      {t === "ANCLAS_CARRERA" && <AnclasTest api={api} assignmentId={assignment.id} />}
      {t === "TABLERO_IDEAS" && <TableroTest api={api} assignmentId={assignment.id} />}
      {t === "PIRAMIDE_PROPOSITO" && <PiramideTest api={api} assignmentId={assignment.id} />}
      {t === "MODELO_NEGOCIO" && (
        <ModeloNegocioTest api={api} assignmentId={assignment.id} prefillIdea={assignment.prefillIdea} />
      )}
      {!["ANCLAS_CARRERA", "TABLERO_IDEAS", "PIRAMIDE_PROPOSITO", "MODELO_NEGOCIO"].includes(t) && (
        <p className="text-muted-foreground text-sm">Este tipo de test no está disponible.</p>
      )}
    </div>
  )
}
