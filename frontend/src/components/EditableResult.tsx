import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Plus, X, ChevronUp, ChevronDown, Save } from "lucide-react"
import { JOB_FIELDS, FREELANCE_FIELDS, type CanvasConfig } from "@/components/canvas/canvasModel"
import { BusinessModelCanvas } from "@/components/canvas/BusinessModelCanvas"

// Editable test result (F7 follow-up): coach + supervisor can modify fields,
// values, and order, then save back to the stored response.

const ANCHOR_NAMES: Record<string, string> = {
  TF: "Técnico/Funcional", GG: "Gerencia General", AU: "Autonomía",
  SE: "Seguridad/Estabilidad", CE: "Creativo-Emprendedor", SC: "Servicio a la Causa",
  PD: "Puro Desafío", EV: "Estilo de Vida",
}

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

function AnclasEditor({ data, setField }: { data: Data; setField: (k: string, v: unknown) => void }) {
  const scores: Record<string, number> = data.scores ?? {}
  const setScore = (a: string, v: string) => setField("scores", { ...scores, [a]: Number(v) })
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Puntajes por ancla (definen el orden del ranking)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
          {Object.keys(ANCHOR_NAMES).map((a) => (
            <div key={a} className="flex items-center gap-2">
              <span className="text-xs flex-1">{ANCHOR_NAMES[a]} ({a})</span>
              <Input type="number" step="0.1" value={scores[a] ?? ""} onChange={(e) => setScore(a, e.target.value)} className="w-24 text-sm" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Insight</Label>
        <Textarea value={data.aiInsight ?? ""} onChange={(e) => setField("aiInsight", e.target.value)} className="text-sm min-h-[80px]" />
      </div>
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
      <div className="space-y-1">
        <Label className="text-xs">Idea elegida</Label>
        <Input value={data.selectedIdea ?? ""} onChange={(e) => setField("selectedIdea", e.target.value)} className="text-sm" />
      </div>
    </div>
  )
}

function ModeloNegocioEditor({ data, setField }: { data: Data; setField: (k: string, v: unknown) => void }) {
  const kind = (data.kind as "CANVAS" | "JOB" | "FREELANCE" | undefined) ?? "CANVAS"
  const content: Record<string, string> = data.content ?? {}
  const setContent = (key: string, value: string) => setField("content", { ...content, [key]: value })

  if (kind === "CANVAS") {
    // Reuse the editable canvas so the coach can edit values, labels, and the story.
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Idea</Label>
          <Input value={data.selectedIdea ?? ""} onChange={(e) => setField("selectedIdea", e.target.value)} className="text-sm" />
        </div>
        <BusinessModelCanvas
          idea={data.selectedIdea ?? ""}
          content={content}
          onChange={setContent}
          config={(data.canvas as CanvasConfig | undefined) ?? {}}
          onConfigChange={(cfg) => setField("canvas", cfg)}
          story={data.story ?? ""}
          onStoryChange={(v) => setField("story", v)}
        />
      </div>
    )
  }

  const fields = kind === "JOB" ? JOB_FIELDS : FREELANCE_FIELDS
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Idea</Label>
        <Input value={data.selectedIdea ?? ""} onChange={(e) => setField("selectedIdea", e.target.value)} className="text-sm" />
      </div>
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label className="text-xs">{f.label}</Label>
          <Textarea value={content[f.key] ?? ""} onChange={(e) => setContent(f.key, e.target.value)} className="text-sm min-h-[70px]" />
        </div>
      ))}
      <div className="space-y-1">
        <Label className="text-xs">Relato de la idea</Label>
        <Textarea value={data.story ?? ""} onChange={(e) => setField("story", e.target.value)} className="text-sm min-h-[80px]" />
      </div>
    </div>
  )
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
