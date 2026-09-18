import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, ChevronDown, ChevronRight, Clock, Loader2, Users, Pencil } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiTry } from "@/lib/api"
import { useDraft } from "@/lib/draft"
import { Markdown } from "@/components/Markdown"
import { MarkdownEditor } from "@/components/MarkdownEditor"
import { SaveIndicator } from "@/components/SaveIndicator"
import ResultsView from "@/pages/client/ResultsView"
import type { DuplaCandidate, StudentModuleItem } from "@/lib/modules"

type PartnerResult = {
  coach: { id: string; name: string }
  completed: boolean
  completedAt?: string
  testType?: string
  responses?: Record<string, unknown> | null
}

/**
 * The registro is the same three fields for every card, but what the coach has
 * to write about depends on the test they ran the session on. Keeping the
 * Anclas wording on a Tablero or a Plan Vital session sent them looking for a
 * ranking of 8 anclas that that test never produces.
 */
const REGISTRO_PLACEHOLDERS: Record<string, { mainOutputs: string; toolsAndResults: string }> = {
  ANCLAS_CARRERA: {
    mainOutputs:
      "Qué apareció en la entrevista: felicidad laboral, insatisfacción y desde cuándo, qué disfruta...",
    toolsAndResults:
      "El ranking de las 8 anclas y cómo resultó la devolución (mirada de lupa y de faro)...",
  },
  TABLERO_IDEAS: {
    mainOutputs:
      "Qué apareció al recorrer el saber, el querer y el soñar: qué le costó más, dónde se entusiasmó...",
    toolsAndResults:
      "Los top 3 de cada columna, las ideas del brainstorming y cuál eligió — y cómo resultó la devolución...",
  },
  PLAN_VITAL: {
    mainOutputs:
      "Qué apareció al mirar las 8 áreas: cuáles puntuó más bajo, qué desequilibrio reconoce, qué la moviliza...",
    toolsAndResults:
      "El puntaje por área, los Estímulos que eligió y cómo resultó la devolución...",
  },
  PIRAMIDE_PROPOSITO: {
    mainOutputs:
      "Qué apareció al construir la pirámide: rol, valores, fortalezas, contextos — dónde dudó más...",
    toolsAndResults:
      "Cómo quedó formulado el propósito final y cómo resultó la devolución...",
  },
  MODELO_NEGOCIO: {
    mainOutputs:
      "Qué apareció al explorar la idea: qué tiene clara, qué está en pañales, qué la frena...",
    toolsAndResults:
      "Los bloques del Canvas (o la investigación del puesto) y cómo resultó la devolución...",
  },
}

const DEFAULT_PLACEHOLDERS = {
  mainOutputs: "Qué apareció en la entrevista: lo que trajo, lo que la moviliza, lo que la frena...",
  toolsAndResults: "Los resultados de la herramienta que usaste y cómo resultó la devolución...",
}

