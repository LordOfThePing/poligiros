import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Briefcase, Lightbulb, UserRound, Send, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TestApi } from "@/lib/testApi"
import { BusinessModelCanvas } from "@/components/canvas/BusinessModelCanvas"
import { JOB_FIELDS, FREELANCE_FIELDS, type CanvasConfig } from "@/components/canvas/canvasModel"

type Kind = "CANVAS" | "FREELANCE" | "JOB"

interface IdeaState {
  idea: string
  kind: Kind | null
  content: Record<string, string>
  canvasConfig: CanvasConfig
  story: string
}

const emptyIdea = (): IdeaState => ({ idea: "", kind: null, content: {}, canvasConfig: {}, story: "" })

const DRAFT_KEY = (id: string) => `modelo-negocio-draft-${id}`

export function ModeloNegocioTest({
  api,
  assignmentId,
  prefillIdeas = [],
}: {
  api: TestApi
  assignmentId: string
  prefillIdeas?: string[]
}) {
  const { toast } = useToast()
  const [primary, setPrimary] = useState<IdeaState>(emptyIdea)
  const [addSecond, setAddSecond] = useState(false)
  const [secondary, setSecondary] = useState<IdeaState>(emptyIdea)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY(assignmentId))
    if (raw) {
      try {
        const d = JSON.parse(raw)
        if (d.primary) setPrimary((prev) => ({ ...prev, ...d.primary }))
        if (typeof d.addSecond === "boolean") setAddSecond(d.addSecond)
        if (d.secondary) setSecondary((prev) => ({ ...prev, ...d.secondary }))
      } catch {}
    } else if (prefillIdeas.length > 0) {
      // Pre-select the first idea (the one they chose in Tablero)
      setPrimary((p) => ({ ...p, idea: prefillIdeas[0] }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId])

  const saveDraft = useCallback(() => {
    localStorage.setItem(
      DRAFT_KEY(assignmentId),
      JSON.stringify({ primary, addSecond, secondary }),
    )
  }, [assignmentId, primary, addSecond, secondary])

  useEffect(() => {
    const interval = setInterval(saveDraft, 30_000)
    return () => clearInterval(interval)
  }, [saveDraft])

  async function handleSubmit() {
    if (!primary.kind || !primary.idea.trim()) return
    if (addSecond && (!secondary.kind || !secondary.idea.trim())) {
      toast({ title: "Completá la idea y el camino de la segunda idea antes de enviar", variant: "destructive" })
      return
    }
    setSaving(true)
    saveDraft()

    const buildIdea = (s: IdeaState, horizon: "short" | "long") => ({
      horizon,
      selectedIdea: s.idea.trim(),
      kind: s.kind,
      content: s.content,
      story: s.story.trim() || undefined,
      ...(s.kind === "CANVAS" ? { canvas: s.canvasConfig } : {}),
    })

    const ideas = [
      buildIdea(primary, "short"),
      ...(addSecond ? [buildIdea(secondary, "long")] : []),
    ]

    const res = await api.submit({ ideas })
    setSaving(false)
    if (res.ok) {
      localStorage.removeItem(DRAFT_KEY(assignmentId))
      setSubmitted(true)
    } else {
      toast({ title: "Error al enviar", variant: "destructive" })
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <p className="text-4xl">✓</p>
        <h2 className="font-serif text-2xl">¡Enviado!</h2>
        <p className="text-muted-foreground">Tu trabajo fue guardado correctamente.</p>
      </div>
    )
  }

  const horizonLabel = (h: "short" | "long") =>
    h === "short" ? (addSecond ? "Corto / mediano plazo" : null) : "Largo plazo"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Exploración</h1>
        <p className="text-sm text-muted-foreground">
          Explorá tu idea como un Modelo de Negocios Canvas, un camino freelance/autónomo o investigando un puesto de trabajo.
        </p>
      </div>

      <IdeaWorkspace
        ideas={prefillIdeas}
        state={primary}
        onChange={setPrimary}
        horizon={addSecond ? "short" : undefined}
      />

      {/* Second idea toggle */}
      {primary.kind && primary.idea.trim() && !addSecond && (
        <button
          onClick={() => setAddSecond(true)}
          className="flex items-center gap-2 text-sm text-brand-accent hover:text-brand-accent-dark transition-colors"
        >
          <Plus className="h-4 w-4" />
          Agregar una segunda idea para explorar a largo plazo
        </button>
      )}

      {addSecond && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Segunda idea — Largo plazo</p>
            <button onClick={() => { setAddSecond(false); setSecondary(emptyIdea()) }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <IdeaWorkspace
            ideas={prefillIdeas}
            state={secondary}
            onChange={setSecondary}
            horizon="long"
          />
        </div>
      )}

      {primary.kind && primary.idea.trim() && (
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-brand-accent hover:bg-brand-accent-dark"
        >
          <Send className="h-4 w-4 mr-2" /> {saving ? "Enviando..." : "Enviar"}
        </Button>
      )}
    </div>
  )
}

