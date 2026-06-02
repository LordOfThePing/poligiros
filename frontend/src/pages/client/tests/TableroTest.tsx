import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Plus, X, Sparkles, Check } from "lucide-react"
import { SortableList, type RankItem } from "@/components/tablero/SortableList"

const API_URL = import.meta.env.VITE_API_URL as string
const DRAFT_KEY = (id: string) => `tablero-ideas-draft-${id}`

// Stable, within-session unique id for ranked items (values may be duplicate
// strings, so we can't key dnd-kit on the text).
let idCounter = 0
const uid = () => `it-${++idCounter}`

const COLUMNS = [
  {
    key: "saber" as const,
    title: "SABER",
    subtitle: "Mi experiencia específica",
    hint: "Principales áreas de experiencia, funciones/roles/tareas en las que tengo experiencia laboral (formal, informal, ad-honorem, voluntariado)",
    header: "bg-brand-accent",
    placeholder: "Ej: Preparar reportes financieros",
  },
  {
    key: "querer" as const,
    title: "QUERER",
    subtitle: "Acciones en las que fluyo",
    hint: "Todo lo que me gusta hacer, actividades que disfruto, tanto de mi vida personal como laboral (hobbies, actividades informales)",
    header: "bg-brand-secondary",
    placeholder: "Ej: Mountain bike",
  },
  {
    key: "sonar" as const,
    title: "SOÑAR",
    subtitle: "Aspiraciones a futuro",
    hint: "Aspiraciones futuras respecto de lo que me gustaría hacer. Conocimientos/aprendizajes que desearía adquirir.",
    header: "bg-indigo-600",
    placeholder: "Ej: Aprender a tirarme en paracaídas",
  },
]

const toItems = (values: string[]): RankItem[] =>
  values.map((s) => s.trim()).filter(Boolean).map((text) => ({ id: uid(), text }))

interface TableroTestProps {
  token: string
  assignmentId: string
}

