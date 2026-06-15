import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { selectBonusCandidates, groupRankedAnchors } from "@/lib/anclas"
import { Sparkles, ChevronRight, Keyboard, Check } from "lucide-react"
import type { TestApi } from "@/lib/testApi"

// ─── Data ────────────────────────────────────────────────────────────────────

const QUESTIONS = [
  "Sueño con ser tan bueno en lo que hago que mi consejo será requerido continuamente.",
  "Me siento más satisfecho / realizado en mi trabajo cuando siento que logré integrar y optimizar los esfuerzos de otros.",
  "Sueño con tener una carrera que me permita la libertad de trabajar independientemente y con planificación propia.",
  "La seguridad y la estabilidad son más importantes para mi que la libertad y la autonomía.",
  "Estoy siempre buscando ideas o proyectos que me permitan encarar un emprendimiento propio.",
  "Voy a sentirme exitoso en mi carrera solo si siento que he hecho una contribución a la comunidad.",
  "Sueño con tener una carrera que me permita resolver problemas o salir adelante en situaciones extremadamente desafiantes.",
  "Cambiaría de empresa antes que asumir una responsabilidad que comprometiera mis objetivos personales y familiares.",
  "Voy a sentirme exitoso en mi carrera sólo si puedo desarrollar mis habilidades técnicas o funcionales hasta el nivel más alto de competencia.",
  "Sueño con estar a cargo de una organización compleja y con tomar decisiones que involucren a muchas personas.",
  "Me siento más cómodo en mi trabajo cuando tengo libertad absoluta para definir tareas, procedimientos y planes.",
  "Cambiaría de empresa antes que aceptar una posición que pusiera en juego mi seguridad en esa organización.",
  "Armar mi propia empresa es más importante para mí que lograr una posición ejecutiva en una organización.",
  "Me siento más realizado en mi carrera si puedo poner mi talento al servicio de otros.",
  "Voy a sentirme exitoso en mi carrera sólo si enfrento y resuelvo desafíos muy complejos.",
  "Sueño una carrera que me permitirá integrar mis necesidades personales, familiares y laborales.",
  "Es más atractivo para mí convertirme en un profesional de nivel ejecutivo en mi área de experiencia que en un gerente general.",
  "Voy a sentirme exitoso sólo si me convierto en gerente general de una empresa.",
  "Voy a sentirme exitoso sólo si logro completa autonomía y libertad.",
  "Prefiero trabajar en organizaciones que me den seguridad y estabilidad.",
  "Me siento más realizado en mi carrera cuando puedo construir algo que es resultado de mis ideas y esfuerzo.",
  "Usar mis capacidades para hacer del mundo un lugar mejor es más importante para mí que alcanzar una posición de alto nivel ejecutivo.",
  "Me sentí más contento con mi carrera cuando pude resolver problemas que parecían imposibles o triunfar pese a grandes obstáculos.",
  "Me siento exitoso en mi vida sólo si puedo equilibrar mis objetivos personales, familiares y de carrera.",
  "Cambiaría de empresa antes que aceptar una rotación que me alejara de mi área de experiencia.",
  "Llegar a ser gerente general es más atractivo para mí que ser un director funcional de mi área de experiencia.",
  "La posibilidad de realizar un trabajo a mi manera, libre de reglas y limitaciones, es más importante para mí que la seguridad laboral.",
  "Me siento más contento con mi trabajo cuando siento que tengo una completa seguridad financiera y de empleo.",
  "Me sentiré realizado en mi carrera sólo si logro crear o construir algo desarrollado o creado enteramente por mí.",
  "Sueño con tener una carrera que me permita realizar una contribución real a la humanidad y a la sociedad.",
  "Busco oportunidades de trabajo que desafíen fuertemente mi capacidad de resolver problemas o mi perfil competitivo.",
  "Equilibrar los requerimientos de la vida personal y profesional es más importante para mí que lograr una posición de alto nivel.",
  "Me siento más satisfecho en mi trabajo cuando puedo utilizar mis conocimientos y habilidades específicas.",
  "Cambiaría de empresa antes que aceptar un trabajo que me alejara del camino hacia la gerencia general.",
  "Cambiaría de empresa antes que aceptar un trabajo que redujera mi autonomía y libertad.",
  "Sueño con desarrollar una carrera que me permita sentir seguridad y estabilidad.",
  "Sueño con poner en marcha y construir mi propio negocio.",
  "Cambiaría de empresa antes que aceptar una posición en la que se desaprovechara mi habilidad de brindar servicio a otros.",
  "Lidiar con problemas que parecen insolubles es más importante para mí que alcanzar una posición ejecutiva.",
  "Siempre busqué oportunidades de trabajo que minimizaran la interferencia con lo familiar y personal.",
]

