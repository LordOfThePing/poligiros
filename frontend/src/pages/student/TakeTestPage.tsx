import { useCallback, useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, Pencil } from "lucide-react"
import { apiJson, apiTry } from "@/lib/api"
import { sessionTestApi } from "@/lib/testApi"
import AnclasTest from "@/pages/client/tests/AnclasTest"
import TableroTest from "@/pages/client/tests/TableroTest"
import PiramideTest from "@/pages/client/tests/PiramideTest"
import { ModeloNegocioTest } from "@/pages/client/tests/ModeloNegocioTest"
import PlanVitalTest from "@/pages/client/tests/PlanVitalTest"
import TareasExploracionTest from "@/pages/client/tests/TareasExploracionTest"
import ResultsView from "@/pages/client/ResultsView"
import { EditableResult } from "@/components/EditableResult"
import { Button } from "@/components/ui/button"
import { LoadingBadge } from "@/components/LoadingBadge"
import { useToast } from "@/hooks/use-toast"

type Assignment = {
  id: string
  completedAt: string | null
  revoked?: boolean
  test: { type: string; title: string }
  response: { responses: Record<string, unknown> } | null
  prefillIdea?: string
  prefillIdeas?: string[]
  feedback?: string | null
  canEdit?: boolean
}

export default function StudentTakeTestPage() {
  const { id } = useParams<{ id: string }>()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const { toast } = useToast()

  const load = useCallback(() => {
    return apiJson<Assignment>(`/student/my-tests/${id}`)
      .then(setAssignment)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <LoadingBadge />
  if (!assignment) return <div className="text-muted-foreground text-sm py-8">Test no encontrado.</div>

  const back = (
    <Link to="/student/my-tests" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
      <ArrowLeft className="h-4 w-4" /> Volver a Mis Tests
    </Link>
  )

  // Modelo de Negocio renders a wide canvas; other tests stay narrow.
  const widthClass =
    assignment.test.type === "MODELO_NEGOCIO" ? "max-w-6xl" :
    assignment.test.type === "TABLERO_IDEAS" ? "max-w-5xl" :
    "max-w-2xl"

  const feedbackPanel = assignment.feedback ? (
    <div className="bg-brand-accent/10 border border-brand-accent/30 rounded-lg p-4">
      <p className="text-xs text-muted-foreground mb-1.5">Feedback de Gaby</p>
      <p className="text-sm text-foreground whitespace-pre-wrap">{assignment.feedback}</p>
    </div>
  ) : null

  // Completed + Gaby already reviewed it → the coach's single post-review edit.
  if (assignment.completedAt && assignment.response && editing && assignment.canEdit) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button
          onClick={() => setEditing(false)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          ← Volver a mis resultados
        </button>
        <p className="text-xs text-muted-foreground">
          Esta es tu única edición para este resultado. Al guardar, vuelve a supervisión para una
          segunda revisión.
        </p>
        {feedbackPanel}
        <EditableResult
          testType={assignment.test.type}
          responses={assignment.response.responses}
          onSave={async (responses) => {
            const res = await apiTry(`/student/responses/${assignment.id}`, {
              method: "PUT",
              body: JSON.stringify({ responses }),
            })
            if (!res.ok) {
              const j = await res.json().catch(() => ({ message: "No se pudo guardar" }))
              toast({ title: j.message || "No se pudo guardar", variant: "destructive" })
              return
            }
            toast({ title: "Resultado actualizado", description: "Vuelve a supervisión para una segunda revisión." })
            setEditing(false)
            load()
          }}
        />
      </div>
    )
  }

  // Completed → read-only results
  if (assignment.completedAt && assignment.response) {
    return (
      <div className={`${widthClass} mx-auto`}>
        {back}
        {feedbackPanel && <div className="mb-6">{feedbackPanel}</div>}
        <ResultsView
          testType={assignment.test.type}
          responses={assignment.response.responses}
          coachFeedback={null}
          completedAt={assignment.completedAt}
          footer={assignment.canEdit ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Editar mis respuestas
            </Button>
          ) : undefined}
        />
      </div>
    )
  }

  // Revoked by Gaby while pending → can't take it until re-opened.
  if (assignment.revoked) {
    return (
      <div className="max-w-md mx-auto text-center space-y-3 py-12">
        {back}
        <p className="text-4xl">🚫</p>
        <h1 className="font-serif text-2xl text-foreground">Este test quedó suspendido</h1>
        <p className="text-muted-foreground">
          Gaby revocó tu acceso a este test. Consultá con ella para reabrir el acceso.
        </p>
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
        <ModeloNegocioTest api={api} assignmentId={assignment.id} prefillIdeas={assignment.prefillIdeas ?? (assignment.prefillIdea ? [assignment.prefillIdea] : [])} />
      )}
      {t === "PLAN_VITAL" && <PlanVitalTest api={api} assignmentId={assignment.id} />}
      {t === "TAREAS_EXPLORACION" && <TareasExploracionTest api={api} assignmentId={assignment.id} />}
      {!["ANCLAS_CARRERA", "TABLERO_IDEAS", "PIRAMIDE_PROPOSITO", "MODELO_NEGOCIO", "PLAN_VITAL", "TAREAS_EXPLORACION"].includes(t) && (
        <p className="text-muted-foreground text-sm">Este tipo de test no está disponible.</p>
      )}
    </div>
  )
}