export default function TableroTest({ token, assignmentId }: TableroTestProps) {
  const { toast } = useToast()

  const [step, setStep] = useState(1)

  // ── Step 1: dynamic input lists (variable length, start with 5 rows) ────────
  const [saber, setSaber] = useState<string[]>(Array(5).fill(""))
  const [querer, setQuerer] = useState<string[]>(Array(5).fill(""))
  const [sonar, setSonar] = useState<string[]>(Array(5).fill(""))
  const [brainstorming, setBrainstorming] = useState("")
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // ── Step 2/3: derived items with stable ids ────────────────────────────────
  const [saberItems, setSaberItems] = useState<RankItem[]>([])
  const [quererItems, setQuererItems] = useState<RankItem[]>([])
  const [sonarItems, setSonarItems] = useState<RankItem[]>([])
  const [passionIds, setPassionIds] = useState<Set<string>>(new Set())
  const [saberRank, setSaberRank] = useState<RankItem[]>([])
  const [quererRank, setQuererRank] = useState<RankItem[]>([])
  const [sonarRank, setSonarRank] = useState<RankItem[]>([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  // [T6] Draft load with old-format migration. The draft only persists the
  // step-1 string columns + brainstorming, so old-format drafts load cleanly —
  // any missing field falls back to a default.
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY(assignmentId))
    if (!raw) return
    try {
      const d = JSON.parse(raw)
      if (Array.isArray(d.saber) && d.saber.length) setSaber(d.saber)
      if (Array.isArray(d.querer) && d.querer.length) setQuerer(d.querer)
      if (Array.isArray(d.sonar) && d.sonar.length) setSonar(d.sonar)
      if (typeof d.brainstorming === "string") setBrainstorming(d.brainstorming)
    } catch {}
  }, [assignmentId])

  const saveDraft = useCallback(() => {
    localStorage.setItem(DRAFT_KEY(assignmentId), JSON.stringify({ saber, querer, sonar, brainstorming }))
    setLastSaved(new Date())
  }, [assignmentId, saber, querer, sonar, brainstorming])

  useEffect(() => {
    const interval = setInterval(saveDraft, 30000)
    return () => clearInterval(interval)
  }, [saveDraft])

  // ── Step 1 helpers ──────────────────────────────────────────────────────────
  function colState(key: (typeof COLUMNS)[number]["key"]) {
    if (key === "saber") return [saber, setSaber] as const
    if (key === "querer") return [querer, setQuerer] as const
    return [sonar, setSonar] as const
  }

  function updateRow(setter: React.Dispatch<React.SetStateAction<string[]>>, i: number, value: string) {
    setter((prev) => prev.map((v, idx) => (idx === i ? value : v)))
  }
  function addRow(setter: React.Dispatch<React.SetStateAction<string[]>>) {
    setter((prev) => [...prev, ""])
  }
  function removeRow(setter: React.Dispatch<React.SetStateAction<string[]>>, i: number) {
    setter((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Step transitions ────────────────────────────────────────────────────────
  function goToStep2() {
    const sItems = toItems(saber)
    const qItems = toItems(querer)
    const nItems = toItems(sonar)
    if (!sItems.length || !qItems.length || !nItems.length) {
      toast({ title: "Completá al menos una idea en cada columna", variant: "destructive" })
      return
    }
    setSaberItems(sItems)
    setQuererItems(qItems)
    setSonarItems(nItems)
    setQuererRank(qItems)
    setSonarRank(nItems)
    setPassionIds(new Set())
    setSaberRank([])
    setStep(2)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function togglePassion(item: RankItem) {
    const next = new Set(passionIds)
    if (next.has(item.id)) {
      next.delete(item.id)
      setSaberRank((r) => r.filter((x) => x.id !== item.id))
    } else {
      next.add(item.id)
      setSaberRank((r) => [...r, item])
    }
    setPassionIds(next)
  }

  function goToStep3() {
    if (saberRank.length === 0) {
      toast({ title: "Marcá al menos una idea que te apasione", variant: "destructive" })
      return
    }
    setStep(3)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleSubmit() {
    setSaving(true)
    const responses = {
      saber: saberItems.map((i) => i.text),
      saberPassion: saberItems.map((i) => passionIds.has(i.id)),
      saberRanking: saberRank.map((i) => i.text), // [T5] strings, not indices
      querer: quererItems.map((i) => i.text),
      quererRanking: quererRank.map((i) => i.text),
      sonar: sonarItems.map((i) => i.text),
      sonarRanking: sonarRank.map((i) => i.text),
      brainstorming,
    }

    try {
      const res = await fetch(`${API_URL}/client/t/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ responses }),
      })
      if (res.ok) {
        localStorage.removeItem(DRAFT_KEY(assignmentId))
        setDone(true)
        window.scrollTo({ top: 0, behavior: "smooth" })
      } else if (res.status === 409) {
        toast({ title: "Ya completaste este test", variant: "destructive" })
      } else {
        toast({ title: "Error al enviar", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error de red", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-3">
        <p className="text-4xl">✓</p>
        <h2 className="font-serif text-2xl text-foreground">¡Tablero enviado!</h2>
        <p className="text-muted-foreground">Tus respuestas fueron guardadas correctamente.</p>
      </div>
    )
  }

  const stepPct = Math.round((step / 3) * 100)

  return (
    <div className="space-y-8 pb-24">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Tablero de Ideas</h1>
        <p className="text-sm text-muted-foreground">
          {step === 1 && "Completá las tres columnas con tus ideas"}
          {step === 2 && "Marcá lo que te apasiona y ordená tus ideas"}
          {step === 3 && "Conectá los datos en tu brainstorming"}
          {lastSaved && step === 1 && (
            <span className="ml-2 text-xs text-green-600">· Guardado automáticamente</span>
          )}
        </p>
      </div>

      {/* ── Step 1: three dynamic columns ── */}
      {step === 1 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {COLUMNS.map((col) => {
              const [values, setter] = colState(col.key)
              return (
                <div key={col.key} className="space-y-3">
                  <div className={cn("text-white rounded-lg px-4 py-3", col.header)}>
                    <h2 className="font-serif text-lg font-medium">{col.title}</h2>
                    <p className="text-xs mt-0.5 opacity-90">{col.subtitle}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{col.hint}</p>
                  <div className="space-y-2">
                    {values.map((val, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <Input
                          value={val}
                          onChange={(e) => updateRow(setter, i, e.target.value)}
                          placeholder={col.placeholder}
                          className="text-sm"
                        />
                        {values.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(setter, i)}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            aria-label="Quitar"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => addRow(setter)} className="w-full">
                    <Plus className="h-3 w-3 mr-1" /> Agregar
                  </Button>
                </div>
              )
            })}
          </div>
          <StepBar step={step} pct={stepPct}>
            <Button onClick={goToStep2} className="bg-brand-accent hover:bg-brand-accent-dark">
              Continuar →
            </Button>
          </StepBar>
        </>
      )}

      {/* ── Step 2: passion marking + ranking ── */}
      {step === 2 && (
        <>
          <section className="space-y-4">
            <div>
              <h2 className="font-serif text-xl text-foreground">SABER: marcá las que te apasionan</h2>
              <p className="text-sm text-muted-foreground">Tocá las ideas que más te entusiasman, después ordenalas por importancia.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {saberItems.map((item) => {
                const selected = passionIds.has(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePassion(item)}
                    className={cn(
                      "text-left text-sm rounded-lg border px-3 py-2 transition-colors flex items-center gap-2",
                      selected
                        ? "border-brand-accent bg-brand-accent/10 text-foreground animate-sparkle-pulse"
                        : "border-border bg-white hover:border-brand-accent/50",
                    )}
                  >
                    {selected ? (
                      <Check className="h-4 w-4 text-brand-accent shrink-0" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span>{item.text}</span>
                  </button>
                )
              })}
            </div>

            {saberRank.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ordená tus pasiones</p>
                <SortableList
                  items={saberRank}
                  onReorder={setSaberRank}
                  renderItem={(item, index) => (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-accent text-xs text-white shrink-0">
                        {index + 1}
                      </span>
                      <span>{item.text}</span>
                    </div>
                  )}
                />
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="font-serif text-lg text-foreground">QUERER: ordenalas</h3>
              <SortableList
                items={quererRank}
                onReorder={setQuererRank}
                renderItem={(item, index) => (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-secondary text-xs text-white shrink-0">
                      {index + 1}
                    </span>
                    <span>{item.text}</span>
                  </div>
                )}
              />
            </div>
            <div className="space-y-2">
              <h3 className="font-serif text-lg text-foreground">SOÑAR: ordenalas</h3>
              <SortableList
                items={sonarRank}
                onReorder={setSonarRank}
                renderItem={(item, index) => (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs text-white shrink-0">
                      {index + 1}
                    </span>
                    <span>{item.text}</span>
                  </div>
                )}
              />
            </div>
          </section>

          <StepBar step={step} pct={stepPct}>
            <Button variant="outline" onClick={() => setStep(1)}>← Atrás</Button>
            <Button onClick={goToStep3} className="bg-brand-accent hover:bg-brand-accent-dark">Continuar →</Button>
          </StepBar>
        </>
      )}

      {/* ── Step 3: brainstorming with ranked reference ── */}
      {step === 3 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-[35%_1fr] gap-6">
            <aside className="space-y-4 md:sticky md:top-4 md:self-start">
              <p className="font-serif text-lg text-foreground">Conectando datos →</p>
              <RankedChips title="Mis apasionantes (SABER)" items={saberRank} chip="bg-brand-accent/10 text-brand-accent" />
              <RankedChips title="Lo que quiero hacer (QUERER)" items={quererRank} chip="bg-brand-secondary/10 text-brand-secondary" />
              <RankedChips title="Mis aspiraciones (SOÑAR)" items={sonarRank} chip="bg-indigo-100 text-indigo-700" />
            </aside>

            <div className="space-y-3">
              <div className="bg-gray-800 text-white rounded-lg px-4 py-3">
                <h2 className="font-serif text-lg font-medium">BRAINSTORMING: Conectando Datos</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                A partir de unir, mezclar los datos de las tres columnas, escribí todas las posibilidades que se te ocurren:
                nuevas ideas de negocio, trabajos, ocupaciones, proyectos laborales que te resultan atractivos. No descartes
                ninguna posibilidad por considerarla difícil o inviable.
              </p>
              <Textarea
                value={brainstorming}
                onChange={(e) => setBrainstorming(e.target.value)}
                placeholder="Escribí todas tus ideas aquí..."
                className="min-h-[240px] text-sm"
              />
            </div>
          </div>

          <StepBar step={step} pct={stepPct}>
            <Button variant="outline" onClick={() => setStep(2)}>← Atrás</Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-brand-accent hover:bg-brand-accent-dark flex-1">
              {saving ? "Enviando..." : "Enviar tablero"}
            </Button>
          </StepBar>
        </>
      )}
    </div>
  )
}

function StepBar({ step, pct, children }: { step: number; pct: number; children: React.ReactNode }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-white/95 backdrop-blur px-4 py-3 z-10">
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-1">Paso {step} de 3</p>
          <Progress value={pct} className="h-1.5" />
        </div>
        <div className="flex gap-2 shrink-0">{children}</div>
      </div>
    </div>
  )
}

function RankedChips({ title, items, chip }: { title: string; items: RankItem[]; chip: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">—</p>
      ) : (
        <ol className="space-y-1">
          {items.map((item, i) => (
            <li key={item.id} className={cn("text-xs rounded-md px-2 py-1 flex items-center gap-1.5", chip)}>
              <span className="font-semibold">{i + 1}.</span>
              <span>{item.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