const ANCHOR_ITEMS: Record<string, number[]> = {
  TF: [0, 8, 16, 24, 32],
  GG: [1, 9, 17, 25, 33],
  AU: [2, 10, 18, 26, 34],
  SE: [3, 11, 19, 27, 35],
  CE: [4, 12, 20, 28, 36],
  SC: [5, 13, 21, 29, 37],
  PD: [6, 14, 22, 30, 38],
  EV: [7, 15, 23, 31, 39],
}

const ANCHOR_INFO: Record<string, { name: string; description: string; icon: string }> = {
  TF: { name: "Técnico/Funcional", icon: "🔬", description: "Tu identidad profesional está ligada al dominio de un área específica. Buscás ser experto/a reconocido/a." },
  GG: { name: "Gerencia General", icon: "🏢", description: "Te motiva liderar organizaciones complejas, integrar personas y tomar decisiones de alto impacto." },
  AU: { name: "Autonomía", icon: "🦅", description: "Valorás la libertad de trabajar a tu manera. La autonomía es innegociable para vos." },
  SE: { name: "Seguridad/Estabilidad", icon: "⚓", description: "Priorizás entornos predecibles y seguros. La estabilidad te permite dar lo mejor de vos." },
  CE: { name: "Creativo-Emprendedor", icon: "🚀", description: "Te impulsa crear algo propio. Encontrás satisfacción en construir desde cero." },
  SC: { name: "Servicio a la Causa", icon: "🌿", description: "El propósito y el impacto en otros son centrales. Querés que tu trabajo tenga significado mayor." },
  PD: { name: "Puro Desafío", icon: "⚡", description: "Los problemas complejos te energizan. Necesitás un trabajo que desafíe constantemente tus capacidades." },
  EV: { name: "Estilo de Vida", icon: "⚖️", description: "Buscás integrar armoniosamente lo profesional y lo personal. Tu bienestar integral no es negociable." },
}

const ANCHOR_ORDER = ["TF", "GG", "AU", "SE", "CE", "SC", "PD", "EV"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcScores(finalAnswers: number[]): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const [anchor, items] of Object.entries(ANCHOR_ITEMS)) {
    const sum = items.reduce((s, i) => s + (finalAnswers[i] || 0), 0)
    scores[anchor] = parseFloat((sum / items.length).toFixed(2))
  }
  return scores
}

function rankAnchors(scores: Record<string, number>): string[] {
  return [...ANCHOR_ORDER].sort((a, b) => scores[b] - scores[a])
}

// ─── Component ───────────────────────────────────────────────────────────────

interface AnclasTestProps {
  api: TestApi
  assignmentId: string
}

