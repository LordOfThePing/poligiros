import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, X, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { TestApi } from "@/lib/testApi"
import { discardDraft, loadDraft, useAutosave } from "@/lib/draft"
import { SaveIndicator } from "@/components/SaveIndicator"
import { InfoHint } from "@/components/canvas/InfoHint"

const DRAFT_KEY = (id: string) => `piramide-draft-${id}`

const VERBS = [
  "Aconsejar","Agilizar","Ampliar","Analizar","Apoyar","Aprender","Aprovechar","Arreglar",
  "Asociarme","Auspiciar","Ayudar","Brindar","Calcular","Cambiar","Co-crear","Colaborar",
  "Coleccionar","Combinar","Compartir","Competir","Comprender","Comunicar","Concretar",
  "Construir","Contactar","Contener","Contratar","Convencer","Conversar","Convocar",
  "Coordinar","Crecer","Cuantificar","Curar","Decidir","Defender","Desarrollar","Descubrir",
  "Dialogar","Digitalizar","Dirigir","Diseñar","Distribuir","Educar","Ejecutar","Emprender",
  "Enlazar","Enseñar","Entregar","Entretener","Entusiasmar","Escribir","Estimular","Evaluar",
  "Evolucionar","Explicar","Explorar","Expresar","Extender","Facilitar","Fantasear","Filosofar",
  "Financiar","Fomentar","Ganar","Generar","Gerenciar","Guiar","Hacer","Idear","Identificar",
  "Iluminar","Impactar","Implementar","Improvisar","Impulsar","Indagar","Iniciar","Innovar",
  "Inspirar","Integrar","Inventar","Invertir","Investigar","Juntar","Lanzar","Liderar",
  "Mantener","Mediar","Mejorar","Mostrar","Motivar","Negociar","Ofertar","Optimizar",
  "Ordenar","Organizar","Pensar","Plasmar","Presentar","Profundizar","Progresar","Promover",
  "Proyectar","Rediseñar","Recaudar","Reciclar","Recomendar","Reducir","Reestructurar",
  "Reflexionar","Relacionarse","Relajar","Renovar","Reparar","Reunir","Sanar","Satisfacer",
  "Servir","Solicitar","Traducir","Verificar","Viajar","Virtualizar",
]

const VALUES = [
  "Afecto","Amistad","Armonía Interior","Ascenso y progreso","Aventura","Ayuda a la Sociedad",
  "Ayuda a los demás","Calidad en mis actividades","Calidad de Vida","Cambio y variedad",
  "Competencia","Comunidad","Conciencia ecológica","Conducta ética","Conocimiento",
  "Cooperación","Creatividad","Crecimiento","Democracia","Desarrollo Personal",
  "Desarrollar a otros","Dinero","Eficiencia","Entusiasmo","Escalar","Equilibrio",
  "Espiritualidad","Estabilidad Laboral","Excelencia","Fama","Familia","Franqueza",
  "Ganancias económicas","Honestidad","Independencia","Influencia sobre los demás",
  "Integridad","Intimidad","Lealtad","Libertad","Liderazgo","Merito","Naturaleza",
  "Tranquilidad","Participación","Pericia","Placer","Plenitud","Poder y autoridad",
  "Posición en el Mercado","Potenciar","Prestigio intelectual","Reconocimiento",
  "Refinamiento","Relaciones","Relaciones Valiosas","Resolver situaciones complejas",
  "Desafíos Constantes","Religión","Reputación","Responsabilidad","Riqueza","Sabiduría",
  "Seguridad","Serenidad","Servicio Público","Status","Tiempo Libre","Trabajo bajo presión",
  "Trabajo con los demás","Trabajo Gratificante","Trabajo Independiente","Trabajo Intenso",
  "Tranquilidad económica","Transformar","Verdad",
]

const FORTALEZAS = [
  "Creatividad","Curiosidad","Juicio crítico","Amor por aprender","Perspectiva",
  "Valentía","Perseverancia","Honestidad","Vitalidad","Amor","Amabilidad",
  "Inteligencia social","Trabajo en equipo","Imparcialidad","Liderazgo",
  "Perdón","Humildad","Prudencia","Autorregulación","Apreciación de la belleza",
  "Gratitud","Esperanza","Humor","Espiritualidad",
]

