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
import PiramideTest, { type PiramideEditInitial } from "@/pages/client/tests/PiramideTest"
import type { TestApi, UploadResult } from "@/lib/testApi"

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

  // Pirámide se edita con el mismo flujo del test (pills → elegir 3 →
  // especialidad por contexto), no con textareas sueltas, para preservar la
  // metodología. El componente usa su propio botón de submit → acá no va la
  // barra "Guardar cambios" genérica.
  if (testType === "PIRAMIDE_PROPOSITO") {
    return <PiramideEditorFull responses={responses} onSave={onSave} />
  }

  return (
    <div className="space-y-4">
      {testType === "ANCLAS_CARRERA" && <AnclasEditor data={data} setField={setField} />}
      {testType === "TABLERO_IDEAS" && <TableroEditor data={data} setField={setField} />}
      {testType === "MODELO_NEGOCIO" && <ModeloNegocioEditor data={data} setField={setField} />}
      {testType === "PLAN_VITAL" && <PlanVitalEditor data={data} setField={setField} />}
      {testType === "TAREAS_EXPLORACION" && <TareasExploracionEditor data={data} setField={setField} />}
      {testType === "COLLAGE" && <CollageEditor data={data} setField={setField} />}
      {testType === "OBJETIVO_CARRERA" && <ObjetivoCarreraEditor data={data} setField={setField} />}
      {testType === "PLAN_ACCION" && <PlanAccionEditor data={data} setField={setField} />}
      <Button onClick={save} disabled={saving} className="bg-brand-accent hover:bg-brand-accent-dark">
        <Save className="h-4 w-4 mr-2" /> {saving ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  )
}

type PillKey = "rol" | "valores" | "fortalezas" | "contextos"
const PIRAMIDE_KEYS: PillKey[] = ["rol", "valores", "fortalezas", "contextos"]

function buildPiramideInitial(responses: Record<string, unknown>): PiramideEditInitial {
  const pools: PiramideEditInitial["pools"] = {
    rol: [], valores: [], fortalezas: [], contextos: [],
  }
  const selected: PiramideEditInitial["selected"] = {
    rol: [], valores: [], fortalezas: [], contextos: [],
  }

  const poolKey = (k: PillKey) => (`${k}Pool`) as `${PillKey}Pool`
  for (const k of PIRAMIDE_KEYS) {
    const p = (responses as any)[poolKey(k)]
    if (Array.isArray(p)) {
      pools[k] = p.filter((s): s is string => typeof s === "string" && s.trim() !== "")
    }
    const sel = (responses as any)[k]
    if (typeof sel === "string" && sel.trim()) {
      selected[k] = sel.split(",").map((s) => s.trim()).filter(Boolean)
    }
  }
  // Legacy fallback: sin pool guardado, usamos las 3 elegidas como pool.
  // Y si una elegida no estuviera en el pool, la agregamos para que sea
  // seleccionable sin tener que re-escribirla.
  for (const k of PIRAMIDE_KEYS) {
    if (pools[k].length === 0 && selected[k].length > 0) {
      pools[k] = [...selected[k]]
      continue
    }
    for (const s of selected[k]) {
      if (!pools[k].some((p) => p.toLowerCase() === s.toLowerCase())) {
        pools[k].push(s)
      }
    }
  }

  let especialidades: Record<string, string> = {}
  const esMap = (responses as any).especialidadPorContexto
  if (esMap && typeof esMap === "object") {
    for (const [k, v] of Object.entries(esMap)) {
      if (typeof v === "string") especialidades[k] = v
    }
  }
  if (Object.keys(especialidades).length === 0 && typeof (responses as any).especialidad === "string") {
    const parts = (responses as any).especialidad.split(",").map((s: string) => s.trim())
    selected.contextos.forEach((c, i) => {
      if (parts[i]) especialidades[c] = parts[i]
    })
  }

  return { pools, selected, especialidades }
}

