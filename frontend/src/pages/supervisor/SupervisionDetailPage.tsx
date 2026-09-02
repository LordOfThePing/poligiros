import { useEffect, useState } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { api, apiJson, apiPost } from "@/lib/api"
import { groupRankedAnchors } from "@/lib/anclas"
import { RawDataView } from "@/components/RawDataView"
import { EditableResult } from "@/components/EditableResult"
import { ModeloNegocioResult } from "@/components/canvas/ModeloNegocioResult"
import { PV_SECTIONS } from "@/lib/planVital"
import { LoadingBadge } from "@/components/LoadingBadge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import ResultsView from "@/pages/client/ResultsView"

function ResponseViewer({ testType, responses }: { testType: string; responses: any }) {
  const ANCHOR_NAMES: Record<string, string> = {
    TF: "Técnico/Funcional", GG: "Gerencia General", AU: "Autonomía",
    SE: "Seguridad/Estabilidad", CE: "Creativo-Emprendedor", SC: "Servicio a la Causa",
    PD: "Puro Desafío", EV: "Estilo de Vida",
  }

  if (testType === "ANCLAS_CARRERA" && responses.scores) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Ranking de anclas:</p>
          {groupRankedAnchors(responses.scores, responses.ranking).map((group) => (
            <div key={group.rank} className="flex items-start gap-3 text-sm">
              <span className="w-5 text-muted-foreground shrink-0">{group.rank}.</span>
              <span className="flex-1">
                {group.anchors.map((a) => `${ANCHOR_NAMES[a]} (${a})`).join(" · ")}
                {group.anchors.length > 1 && <span className="text-xs text-muted-foreground"> — empate</span>}
              </span>
              <span className="font-medium shrink-0">{group.score}</span>
            </div>
          ))}
        </div>
        {responses.aiInsight && (
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Insight AI:</p>
            <p className="text-sm">{responses.aiInsight}</p>
          </div>
        )}
        <RawDataView testType={testType} responses={responses} />
      </div>
    )
  }

  if (testType === "TABLERO_IDEAS") {
    return (
      <div className="space-y-4">
        {["saber", "querer", "sonar"].map((col) => (
          <div key={col}>
            <p className="text-sm font-medium capitalize mb-1">{col === "sonar" ? "Soñar" : col.charAt(0).toUpperCase() + col.slice(1)}:</p>
            <ul className="space-y-1">
              {(responses[col] as string[]).filter(Boolean).map((v: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground">• {v}</li>
              ))}
            </ul>
          </div>
        ))}
        {Array.isArray(responses.brainstormIdeas) && responses.brainstormIdeas.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Ideas (brainstorming):</p>
            <ol className="space-y-1 list-decimal list-inside">
              {(responses.brainstormIdeas as string[]).map((v: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground">{v}</li>
              ))}
            </ol>
          </div>
        )}
        {Array.isArray(responses.aiIdeas) && responses.aiIdeas.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Ideas sugeridas por IA:</p>
            <ul className="space-y-1">
              {(responses.aiIdeas as string[]).map((v: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground">✨ {v}</li>
              ))}
            </ul>
          </div>
        )}
        {responses.selectedIdea && (
          <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-lg p-3">
            <p className="text-xs font-medium text-brand-accent mb-0.5">Idea elegida para desarrollar</p>
            <p className="text-sm">{responses.selectedIdea}</p>
          </div>
        )}
        {responses.brainstorming && !responses.brainstormIdeas && (
          <div>
            <p className="text-sm font-medium mb-1">Brainstorming:</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{responses.brainstorming}</p>
          </div>
        )}
        {Array.isArray(responses.explorationTasks) && responses.explorationTasks.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Tareas de exploración:</p>
            <ul className="space-y-1">
              {(responses.explorationTasks as string[]).map((v: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground">○ {v}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  if (testType === "PIRAMIDE_PROPOSITO") {
    return (
      <div className="space-y-3">
        {["rol", "valores", "fortalezas", "contextos", "especialidad"].map((field) => (
          responses[field] && (
            <div key={field}>
              <p className="text-sm font-medium capitalize mb-0.5">{field}:</p>
              <p className="text-sm text-muted-foreground">{responses[field]}</p>
            </div>
          )
        ))}
        {responses.propositoFinal && (
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 mt-4">
            <p className="text-xs text-gray-400 mb-1">Propósito final:</p>
            <p className="text-sm">{responses.propositoFinal}</p>
          </div>
        )}
        <RawDataView testType={testType} responses={responses} />
      </div>
    )
  }

  if (testType === "MODELO_NEGOCIO") {
    return <ModeloNegocioResult responses={responses} />
  }

  if (testType === "PLAN_VITAL") {
    return (
      <div className="space-y-3">
        {PV_SECTIONS.map((s) => {
          const val = responses[s.key] as string | undefined
          if (!val?.trim()) return null
          return (
            <div key={s.key}>
              <p className="text-sm font-medium mb-0.5">{s.num}. {s.title}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{val}</p>
            </div>
          )
        })}
        {Array.isArray(responses.estimulos) && (responses.estimulos as string[]).filter(Boolean).length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Estímulos:</p>
            <ul className="space-y-0.5">
              {(responses.estimulos as string[]).filter(Boolean).map((e: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground">· {e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return <pre className="text-xs text-muted-foreground overflow-auto">{JSON.stringify(responses, null, 2)}</pre>
}

/** The supervisor's feedback card (internal notes + client feedback + review). */
function FeedbackBox({
  notes,
  setNotes,
  coachFeedback,
  setCoachFeedback,
  reviewed,
  reviewedAt,
  saving,
  onReview,
  sticky = false,
}: {
  notes: string
  setNotes: (v: string) => void
  coachFeedback: string
  setCoachFeedback: (v: string) => void
  reviewed: boolean
  reviewedAt: string | null
  saving: boolean
  onReview: () => void
  sticky?: boolean
}) {
  const [editingReviewed, setEditingReviewed] = useState(false)
  const locked = reviewed && !editingReviewed

  return (
    <Card className={cn("bg-white", sticky && "lg:sticky lg:top-6")}>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Feedback</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Notas de supervisión (internas)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Feedback interno para el alumno..."
            disabled={locked}
          />
        </div>
        <div className="space-y-2">
          <Label>Feedback para el cliente (visible en el enlace de resultados)</Label>
          <Textarea
            value={coachFeedback}
            onChange={(e) => setCoachFeedback(e.target.value)}
            rows={3}
            placeholder="Mensaje visible para el cliente cuando vea sus resultados..."
            disabled={locked}
          />
        </div>

        {reviewed ? (
          editingReviewed ? (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => { onReview(); setEditingReviewed(false) }}
                disabled={saving}
                className="bg-brand-accent hover:bg-brand-accent-dark"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
              <Button variant="outline" onClick={() => setEditingReviewed(false)} disabled={saving}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-indigo-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Revisado el {reviewedAt ? formatShortDate(reviewedAt) : ""}
              </p>
              <Button variant="outline" size="sm" onClick={() => setEditingReviewed(true)}>
                Editar
              </Button>
            </div>
          )
        ) : (
          <Button
            onClick={onReview}
            disabled={saving}
            className="bg-brand-accent hover:bg-brand-accent-dark"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : "Marcar como revisado"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default function SupervisionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [req, setReq] = useState<any>(null)
  const [notes, setNotes] = useState("")
  const [coachFeedback, setCoachFeedback] = useState("")
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [fullView, setFullView] = useState(false)
  // For Anclas, the full view is the default but the raw/compressed view stays
  // one click away.
  const [showRaw, setShowRaw] = useState(false)

  function load() {
    apiJson<any[]>("/supervisor/supervision")
      .then((all) => {
        const found = all.find((r: any) => r.id === id)
        if (found) {
          setReq(found)
          setNotes(found.supervisorNotes ?? "")
          setCoachFeedback(found.coachFeedback ?? "")
        }
      })
      .catch(() => {})
  }
  useEffect(load, [id])

  async function handleReview() {
    setSaving(true)
    try {
      await apiPost(`/supervisor/supervision/${id}/review`, { supervisorNotes: notes, coachFeedback })
      toast({ title: "Supervisión marcada como revisada" })
      navigate("/supervisor/supervision")
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" })
    }
    setSaving(false)
  }

  if (!req) return <LoadingBadge />

  const responses = req.assignment?.response?.responses
  const testType = req.assignment?.test?.type
  // Modelo de Negocio needs room for the wide canvas; Tablero de Ideas for its
  // three columns + brainstorming panel.
  const wide = testType === "MODELO_NEGOCIO" || testType === "TABLERO_IDEAS"
  // Anclas gets the full pretty view with a floating feedback box on the right.
  const isAnclas = testType === "ANCLAS_CARRERA"

  return (
    <div className={cn("space-y-6", wide || isAnclas ? "max-w-6xl" : "max-w-3xl")}>
      <div className="flex items-center gap-3">
        <Link to="/supervisor/supervision" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-serif text-2xl text-foreground">{req.assignment.test.title}</h1>
          <p className="text-muted-foreground text-sm">
            {req.student.name} · {req.assignment.client.name} · {formatShortDate(req.createdAt)}
          </p>
        </div>
        <Badge className={req.status === "REVIEWED" ? "bg-indigo-100 text-indigo-800 ml-auto" : "bg-amber-100 text-amber-800 ml-auto"}>
          {req.status === "REVIEWED" ? "Revisado" : "Pendiente"}
        </Badge>
      </div>

      {req.studentNotes && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="py-4">
            <p className="text-xs font-medium text-amber-700 mb-1">Notas del alumno:</p>
            <p className="text-sm text-amber-900">{req.studentNotes}</p>
          </CardContent>
        </Card>
      )}

      {isAnclas ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
          <div className="min-w-0">
            {responses && (
              <Card className="bg-white">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="font-serif text-lg">Respuesta del cliente</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowRaw((v) => !v)}>
                      {showRaw ? "Ver vista completa" : "Ver vista cruda"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
                      {editing ? "Cancelar" : "Editar"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {editing ? (
                    <EditableResult
                      testType={req.assignment.test.type}
                      responses={responses}
                      onSave={async (updated) => {
                        await api(`/supervisor/responses/${req.assignment.id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ responses: updated }),
                        })
                        toast({ title: "Resultado actualizado" })
                        setEditing(false)
                        load()
                      }}
                    />
                  ) : showRaw ? (
                    <ResponseViewer testType={testType!} responses={responses} />
                  ) : (
                    <ResultsView
                      testType={testType!}
                      responses={responses}
                      coachFeedback={coachFeedback || req.assignment.supervision?.coachFeedback || null}
                      completedAt={req.assignment.completedAt}
                      constrainHeight={false}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="min-w-0 lg:self-start lg:sticky lg:top-6">
            <FeedbackBox
              notes={notes}
              setNotes={setNotes}
              coachFeedback={coachFeedback}
              setCoachFeedback={setCoachFeedback}
              reviewed={req.status === "REVIEWED"}
              reviewedAt={req.reviewedAt}
              saving={saving}
              onReview={handleReview}
            />
          </div>
        </div>
      ) : (
        <>
          {responses && (
            <Card className="bg-white">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="font-serif text-lg">Respuesta del cliente</CardTitle>
                <div className="flex items-center gap-2">
                  {testType === "TABLERO_IDEAS" ? (
                    // Its 3-column + scroll layout only renders correctly at a
                    // real full page, never nested in a modal — open a tab.
                    <a href={`/supervisor/supervision/${req.id}/vista`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1.5" /> Ver vista completa
                      </Button>
                    </a>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setFullView(true)}>
                      <Eye className="h-4 w-4 mr-1.5" /> Ver vista completa
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
                    {editing ? "Cancelar" : "Editar"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {editing ? (
                  <EditableResult
                    testType={req.assignment.test.type}
                    responses={responses}
                    onSave={async (updated) => {
                      await api(`/supervisor/responses/${req.assignment.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ responses: updated }),
                      })
                      toast({ title: "Resultado actualizado" })
                      setEditing(false)
                      load()
                    }}
                  />
                ) : (
                  <ResponseViewer testType={req.assignment.test.type} responses={responses} />
                )}
              </CardContent>
            </Card>
          )}

          <FeedbackBox
            notes={notes}
            setNotes={setNotes}
            coachFeedback={coachFeedback}
            setCoachFeedback={setCoachFeedback}
            reviewed={req.status === "REVIEWED"}
            reviewedAt={req.reviewedAt}
            saving={saving}
            onReview={handleReview}
          />
        </>
      )}

      {/* Full (nice) result view. Anclas shows the full view with a floating feedback box. */}
      <Dialog open={fullView} onOpenChange={setFullView}>
        <DialogContent className="w-[min(1200px,96vw)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {req.assignment.test.title} — vista completa
            </DialogTitle>
          </DialogHeader>
          {responses &&
            (isAnclas ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
                <div className="min-w-0">
                  <ResultsView
                    testType={testType!}
                    responses={responses}
                    coachFeedback={coachFeedback || req.assignment.supervision?.coachFeedback || null}
                    completedAt={req.assignment.completedAt}
                    constrainHeight={false}
                  />
                </div>
                {/* Floating feedback box: stays visible while the dialog scrolls. */}
                <div className="lg:sticky lg:top-0">
                  <FeedbackBox
                    notes={notes}
                    setNotes={setNotes}
                    coachFeedback={coachFeedback}
                    setCoachFeedback={setCoachFeedback}
                    reviewed={req.status === "REVIEWED"}
                    reviewedAt={req.reviewedAt}
                    saving={saving}
                    onReview={handleReview}
                  />
                </div>
              </div>
            ) : (
              <ResultsView
                testType={testType!}
                responses={responses}
                coachFeedback={coachFeedback || req.assignment.supervision?.coachFeedback || null}
                completedAt={req.assignment.completedAt}
                constrainHeight={false}
              />
            ))}
        </DialogContent>
      </Dialog>
    </div>
  )
}