const LEVELS = [
  { key: "especialidad", label: "ESPECIALIDAD", color: "#2D6A4F", points: "40,10 60,10 55,30 45,30" },
  { key: "contextos", label: "CONTEXTOS", color: "#3D8A6A", points: "45,30 55,30 62,50 38,50" },
  { key: "fortalezas", label: "FORTALEZAS", color: "#4EA87F", points: "38,50 62,50 68,70 32,70" },
  { key: "valores", label: "VALORES", color: "#60C595", points: "32,70 68,70 74,90 26,90" },
  { key: "rol", label: "ROL", color: "#73D9AB", points: "26,90 74,90 80,110 20,110" },
]

type PillKey = "rol" | "valores" | "fortalezas" | "contextos"
const PILL_KEYS: PillKey[] = ["rol", "valores", "fortalezas", "contextos"]

type Pools = Record<PillKey, string[]>
type Selected = Record<PillKey, string[]>

function emptyPools(): Pools {
  return { rol: [], valores: [], fortalezas: [], contextos: [] }
}

interface Section {
  key: PillKey
  title: string
  instruction: string
  hint: string
  helpers: string[]
  helperLabel: string | null
  placeholder: string
}

const SECTIONS: Section[] = [
  {
    key: "rol",
    title: "1. MI ROL",
    instruction: "¿Qué tareas me gusta hacer? ¿Qué acciones son las que más disfruto?",
    hint: "Agregá todos los verbos que te representen. Podés escribirlos vos o elegir de la lista. En el paso siguiente vas a quedarte con solo 3 — los que más te resuenen.",
    helpers: VERBS,
    helperLabel: "Ver lista de verbos →",
    placeholder: "Ej.: motivar, enseñar, crear...",
  },
  {
    key: "valores",
    title: "2. MIS VALORES CENTRALES",
    instruction: "¿Qué valores son los más importantes para mí? ¿Qué creencias profundas guían mi vida?",
    hint: "Agregá todos los que te resuenen (podés escribir los tuyos o elegir de la lista). Después vas a quedarte con solo 3 — los que más te representan.",
    helpers: VALUES,
    helperLabel: "Ver lista de valores →",
    placeholder: "Ej.: honestidad, libertad, familia...",
  },
  {
    key: "fortalezas",
    title: "3. MIS FORTALEZAS",
    instruction: "¿Qué fortalezas de personalidad tengo más desarrolladas?",
    hint: "Agregá todas las que te representen. Después vas a quedarte con solo 3 — las más desarrolladas.",
    helpers: FORTALEZAS,
    helperLabel: "Ver fortalezas →",
    placeholder: "Ej.: creatividad, perseverancia...",
  },
  {
    key: "contextos",
    title: "4. CONTEXTOS DE IMPACTO",
    instruction: "¿Al servicio de quién o de qué querés disponer tu tiempo y energía? ¿En qué áreas querés generar impacto?",
    hint: "Pensá en \"los otros a quien querés servir\", NO en tus intereses personales. Ej.: si elegís VIAJAR es porque querés impactar en la gente que viaja — no porque quieras viajar vos. Después vas a elegir 3.",
    helpers: [],
    helperLabel: null,
    placeholder: "Ej.: educación, salud mental, medio ambiente...",
  },
]

const ESPECIALIDAD_HINT = "Escribí un texto breve respondiendo las preguntas: ¿dónde querés dejar tu huella? ¿Cuál es tu nicho o tema específico dentro de cada contexto elegido? Ej.: \"Coach de bienestar para mujeres profesionales, facilitadora de retiros espirituales y talleres de liderazgo con foco en género\"."

function normalize(v: string) {
  return v.trim().replace(/\s+/g, " ")
}