function PiramideEditorFull({
  responses,
  onSave,
}: {
  responses: Record<string, unknown>
  onSave: (responses: Record<string, unknown>) => Promise<void>
}) {
  const [initial] = useState<PiramideEditInitial>(() => buildPiramideInitial(responses))
  const [editSessionId] = useState(() => `edit-${Math.random().toString(36).slice(2)}`)

  // `PiramideTest` espera un `TestApi` real. Para el modo edición le pasamos
  // un stub que toma el payload (shape ya final de respuestas) y lo entrega
  // al onSave del padre; devolvemos una `Response` ok para que el componente
  // siga su flujo normal post-submit.
  const editApi: TestApi = {
    async submit(payload: unknown) {
      try {
        await onSave(payload as Record<string, unknown>)
        return new Response(null, { status: 200 })
      } catch {
        return new Response(null, { status: 500 })
      }
    },
    async aiInsight() { return { insight: null } },
    async aiIdeas() { return { ideas: [] } },
    async uploadFile(): Promise<{ ok: false; error: string } | { ok: true; data: UploadResult }> {
      return { ok: false, error: "No disponible en edición" }
    },
  }

  return (
    <PiramideTest api={editApi} assignmentId={editSessionId} editInitial={initial} />
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

// Collage: no se re-sube un archivo nuevo desde el editor de EditableResult —
// el editor sólo permite corregir el nombre del archivo y las notas que lo
// acompañan. Para cambiar el PDF/imagen, re-asignar el test es más limpio
// que inyectar un endpoint de upload en un componente genérico que no sabe
// de token/sesión.
function CollageEditor({ data, setField }: { data: Data; setField: (k: string, v: unknown) => void }) {
  const fileUrl = typeof data.fileUrl === "string" ? data.fileUrl : ""
  const fileName = typeof data.fileName === "string" ? data.fileName : ""
  return (
    <div className="space-y-3">
      {fileUrl && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Archivo subido:{" "}
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-accent hover:underline"
          >
            {fileName || "ver archivo"} ↗
          </a>
          <p className="mt-1 italic">
            Para cambiar el archivo re-asigná el test — este editor sólo corrige
            el nombre y las notas.
          </p>
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">Nombre del archivo</Label>
        <Input
          value={data.fileName ?? ""}
          onChange={(e) => setField("fileName", e.target.value)}
          className="text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notas</Label>
        <Textarea
          value={data.notes ?? ""}
          onChange={(e) => setField("notes", e.target.value)}
          className="text-sm min-h-[80px]"
        />
      </div>
    </div>
  )
}

const OBJETIVO_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: "puesto", label: "Puesto / Rol / Función" },
  { key: "tareas", label: "Tareas", multiline: true },
  { key: "area", label: "Área" },
  { key: "tipoOrganizacion", label: "Tipo de organización / Negocio" },
  { key: "rubro", label: "Rubro / Nicho" },
  { key: "condiciones", label: "Condiciones de satisfacción", multiline: true },
  { key: "valores", label: "Valores centrales" },
]

function ObjetivoCarreraEditor({ data, setField }: { data: Data; setField: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      {OBJETIVO_FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label className="text-xs">{f.label}</Label>
          {f.multiline ? (
            <Textarea
              value={data[f.key] ?? ""}
              onChange={(e) => setField(f.key, e.target.value)}
              className="text-sm min-h-[70px]"
            />
          ) : (
            <Input
              value={data[f.key] ?? ""}
              onChange={(e) => setField(f.key, e.target.value)}
              className="text-sm"
            />
          )}
        </div>
      ))}
      <div className="space-y-1">
        <Label className="text-xs">Síntesis (frase final — regenerá a mano si corregís los campos)</Label>
        <Textarea
          value={data.sintesis ?? ""}
          onChange={(e) => setField("sintesis", e.target.value)}
          className="text-sm min-h-[90px]"
        />
      </div>
    </div>
  )
}

type PlanObjetivo = {
  titulo?: string
  accion?: string
  recursos?: string
  tiempo?: string
  soporte?: string
}

function PlanAccionEditor({ data, setField }: { data: Data; setField: (k: string, v: unknown) => void }) {
  const objetivos: PlanObjetivo[] = Array.isArray(data.objetivos) ? data.objetivos : []
  const setObjetivo = (i: number, patch: PlanObjetivo) => {
    setField(
      "objetivos",
      objetivos.map((o, idx) => (idx === i ? { ...o, ...patch } : o)),
    )
  }
  const addObjetivo = () =>
    setField("objetivos", [
      ...objetivos,
      { titulo: "", accion: "", recursos: "", tiempo: "", soporte: "" },
    ])
  const removeObjetivo = (i: number) =>
    setField("objetivos", objetivos.filter((_, idx) => idx !== i))
  const moveObjetivo = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= objetivos.length) return
    const next = [...objetivos]
    ;[next[i], next[j]] = [next[j], next[i]]
    setField("objetivos", next)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Estrategia</Label>
        <Textarea
          value={data.estrategia ?? ""}
          onChange={(e) => setField("estrategia", e.target.value)}
          className="text-sm min-h-[80px]"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Objetivo general</Label>
        <Textarea
          value={data.objetivoGeneral ?? ""}
          onChange={(e) => setField("objetivoGeneral", e.target.value)}
          className="text-sm min-h-[80px]"
        />
      </div>
      <div className="space-y-3">
        <Label className="text-xs">Objetivos específicos</Label>
        {objetivos.map((o, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] uppercase tracking-wide text-brand-accent">
                Objetivo {i + 1}
              </span>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveObjetivo(i, -1)}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveObjetivo(i, 1)}>
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeObjetivo(i)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <Input
              value={o.titulo ?? ""}
              onChange={(e) => setObjetivo(i, { titulo: e.target.value })}
              placeholder="Título"
              className="text-sm"
            />
            <Textarea
              value={o.accion ?? ""}
              onChange={(e) => setObjetivo(i, { accion: e.target.value })}
              placeholder="¿Qué voy a hacer? (acción)"
              className="text-sm min-h-[60px]"
            />
            <Textarea
              value={o.recursos ?? ""}
              onChange={(e) => setObjetivo(i, { recursos: e.target.value })}
              placeholder="¿Qué necesito? (recursos)"
              className="text-sm min-h-[60px]"
            />
            <Input
              value={o.tiempo ?? ""}
              onChange={(e) => setObjetivo(i, { tiempo: e.target.value })}
              placeholder="Tiempo (fechas)"
              className="text-sm"
            />
            <Input
              value={o.soporte ?? ""}
              onChange={(e) => setObjetivo(i, { soporte: e.target.value })}
              placeholder="Soporte / Feedback"
              className="text-sm"
            />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addObjetivo}>
          <Plus className="h-3 w-3 mr-1" /> Agregar objetivo
        </Button>
      </div>
    </div>
  )
}
