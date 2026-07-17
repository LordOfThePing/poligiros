import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Plus, X, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { TestApi } from "@/lib/testApi"
import { PV_SECTIONS, type PvSectionKey } from "@/lib/planVital"

const DRAFT_KEY = (id: string) => `plan-vital-draft-${id}`

interface SectionDef {
  key: PvSectionKey
  num: number
  title: string
  subtitle: string
  color: string
  intro?: string
  timeHint?: string
  optional?: boolean
  questions: string[]
  placeholder: string
}

const SECTION_DEFS: SectionDef[] = [
  {
    key: "saludFisica",
    num: 1,
    title: "Salud Física",
    subtitle: "Tu bienestar físico, mental y espiritual",
    color: "bg-green-600",
    questions: [
      "¿Cómo estás actualmente de salud física? ¿Tenés alguna enfermedad crónica, síntomas que se repitan, cirugías previas?",
      "¿Cuáles son tus puntos débiles a nivel salud? ¿Cómo los trataste (médico, terapia alternativa, etc.)?",
      "¿Cómo es tu sueño? ¿Dormís bien? ¿Cuántas horas?",
      "¿Cómo es tu alimentación? ¿Realizás actividad física? ¿Cuál y con qué frecuencia?",
      "Salud mental y emocional: ¿Tuviste o tenés algún síntoma o patología (ansiedad, depresión, angustia)? ¿Hacés terapia?",
      "Salud espiritual: ¿Te sentís en paz y armonía? ¿Tenés momentos de conexión espiritual (meditar, orar, respirar, silencio)?",
    ],
    placeholder: "Respondé con honestidad y el mayor detalle posible...",
  },
  {
    key: "familia",
    num: 2,
    title: "Familia",
    subtitle: "Tu situación familiar y entorno de apoyo",
    color: "bg-rose-500",
    questions: [
      "¿Cuál es tu situación actual a nivel familiar? (vivís sol@, con pareja, hijos, cargas familiares, compartís gastos, etc.)",
      "Si tenés pareja: ¿te apoya en un posible cambio laboral?",
      "¿Algún otro familiar puede brindarte apoyo?",
      "Familia extendida: ¿qué hacían tus padres a nivel laboral/estudios? ¿Cómo ven tu cambio de carrera?",
    ],
    placeholder: "Describí tu situación familiar actual...",
  },
  {
    key: "finanzas",
    num: 3,
    title: "Finanzas",
    subtitle: "Tu situación económica y posibilidades reales",
    color: "bg-amber-600",
    questions: [
      "¿Cómo es tu situación económica actual (ingresos/egresos)?",
      "Si estás desempleado/a: ¿tenés backup (ahorros, apoyo de alguien)? ¿Cuánto tiempo podés estar sin salario?",
      "Si estás trabajando: ¿qué nivel de ingresos quisieras ganar? ¿Aceptarías ganar menos por un trabajo que te apasione?",
    ],
    placeholder: "Describí tu situación financiera con honestidad...",
  },
  {
    key: "realizacionPersonal",
    num: 4,
    title: "Realización Personal",
    subtitle: "Lo que te haría sentir pleno/a como persona",
    color: "bg-purple-600",
    intro: "Anotá todo aquello que, si se cumpliera en tu vida, te haría sentir muy realizad@ como persona — tanto material como espiritual.",
    timeHint: "Dedicá entre 5 y 10 minutos a este ejercicio. Escribí sin filtros.",
    questions: [
      "Material: ¿qué cosas o logros concretos quisieras alcanzar? (Ej: comprar casa, armar un emprendimiento, formar familia)",
      "Intangible: ¿qué estados o experiencias quisieras vivir? (Ej: tener paz y armonía, ver crecer a tus hijos, ayudar a otros)",
    ],
    placeholder: "Escribí libremente, sin filtros ni límites...",
  },
  {
    key: "redes",
    num: 5,
    title: "Redes",
    subtitle: "Tu red de contactos y capacidad de networking",
    color: "bg-sky-600",
    questions: [
      "¿Cómo es tu red de contactos? ¿Amplia, nutrida, diversificada?",
      "¿Cuántos contactos tenés en LinkedIn?",
      "¿Te gusta hacer networking? ¿Te resulta fácil o difícil?",
    ],
    placeholder: "Describí tu situación actual en cuanto a redes profesionales...",
  },
  {
    key: "trabajo",
    num: 6,
    title: "Trabajo",
    subtitle: "Tu visión sobre el tipo de trabajo que buscás",
    color: "bg-teal-600",
    questions: [
      "¿Qué tipo de trabajo querés?",
      "¿Querés seguir en la misma modalidad (relación de dependencia, freelance, independiente, etc.)?",
      "¿Ya sabés lo que buscás o todavía estás explorando?",
    ],
    placeholder: "Describí qué tipo de trabajo imaginás para vos...",
  },
  {
    key: "vocacion",
    num: 7,
    title: "Vocación",
    subtitle: "Un recorrido por tus intereses y sueños a lo largo del tiempo",
    color: "bg-orange-600",
    questions: [
      "De niño/a: ¿a qué jugabas, qué soñabas ser, qué decías que ibas a ser de grande?",
      "Adolescencia: ¿qué actividades extracurriculares hacías (deporte, arte, música, etc.)?",
      "Secundaria: ¿qué carreras pensabas estudiar?",
      "A los 18: ¿qué opciones consideraste? ¿Por qué elegiste la que estudiaste? ¿Por qué descartaste otras?",
      "¿Hoy alguna de esas opciones descartadas vuelve a hacer sentido?",
    ],
    placeholder: "Hacé un recorrido honesto por tu historia vocacional...",
  },
  {
    key: "misionPersonal",
    num: 8,
    title: "Misión Personal",
    subtitle: "Tu propósito en la vida",
    color: "bg-indigo-600",
    intro: "Si no podés responder ahora, no pasa nada — lo trabajaremos juntos en la próxima herramienta: Pirámide del Propósito.",
    optional: true,
    questions: [
      "Si tuvieras que definir una misión en tu vida, ¿cuál creés que sería?",
    ],
    placeholder: "Escribí lo primero que te venga, aunque no sea perfecto...",
  },
]

