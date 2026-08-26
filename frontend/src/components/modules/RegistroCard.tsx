import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiTry } from "@/lib/api"
import { Markdown } from "@/components/Markdown"
import { MarkdownEditor } from "@/components/MarkdownEditor"
import { AnclasResult } from "@/components/results/AnclasResult"
import type { DuplaCandidate, StudentModuleItem } from "@/lib/modules"

type PartnerAnclas = {
  coach: { id: string; name: string }
  completed: boolean
  completedAt?: string
  scores?: Record<string, number> | null
  aiInsight?: string | null
}

/**
 * A kind = REGISTRO card: the coach picks their dupla partner, reviews that
 * partner's Anclas result to prepare the devolución, and writes up the session
 * they ran. Both sides are coaches of the same CIC — this never touches the
 * `Client` model, so it does not depend on the cohort's practice permission.
 */
export function RegistroCard({
  item,
  onSaved,
}: {
  item: StudentModuleItem
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [candidates, setCandidates] = useState<DuplaCandidate[]>([])
  const [coacheeId, setCoacheeId] = useState(item.practice?.coachee.id ?? "")
  const [sessionDate, setSessionDate] = useState(item.practice?.sessionDate?.slice(0, 10) ?? "")
  const [mainOutputs, setMainOutputs] = useState(item.practice?.mainOutputs ?? "")
  const [toolsAndResults, setToolsAndResults] = useState(item.practice?.toolsAndResults ?? "")
  const [conclusions, setConclusions] = useState(item.practice?.conclusions ?? "")
  const [saving, setSaving] = useState(false)

  // The partner's Anclas, loaded on demand once a partner is picked.
  const [anclas, setAnclas] = useState<PartnerAnclas | null>(null)
  const [loadingAnclas, setLoadingAnclas] = useState(false)
  const [showAnclas, setShowAnclas] = useState(false)

  const [showAboutMe, setShowAboutMe] = useState(false)

  const locked = Boolean(item.practice?.reviewedAt)

  useEffect(() => {
    apiJson<{ candidates: DuplaCandidate[] }>(`/student/module-items/${item.id}/dupla`)
      .then((r) => setCandidates(r.candidates))
      .catch(() => {})
  }, [item.id])


  // Reset whenever the partner changes: showing anchors from the previous pick
  // next to a different name would be worse than showing nothing.
  useEffect(() => {
    setAnclas(null)
    setShowAnclas(false)
  }, [coacheeId])

  async function loadAnclas() {
    if (!coacheeId) return
    setShowAnclas(true)
    if (anclas) return
    setLoadingAnclas(true)
    try {
      setAnclas(await apiJson<PartnerAnclas>(`/student/coaches/${coacheeId}/anclas`))
    } catch {
      setAnclas(null)
    }
    setLoadingAnclas(false)
  }

  async function save() {
    setSaving(true)
    const res = await apiTry(`/student/module-items/${item.id}/registro`, {
      method: "PUT",
      body: JSON.stringify({
        coacheeId,
        sessionDate: sessionDate || null,
        mainOutputs,
        toolsAndResults,
        conclusions,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: j.error || "No se pudo guardar", variant: "destructive" })
      return
    }
    toast({ title: item.practice ? "Registro actualizado" : "Registro enviado" })
    onSaved()
  }

  const partnerName = candidates.find((c) => c.id === coacheeId)?.name

  return (
    <div className="space-y-5">
      {/* ── The session I ran ─────────────────────────────────────────────── */}
      {locked ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" /> Entregado y revisado
          </div>
          <ReadOnlyRecord
            heading={`Sesión con ${item.practice!.coachee.name}`}
            date={item.practice!.sessionDate}
            mainOutputs={item.practice!.mainOutputs}
            toolsAndResults={item.practice!.toolsAndResults}
            conclusions={item.practice!.conclusions}
          />
          {item.practice!.feedback && (
            <div className="bg-brand-accent/10 border border-brand-accent/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Devolución de Gaby</p>
              <Markdown>{item.practice!.feedback}</Markdown>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>¿A quién entrevistaste?</Label>
            <Select value={coacheeId} onValueChange={setCoacheeId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí tu compañero/a de dupla" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {candidates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Todavía no hay otros coaches en tu CIC para elegir.
              </p>
            )}
            {coacheeId && (
              <p className="text-xs text-muted-foreground">
                Tu dupla: <strong className="text-foreground">{partnerName}</strong>
              </p>
            )}
          </div>

          {/* Preparing the devolución: the partner's own Anclas result. */}
          {coacheeId && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <button
                onClick={() => (showAnclas ? setShowAnclas(false) : loadAnclas())}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                {showAnclas ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Users className="h-4 w-4 text-brand-accent" />
                Ver las anclas de {partnerName ?? "tu dupla"}
              </button>

              {showAnclas && (
                <div className="mt-3">
                  {loadingAnclas ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
                    </p>
                  ) : anclas?.completed && anclas.scores ? (
                    <AnclasResult
                      scores={anclas.scores}
                      aiInsight={anclas.aiInsight ?? null}
                      title={`Anclas de ${partnerName ?? "tu dupla"}`}
                      subtitle={
                        anclas.completedAt
                          ? `Test completado el ${formatShortDate(anclas.completedAt)}`
                          : "Resultados según la metodología de Edgar Schein"
                      }
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Todavía no completó el Test de Anclas de Carrera. Pedile que lo haga antes de
                      la sesión: sin eso no vas a poder darle la devolución.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Fecha de la sesión</Label>
            <Input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-44"
            />
          </div>

          <div className="space-y-2">
            <Label>Principales emergentes</Label>
            <MarkdownEditor
              value={mainOutputs}
              onChange={setMainOutputs}
              rows={7}
              placeholder="Qué apareció en la entrevista: felicidad laboral, insatisfacción y desde cuándo, qué disfruta..."
            />
          </div>

          <div className="space-y-2">
            <Label>Herramientas y resultados</Label>
            <MarkdownEditor
              value={toolsAndResults}
              onChange={setToolsAndResults}
              rows={7}
              placeholder="El ranking de las 8 anclas y cómo resultó la devolución (mirada de lupa y de faro)..."
            />
          </div>

          <div className="space-y-2">
            <Label>Conclusiones</Label>
            <MarkdownEditor
              value={conclusions}
              onChange={setConclusions}
              rows={7}
              placeholder="Tu lectura como Coach: hipótesis, hacia dónde orientarías el proceso..."
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              className="bg-brand-accent hover:bg-brand-accent-dark"
              disabled={
                saving || !coacheeId || !mainOutputs.trim() || !toolsAndResults.trim() ||
                !conclusions.trim()
              }
              onClick={save}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {item.practice ? "Guardar cambios" : "Enviar registro"}
            </Button>
            {item.practice && (
              <span className="text-xs text-muted-foreground">
                Entregado · podés editarlo hasta que Gaby lo revise
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── The session my partner ran on me ──────────────────────────────── */}
      {item.practiceAboutMe && (
        <div className="border-t border-border pt-4">
          <button
            onClick={() => setShowAboutMe((v) => !v)}
            className="flex items-center gap-2 text-sm text-foreground"
          >
            {showAboutMe ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            El registro que te hicieron a vos
            <Badge variant="secondary" className="text-xs">
              {item.practiceAboutMe.coach.name}
            </Badge>
          </button>

          {showAboutMe && (
            <div className="mt-3">
              <ReadOnlyRecord
                heading={`Sesión conducida por ${item.practiceAboutMe.coach.name}`}
                date={item.practiceAboutMe.sessionDate}
                mainOutputs={item.practiceAboutMe.mainOutputs}
                toolsAndResults={item.practiceAboutMe.toolsAndResults}
                conclusions={item.practiceAboutMe.conclusions}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReadOnlyRecord({
  heading,
  date,
  mainOutputs,
  toolsAndResults,
  conclusions,
}: {
  heading: string
  date: string | null
  mainOutputs: string
  toolsAndResults: string
  conclusions: string
}) {
  return (
    <div className="bg-muted/40 rounded-lg p-3 space-y-3">
      <p className="text-xs text-muted-foreground">
        {heading}
        {date && ` · ${formatShortDate(date)}`}
      </p>
      {[
        ["Principales emergentes", mainOutputs],
        ["Herramientas y resultados", toolsAndResults],
        ["Conclusiones", conclusions],
      ].map(([label, body]) => (
        <div key={label}>
          <p className="text-xs font-medium text-foreground mb-1">{label}</p>
          <Markdown>{body}</Markdown>
        </div>
      ))}
    </div>
  )
}