// ── IdeaWorkspace ─────────────────────────────────────────────────────────────
// One idea: pick an idea → pick a kind → fill the form.

function IdeaWorkspace({
  ideas,
  state,
  onChange,
  horizon,
}: {
  ideas: string[]
  state: IdeaState
  onChange: (s: IdeaState) => void
  horizon?: "short" | "long"
}) {
  const set = (patch: Partial<IdeaState>) => onChange({ ...state, ...patch })
  const setContent = (key: string, value: string) =>
    set({ content: { ...state.content, [key]: value } })

  const horizonLabel =
    horizon === "short" ? "Corto / mediano plazo" : horizon === "long" ? "Largo plazo" : null

  return (
    <div className="space-y-4">
      {/* Idea picker */}
      <div className="rounded-xl border border-border bg-white p-5 space-y-3">
        {horizonLabel && (
          <p className="text-xs font-medium text-brand-accent uppercase tracking-wide">{horizonLabel}</p>
        )}
        <p className="text-sm font-medium text-foreground">¿Qué idea vas a explorar?</p>

        {ideas.length > 0 && (
          <div className="grid gap-2">
            {ideas.map((idea) => (
              <button
                key={idea}
                onClick={() => set({ idea })}
                className={cn(
                  "text-left rounded-lg border px-4 py-3 text-sm transition-colors",
                  state.idea === idea
                    ? "border-brand-accent bg-brand-accent/10 text-foreground font-medium"
                    : "border-border bg-white text-muted-foreground hover:border-brand-accent/50",
                )}
              >
                {idea}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1">
          {ideas.length > 0 && (
            <p className="text-xs text-muted-foreground">O escribí una idea diferente:</p>
          )}
          <Input
            value={ideas.includes(state.idea) ? "" : state.idea}
            onChange={(e) => set({ idea: e.target.value })}
            onFocus={() => { if (ideas.includes(state.idea)) set({ idea: "" }) }}
            placeholder={ideas.length > 0 ? "Otra idea..." : "Escribí la idea a explorar..."}
            className="text-foreground"
          />
        </div>

        {/* Kind picker — only shows once an idea is chosen */}
        {state.idea.trim() && (
          <div className="pt-1 space-y-2">
            <p className="text-sm text-muted-foreground">¿Qué camino querés explorar?</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant={state.kind === "CANVAS" ? "default" : "outline"}
                onClick={() => set({ kind: "CANVAS" })}
                className="flex-1"
              >
                <Lightbulb className="h-4 w-4 mr-2" /> Emprendimiento — Canvas
              </Button>
              <Button
                variant={state.kind === "FREELANCE" ? "default" : "outline"}
                onClick={() => set({ kind: "FREELANCE" })}
                className="flex-1"
              >
                <UserRound className="h-4 w-4 mr-2" /> Freelance / Autónomo
              </Button>
              <Button
                variant={state.kind === "JOB" ? "default" : "outline"}
                onClick={() => set({ kind: "JOB" })}
                className="flex-1"
              >
                <Briefcase className="h-4 w-4 mr-2" /> Empleo — Investigación
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Form — shows once kind is chosen */}
      {state.kind === "CANVAS" && (
        <BusinessModelCanvas
          idea={state.idea}
          content={state.content}
          onChange={setContent}
          config={state.canvasConfig}
          onConfigChange={(cfg) => set({ canvasConfig: cfg })}
          story={state.story}
          onStoryChange={(v) => set({ story: v })}
        />
      )}
      {state.kind === "FREELANCE" && (
        <FieldsForm
          fields={FREELANCE_FIELDS}
          content={state.content}
          onChange={setContent}
          story={state.story}
          onStoryChange={(v) => set({ story: v })}
        />
      )}
      {state.kind === "JOB" && (
        <FieldsForm
          fields={JOB_FIELDS}
          content={state.content}
          onChange={setContent}
          story={state.story}
          onStoryChange={(v) => set({ story: v })}
        />
      )}
    </div>
  )
}

// ── FieldsForm ────────────────────────────────────────────────────────────────

function FieldsForm({
  fields,
  content,
  onChange,
  story,
  onStoryChange,
}: {
  fields: { key: string; label: string; placeholder: string }[]
  content: Record<string, string>
  onChange: (key: string, value: string) => void
  story: string
  onStoryChange: (value: string) => void
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-white p-5">
      {fields.map((f) => (
        <div key={f.key}>
          <p className="text-xs font-medium text-muted-foreground mb-1">{f.label}</p>
          <Textarea
            value={content[f.key] ?? ""}
            onChange={(e) => onChange(f.key, e.target.value)}
            placeholder={f.placeholder}
            className="text-sm min-h-[80px]"
          />
        </div>
      ))}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Contá tu idea</p>
        <Textarea
          value={story}
          onChange={(e) => onStoryChange(e.target.value)}
          placeholder="Describí tu idea en un breve relato: el problema que resolvés, cómo encaja todo y por qué te entusiasma."
          className="text-sm min-h-[100px]"
        />
      </div>
    </div>
  )
}
