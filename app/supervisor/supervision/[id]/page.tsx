"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"

export default function SupervisionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const [req, setReq] = useState<any>(null)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/supervisor/supervision")
      .then((r) => r.json())
      .then((all) => {
        const found = all.find((r: any) => r.id === id)
        if (found) {
          setReq(found)
          setNotes(found.supervisorNotes ?? "")
        }
      })
  }, [id])

  async function handleReview() {
    setSaving(true)
    const res = await fetch(`/api/supervisor/supervision/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supervisorNotes: notes }),
    })

    if (res.ok) {
      toast({ title: "Supervisión marcada como revisada" })
      router.push("/supervisor/supervision")
    } else {
      toast({ title: "Error al guardar", variant: "destructive" })
    }
    setSaving(false)
  }

  if (!req) return <div className="text-muted-foreground text-sm py-8">Cargando...</div>

  const responses = req.assignment?.response?.responses

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/supervisor/supervision" className="text-muted-foreground hover:text-foreground">
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

      {/* Student notes */}
      {req.studentNotes && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="py-4">
            <p className="text-xs font-medium text-amber-700 mb-1">Notas del alumno:</p>
            <p className="text-sm text-amber-900">{req.studentNotes}</p>
          </CardContent>
        </Card>
      )}

      {/* Test response (read-only) */}
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

      {/* Supervisor notes */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Tu feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Notas de supervisión</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Escribí tu feedback para el alumno..."
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

function ResponseViewer({ testType, responses }: { testType: string; responses: any }) {
  if (testType === "ANCLAS_CARRERA" && responses.ranking) {
    const ANCHOR_NAMES: Record<string, string> = {
      TF: "Técnico/Funcional", GG: "Gerencia General", AU: "Autonomía",
      SE: "Seguridad/Estabilidad", CE: "Creativo-Empresario", SC: "Servicio a la Causa",
      PD: "Puro Desafío", EV: "Estilo de Vida",
    }
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Ranking de anclas:</p>
          {(responses.ranking as string[]).map((anchor: string, i: number) => (
            <div key={anchor} className="flex items-center gap-3 text-sm">
              <span className="w-5 text-muted-foreground">{i + 1}.</span>
              <span className="flex-1">{ANCHOR_NAMES[anchor]} ({anchor})</span>
              <span className="font-medium">{responses.scores?.[anchor]}/6</span>
            </div>
          ))}
        </div>
        {responses.aiInsight && (
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Insight AI:</p>
            <p className="text-sm">{responses.aiInsight}</p>
          </div>
        )}
      </div>
    )
  }

  if (testType === "TABLERO_IDEAS") {
    // New shape stores per-column rankings as strings ([T5]); old responses only
    // have the raw saber/querer/sonar arrays. Prefer the ranking when present,
    // fall back to the raw list so historical responses still render.
    const cols = [
      { key: "saber", label: "Saber", rankKey: "saberRanking" },
      { key: "querer", label: "Querer", rankKey: "quererRanking" },
      { key: "sonar", label: "Soñar", rankKey: "sonarRanking" },
    ]
    const passion = (responses.saberPassion as boolean[] | undefined) ?? []
    const saberAll = (responses.saber as string[] | undefined)?.filter(Boolean) ?? []
    return (
      <div className="space-y-4">
        {cols.map(({ key, label, rankKey }) => {
          const ranked = (responses[rankKey] as string[] | undefined)?.filter(Boolean) ?? []
          const raw = (responses[key] as string[] | undefined)?.filter(Boolean) ?? []
          return (
            <div key={key}>
              <p className="text-sm font-medium mb-1">
                {label}
                {ranked.length > 0 && <span className="text-xs text-muted-foreground font-normal"> (en orden)</span>}:
              </p>
              {ranked.length > 0 ? (
                <ol className="space-y-1 list-decimal list-inside">
                  {ranked.map((v, i) => (
                    <li key={i} className="text-sm text-muted-foreground">{v}</li>
                  ))}
                </ol>
              ) : (
                <ul className="space-y-1">
                  {raw.map((v, i) => (
                    <li key={i} className="text-sm text-muted-foreground">• {v}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
        {/* Full SABER list with the passion marks, when the new shape is present */}
        {saberAll.length > 0 && passion.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Saber — todas (★ = apasiona):</p>
            <ul className="space-y-1">
              {saberAll.map((v, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {passion[i] ? "★" : "•"} {v}
                </li>
              ))}
            </ul>
          </div>
        )}
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
      </div>
    )
  }

  return <pre className="text-xs text-muted-foreground overflow-auto">{JSON.stringify(responses, null, 2)}</pre>
}