/**
 * A kind = REGISTRO card: the coach picks their dupla partner, reviews that
 * partner's result for the card's test (`ModuleItem.testId`) to prepare the
 * devolución, and writes up the session they ran. Both sides are coaches of
 * the same CIC — this never touches the `Client` model, so it does not depend
 * on the cohort's practice permission.
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
  // The registro is long-form writing that used to live only in React state:
  // a refresh mid-write threw it away. It is drafted to localStorage now, and
  // only cleared once the server has it.
  const draftKey = `registro-${item.id}`
  const [coacheeId, setCoacheeId] = useState(item.practice?.coachee.id ?? "")
  const [sessionDate, setSessionDate, clearDateDraft] = useDraft(
    `${draftKey}.date`,
    item.practice?.sessionDate?.slice(0, 10) ?? ""
  )
  const [mainOutputs, setMainOutputs, clearMainDraft] = useDraft(
    `${draftKey}.main`,
    item.practice?.mainOutputs ?? ""
  )
  const [toolsAndResults, setToolsAndResults, clearToolsDraft] = useDraft(
    `${draftKey}.tools`,
    item.practice?.toolsAndResults ?? ""
  )
  const [conclusions, setConclusions, clearConclusionsDraft] = useDraft(
    `${draftKey}.conclusions`,
    item.practice?.conclusions ?? ""
  )
  const [saving, setSaving] = useState(false)

  // The partner's test result, loaded on demand once a partner is picked.
  const [result, setResult] = useState<PartnerResult | null>(null)
  const [loadingResult, setLoadingResult] = useState(false)
  const [showResult, setShowResult] = useState(false)

  const [showAboutMe, setShowAboutMe] = useState(false)

  // Handed in → read-only until Gaby returns it; her devolución reopens it for
  // a correction, which goes back to her (see PUT .../registro). So the form is
  // shown for the first hand-in, and afterwards only while correcting.
  const [editing, setEditing] = useState(false)
  const postReviewEdit = editing && Boolean(item.practice?.canEdit)
  const locked = Boolean(item.practice) && !postReviewEdit
  const awaitingReview = Boolean(item.practice) && !item.practice?.reviewedAt

  useEffect(() => {
    apiJson<{ candidates: DuplaCandidate[] }>(`/student/module-items/${item.id}/dupla`)
      .then((r) => setCandidates(r.candidates))
      .catch(() => {})
  }, [item.id])


  // Reset whenever the partner changes: showing a result from the previous pick
  // next to a different name would be worse than showing nothing.
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
      setResult(await apiJson<PartnerResult>(`/student/module-items/${item.id}/dupla/${coacheeId}`))
    } catch {
      setResult(null)
    }
    setLoadingResult(false)
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
    clearDateDraft()
    clearMainDraft()
    clearToolsDraft()
    clearConclusionsDraft()
    toast({
      title: item.practice ? "Registro actualizado" : "Registro enviado",
      description: postReviewEdit ? "Vuelve a Gaby para una nueva devolución." : undefined,
    })
    setEditing(false)
    onSaved()
  }

  const partnerName = candidates.find((c) => c.id === coacheeId)?.name
  const placeholders =
    (item.test && REGISTRO_PLACEHOLDERS[item.test.type]) || DEFAULT_PLACEHOLDERS

  return (
    <div className="space-y-5">
      {/* ── The session I ran ─────────────────────────────────────────────── */}
      {locked ? (
        <div className="space-y-3">
          {awaitingReview ? (
            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
              <Clock className="h-4 w-4" /> Entregado · esperando la devolución de Gaby
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" /> Entregado y revisado
            </div>
          )}
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
          {item.practice!.canEdit ? (
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar mi registro
              </Button>
              <span className="text-xs text-muted-foreground">
                Al guardar vuelve a Gaby para una nueva devolución.
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Mientras espera su devolución no se puede editar.
            </p>
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

          {/* Preparing the devolución: the partner's own result for this card's test. */}
          {coacheeId && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <button
                onClick={() => (showResult ? setShowResult(false) : loadResult())}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                {showResult ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Users className="h-4 w-4 text-brand-accent" />
                Ver el resultado de {partnerName ?? "tu dupla"}
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
                      Todavía no completó ese test. Pedile que lo haga antes de la sesión: sin eso
                      no vas a poder darle la devolución.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Fecha de la sesión</Label>
              <SaveIndicator value={sessionDate} draftKey={`${draftKey}.date`} />
            </div>
            <Input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-44"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Principales emergentes</Label>
              <SaveIndicator value={mainOutputs} draftKey={`${draftKey}.main`} />
            </div>
            <MarkdownEditor
              value={mainOutputs}
              onChange={setMainOutputs}
              rows={7}
              placeholder={placeholders.mainOutputs}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Herramientas y resultados</Label>
              <SaveIndicator value={toolsAndResults} draftKey={`${draftKey}.tools`} />
            </div>
            <MarkdownEditor
              value={toolsAndResults}
              onChange={setToolsAndResults}
              rows={7}
              placeholder={placeholders.toolsAndResults}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Conclusiones</Label>
              <SaveIndicator value={conclusions} draftKey={`${draftKey}.conclusions`} />
            </div>
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
            {postReviewEdit ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
                <span className="text-xs text-muted-foreground">
                  Al guardar vuelve a Gaby para una nueva devolución
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                Al enviarlo queda fijo hasta que Gaby te devuelva
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
