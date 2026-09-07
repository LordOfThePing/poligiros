import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Plus, X, ChevronUp, ChevronDown, Save } from "lucide-react"
import { JOB_FIELDS, FREELANCE_FIELDS, type CanvasConfig } from "@/components/canvas/canvasModel"
import { BusinessModelCanvas } from "@/components/canvas/BusinessModelCanvas"
import { PV_SECTIONS } from "@/lib/planVital"
import { QUESTIONS, calcScores, rankAnchors } from "@/lib/anclas"

// Editable test result (F7 follow-up): coach + supervisor can modify fields,
// values, and order, then save back to the stored response.

type Data = Record<string, any>

export function EditableResult({
  testType,
  responses,
  onSave,
}: {
  testType: string
  responses: Record<string, unknown>
  onSave: (responses: Record<string, unknown>) => Promise<void>
}) {
  const [data, setData] = useState<Data>({ ...responses })
  const [saving, setSaving] = useState(false)

  const setField = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }))

  async function save() {
    setSaving(true)
    try {
      await onSave(data)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {testType === "ANCLAS_CARRERA" && <AnclasEditor data={data} setField={setField} />}
      {testType === "TABLERO_IDEAS" && <TableroEditor data={data} setField={setField} />}
      {testType === "PIRAMIDE_PROPOSITO" && <PiramideEditor data={data} setField={setField} />}
      {testType === "MODELO_NEGOCIO" && <ModeloNegocioEditor data={data} setField={setField} />}
      {testType === "PLAN_VITAL" && <PlanVitalEditor data={data} setField={setField} />}
      {testType === "TAREAS_EXPLORACION" && <TareasExploracionEditor data={data} setField={setField} />}
      <Button onClick={save} disabled={saving} className="bg-brand-accent hover:bg-brand-accent-dark">
        <Save className="h-4 w-4 mr-2" /> {saving ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  )
}

function ListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const set = (i: number, v: string) => onChange(items.map((x, idx) => (idx === i ? v : x)))
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="text-xs w-4 text-muted-foreground shrink-0">{i + 1}</span>
          <Input value={v} onChange={(e) => set(i, e.target.value)} className="text-sm" />
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => move(i, -1)}><ChevronUp className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => move(i, 1)}><ChevronDown className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => remove(i)}><X className="h-3 w-3" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...items, ""])}><Plus className="h-3 w-3 mr-1" /> Agregar</Button>
    </div>
  )
}

/**
 * Anclas is edited by re-answering the 40 statements — the same thing the test
 * asks — never by hand-editing what those answers produce. Puntajes, ranking e
 * insight son derivados: los dos primeros se recalculan acá al guardar (con el
 * mismo +4 de los ítems bonus que aplica el test) y el insight queda como está.
 */
