import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Plus, X, Sparkles, Check, Heart, AlertTriangle } from "lucide-react"
import { SortableList, type RankItem } from "@/components/tablero/SortableList"
import type { TestApi } from "@/lib/testApi"

const DRAFT_KEY = (id: string) => `tablero-ideas-draft-${id}`

// Stable, within-session unique id for ranked items (values may be duplicate
// strings, so we can't key dnd-kit on the text).
let idCounter = 0
const uid = () => `it-${++idCounter}`

type ColKey = "saber" | "querer" | "sonar"

const COLUMNS: Record<
  ColKey,
  { title: string; subtitle: string; hint: string; header: string; placeholder: string }
> = {
  saber: {
    title: "SABER",
    subtitle: "Mi experiencia específica",
    hint: "Tus principales áreas de experiencia: funciones, roles o tareas en las que tenés experiencia (laboral formal o informal, ad-honorem, voluntariado, proyectos personales). No te limites a tu trabajo actual — incluí todo lo que sepas hacer, aunque hoy no lo uses.",
    header: "bg-brand-accent",
    placeholder: "Ej: Preparar reportes financieros",
  },
  querer: {
    title: "QUERER",
    subtitle: "Acciones en las que fluyo",
    hint: "Todo lo que te gusta hacer y disfrutás, tanto de tu vida personal como laboral: hobbies, deportes, actividades informales. Pensá en aquello que cuando lo hacés perdés la noción del tiempo.",
    header: "bg-brand-secondary",
    placeholder: "Ej: Cocinar / tocar el piano",
  },
  sonar: {
    title: "SOÑAR",
    subtitle: "Sueños sin límites",
    hint: "Cosas que te gustaría hacer y nunca hiciste, aunque parezcan difíciles, imposibles o delirantes. Aprendizajes que desearías adquirir, lugares, proyectos o experiencias.",
    header: "bg-indigo-600",
    placeholder: "Ej: Vivir un año en Japón / tocar en vivo con mi banda",
  },
}

const COL_ORDER: ColKey[] = ["saber", "querer", "sonar"]

// The ordered stage machine. Each column is filled → (selected, saber only) →
// ranked before moving on, so the coachee works one focus at a time even
// without a coach narrating it.
type Stage =
  | { col: ColKey; phase: "write" }
  | { col: "saber"; phase: "select" }
  | { col: ColKey; phase: "rank" }
  | { phase: "brainstorm" }
  | { phase: "explore" }

const STAGES: Stage[] = [
  { col: "saber", phase: "write" },
  { col: "saber", phase: "select" },
  { col: "saber", phase: "rank" },
  { col: "querer", phase: "write" },
  { col: "querer", phase: "rank" },
  { col: "sonar", phase: "write" },
  { col: "sonar", phase: "rank" },
  { phase: "brainstorm" },
  { phase: "explore" },
]

// Per-rank-stage consigna. The whole point of the session feedback: rank by how
// much you ENJOY each thing, not by how work-relevant or easy it is.
const RANK_CONSIGNA: Record<ColKey, string> = {
  saber:
    "Ordená tus pasiones: lo que MÁS te apasiona hacer va primero. No lo que te sale fácil o conveniente — lo que de verdad disfrutás.",
  querer:
    "Ordená por nivel de disfrute: lo que más disfrutás, arriba. Olvidate de si es algo laboral o personal — lo único que importa es cuánto lo disfrutás.",
  sonar:
    "Ordená por las ganas que te genera: lo que más te entusiasma lograr o vivir va primero.",
}

const toItems = (values: string[]): RankItem[] =>
  values.map((s) => s.trim()).filter(Boolean).map((text) => ({ id: uid(), text }))

const asStrings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []

// Restore a ranked list from a list of texts, drawing items out of `pool` by
// matching text (consuming each match). Pool items not named in `texts` are
// appended at the end so nothing is lost.
function rankFromTexts(texts: string[], pool: RankItem[]): RankItem[] {
  const used = new Set<string>()
  const out: RankItem[] = []
  for (const t of texts) {
    const m = pool.find((it) => it.text === t && !used.has(it.id))
    if (m) {
      out.push(m)
      used.add(m.id)
    }
  }
  for (const it of pool) if (!used.has(it.id)) out.push(it)
  return out
}

