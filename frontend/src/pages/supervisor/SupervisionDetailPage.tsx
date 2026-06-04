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
import { apiJson, apiPost } from "@/lib/api"
import { groupRankedAnchors } from "@/lib/anclas"
import { RawDataView } from "@/components/RawDataView"

function ResponseViewer({ testType, responses }: { testType: string; responses: any }) {
  const ANCHOR_NAMES: Record<string, string> = {
    TF: "Técnico/Funcional", GG: "Gerencia General", AU: "Autonomía",
    SE: "Seguridad/Estabilidad", CE: "Creativo-Empresario", SC: "Servicio a la Causa",
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
              <span className="font-medium shrink-0">{group.score}/6</span>
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
        {responses.brainstorming && (
          <div>
            <p className="text-sm font-medium mb-1">Brainstorming:</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{responses.brainstorming}</p>
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

  return <pre className="text-xs text-muted-foreground overflow-auto">{JSON.stringify(responses, null, 2)}</pre>
}

export default function SupervisionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [req, setReq] = useState<any>(null)
  const [notes, setNotes] = useState("")
  const [coachFeedback, setCoachFeedback] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
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
  }, [id])

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

  if (!req) return <div className="text-muted-foreground text-sm py-8">Cargando...</div>

  const responses = req.assignment?.response?.responses

  return (
    <div className="space-y-6 max-w-3xl">
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

      {responses && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Respuesta del cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponseViewer testType={req.assignment.test.type} responses={responses} />
          </CardContent>
        </Card>
      )}

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Tu feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Notas de supervisión (internas)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Feedback interno para el alumno..."
              disabled={req.status === "REVIEWED"}
            />
          </div>
          <div className="space-y-2">
            <Label>Feedback para el cliente (visible en el enlace de resultados)</Label>
            <Textarea
              value={coachFeedback}
              onChange={(e) => setCoachFeedback(e.target.value)}
              rows={3}
              placeholder="Mensaje visible para el cliente cuando vea sus resultados..."
              disabled={req.status === "REVIEWED"}
            />
          </div>

          {req.status === "PENDING" ? (
            <Button
              onClick={handleReview}
              disabled={saving}
              className="bg-brand-accent hover:bg-brand-accent-dark"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {saving ? "Guardando..." : "Marcar como revisado"}
            </Button>
          ) : (
            <p className="text-sm text-indigo-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Revisado el {req.reviewedAt ? formatShortDate(req.reviewedAt) : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