const TOTAL_STEPS = SECTION_DEFS.length + 1  // 8 sections + estímulos
const ESTIMULOS_STEP = SECTION_DEFS.length   // index 8

export default function PlanVitalTest({ api, assignmentId }: { api: TestApi; assignmentId: string }) {
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(SECTION_DEFS.map((s) => [s.key, ""]))
  )
  const [estimulos, setEstimulos] = useState<string[]>(Array(5).fill(""))
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY(assignmentId))
    if (raw) {
      try {
        const d = JSON.parse(raw)
        if (d.answers) setAnswers((prev) => ({ ...prev, ...d.answers }))
        if (Array.isArray(d.estimulos)) setEstimulos(d.estimulos)
        if (typeof d.step === "number") setStep(Math.min(Math.max(0, d.step), TOTAL_STEPS - 1))
      } catch {}
    }
    setHydrated(true)
  }, [assignmentId])

  const saveDraft = useCallback(() => {
    localStorage.setItem(DRAFT_KEY(assignmentId), JSON.stringify({ answers, estimulos, step }))
  }, [assignmentId, answers, estimulos, step])

  useEffect(() => {
    if (!hydrated || done) return
    saveDraft()
  }, [hydrated, answers, estimulos, step, done, saveDraft])

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" })

  function goNext() {
    const section = SECTION_DEFS[step]
    if (section && !section.optional && !answers[section.key].trim()) {
      toast({ title: "Completá esta sección antes de continuar", variant: "destructive" })
      return
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
    scrollTop()
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1))
    scrollTop()
  }

  async function handleSubmit() {
    if (!estimulos.some((e) => e.trim())) {
      toast({ title: "Anotá al menos un estímulo antes de finalizar", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await api.submit({
        ...answers,
        estimulos: estimulos.map((e) => e.trim()).filter(Boolean),
      })
      if (res.ok) {
        localStorage.removeItem(DRAFT_KEY(assignmentId))
        setDone(true)
        scrollTop()
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

  if (done) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-3">
        <p className="text-4xl">✓</p>
        <h2 className="font-serif text-2xl text-foreground">¡Plan Vital enviado!</h2>
        <p className="text-muted-foreground">Tus respuestas fueron guardadas. Las revisamos juntos en la próxima sesión.</p>
      </div>
    )
  }

  const isEstimulos = step === ESTIMULOS_STEP
  const section = !isEstimulos ? SECTION_DEFS[step] : null
  const stepNum = step + 1
  const pct = Math.round((stepNum / TOTAL_STEPS) * 100)

  return (
    <div className="space-y-8 pb-24">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Plan Vital Integral</h1>
        <p className="text-sm text-muted-foreground">
          Respondé con honestidad y el mayor detalle posible. Cuanto más específicas sean tus respuestas, más valioso será tu proceso.
        </p>
      </div>

      {/* ── Section step ── */}
      {section && (
        <section className="max-w-2xl mx-auto space-y-4">
          <div className={cn("text-white rounded-xl px-5 py-4", section.color)}>
            <p className="text-xs font-medium opacity-70 uppercase tracking-wide mb-0.5">
              Sección {section.num} de 8
            </p>
            <h2 className="font-serif text-2xl">{section.title}</h2>
            <p className="text-sm opacity-90 mt-0.5">{section.subtitle}</p>
          </div>

          {section.intro && (
            <p className="text-sm text-foreground bg-white rounded-lg border border-border px-4 py-3 leading-relaxed">
              {section.intro}
            </p>
          )}

          {section.timeHint && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {section.timeHint}
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preguntas guía</p>
            <ul className="space-y-1.5">
              {section.questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-brand-accent mt-0.5 shrink-0">·</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>

          <Textarea
            value={answers[section.key]}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [section.key]: e.target.value }))}
            placeholder={section.placeholder}
            className="min-h-[220px] text-sm leading-relaxed resize-y"
          />

          {section.optional && (
            <p className="text-xs text-muted-foreground italic">
              Esta sección es opcional — podés dejarla en blanco si todavía no tenés una respuesta clara.
            </p>
          )}
        </section>
      )}

      {/* ── Estímulos step ── */}
      {isEstimulos && (
        <section className="max-w-2xl mx-auto space-y-4">
          <div className="bg-brand-accent text-white rounded-xl px-5 py-4">
            <p className="text-xs font-medium opacity-70 uppercase tracking-wide mb-0.5">Ejercicio final</p>
            <h2 className="font-serif text-2xl">Estímulos</h2>
            <p className="text-sm opacity-90 mt-0.5">Aquello que te hace sentir pleno/a y donde el tiempo vuela</p>
          </div>

          <div className="bg-white rounded-xl border border-border px-5 py-4 space-y-3">
            <p className="text-sm text-foreground leading-relaxed">
              Dedicá entre <strong>20 y 30 minutos</strong> a escribir un listado de todo aquello que, al conectarte con eso, te hace sentir pleno/a, donde el tiempo vuela y fluís.
            </p>
            <p className="text-sm text-muted-foreground">
              Puede ser cualquier cosa: <strong>lugares, personas, animales, acciones, situaciones, actividades específicas</strong>.
            </p>
            <div className="space-y-1 text-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Condiciones:</p>
              <ul className="space-y-1 ml-1">
                {[
                  "Lo hayas hecho al menos una vez.",
                  "Te haya generado disfrute, bienestar o plenitud.",
                  "Lo describas de la forma más específica posible.",
                ].map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-brand-accent shrink-0 mt-0.5">·</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/20 px-3 py-2.5 text-sm">
              <span className="font-medium text-brand-accent">Ejemplo:</span>{" "}
              <span className="text-foreground/80">"Me gusta escuchar rock nacional, especialmente cuando manejo de noche o en recitales en vivo."</span>
            </div>
          </div>

          <div className="space-y-2">
            {estimulos.map((val, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input
                  value={val}
                  onChange={(e) => setEstimulos((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                  placeholder="Describí el estímulo de forma específica..."
                  className="text-sm"
                />
                {estimulos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setEstimulos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEstimulos((prev) => [...prev, ""])}
              className="w-full"
            >
              <Plus className="h-3 w-3 mr-1" /> Agregar estímulo
            </Button>
          </div>
        </section>
      )}

      {/* ── Step bar ── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-white/95 backdrop-blur px-4 py-3 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">Paso {stepNum} de {TOTAL_STEPS}</p>
            <Progress value={pct} className="h-1.5" />
          </div>
          <div className="flex gap-2 shrink-0">
            {step > 0 && (
              <Button variant="outline" onClick={goBack}>← Atrás</Button>
            )}
            {!isEstimulos ? (
              <Button onClick={goNext} className="bg-brand-accent hover:bg-brand-accent-dark">
                Continuar →
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={saving} className="bg-brand-accent hover:bg-brand-accent-dark">
                {saving ? "Enviando..." : "Finalizar y enviar"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