// Keep at least `min` input rows so a column never renders empty.
const padRows = (strs: string[], min = 5): string[] =>
  strs.length >= min ? strs : [...strs, ...Array(min - strs.length).fill("")]

interface TableroTestProps {
  api: TestApi
  assignmentId: string
  initialResponses?: Record<string, unknown>
  onDone?: () => void
}

export default function TableroTest({ api, assignmentId, initialResponses, onDone }: TableroTestProps) {
  const { toast } = useToast()

  const [stageIndex, setStageIndex] = useState(0)

  // ── Write inputs (variable length, start with 5 rows) ───────────────────────
  const [saber, setSaber] = useState<string[]>(Array(5).fill(""))
  const [querer, setQuerer] = useState<string[]>(Array(5).fill(""))
  const [sonar, setSonar] = useState<string[]>(Array(5).fill(""))
  const [explorationTasks, setExplorationTasks] = useState<string[]>(Array(3).fill(""))
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // ── Derived items with stable ids ───────────────────────────────────────────
  const [saberItems, setSaberItems] = useState<RankItem[]>([])
  const [quererItems, setQuererItems] = useState<RankItem[]>([])
  const [sonarItems, setSonarItems] = useState<RankItem[]>([])
  const [passionIds, setPassionIds] = useState<Set<string>>(new Set())
  const [saberRank, setSaberRank] = useState<RankItem[]>([])
  const [quererRank, setQuererRank] = useState<RankItem[]>([])
  const [sonarRank, setSonarRank] = useState<RankItem[]>([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  // ── Brainstorming idea cards → AI cards → pick one ──────────────────────────
  const [ideaCards, setIdeaCards] = useState<RankItem[]>([]) // user's own, ordered
  const [newIdea, setNewIdea] = useState("")
  const [aiIdeas, setAiIdeas] = useState<string[]>([]) // AI-generated (after the user's)
  const [ideasGenerated, setIdeasGenerated] = useState(false)
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null) // the chosen one

  const [hydrated, setHydrated] = useState(false)

  // Seed the whole flow from either a localStorage draft (write strings + ranks
  // + stage) or, later, a stored `responses` object (item 11 — re-enter to
  // edit). Both shapes are understood here so there's a single hydrate path.
  function hydrate(src: Record<string, unknown>) {
    const saberStrs = asStrings(src.saber)
    const quererStrs = asStrings(src.querer)
    const sonarStrs = asStrings(src.sonar)
    if (saberStrs.length) setSaber(padRows(saberStrs))
    if (quererStrs.length) setQuerer(padRows(quererStrs))
    if (sonarStrs.length) setSonar(padRows(sonarStrs))

    const sItems = toItems(saberStrs)
    const qItems = toItems(quererStrs)
    const nItems = toItems(sonarStrs)
    setSaberItems(sItems)
    setQuererItems(qItems)
    setSonarItems(nItems)

    // Passions come as a `passions` text list (draft) or a `saberPassion` bool[]
    // parallel to `saber` (stored response).
    const passionTexts = Array.isArray(src.passions)
      ? new Set(asStrings(src.passions))
      : Array.isArray(src.saberPassion)
        ? new Set(saberStrs.filter((_, i) => Boolean((src.saberPassion as unknown[])[i])))
        : new Set<string>()
    const pIds = new Set(sItems.filter((it) => passionTexts.has(it.text)).map((it) => it.id))
    setPassionIds(pIds)

    setSaberRank(
      rankFromTexts(
        asStrings(src.saberRank ?? src.saberRanking),
        sItems.filter((it) => pIds.has(it.id)),
      ),
    )
    setQuererRank(rankFromTexts(asStrings(src.quererRank ?? src.quererRanking), qItems))
    setSonarRank(rankFromTexts(asStrings(src.sonarRank ?? src.sonarRanking), nItems))

    setIdeaCards(toItems(asStrings(src.ideaCards ?? src.brainstormIdeas)))
    if (Array.isArray(src.aiIdeas)) {
      setAiIdeas(asStrings(src.aiIdeas))
      setIdeasGenerated(asStrings(src.aiIdeas).length > 0)
    }
    if (typeof src.selectedIdea === "string") setSelectedIdea(src.selectedIdea || null)

    const expl = asStrings(src.explorationTasks)
    if (expl.length) setExplorationTasks(padRows(expl, 3))

    if (typeof src.stageIndex === "number") {
      setStageIndex(Math.min(Math.max(0, src.stageIndex), STAGES.length - 1))
    }
  }

  // ── Draft load (tolerant of the old {saber,querer,sonar,brainstorming} shape) ─
  // When initialResponses is provided (re-enter-to-edit flow), prefer it over
  // any stale localStorage draft so the coachee starts from their saved state.
  useEffect(() => {
    if (initialResponses) {
      localStorage.removeItem(DRAFT_KEY(assignmentId))
      hydrate(initialResponses)
    } else {
      const raw = localStorage.getItem(DRAFT_KEY(assignmentId))
      if (raw) {
        try {
          hydrate(JSON.parse(raw))
        } catch {
          /* ignore malformed draft */
        }
      }
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId])

  function saveDraft() {
    const draft = {
      v: 2,
      saber,
      querer,
      sonar,
      saberRank: saberRank.map((i) => i.text),
      quererRank: quererRank.map((i) => i.text),
      sonarRank: sonarRank.map((i) => i.text),
      passions: saberItems.filter((i) => passionIds.has(i.id)).map((i) => i.text),
      ideaCards: ideaCards.map((i) => i.text),
      aiIdeas,
      selectedIdea,
      explorationTasks,
      stageIndex,
    }
    localStorage.setItem(DRAFT_KEY(assignmentId), JSON.stringify(draft))
    setLastSaved(new Date())
  }

  // Persist whenever the saved slice changes — once hydration has run, so we
  // never clobber an existing draft with the empty initial state on mount.
  useEffect(() => {
    if (!hydrated || done) return
    saveDraft()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrated,
    saber,
    querer,
    sonar,
    saberRank,
    quererRank,
    sonarRank,
    passionIds,
    ideaCards,
    aiIdeas,
    selectedIdea,
    explorationTasks,
    stageIndex,
  ])

  // ── Column accessors ─────────────────────────────────────────────────────────
  function colState(key: ColKey) {
    if (key === "saber") return [saber, setSaber] as const
    if (key === "querer") return [querer, setQuerer] as const
    return [sonar, setSonar] as const
  }
  function rankState(key: ColKey) {
    if (key === "saber") return [saberRank, setSaberRank] as const
    if (key === "querer") return [quererRank, setQuererRank] as const
    return [sonarRank, setSonarRank] as const
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

  // Reconcile items + rank from the current write strings, preserving the
  // existing ranked order (matched by text) and appending new entries. This is
  // what lets the coachee go back to add an item without losing their ranking.
  function syncColumn(col: ColKey) {
    if (col === "saber") {
      const items = toItems(saber)
      const passionTexts = new Set(
        saberItems.filter((it) => passionIds.has(it.id)).map((it) => it.text),
      )
      const newPassionIds = new Set(items.filter((it) => passionTexts.has(it.text)).map((it) => it.id))
      const selected = items.filter((it) => newPassionIds.has(it.id))
      setSaberItems(items)
      setPassionIds(newPassionIds)
      setSaberRank((prev) => rankFromTexts(prev.map((r) => r.text), selected))
      return
    }
    const [values] = colState(col)
    const items = toItems(values)
    const [, setRank] = rankState(col)
    if (col === "querer") setQuererItems(items)
    else setSonarItems(items)
    setRank((prev) => rankFromTexts(prev.map((r) => r.text), items))
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

  // ── Navigation ────────────────────────────────────────────────────────────────
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" })

  function goNext() {
    const stage = STAGES[stageIndex]
    if (stage.phase === "write") {
      const [values] = colState(stage.col)
      if (toItems(values).length === 0) {
        toast({ title: `Completá al menos una idea en ${COLUMNS[stage.col].title}`, variant: "destructive" })
        return
      }
      syncColumn(stage.col)
    }
    if (stage.phase === "select" && passionIds.size === 0) {
      toast({ title: "Marcá al menos una idea que te apasione", variant: "destructive" })
      return
    }
    if (stage.phase === "brainstorm" && !selectedIdea) {
      toast({ title: "Elegí una idea para desarrollar antes de continuar", variant: "destructive" })
      return
    }
    setStageIndex((i) => Math.min(i + 1, STAGES.length - 1))
    scrollTop()
  }

  function goBack() {
    setStageIndex((i) => Math.max(0, i - 1))
    scrollTop()
  }

  // "Volver a agregar" from a rank/select stage jumps straight to that column's
  // write stage; syncColumn on the way forward keeps the ranking intact.
  function goToWrite(col: ColKey) {
    const idx = STAGES.findIndex((s) => s.phase === "write" && "col" in s && s.col === col)
    if (idx >= 0) {
      setStageIndex(idx)
      scrollTop()
    }
  }

  // ── Brainstorming helpers ─────────────────────────────────────────────────────
  function addIdea() {
    const t = newIdea.trim()
    if (!t) return
    setIdeaCards((prev) => [...prev, { id: uid(), text: t }])
    setNewIdea("")
  }
  function removeIdea(id: string, text: string) {
    setIdeaCards((prev) => prev.filter((x) => x.id !== id))
    if (selectedIdea === text) setSelectedIdea(null)
  }
  async function generateAiIdeas() {
    if (ideaCards.length === 0) return
    setLoadingIdeas(true)
    try {
      const { ideas } = await api.aiIdeas({
        saber: saberRank.slice(0, 3).map((i) => i.text),
        querer: quererRank.slice(0, 3).map((i) => i.text),
        sonar: sonarRank.slice(0, 3).map((i) => i.text),
        brainstormIdeas: ideaCards.map((i) => i.text),
      })
      setAiIdeas(ideas)
      setIdeasGenerated(true)
      if (ideas.length === 0) {
        toast({ title: "No se pudieron generar ideas con IA — seguí con las tuyas" })
      }
    } finally {
      setLoadingIdeas(false)
    }
  }

  async function handleSubmit() {
    if (!selectedIdea) {
      toast({ title: "Elegí una idea para desarrollar antes de finalizar", variant: "destructive" })
      return
    }
    setSaving(true)
    const responses = {
      saber: saberItems.map((i) => i.text),
      saberPassion: saberItems.map((i) => passionIds.has(i.id)),
      saberRanking: saberRank.map((i) => i.text), // [T5] strings, not indices
      querer: quererItems.map((i) => i.text),
      quererRanking: quererRank.map((i) => i.text),
      sonar: sonarItems.map((i) => i.text),
      sonarRanking: sonarRank.map((i) => i.text),
      brainstormIdeas: ideaCards.map((i) => i.text), // user's, ordered
      aiIdeas, // AI-generated
      selectedIdea, // the idea chosen to develop
      explorationTasks: explorationTasks.map((s) => s.trim()).filter(Boolean),
    }

    try {
      const res = await api.submit(responses)
      if (res.ok) {
        localStorage.removeItem(DRAFT_KEY(assignmentId))
        if (onDone) {
          onDone()
        } else {
          setDone(true)
          scrollTop()
        }
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

  const stage = STAGES[stageIndex]
  const stepNum = stageIndex + 1
  const totalSteps = STAGES.length
  const stepPct = Math.round((stepNum / totalSteps) * 100)
  const subtitle = stageSubtitle(stage)

  return (
    <div className="space-y-8 pb-24">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Tablero de Ideas</h1>
        <p className="text-sm text-muted-foreground">
          {subtitle}
          {lastSaved && stage.phase !== "brainstorm" && (
            <span className="ml-2 text-xs text-green-600">· Guardado automáticamente</span>
          )}
        </p>
      </div>

      {/* ── Write a single column ── */}
      {stage.phase === "write" && (
        <>
          <section className="max-w-2xl space-y-3">
            <div className={cn("text-white rounded-lg px-4 py-3", COLUMNS[stage.col].header)}>
              <h2 className="font-serif text-lg font-medium">{COLUMNS[stage.col].title}</h2>
              <p className="text-xs mt-0.5 opacity-90">{COLUMNS[stage.col].subtitle}</p>
            </div>
            <p className="text-sm text-muted-foreground">{COLUMNS[stage.col].hint}</p>
            {stage.col === "sonar" && (
              <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-900">
                <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Soñá en grande.</strong> Imaginá que no tenés ningún condicionamiento de
                  plata ni de tiempo: ¿qué harías? Tiene que ser algo que <strong>nunca hiciste</strong> y
                  que <strong>hoy</strong> te haga sentido — aunque parezca difícil o delirante.
                </p>
              </div>
            )}
            <div className="space-y-2">
              {colState(stage.col)[0].map((val, i) => {
                const setter = colState(stage.col)[1]
                return (
                  <div key={i} className="flex items-center gap-1">
                    <Input
                      value={val}
                      onChange={(e) => updateRow(setter, i, e.target.value)}
                      placeholder={COLUMNS[stage.col].placeholder}
                      className="text-sm"
                    />
                    {colState(stage.col)[0].length > 1 && (
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
                )
              })}
            </div>
            <Button variant="outline" size="sm" onClick={() => addRow(colState(stage.col)[1])} className="w-full">
              <Plus className="h-3 w-3 mr-1" /> Agregar
            </Button>
          </section>
          <StepBar step={stepNum} total={totalSteps} pct={stepPct}>
            {stageIndex > 0 && (
              <Button variant="outline" onClick={goBack}>
                ← Atrás
              </Button>
            )}
            <Button onClick={goNext} className="bg-brand-accent hover:bg-brand-accent-dark">
              Continuar →
            </Button>
          </StepBar>
        </>
      )}

      {/* ── Select passions (SABER only) ── */}
      {stage.phase === "select" && (
        <>
          <section className="max-w-3xl space-y-4">
            <div>
              <h2 className="font-serif text-xl text-foreground">SABER: marcá lo que te apasiona</h2>
              <p className="text-sm text-muted-foreground">
                Tocá las áreas que más te entusiasman. En el próximo paso las vas a ordenar.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <strong>Importante:</strong> elegí lo que de verdad te <strong>apasiona</strong>, no lo
                que te sale fácil o conveniente. Si algo lo hacés bien pero no lo disfrutás, no lo
                marques.
              </p>
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
          </section>
          <StepBar step={stepNum} total={totalSteps} pct={stepPct}>
            <Button variant="outline" onClick={() => goToWrite("saber")}>
              <Plus className="h-3 w-3 mr-1" /> Agregar
            </Button>
            <Button onClick={goNext} className="bg-brand-accent hover:bg-brand-accent-dark">
              Continuar →
            </Button>
          </StepBar>
        </>
      )}

      {/* ── Rank a single column ── */}
      {stage.phase === "rank" && (
        <>
          <section className="max-w-2xl space-y-4">
            <div>
              <h2 className="font-serif text-xl text-foreground">{COLUMNS[stage.col].title}: ordená tu top 3</h2>
              <p className="text-sm text-muted-foreground">{RANK_CONSIGNA[stage.col]}</p>
            </div>
            <SortableList
              items={rankState(stage.col)[0]}
              onReorder={rankState(stage.col)[1]}
              renderItem={(item, index) => (
                <RankRow item={item} index={index} color={COLUMNS[stage.col].header} />
              )}
            />
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900">
              <Heart className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <p>
                Dale una última mirada <strong>con el corazón</strong>. ¿Te olvidaste de algo que
                disfrutás mucho? Podés{" "}
                <button
                  type="button"
                  onClick={() => goToWrite(stage.col)}
                  className="underline font-medium hover:text-rose-700"
                >
                  volver a agregar
                </button>
                {" "}sin perder tu orden.
              </p>
            </div>
          </section>
          <StepBar step={stepNum} total={totalSteps} pct={stepPct}>
            <Button variant="outline" onClick={goBack}>
              ← Atrás
            </Button>
            <Button onClick={goNext} className="bg-brand-accent hover:bg-brand-accent-dark">
              Continuar →
            </Button>
          </StepBar>
        </>
      )}

      {/* ── Brainstorming: idea cards → AI cards → pick one to develop ── */}
      {stage.phase === "brainstorm" && (
        <>
          <div className="lg:h-[calc(100vh-260px)] flex flex-col gap-3">
            <div className="grid grid-cols-1 lg:grid-cols-[24%_1fr_1fr] gap-4 flex-1 min-h-0">
              {/* Col 1: connecting data — top 3 of each column */}
              <aside className="space-y-3 lg:overflow-y-auto lg:pr-1">
                <p className="font-serif text-base text-foreground">Conectando datos →</p>
                <RankedChips title="SABER" items={saberRank.slice(0, 3)} chip="bg-brand-accent/10 text-brand-accent" />
                <RankedChips title="QUERER" items={quererRank.slice(0, 3)} chip="bg-brand-secondary/10 text-brand-secondary" />
                <RankedChips title="SOÑAR" items={sonarRank.slice(0, 3)} chip="bg-indigo-100 text-indigo-700" />
              </aside>

              {/* Col 2: your idea cards */}
              <div className="flex flex-col min-h-0">
                <div className="bg-gray-800 text-white rounded-lg px-4 py-2.5 shrink-0">
                  <h2 className="font-serif text-base font-medium">Tus ideas</h2>
                  <p className="text-xs opacity-90">Conectá las tres columnas: negocios, trabajos o proyectos. Ordená de más a menos atractiva.</p>
                </div>
                <div className="flex gap-2 mt-3 shrink-0">
                  <Input
                    value={newIdea}
                    onChange={(e) => setNewIdea(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addIdea() } }}
                    placeholder="Ej: Estudio de diseño para pymes"
                    className="text-sm"
                  />
                  <Button variant="outline" onClick={addIdea} className="shrink-0">
                    <Plus className="h-3 w-3 mr-1" /> Agregar
                  </Button>
                </div>
                <div className="mt-3 flex-1 lg:overflow-y-auto lg:pr-1">
                  {ideaCards.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Agregá al menos una idea para continuar.</p>
                  ) : (
                    <SortableList
                      items={ideaCards}
                      onReorder={setIdeaCards}
                      renderItem={(item, index) => (
                        <div
                          onClick={() => setSelectedIdea(item.text)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors",
                            selectedIdea === item.text
                              ? "border-brand-accent bg-brand-accent/10"
                              : "border-border bg-white hover:border-brand-accent/50"
                          )}
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-accent text-xs text-white shrink-0">{index + 1}</span>
                          <span className="flex-1">{item.text}</span>
                          {selectedIdea === item.text && <Check className="h-4 w-4 text-brand-accent shrink-0" />}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeIdea(item.id, item.text) }}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            aria-label="Quitar"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Col 3: AI ideas — only after the user has created their own */}
              <div className="flex flex-col min-h-0">
                <div className="bg-brand-accent text-white rounded-lg px-4 py-2.5 shrink-0">
                  <h2 className="font-serif text-base font-medium flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" /> Ideas con IA
                  </h2>
                  <p className="text-xs opacity-90">Sumá sugerencias generadas a partir de tus datos.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={generateAiIdeas}
                  disabled={ideaCards.length === 0 || loadingIdeas}
                  className="w-full mt-3 shrink-0"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {loadingIdeas ? "Generando ideas..." : ideasGenerated ? "Volver a generar con IA" : "Generar ideas con IA"}
                </Button>
                <div className="mt-3 flex-1 lg:overflow-y-auto lg:pr-1 space-y-2">
                  {ideaCards.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Primero agregá tus propias ideas.</p>
                  )}
                  {ideasGenerated && aiIdeas.map((idea, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedIdea(idea)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm cursor-pointer transition-colors",
                        selectedIdea === idea
                          ? "border-brand-accent bg-brand-accent/10"
                          : "border-brand-accent/40 bg-brand-accent/[0.03] hover:bg-brand-accent/10"
                      )}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                      <span className="flex-1">{idea}</span>
                      {selectedIdea === idea && <Check className="h-4 w-4 text-brand-accent shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selectedIdea && (
              <p className="shrink-0 text-sm text-foreground bg-brand-accent/5 border border-brand-accent/20 rounded-lg px-3 py-2 truncate">
                Vas a desarrollar: <strong>{selectedIdea}</strong>
              </p>
            )}
          </div>

          <StepBar step={stepNum} total={totalSteps} pct={stepPct}>
            <Button variant="outline" onClick={goBack}>← Atrás</Button>
            <Button onClick={goNext} disabled={!selectedIdea} className="bg-brand-accent hover:bg-brand-accent-dark flex-1">
              Continuar →
            </Button>
          </StepBar>
        </>
      )}

      {/* ── Exploration tasks: what to investigate after the session ── */}
      {stage.phase === "explore" && (
        <>
          <section className="max-w-2xl space-y-3">
            <div>
              <h2 className="font-serif text-xl text-foreground">Tareas de exploración</h2>
              <p className="text-sm text-muted-foreground">
                Antes de cerrar, anotá qué te llevás para investigar: cursos, eventos, nichos o
                industrias ligadas a tus ideas (por ejemplo el mundo gastronómico, el gaming, la
                fotografía o el contenido deportivo). Son tus próximos pasos para explorar.
              </p>
            </div>
            <div className="space-y-2">
              {explorationTasks.map((val, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input
                    value={val}
                    onChange={(e) => updateRow(setExplorationTasks, i, e.target.value)}
                    placeholder="Ej: Investigar cursos de filmmaking deportivo"
                    className="text-sm"
                  />
                  {explorationTasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(setExplorationTasks, i)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Quitar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addRow(setExplorationTasks)} className="w-full">
                <Plus className="h-3 w-3 mr-1" /> Agregar
              </Button>
            </div>
          </section>
          <StepBar step={stepNum} total={totalSteps} pct={stepPct}>
            <Button variant="outline" onClick={goBack}>← Atrás</Button>
            <Button onClick={handleSubmit} disabled={saving || !selectedIdea} className="bg-brand-accent hover:bg-brand-accent-dark flex-1">
              {saving ? "Enviando..." : "Finalizar test"}
            </Button>
          </StepBar>
        </>
      )}
    </div>
  )
}

function stageSubtitle(stage: Stage): string {
  switch (stage.phase) {
    case "write":
      return COL_ORDER.includes(stage.col)
        ? `Escribí tu ${COLUMNS[stage.col].title} — ${COLUMNS[stage.col].subtitle.toLowerCase()}`
        : ""
    case "select":
      return "Marcá lo que te apasiona en tu experiencia"
    case "rank":
      return `Ordená tu ${COLUMNS[stage.col].title} por nivel de disfrute`
    case "brainstorm":
      return "Conectá los datos en tu brainstorming y elegí una idea"
    case "explore":
      return "Anotá tus tareas de exploración"
  }
}

function StepBar({
  step,
  total,
  pct,
  children,
}: {
  step: number
  total: number
  pct: number
  children: React.ReactNode
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-white/95 backdrop-blur px-4 py-3 z-10">
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-1">Paso {step} de {total}</p>
          <Progress value={pct} className="h-1.5" />
        </div>
        <div className="flex gap-2 shrink-0">{children}</div>
      </div>
    </div>
  )
}

// A ranked row that visually emphasizes the top 3 (the focus of the rank step).
// Items past position 3 are dimmed so the "top 3 from each category" stays
// front-of-mind.
function RankRow({ item, index, color }: { item: RankItem; index: number; color: string }) {
  const inTop3 = index < 3
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm transition-colors",
        inTop3 ? "border-foreground/20" : "border-border opacity-60",
      )}
    >
      <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-xs text-white shrink-0", inTop3 ? color : "bg-muted-foreground/50")}>
        {index + 1}
      </span>
      <span className="flex-1">{item.text}</span>
      {index === 0 && (
        <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Top 3
        </span>
      )}
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