function AnclasEditor({ data, setField }: { data: Data; setField: (k: string, v: unknown) => void }) {
  const raw: (number | null)[] = Array.isArray(data.rawAnswers)
    ? data.rawAnswers
    : Array.isArray(data.finalAnswers)
      ? data.finalAnswers
      : Array(QUESTIONS.length).fill(null)
  const bonusItems: number[] = Array.isArray(data.bonusItems) ? data.bonusItems : []

  function setAnswer(idx: number, val: number) {
    const next = [...raw]
    next[idx] = val
    // Same derivation as the test: bonus items get +4 before scoring.
    const final = next.map((v) => v ?? 0)
    bonusItems.forEach((i) => { final[i] = (final[i] || 0) + 4 })
    const scores = calcScores(final)
    setField("rawAnswers", next)
    setField("finalAnswers", final)
    setField("scores", scores)
    setField("ranking", rankAnchors(scores))
  }

  const answered = raw.filter((v) => v !== null && v !== undefined).length

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Volvé a responder las afirmaciones que quieras cambiar ({answered} de {QUESTIONS.length}{" "}
        respondidas). El ranking se recalcula solo al guardar.
      </p>
      {QUESTIONS.map((q, idx) => (
        <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-sm text-foreground flex items-start gap-2">
            <span className="font-medium text-brand-accent">{idx + 1}.</span>
            <span className="flex-1">{q}</span>
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {[1, 2, 3, 4, 5, 6].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAnswer(idx, val)}
                className={
                  "w-8 h-8 rounded-full border-2 text-xs font-bold transition-all " +
                  (raw[idx] === val
                    ? "bg-brand-accent border-brand-accent text-white"
                    : "border-border text-muted-foreground hover:border-brand-accent hover:text-brand-accent")
                }
              >
                {val}
              </button>
            ))}
            {bonusItems.includes(idx) && (
              <span className="self-center text-[0.7rem] text-brand-accent font-medium ml-1">
                +4 (elegida en el paso 2)
              </span>
            )}
          </div>
          {idx === 0 && (
            <div className="flex justify-between text-[0.7rem] text-muted-foreground">
              <span>1 = No es verdadero para mí</span>
              <span>6 = Es siempre verdadero</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TableroEditor({ data, setField }: { data: Data; setField: (k: string, v: unknown) => void }) {
  const list = (k: string): string[] => (Array.isArray(data[k]) ? data[k] : [])
  return (
    <div className="space-y-3">
      <ListEditor label="SABER (ranking)" items={list("saberRanking")} onChange={(v) => setField("saberRanking", v)} />
      <ListEditor label="QUERER (ranking)" items={list("quererRanking")} onChange={(v) => setField("quererRanking", v)} />
      <ListEditor label="SOÑAR (ranking)" items={list("sonarRanking")} onChange={(v) => setField("sonarRanking", v)} />
      <ListEditor label="Ideas (brainstorming)" items={list("brainstormIdeas")} onChange={(v) => setField("brainstormIdeas", v)} />
      <ListEditor label="Ideas de IA" items={list("aiIdeas")} onChange={(v) => setField("aiIdeas", v)} />
      <ListEditor label="Tareas de exploración" items={list("explorationTasks")} onChange={(v) => setField("explorationTasks", v)} />
      <div className="space-y-1">
        <Label className="text-xs">Idea elegida</Label>
        <Input value={data.selectedIdea ?? ""} onChange={(e) => setField("selectedIdea", e.target.value)} className="text-sm" />
      </div>
    </div>
  )
}

function IdeaEditor({ data, onChange }: { data: Data; onChange: (patch: Data) => void }) {
  const kind = (data.kind as "CANVAS" | "JOB" | "FREELANCE" | undefined) ?? "CANVAS"
  const content: Record<string, string> = data.content ?? {}
  const setContent = (key: string, value: string) =>
    onChange({ content: { ...content, [key]: value } })

  if (kind === "CANVAS") {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Idea</Label>
          <Input value={data.selectedIdea ?? ""} onChange={(e) => onChange({ selectedIdea: e.target.value })} className="text-sm" />
        </div>
        <BusinessModelCanvas
          idea={data.selectedIdea ?? ""}
          content={content}
          onChange={setContent}
          config={(data.canvas as CanvasConfig | undefined) ?? {}}
          onConfigChange={(cfg) => onChange({ canvas: cfg })}
          story={data.story ?? ""}
          onStoryChange={(v) => onChange({ story: v })}
        />
      </div>
    )
  }

  const fields = kind === "JOB" ? JOB_FIELDS : FREELANCE_FIELDS
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Idea</Label>
        <Input value={data.selectedIdea ?? ""} onChange={(e) => onChange({ selectedIdea: e.target.value })} className="text-sm" />
      </div>
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label className="text-xs">{f.label}</Label>
          <Textarea value={content[f.key] ?? ""} onChange={(e) => setContent(f.key, e.target.value)} className="text-sm min-h-[70px]" />
        </div>
      ))}
      <div className="space-y-1">
        <Label className="text-xs">Relato de la idea</Label>
        <Textarea value={data.story ?? ""} onChange={(e) => onChange({ story: e.target.value })} className="text-sm min-h-[80px]" />
      </div>
    </div>
  )
}

function ModeloNegocioEditor({ data, setField }: { data: Data; setField: (k: string, v: unknown) => void }) {
  // New shape: { ideas: [...] }
  if (Array.isArray(data.ideas) && data.ideas.length > 0) {
    const ideas = data.ideas as Data[]
    const setIdea = (i: number, patch: Data) => {
      const next = ideas.map((x, idx) => (idx === i ? { ...x, ...patch } : x))
      setField("ideas", next)
    }
    return (
      <div className="space-y-6">
        {ideas.map((entry, i) => (
          <div key={i} className="space-y-3">
            {ideas.length > 1 && (
              <Label className="text-xs text-brand-accent uppercase tracking-wide">
                {entry.horizon === "long" ? "Largo plazo" : "Corto / mediano plazo"}
              </Label>
            )}
            <IdeaEditor data={entry} onChange={(patch) => setIdea(i, patch)} />
          </div>
        ))}
      </div>
    )
  }

  // Old shape backward compat
  return <IdeaEditor data={data} onChange={(patch) => Object.entries(patch).forEach(([k, v]) => setField(k, v))} />
}

function PlanVitalEditor({ data, setField }: { data: Data; setField: (k: string, v: unknown) => void }) {
  const list = (k: string): string[] => (Array.isArray(data[k]) ? data[k] : [])
  return (
    <div className="space-y-3">
      {PV_SECTIONS.map((s) => (
        <div key={s.key} className="space-y-1">
          <Label className="text-xs uppercase">{s.num}. {s.title}</Label>
          <Textarea value={data[s.key] ?? ""} onChange={(e) => setField(s.key, e.target.value)} className="text-sm min-h-[80px]" />
        </div>
      ))}
      <ListEditor label="Estímulos" items={list("estimulos")} onChange={(v) => setField("estimulos", v)} />
    </div>
  )
}

function TareasExploracionEditor({ data, setField }: { data: Data; setField: (k: string, v: unknown) => void }) {
  const list = (k: string): string[] => (Array.isArray(data[k]) ? data[k] : [])
  return <ListEditor label="Tareas" items={list("tasks")} onChange={(v) => setField("tasks", v)} />
}

function PiramideEditor({ data, setField }: { data: Data; setField: (k: string, v: unknown) => void }) {
  const fields = ["rol", "valores", "fortalezas", "contextos", "especialidad", "propositoFinal"]
  return (
    <div className="space-y-2">
      {fields.map((f) => (
        <div key={f} className="space-y-1">
          <Label className="text-xs uppercase">{f}</Label>
          <Textarea value={data[f] ?? ""} onChange={(e) => setField(f, e.target.value)} className="text-sm min-h-[60px]" />
        </div>
      ))}
    </div>
  )
}