function PyramidSVG({ active, onLevel }: { active: string; onLevel: (k: string) => void }) {
  return (
    <svg viewBox="0 0 100 120" className="w-full max-w-xs mx-auto" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.1))" }}>
      {LEVELS.map((level) => (
        <g key={level.key} onClick={() => onLevel(level.key)} className="cursor-pointer">
          <polygon
            points={level.points}
            fill={active === level.key ? "#1E4D38" : level.color}
            stroke="white"
            strokeWidth="1"
            className="transition-all duration-200"
          />
          <text
            x="50"
            y={level.key === "especialidad" ? 22 : level.key === "contextos" ? 42 : level.key === "fortalezas" ? 62 : level.key === "valores" ? 82 : 102}
            textAnchor="middle"
            fill="white"
            fontSize={level.key === "especialidad" ? "5" : "4.5"}
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            {level.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function Pill({
  label,
  onRemove,
  onClick,
  selectable,
  selected,
}: {
  label: string
  onRemove?: () => void
  onClick?: () => void
  selectable?: boolean
  selected?: boolean
}) {
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
        selectable ? "cursor-pointer select-none" : "",
        selected
          ? "bg-brand-accent text-white"
          : selectable
          ? "bg-muted text-foreground hover:bg-brand-accent/15"
          : "bg-muted text-foreground",
      )}
    >
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="rounded-full hover:text-destructive"
          aria-label={`Quitar ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

function PillInput({ onAdd, placeholder }: { onAdd: (v: string) => void; placeholder?: string }) {
  const [val, setVal] = useState("")
  function submit() {
    if (val.trim()) {
      onAdd(val)
      setVal("")
    }
  }
  function handleChange(next: string) {
    if (!next.includes(",")) {
      setVal(next)
      return
    }
    const parts = next.split(",")
    const tail = parts.pop() ?? ""
    for (const p of parts) {
      if (p.trim()) onAdd(p)
    }
    setVal(tail)
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        value={val}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        className="text-sm"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={submit}
        disabled={!val.trim()}
        aria-label="Agregar"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}

function HelperPanel({ items, onSelect }: { items: string[]; onSelect: (item: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto p-2">
      {items.map((item) => (
        <button
          type="button"
          key={item}
          onClick={() => onSelect(item)}
          className="text-left text-xs px-2 py-1.5 rounded bg-muted hover:bg-brand-accent/10 hover:text-brand-accent transition-colors"
        >
          {item}
        </button>
      ))}
    </div>
  )
}

interface PiramideTestProps {
  api: TestApi
  assignmentId: string
}

interface DraftShape {
  pools?: Partial<Pools>
  selected?: Partial<Selected>
  especialidad?: string
  step?: "brainstorm" | "select"
  // legacy
  rol?: string
  valores?: string
  fortalezas?: string
  contextos?: string
}

export default function PiramideTest({ api, assignmentId }: PiramideTestProps) {
  const { toast } = useToast()

  const [pools, setPools] = useState<Pools>(emptyPools)
  const [selected, setSelected] = useState<Selected>(emptyPools)
  const [especialidad, setEspecialidad] = useState("")
  const [step, setStep] = useState<"brainstorm" | "select">("brainstorm")
  const [activeLevel, setActiveLevel] = useState<string>("rol")
  const [showIntro, setShowIntro] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const d = loadDraft<DraftShape>(DRAFT_KEY(assignmentId))
    if (d) {
      const nextPools = emptyPools()
      if (d.pools) {
        for (const k of PILL_KEYS) {
          const v = d.pools[k]
          if (Array.isArray(v)) nextPools[k] = v.filter((s): s is string => typeof s === "string" && s.trim() !== "")
        }
      } else {
        // migrate legacy textarea format (comma-separated string per field)
        for (const k of PILL_KEYS) {
          const v = d[k]
          if (typeof v === "string" && v.trim()) {
            nextPools[k] = v.split(",").map(normalize).filter(Boolean)
          }
        }
      }
      setPools(nextPools)

      const nextSelected = emptyPools()
      if (d.selected) {
        for (const k of PILL_KEYS) {
          const v = d.selected[k]
          if (Array.isArray(v)) {
            nextSelected[k] = v
              .filter((s): s is string => typeof s === "string")
              .filter((s) => nextPools[k].includes(s))
              .slice(0, 3)
          }
        }
      }
      setSelected(nextSelected)

      if (typeof d.especialidad === "string") setEspecialidad(d.especialidad)

      const readyForSelect = PILL_KEYS.every((k) => nextPools[k].length >= 3)
      setStep(d.step === "select" && readyForSelect ? "select" : "brainstorm")
    }
    setHydrated(true)
  }, [assignmentId])

  useAutosave(
    DRAFT_KEY(assignmentId),
    { pools, selected, especialidad, step },
    hydrated && !submitted,
  )

  function addPill(key: PillKey, raw: string) {
    const val = normalize(raw)
    if (!val) return
    setPools((prev) => {
      if (prev[key].some((p) => p.toLowerCase() === val.toLowerCase())) return prev
      return { ...prev, [key]: [...prev[key], val] }
    })
  }

  function removePill(key: PillKey, val: string) {
    setPools((prev) => ({ ...prev, [key]: prev[key].filter((x) => x !== val) }))
    setSelected((prev) => ({ ...prev, [key]: prev[key].filter((x) => x !== val) }))
  }

  function toggleSelected(key: PillKey, val: string) {
    setSelected((prev) => {
      const cur = prev[key]
      if (cur.includes(val)) {
        return { ...prev, [key]: cur.filter((x) => x !== val) }
      }
      if (cur.length >= 3) {
        toast({
          title: "Ya elegiste 3",
          description: "Deseleccioná una antes de elegir otra.",
        })
        return prev
      }
      return { ...prev, [key]: [...cur, val] }
    })
  }

  function handlePyramidClick(key: string) {
    setActiveLevel(key)
    sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const canGoNext = PILL_KEYS.every((k) => pools[k].length >= 3)
  const canSubmit =
    PILL_KEYS.every((k) => selected[k].length === 3) && especialidad.trim().length > 0

  const finalStrings = {
    rol: selected.rol.join(", "),
    valores: selected.valores.join(", "),
    fortalezas: selected.fortalezas.join(", "),
    contextos: selected.contextos.join(", "),
    especialidad: especialidad.trim(),
  }

  const synth = `Mi propósito es ${finalStrings.rol || "___"} alineado a mis valores de ${finalStrings.valores || "___"}, y conectado con mis principales fortalezas: ${finalStrings.fortalezas || "___"}, para lograr impactar en ${finalStrings.contextos || "___"}, dejando mi huella a través de ${finalStrings.especialidad || "___"}.`

  async function handleSubmit() {
    setSaving(true)
    const propositoFinal = synth
    const res = await api.submit({
      ...finalStrings,
      propositoFinal,
      rolPool: pools.rol,
      valoresPool: pools.valores,
      fortalezasPool: pools.fortalezas,
      contextosPool: pools.contextos,
    })
    setSaving(false)

    if (res.ok) {
      discardDraft(DRAFT_KEY(assignmentId))
      toast({ title: "¡Pirámide enviada!" })
      setSubmitted(true)
    } else {
      toast({ title: "Error al enviar", variant: "destructive" })
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <p className="text-4xl">✓</p>
        <h2 className="font-serif text-2xl">¡Pirámide enviada!</h2>
        <p className="text-muted-foreground">Tus respuestas fueron guardadas correctamente.</p>
        <div className="bg-gray-900 text-white rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-2">Tu propósito</p>
          <p className="text-sm leading-relaxed">{synth}</p>
        </div>
      </div>
    )
  }

  if (showIntro) {
    return (
      <div className="space-y-6 pb-24 max-w-2xl mx-auto">
        <div>
          <h1 className="font-serif text-3xl text-foreground mb-1">Pirámide del Propósito</h1>
          <p className="text-sm text-muted-foreground">Instrucciones generales</p>
        </div>

        <div className="rounded-xl bg-brand-accent/5 border border-brand-accent/20 p-4 text-sm leading-relaxed text-foreground">
          <p className="font-medium mb-1">🎯 Objetivo</p>
          <p className="text-muted-foreground">
            Explorar, integrar y conectar las dimensiones que componen tu <strong className="text-foreground">propósito profesional</strong>: qué te gusta hacer (<strong>ROL</strong>), qué te guía (<strong>VALORES</strong> y <strong>FORTALEZAS</strong>), dónde querés generar impacto (<strong>CONTEXTOS</strong>) y en qué nicho querés dejar tu huella (<strong>ESPECIALIDAD</strong>).
          </p>
        </div>

        <div className="bg-white rounded-xl border border-border p-5 space-y-4 text-sm leading-relaxed">
          <p className="text-foreground font-medium">🧭 Cómo se completa</p>
          <p className="text-muted-foreground">
            El test tiene <strong className="text-foreground">2 pantallas</strong>. En la primera hacés un brainstorm por sección. En la segunda te quedás con solo 3 palabras o frases por sección y escribís tu especialidad.
          </p>

          <div className="space-y-3">
            <div>
              <p className="font-medium text-foreground">a) Brainstorm</p>
              <p className="text-muted-foreground">
                En las 4 secciones (ROL, VALORES, FORTALEZAS, CONTEXTOS) escribí <strong className="text-foreground">al menos 3</strong> palabras o frases que te representen. Podés escribirlas vos o elegirlas de las listas sugeridas.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">b) Selección final</p>
              <p className="text-muted-foreground">
                Volvé a leer las que agregaste y elegí <strong className="text-foreground">exactamente 3</strong> por sección — las que más te representan.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">c) Especialidad y frase final</p>
              <p className="text-muted-foreground">
                En un texto libre respondé las preguntas de ESPECIALIDAD (dónde querés dejar tu huella / cuál es tu nicho concreto dentro de cada contexto). La frase final se arma sola.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-4 text-muted-foreground">
            Se guarda solo a medida que avanzás, así que podés cortar y seguir después. En cada sección vas a encontrar un ícono <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs">ⓘ</span> con la consigna específica.
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-5 space-y-2 text-sm leading-relaxed">
          <p className="font-medium text-foreground">✍️ Ejemplo de frase final</p>
          <p className="text-muted-foreground italic">
            Mi propósito en la vida es <strong className="text-foreground not-italic">MOTIVAR, ASESORAR, IMPULSAR</strong>, alineado a mis valores centrales <strong className="text-foreground not-italic">AMOR, SALUD, ARMONÍA</strong> y conectado con mis fortalezas <strong className="text-foreground not-italic">DESEO DE APRENDER, INTEGRIDAD, VITALIDAD</strong>; para lograr impactar en <strong className="text-foreground not-italic">DESARROLLO HUMANO, EDUCACIÓN, ESPIRITUALIDAD</strong>, dejando mi huella como <strong className="text-foreground not-italic">Coach de carrera, docente universitaria y mentora holística con foco espiritual</strong>.
          </p>
        </div>

        <Button
          onClick={() => setShowIntro(false)}
          size="lg"
          className="w-full bg-brand-accent hover:bg-brand-accent-dark"
        >
          Comenzar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Mi Pirámide del Propósito</h1>
        <p className="text-sm text-muted-foreground">
          {step === "brainstorm"
            ? "Paso 1 de 2 — agregá al menos 3 por sección"
            : "Paso 2 de 2 — elegí exactamente 3 por sección"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
          <PyramidSVG active={activeLevel} onLevel={handlePyramidClick} />
          <p className="text-xs text-center text-muted-foreground">Hacé click en un nivel para ir a esa sección</p>
        </div>

        {step === "brainstorm" ? (
          <div className="space-y-6">
            {SECTIONS.map((section) => {
              const count = pools[section.key].length
              const ok = count >= 3
              return (
                <div
                  key={section.key}
                  ref={(el) => { sectionRefs.current[section.key] = el }}
                  className={cn(
                    "bg-white rounded-xl border-2 p-5 space-y-3 transition-colors",
                    activeLevel === section.key ? "border-brand-accent" : "border-border",
                  )}
                  onFocus={() => setActiveLevel(section.key)}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <h2 className="font-serif text-lg text-foreground">{section.title}</h2>
                      <InfoHint text={section.hint} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-medium", ok ? "text-brand-accent" : "text-muted-foreground")}>
                        {count} {count === 1 ? "agregada" : "agregadas"} · mín. 3
                      </span>
                      <SaveIndicator value={pools[section.key].join("|")} draftKey={DRAFT_KEY(assignmentId)} enabled={hydrated} />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{section.instruction}</p>

                  <PillInput
                    placeholder={section.placeholder}
                    onAdd={(v) => { addPill(section.key, v); setActiveLevel(section.key) }}
                  />

                  {pools[section.key].length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {pools[section.key].map((p) => (
                        <Pill key={p} label={p} onRemove={() => removePill(section.key, p)} />
                      ))}
                    </div>
                  )}

                  {section.helperLabel && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-brand-accent hover:text-brand-accent-dark p-0 h-auto">
                          {section.helperLabel} <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 border border-border rounded-lg overflow-hidden">
                        <HelperPanel
                          items={section.helpers.filter(
                            (h) => !pools[section.key].some((p) => p.toLowerCase() === h.toLowerCase()),
                          )}
                          onSelect={(item) => addPill(section.key, item)}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )
            })}

            <Button
              onClick={() => { setStep("select"); window.scrollTo({ top: 0, behavior: "smooth" }) }}
              disabled={!canGoNext}
              size="lg"
              className="w-full bg-brand-accent hover:bg-brand-accent-dark"
            >
              Siguiente: elegir mis 3 por sección
            </Button>
            {!canGoNext && (
              <p className="text-xs text-muted-foreground text-center">
                Necesitás al menos 3 en cada sección para avanzar.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl bg-brand-accent/5 border border-brand-accent/20 p-4 text-sm text-foreground">
              Ahora quedate con <strong>solo 3</strong> por sección — las que más te representan. Hacé click en las que elijas.
            </div>

            {SECTIONS.map((section) => {
              const sel = selected[section.key]
              const done = sel.length === 3
              return (
                <div
                  key={section.key}
                  ref={(el) => { sectionRefs.current[section.key] = el }}
                  className={cn(
                    "bg-white rounded-xl border-2 p-5 space-y-3 transition-colors",
                    activeLevel === section.key ? "border-brand-accent" : "border-border",
                  )}
                  onFocus={() => setActiveLevel(section.key)}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <h2 className="font-serif text-lg text-foreground">{section.title}</h2>
                      <InfoHint text={section.hint} />
                    </div>
                    <span className={cn("text-xs font-medium", done ? "text-brand-accent" : "text-muted-foreground")}>
                      {sel.length}/3 seleccionadas
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{section.instruction}</p>

                  {pools[section.key].length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sin opciones — volvé al paso anterior y agregá al menos 3.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {pools[section.key].map((p) => (
                        <Pill
                          key={p}
                          label={p}
                          selectable
                          selected={sel.includes(p)}
                          onClick={() => toggleSelected(section.key, p)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            <div
              ref={(el) => { sectionRefs.current["especialidad"] = el }}
              className={cn(
                "bg-white rounded-xl border-2 p-5 space-y-3 transition-colors",
                activeLevel === "especialidad" ? "border-brand-accent" : "border-border",
              )}
              onFocus={() => setActiveLevel("especialidad")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-serif text-lg text-foreground">5. MI ESPECIALIDAD</h2>
                  <InfoHint text={ESPECIALIDAD_HINT} />
                </div>
                <SaveIndicator value={especialidad} draftKey={DRAFT_KEY(assignmentId)} enabled={hydrated} />
              </div>
              <p className="text-sm text-muted-foreground">
                ¿Dónde querés dejar tu huella? ¿Cuál es tu nicho o tema específico dentro de cada contexto elegido? Respondé en un texto libre.
              </p>
              <Textarea
                value={especialidad}
                onChange={(e) => { setEspecialidad(e.target.value); setActiveLevel("especialidad") }}
                rows={5}
                placeholder="Escribí tu especialidad aquí, respondiendo las preguntas..."
                className="text-sm"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setStep("brainstorm"); window.scrollTo({ top: 0, behavior: "smooth" }) }}
              >
                ← Volver al brainstorm
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !canSubmit}
                className="flex-1 bg-brand-accent hover:bg-brand-accent-dark"
              >
                {saving ? "Enviando..." : "Enviar mi pirámide"}
              </Button>
            </div>
            {!canSubmit && (
              <p className="text-xs text-muted-foreground text-center">
                Elegí exactamente 3 en cada sección y escribí tu especialidad para enviar.
              </p>
            )}
          </div>
        )}
      </div>

      {step === "select" && (
        <div className="sticky bottom-4 bg-gray-900 text-white rounded-xl p-5 shadow-xl">
          <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Mi propósito</p>
          <p className="text-sm leading-relaxed text-gray-100">{synth}</p>
        </div>
      )}
    </div>
  )
}
