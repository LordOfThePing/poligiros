import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Plus, X, ChevronUp, ChevronDown, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { TestApi } from "@/lib/testApi"
import { loadDraft, discardDraft, useAutosave } from "@/lib/draft"

interface PrefillObjetivo {
  objetivoGeneral: string
}

interface PlanAccionTestProps {
  api: TestApi
  assignmentId: string
  prefillObjetivo?: PrefillObjetivo
}

type Objetivo = {
  titulo: string
  accion: string
  recursos: string
  tiempo: string
  soporte: string
}

type Form = {
  estrategia: string
  objetivoGeneral: string
  objetivos: Objetivo[]
}

const EMPTY_OBJETIVO: Objetivo = {
  titulo: "",
  accion: "",
  recursos: "",
  tiempo: "",
  soporte: "",
}

const EMPTY: Form = {
  estrategia: "",
  objetivoGeneral: "",
  objetivos: [{ ...EMPTY_OBJETIVO }, { ...EMPTY_OBJETIVO }, { ...EMPTY_OBJETIVO }],
}

const DRAFT_KEY = (id: string) => `plan-accion-draft-${id}`

export default function PlanAccionTest({
  api,
  assignmentId,
  prefillObjetivo,
}: PlanAccionTestProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const d = loadDraft<Partial<Form>>(DRAFT_KEY(assignmentId))
    if (d && (d.estrategia || d.objetivoGeneral || (d.objetivos?.length ?? 0) > 0)) {
      setForm({
        estrategia: d.estrategia ?? "",
        objetivoGeneral: d.objetivoGeneral ?? "",
        objetivos:
          Array.isArray(d.objetivos) && d.objetivos.length > 0
            ? d.objetivos.map((o) => ({ ...EMPTY_OBJETIVO, ...o }))
            : EMPTY.objetivos.map((o) => ({ ...o })),
      })
    } else if (prefillObjetivo?.objetivoGeneral) {
      setForm({
        ...EMPTY,
        objetivoGeneral: prefillObjetivo.objetivoGeneral,
        objetivos: EMPTY.objetivos.map((o) => ({ ...o })),
      })
    }
    setHydrated(true)
  }, [assignmentId, prefillObjetivo])

  useAutosave(DRAFT_KEY(assignmentId), form, hydrated && !submitted)

  function setObjetivo(i: number, patch: Partial<Objetivo>) {
    setForm((prev) => ({
      ...prev,
      objetivos: prev.objetivos.map((o, idx) => (idx === i ? { ...o, ...patch } : o)),
    }))
  }

  function addObjetivo() {
    setForm((prev) => ({ ...prev, objetivos: [...prev.objetivos, { ...EMPTY_OBJETIVO }] }))
  }

  function removeObjetivo(i: number) {
    setForm((prev) => ({
      ...prev,
      objetivos: prev.objetivos.filter((_, idx) => idx !== i),
    }))
  }

  function moveObjetivo(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= form.objetivos.length) return
    const next = [...form.objetivos]
    ;[next[i], next[j]] = [next[j], next[i]]
    setForm((prev) => ({ ...prev, objetivos: next }))
  }

  const filledObjetivos = form.objetivos.filter(
    (o) => o.accion.trim() || o.titulo.trim() || o.recursos.trim() || o.tiempo.trim() || o.soporte.trim(),
  )
  const canSubmit =
    form.estrategia.trim().length > 0 &&
    form.objetivoGeneral.trim().length > 0 &&
    filledObjetivos.length > 0 &&
    filledObjetivos.every((o) => o.accion.trim().length > 0)

  async function submit() {
    setSaving(true)
    const payload = {
      estrategia: form.estrategia,
      objetivoGeneral: form.objetivoGeneral,
      objetivos: filledObjetivos,
    }
    const res = await api.submit(payload)
    setSaving(false)
    if (res.ok) {
      discardDraft(DRAFT_KEY(assignmentId))
      setSubmitted(true)
    } else {
      toast({ title: "Error al enviar", variant: "destructive" })
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-3">
        <p className="text-4xl">✓</p>
        <h2 className="font-serif text-2xl text-foreground">¡Plan de Acción enviado!</h2>
        <p className="text-muted-foreground">Tu plan quedó guardado y le llegó a tu coach.</p>
      </div>
    )
  }

  const hasObjetivoPrefill = Boolean(prefillObjetivo?.objetivoGeneral)

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto">
      <div>
        <h2 className="font-serif text-2xl text-foreground mb-1">Plan de Acción</h2>
        <p className="text-sm text-muted-foreground">
          Definí tu estrategia, tu objetivo general y los objetivos específicos que
          se desprenden. Para cada uno anotá qué vas a hacer, qué necesitás, para
          cuándo y quién te ayuda.
        </p>
      </div>

      {hasObjetivoPrefill && (
        <div className="flex items-start gap-2 rounded-lg border border-brand-accent/20 bg-brand-accent/5 px-3 py-2.5 text-sm text-foreground">
          <Sparkles className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
          <p>
            Pre-llenamos el <strong>objetivo general</strong> con la frase que armaste en tu
            Objetivo de Carrera. Es editable — ajustala si para este plan te hace
            falta recortarla o reformularla.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-border p-5 space-y-2">
        <Label className="text-sm font-serif text-foreground">Estrategia</Label>
        <p className="text-xs text-muted-foreground">
          Describí en pocas líneas la estrategia general que vas a seguir.
        </p>
        <Textarea
          value={form.estrategia}
          onChange={(e) => setForm((p) => ({ ...p, estrategia: e.target.value }))}
          placeholder="Ej.: construir una red de referentes del sector, aprender haciendo..."
          className="text-sm min-h-[90px]"
        />
      </div>

      <div className="bg-white rounded-xl border border-border p-5 space-y-2">
        <Label className="text-sm font-serif text-foreground">Objetivo general</Label>
        <p className="text-xs text-muted-foreground">
          A dónde querés llegar — un objetivo claro y acotado.
        </p>
        <Textarea
          value={form.objetivoGeneral}
          onChange={(e) => setForm((p) => ({ ...p, objetivoGeneral: e.target.value }))}
          placeholder="Ej.: en 6 meses tener un rol de..."
          className="text-sm min-h-[90px]"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-serif text-lg text-foreground">Objetivos específicos</h3>
          <span className="text-xs text-muted-foreground">
            {form.objetivos.length} {form.objetivos.length === 1 ? "objetivo" : "objetivos"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Son los objetivos que se desprenden del general. Para cada uno anotá qué
          vas a hacer concretamente, qué necesitás, para cuándo y quién te ayuda.
        </p>

        {form.objetivos.map((o, i) => (
          <div key={i} className="bg-white rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs uppercase tracking-wide text-brand-accent">
                Objetivo {i + 1}
              </Label>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => moveObjetivo(i, -1)}
                  disabled={i === 0}
                  className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Subir"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveObjetivo(i, 1)}
                  disabled={i === form.objetivos.length - 1}
                  className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Bajar"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {form.objetivos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeObjetivo(i)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    aria-label="Quitar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Objetivo (título)</Label>
              <Input
                value={o.titulo}
                onChange={(e) => setObjetivo(i, { titulo: e.target.value })}
                placeholder="Ej.: Conseguir 3 entrevistas en el sector"
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">¿Qué voy a hacer? (acción)</Label>
                <Textarea
                  value={o.accion}
                  onChange={(e) => setObjetivo(i, { accion: e.target.value })}
                  placeholder="Acción concreta..."
                  className="text-sm min-h-[70px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">¿Qué necesito? (recursos)</Label>
                <Textarea
                  value={o.recursos}
                  onChange={(e) => setObjetivo(i, { recursos: e.target.value })}
                  placeholder="Materiales, dinero, info..."
                  className="text-sm min-h-[70px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tiempo (fechas)</Label>
                <Input
                  value={o.tiempo}
                  onChange={(e) => setObjetivo(i, { tiempo: e.target.value })}
                  placeholder="Ej.: antes del 15/12"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Soporte / feedback (¿quién me ayuda?)
                </Label>
                <Input
                  value={o.soporte}
                  onChange={(e) => setObjetivo(i, { soporte: e.target.value })}
                  placeholder="Mentor, amigos, red profesional..."
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={addObjetivo} className="w-full">
          <Plus className="h-3 w-3 mr-1" /> Agregar otro objetivo
        </Button>
      </div>

      <Button
        className="w-full bg-brand-accent hover:bg-brand-accent-dark"
        disabled={!canSubmit || saving}
        onClick={submit}
      >
        {saving ? "Enviando..." : "Enviar plan de acción"}
      </Button>
      {!canSubmit && (
        <p className="text-xs text-muted-foreground text-center">
          Necesitás estrategia, objetivo general y al menos un objetivo con acción.
        </p>
      )}
    </div>
  )
}
