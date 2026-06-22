import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Briefcase, Lightbulb, UserRound, Send } from "lucide-react"
import type { TestApi } from "@/lib/testApi"
import { BusinessModelCanvas } from "@/components/canvas/BusinessModelCanvas"
import { JOB_FIELDS, FREELANCE_FIELDS, type CanvasConfig } from "@/components/canvas/canvasModel"

// Standalone "Exploración" test (formerly "Modelo de Negocio"). The client develops
// an idea as a Business Model Canvas, a freelance/autonomous plan, or a job-research
// workspace. Idea pre-fills from the client's latest Tablero but is freely editable.

type Kind = "CANVAS" | "FREELANCE" | "JOB"

const DRAFT_KEY = (id: string) => `modelo-negocio-draft-${id}`

export function ModeloNegocioTest({
  api,
  assignmentId,
  prefillIdea,
}: {
  api: TestApi
  assignmentId: string
  prefillIdea?: string
}) {
  const { toast } = useToast()
  const [idea, setIdea] = useState(prefillIdea ?? "")
  const [kind, setKind] = useState<Kind | null>(null)
  const [content, setContent] = useState<Record<string, string>>({})
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>({})
  const [story, setStory] = useState("")
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Restore draft (and only fall back to the Tablero pre-fill when no draft idea).
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY(assignmentId))
    if (raw) {
      try {
        const d = JSON.parse(raw)
        if (typeof d.idea === "string" && d.idea) setIdea(d.idea)
        if (d.kind === "CANVAS" || d.kind === "JOB" || d.kind === "FREELANCE") setKind(d.kind)
        if (d.content && typeof d.content === "object") setContent(d.content)
        if (d.canvasConfig && typeof d.canvasConfig === "object") setCanvasConfig(d.canvasConfig)
        if (typeof d.story === "string") setStory(d.story)
      } catch {}
    }
  }, [assignmentId])

  const saveDraft = useCallback(() => {
    localStorage.setItem(
      DRAFT_KEY(assignmentId),
      JSON.stringify({ idea, kind, content, canvasConfig, story }),
    )
  }, [assignmentId, idea, kind, content, canvasConfig, story])

  useEffect(() => {
    const interval = setInterval(saveDraft, 30000)
    return () => clearInterval(interval)
  }, [saveDraft])

  function set(key: string, value: string) {
    setContent((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!kind || !idea.trim()) return
    setSaving(true)
    saveDraft()
    const res = await api.submit({
      kind,
      selectedIdea: idea.trim(),
      content,
      story: story.trim() || undefined,
      ...(kind === "CANVAS" ? { canvas: canvasConfig } : {}),
    })
    setSaving(false)
    if (res.ok) {
      localStorage.removeItem(DRAFT_KEY(assignmentId))
      toast({ title: "¡Enviado!" })
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Exploración</h1>
        <p className="text-sm text-muted-foreground">
          Explorá tu idea como un Modelo de Negocios Canvas, un camino freelance/autónomo o investigando un puesto de trabajo.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-white p-5">
        <label className="block text-sm text-muted-foreground">
          Idea a desarrollar
          <Input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Escribí la idea que vas a desarrollar..."
            className="mt-1 text-foreground"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Se pre-completa con la idea elegida en tu Tablero. Podés editarla si tu coach propuso cambios.
        </p>

        <div className="pt-2">
          <p className="text-sm text-muted-foreground mb-2">¿Qué camino querés explorar?</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant={kind === "CANVAS" ? "default" : "outline"}
              onClick={() => setKind("CANVAS")}
              className="flex-1"
            >
              <Lightbulb className="h-4 w-4 mr-2" /> Emprendimiento — Canvas
            </Button>
            <Button
              variant={kind === "FREELANCE" ? "default" : "outline"}
              onClick={() => setKind("FREELANCE")}
              className="flex-1"
            >
              <UserRound className="h-4 w-4 mr-2" /> Freelance / Autónomo
            </Button>
            <Button
              variant={kind === "JOB" ? "default" : "outline"}
              onClick={() => setKind("JOB")}
              className="flex-1"
            >
              <Briefcase className="h-4 w-4 mr-2" /> Empleo — Investigación
            </Button>
          </div>
        </div>
      </div>

      {kind === "CANVAS" && (
        <BusinessModelCanvas
          idea={idea}
          content={content}
          onChange={set}
          config={canvasConfig}
          onConfigChange={setCanvasConfig}
          story={story}
          onStoryChange={setStory}
        />
      )}

      {kind === "FREELANCE" && (
        <FieldsForm fields={FREELANCE_FIELDS} content={content} onChange={set} story={story} onStoryChange={setStory} />
      )}

      {kind === "JOB" && (
        <FieldsForm fields={JOB_FIELDS} content={content} onChange={set} story={story} onStoryChange={setStory} />
      )}

      {kind && (
        <Button
          onClick={handleSubmit}
          disabled={saving || !idea.trim()}
          className="bg-brand-accent hover:bg-brand-accent-dark"
        >
          <Send className="h-4 w-4 mr-2" /> {saving ? "Enviando..." : "Enviar"}
        </Button>
      )}
    </div>
  )
}

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