export default function AnclasTest({ api }: AnclasTestProps) {
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState<(number | null)[]>(Array(40).fill(null))
  const [unanswered, setUnanswered] = useState<Set<number>>(new Set())
  const [bonusItems, setBonusItems] = useState<number[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [ranking, setRanking] = useState<string[]>([])
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [loadingInsight, setLoadingInsight] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  // Captured at step 2→3 so a failed submit can be retried without recomputing.
  const [finalAnswers, setFinalAnswers] = useState<number[]>([])

  // Which statement currently has keyboard focus (for the highlight + indicator).
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  const answered = answers.filter((a) => a !== null).length
  const progressPct = Math.round((answered / 40) * 100)

  const bonusCandidates = step >= 2 ? selectBonusCandidates(answers) : []

  // Focus the first statement on mount so the keyboard flow works immediately,
  // without scrolling the page away from the instructions.
  useEffect(() => {
    if (step === 1) cardRefs.current[0]?.focus({ preventScroll: true })
  }, [step])

  function setAnswer(idx: number, val: number) {
    setAnswers((prev) => {
      const next = [...prev]
      next[idx] = val
      return next
    })
    setUnanswered((prev) => {
      const next = new Set(prev)
      next.delete(idx)
      return next
    })
  }

  // Keyboard-fast entry on a focused statement: 1-6 records the answer and jumps
  // to the next statement; Arrow Up/Down move between them. (Tab also moves
  // card-to-card because the score buttons are tabIndex={-1}.)
  function handleCardKey(e: React.KeyboardEvent, idx: number) {
    if (e.key >= "1" && e.key <= "6") {
      e.preventDefault()
      setAnswer(idx, Number(e.key))
      cardRefs.current[idx + 1]?.focus()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      cardRefs.current[idx + 1]?.focus()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      cardRefs.current[idx - 1]?.focus()
    }
  }

  function handleNextStep() {
    const missing = new Set<number>()
    answers.forEach((a, i) => { if (a === null) missing.add(i) })
    if (missing.size > 0) {
      setUnanswered(missing)
      document.getElementById(`q-${Math.min(...Array.from(missing))}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    setUnanswered(new Set())
    setStep(2)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Persists the response. Separated from the AI insight so the test is always
  // saved even when the (optional) insight is unavailable. Safe to call again
  // on retry — the backend upserts the response.
  async function persistResponse(fa: number[], s: Record<string, number>, r: string[], insight: string | null) {
    setSaving(true)
    setSubmitError(false)
    try {
      const res = await api.submit({
        rawAnswers: answers,
        bonusItems,
        finalAnswers: fa,
        scores: s,
        ranking: r,
        aiInsight: insight,
      })
      if (res.ok || res.status === 409) {
        setDone(true)
      } else {
        setSubmitError(true)
      }
    } catch (e) {
      console.error(e)
      setSubmitError(true)
    } finally {
      setSaving(false)
    }
  }

  async function handleBonusSubmit() {
    if (bonusItems.length !== 3) return

    const fa = [...answers] as number[]
    bonusItems.forEach((idx) => { fa[idx] = (fa[idx] || 0) + 4 })

    const s = calcScores(fa)
    const r = rankAnchors(s)
    setScores(s)
    setRanking(r)
    setFinalAnswers(fa)
    setStep(3)
    window.scrollTo({ top: 0, behavior: "smooth" })

    // Best-effort AI insight — must never block or fail the submission.
    setLoadingInsight(true)
    let insight: string | null = null
    try {
      const data = await api.aiInsight({ ranking: r, scores: s })
      insight = data.insight ?? null
    } catch (e) {
      console.error(e)
    } finally {
      setAiInsight(insight)
      setLoadingInsight(false)
    }

    // Always persist, regardless of insight outcome.
    await persistResponse(fa, s, r, insight)
  }

  function toggleBonus(idx: number) {
    setBonusItems((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx)
      if (prev.length >= 3) return prev
      return [...prev, idx]
    })
  }

  // ─── Step 1: 40 questions ─────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-serif text-3xl text-foreground mb-1">Test de Anclas de Carrera</h1>
          <p className="text-sm text-muted-foreground">Respondé las 40 afirmaciones según cuánto te representan</p>
        </div>

        {/* Keyboard-fast instructions */}
        <div className="flex items-start gap-2.5 rounded-lg bg-brand-accent/5 border border-brand-accent/20 px-3.5 py-2.5 text-xs text-muted-foreground">
          <Keyboard className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            Tip: respondé con el teclado. <Kbd>Tab</Kbd> pasa a la siguiente afirmación y las teclas{" "}
            <Kbd>1</Kbd>–<Kbd>6</Kbd> registran tu respuesta y avanzan solas. También podés tocar los números.
          </span>
        </div>

        <div className="sticky top-0 bg-brand-bg/95 backdrop-blur py-3 z-10">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>
              {answered} de 40 respondidas
              {focusedIdx !== null && (
                <span className="text-brand-accent font-medium"> · afirmación {focusedIdx + 1}</span>
              )}
            </span>
            <span>{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        <div className="space-y-4">
          {QUESTIONS.map((q, idx) => {
            const isFocused = focusedIdx === idx
            const isAnswered = answers[idx] !== null
            return (
              <div
                key={idx}
                id={`q-${idx}`}
                ref={(el) => {
                  cardRefs.current[idx] = el
                }}
                tabIndex={0}
                onFocus={() => setFocusedIdx(idx)}
                onBlur={() => setFocusedIdx((f) => (f === idx ? null : f))}
                onKeyDown={(e) => handleCardKey(e, idx)}
                className={cn(
                  "bg-white rounded-xl border p-5 space-y-3 outline-none transition-all duration-200",
                  unanswered.has(idx) ? "border-destructive bg-red-50/50" : "border-border",
                  isFocused &&
                    "border-brand-accent ring-2 ring-brand-accent/60 shadow-lg scale-[1.015] bg-brand-accent/[0.02]"
                )}
              >
                <p className="text-sm text-foreground flex items-start gap-2">
                  <span className="font-medium text-brand-accent">{idx + 1}.</span>
                  <span className="flex-1">{q}</span>
                  {isAnswered && (
                    <Check className="h-4 w-4 text-green-600 shrink-0 animate-[sparkle-pulse_0.3s_ease]" />
                  )}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5, 6].map((val) => (
                    <button
                      key={val}
                      type="button"
                      tabIndex={-1}
                      onClick={() => setAnswer(idx, val)}
                      className={cn(
                        "w-10 h-10 rounded-full border-2 text-sm font-bold transition-all",
                        answers[idx] === val
                          ? "bg-brand-accent border-brand-accent text-white scale-110"
                          : "border-border text-muted-foreground hover:border-brand-accent hover:text-brand-accent"
                      )}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                {idx === 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span>1 = No es verdadero para mí</span>
                    <span>6 = Es siempre verdadero</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {unanswered.size > 0 && (
          <p className="text-sm text-destructive font-medium">
            Falta responder {unanswered.size} pregunta{unanswered.size > 1 ? "s" : ""}. Están marcadas en rojo.
          </p>
        )}

        <Button
          onClick={handleNextStep}
          className="w-full bg-brand-accent hover:bg-brand-accent-dark"
          size="lg"
        >
          Continuar <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  // ─── Step 2: Bonus selection ───────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="font-serif text-3xl text-foreground mb-1">Seleccioná tus top 3</h2>
          <p className="text-sm text-muted-foreground">
            De las afirmaciones que más te representaron, elegí exactamente las <strong>3</strong> que mejor describen quién sos en tu carrera
          </p>
        </div>

        <div className="space-y-3">
          {bonusCandidates.map(({ idx, val }) => {
            const isSelected = bonusItems.includes(idx)
            const isDisabled = !isSelected && bonusItems.length >= 3

            return (
              <button
                key={idx}
                disabled={isDisabled}
                onClick={() => toggleBonus(idx)}
                className={cn(
                  "w-full text-left rounded-xl border-2 p-4 flex items-start gap-4 transition-all",
                  isSelected
                    ? "border-brand-accent bg-brand-accent/5 animate-[sparkle-pulse_0.4s_ease-in-out]"
                    : isDisabled
                    ? "border-border opacity-40 cursor-not-allowed"
                    : "border-border hover:border-brand-accent/50 cursor-pointer bg-white"
                )}
              >
                <div className={cn(
                  "mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
                  isSelected ? "bg-brand-accent border-brand-accent" : "border-border"
                )}>
                  {isSelected && <span className="text-white text-xs font-bold">{bonusItems.indexOf(idx) + 1}</span>}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{QUESTIONS[idx]}</p>
                  <p className="text-xs text-muted-foreground mt-1">Puntaje: {val}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="sticky bottom-4">
          <Button
            onClick={handleBonusSubmit}
            disabled={bonusItems.length !== 3 || saving}
            className="w-full bg-brand-accent hover:bg-brand-accent-dark"
            size="lg"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Ver mis resultados ({bonusItems.length}/3 seleccionados)
          </Button>
        </div>
      </div>
    )
  }

  // ─── Step 3: Results ───────────────────────────────────────────────────────
  // The average can exceed 6 (bonus items add +4), so bars scale to the top
  // anchor rather than to a fixed /6 max.
  const topScore = Math.max(...Object.values(scores), 1)
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="font-serif text-3xl text-foreground mb-1">Tus Anclas de Carrera</h2>
        <p className="text-sm text-muted-foreground">Resultados según la metodología de Edgar Schein</p>
      </div>

      <div className="space-y-3">
        {/* Dense ranking: tied anchors share a rank and sit side by side. */}
        {groupRankedAnchors(scores, ANCHOR_ORDER).map((group) => {
          const isTop = group.rank === 1
          return (
            <div key={group.rank} className={cn(
              "bg-white rounded-xl border border-border p-5",
              isTop && "border-brand-accent/50 shadow-sm"
            )}>
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base",
                  isTop ? "bg-brand-accent text-white" : "bg-muted text-muted-foreground"
                )}>
                  {isTop ? "🏆" : group.rank}
                </div>
                <div className={cn(
                  "flex-1 min-w-0 grid gap-x-6 gap-y-4",
                  group.anchors.length > 1 && "sm:grid-cols-2"
                )}>
                  {group.anchors.map((anchor) => {
                    const info = ANCHOR_INFO[anchor]
                    const barWidth = (scores[anchor] / topScore) * 100
                    return (
                      <div key={anchor} className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">{info.icon}</span>
                          <span className="font-semibold text-foreground">{info.name}</span>
                          <Badge variant="outline" className="text-xs">{anchor}</Badge>
                          {isTop && <Badge className="bg-brand-accent text-white hover:bg-brand-accent text-xs">1er ancla</Badge>}
                          {group.anchors.length > 1 && <Badge variant="secondary" className="text-xs">empate</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{info.description}</p>
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Puntuación</span>
                            <span className="font-medium text-foreground">{scores[anchor]}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-brand-accent rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl bg-gray-900 text-gray-100 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-medium text-gray-300">Insight personalizado</span>
        </div>
        {loadingInsight ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn("h-4 bg-gray-700 rounded animate-pulse", i === 3 && "w-2/3")} />
            ))}
          </div>
        ) : aiInsight ? (
          <p className="text-sm leading-relaxed">{aiInsight}</p>
        ) : (
          <p className="text-sm text-gray-500">No se pudo generar el insight.</p>
        )}
      </div>

      {saving && (
        <p className="text-sm text-muted-foreground text-center font-medium">
          Guardando tus resultados...
        </p>
      )}

      {done && (
        <p className="text-sm text-green-700 text-center font-medium">
          ✓ Tus resultados fueron guardados correctamente.
        </p>
      )}

      {submitError && !saving && (
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive font-medium">
            No pudimos guardar tus resultados. Revisá tu conexión e intentá de nuevo.
          </p>
          <Button
            onClick={() => persistResponse(finalAnswers, scores, ranking, aiInsight)}
            className="bg-brand-accent hover:bg-brand-accent-dark"
            size="lg"
          >
            Reintentar envío
          </Button>
        </div>
      )}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5em] px-1 py-0.5 rounded border border-border bg-muted font-mono text-[0.7rem] font-medium text-foreground">
      {children}
    </kbd>
  )
}
