import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, X, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { TestApi } from "@/lib/testApi"
import { discardDraft, loadDraft, useAutosave } from "@/lib/draft"
import { SaveIndicator } from "@/components/SaveIndicator"
import { InfoHint } from "@/components/canvas/InfoHint"

const DRAFT_KEY = (id: string) => `piramide-draft-${id}`
const PILL_MAX_LEN = 40
const ESPECIALIDAD_MAX_LEN = 120

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

const CONTEXTOS = [
  "La Psicología","La Familia","La Educación","Los medios de Comunicación",
  "La Salud Pública","Los ancianos","Los Niños","Los Pobres","El Campo",
  "La Agricultura","La Drogadicción","La delincuencia juvenil","La Salud",
  "Las Empresas","La Universidad","Las organizaciones Sociales",
  "El Partido Político","La Iglesia","Los enfermos y desvalidos",
  "El desarrollo humano","El Barrio","El aprendizaje",
  "Las potencias del hombre","Los libros","La comida",
  "Administración de empresas","Los viajes","La sexualidad","Los deportes",
  "La tecnología","La defensa","El trato a los animales",
  "Asuntos Internacionales","Proyectos Multiculturales",
  "Los recursos naturales (agua, viento, energía solar)","Las comunidades",
  "La exploración del espacio","La exploración de la mente","La literatura",
  "El arte","La ética","La filosofía","La evaluación","La música",
  "La arqueología","Las relaciones laborales","El trabajo","La moda",
  "ONGs","Empresas de Triple Impacto","Energías Renovables","IoT",
  "Robótica","Diversidad","Género","Minorías","Migraciones","Inclusión",
  "Criptomonedas","Docencia",
]

const LEVELS = [
  { key: "especialidad", label: "ESPECIALIDAD", color: "#2D6A4F", points: "40,10 60,10 55,30 45,30", cy: 20, rightX: 57.5 },
  { key: "contextos", label: "CONTEXTOS", color: "#3D8A6A", points: "45,30 55,30 62,50 38,50", cy: 40, rightX: 58.5 },
  { key: "fortalezas", label: "FORTALEZAS", color: "#4EA87F", points: "38,50 62,50 68,70 32,70", cy: 60, rightX: 65 },
  { key: "valores", label: "VALORES", color: "#60C595", points: "32,70 68,70 74,90 26,90", cy: 80, rightX: 71 },
  { key: "rol", label: "ROL", color: "#73D9AB", points: "26,90 74,90 80,110 20,110", cy: 100, rightX: 77 },
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
    helpers: CONTEXTOS,
    helperLabel: "Ver lista de contextos →",
    placeholder: "Ej.: educación, salud mental, medio ambiente...",
  },
]

const ESPECIALIDAD_HINT = "Por cada uno de tus 3 contextos, escribí tu especialidad concreta — el nicho o tema específico donde vas a dejar tu huella. Ej.: contexto GÉNERO → \"Coach de bienestar para mujeres profesionales\"; ESPIRITUALIDAD → \"Facilitadora de retiros\"; LIDERAZGO → \"Talleres para equipos\"."

function normalize(v: string) {
  return v.trim().replace(/\s+/g, " ")
}

function PyramidSVG({ active, onLevel }: { active: string; onLevel: (k: string) => void }) {
  // viewBox recortado — el original 0 0 140 120 dejaba ~10 unidades de
  // padding vacío arriba y abajo del contenido (polígonos y=10→110), que se
  // percibía como espacio de más arriba de la pirámide.
  return (
    <svg viewBox="0 6 140 108" className="w-full max-w-sm mx-auto" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.1))" }}>
      {LEVELS.map((level) => {
        const isActive = active === level.key
        return (
          <g key={level.key} onClick={() => onLevel(level.key)} className="cursor-pointer">
            <polygon
              points={level.points}
              fill={isActive ? "#1E4D38" : level.color}
              stroke="white"
              strokeWidth="1"
              className="transition-all duration-200"
            />
            <line
              x1={level.rightX}
              y1={level.cy}
              x2={83}
              y2={level.cy}
              stroke={isActive ? "#1E4D38" : level.color}
              strokeWidth="0.6"
              opacity="0.7"
            />
            <text
              x={85}
              y={level.cy + 2}
              textAnchor="start"
              fill={isActive ? "#1E4D38" : "#1F2937"}
              fontSize="6"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              {level.label}
            </text>
          </g>
        )
      })}
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
          tabIndex={-1}
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
      setVal(next.slice(0, PILL_MAX_LEN))
      return
    }
    const parts = next.split(",")
    const tail = parts.pop() ?? ""
    for (const p of parts) {
      if (p.trim()) onAdd(p)
    }
    setVal(tail.slice(0, PILL_MAX_LEN))
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
        maxLength={PILL_MAX_LEN}
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

const RECAP_ROWS: { key: PillKey; label: string; color: string }[] = [
  { key: "contextos", label: "CONTEXTOS", color: "#3D8A6A" },
  { key: "fortalezas", label: "FORTALEZAS", color: "#4EA87F" },
  { key: "valores", label: "VALORES", color: "#60C595" },
  { key: "rol", label: "ROL", color: "#73D9AB" },
]

function SelectionRecap({ selected }: { selected: Selected }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Tus 3 por sección
      </p>
      {RECAP_ROWS.map((row) => (
        <div key={row.key} className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: row.color }}
            />
            <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">
              {row.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-4.5" style={{ paddingLeft: "1.125rem" }}>
            {selected[row.key].length === 0 ? (
              <span className="text-xs text-muted-foreground italic">—</span>
            ) : (
              selected[row.key].map((s) => (
                <span
                  key={s}
                  className="inline-block rounded-full bg-muted text-foreground text-[11px] px-2 py-0.5 max-w-[14rem] truncate"
                  title={s}
                >
                  {s}
                </span>
              ))
            )}
          </div>
        </div>
      ))}
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

type Step = "brainstorm" | "select" | "especialidad"

interface DraftShape {
  pools?: Partial<Pools>
  selected?: Partial<Selected>
  especialidades?: Record<string, string>
  especialidad?: string
  step?: Step
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
  const [especialidades, setEspecialidades] = useState<Record<string, string>>({})
  const [step, setStep] = useState<Step>("brainstorm")
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

      if (d.especialidades && typeof d.especialidades === "object") {
        const clean: Record<string, string> = {}
        for (const [k, v] of Object.entries(d.especialidades)) {
          if (typeof v === "string") clean[k] = v
        }
        setEspecialidades(clean)
      } else if (typeof d.especialidad === "string" && d.especialidad.trim()) {
        // legacy: split the free-text especialidad by comma into selected contextos
        const parts = d.especialidad.split(",").map((s) => s.trim())
        const map: Record<string, string> = {}
        nextSelected.contextos.forEach((c, i) => {
          if (parts[i]) map[c] = parts[i]
        })
        setEspecialidades(map)
      }

      const readyForSelect = PILL_KEYS.every((k) => nextPools[k].length >= 3)
      const readyForEspecialidad = readyForSelect && PILL_KEYS.every((k) => nextSelected[k].length === 3)
      if (d.step === "especialidad" && readyForEspecialidad) setStep("especialidad")
      else if (d.step === "select" && readyForSelect) setStep("select")
      else if (d.step === "especialidad" && readyForSelect) setStep("select")
      else setStep("brainstorm")
    }
    setHydrated(true)
  }, [assignmentId])

  useAutosave(
    DRAFT_KEY(assignmentId),
    { pools, selected, especialidades, step },
    hydrated && !submitted,
  )

  function addPill(key: PillKey, raw: string) {
    const val = normalize(raw).slice(0, PILL_MAX_LEN)
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
    // block:"center" en vez de "start" — así la caja completa queda visible
    // (con "start" el borde superior quedaba pegado al top del viewport y se
    // percibía como que el scroll caía un toque más abajo del inicio de la
    // caja).
    sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  const canGoNext = PILL_KEYS.every((k) => pools[k].length >= 3)
  const canGoEspecialidad = PILL_KEYS.every((k) => selected[k].length === 3)
  const especialidadEntries = selected.contextos.map((c) => ({
    contexto: c,
    texto: (especialidades[c] ?? "").trim(),
  }))
  const canSubmit = canGoEspecialidad && especialidadEntries.every((e) => e.texto.length > 0)

  // Secciones pendientes en el paso "elegir 3" — se usa tanto para pintar la
  // caja pendiente (borde ámbar) como para el texto y la acción de "ir al
  // primer pendiente".
  const missingSelect = SECTIONS
    .map((s) => ({
      key: s.key,
      short: s.title.replace(/^\d+\.\s*/, ""),
      need: Math.max(0, 3 - selected[s.key].length),
    }))
    .filter((m) => m.need > 0)

  function scrollToFirstMissingSelect() {
    const first = missingSelect[0]
    if (!first) return
    setActiveLevel(first.key)
    sectionRefs.current[first.key]?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  // Cuando cambia de paso, volver arriba para que el usuario recorra el nuevo
  // paso desde el principio. Usar useEffect en vez de scrollTo inline evita
  // que el scroll pase antes del rerender.
  useEffect(() => {
    if (!hydrated) return
    window.scrollTo({ top: 0, behavior: "smooth" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const finalStrings = {
    rol: selected.rol.join(", "),
    valores: selected.valores.join(", "),
    fortalezas: selected.fortalezas.join(", "),
    contextos: selected.contextos.join(", "),
    especialidad: especialidadEntries.map((e) => e.texto).filter(Boolean).join(", "),
  }

  const synth = `Mi propósito es ${finalStrings.rol || "___"} alineado a mis valores de ${finalStrings.valores || "___"}, y conectado con mis principales fortalezas: ${finalStrings.fortalezas || "___"}, para lograr impactar en ${finalStrings.contextos || "___"}, dejando mi huella a través de ${finalStrings.especialidad || "___"}.`

  async function handleSubmit() {
    setSaving(true)
    const propositoFinal = synth
    const especialidadPorContexto = especialidadEntries.reduce<Record<string, string>>((acc, e) => {
      if (e.texto) acc[e.contexto] = e.texto
      return acc
    }, {})
    const res = await api.submit({
      ...finalStrings,
      propositoFinal,
      rolPool: pools.rol,
      valoresPool: pools.valores,
      fortalezasPool: pools.fortalezas,
      contextosPool: pools.contextos,
      especialidadPorContexto,
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
            El test tiene <strong className="text-foreground">3 pantallas</strong>. Primero hacés un brainstorm por sección; después te quedás con solo 3 palabras o frases por sección; y por último escribís una especialidad concreta por cada contexto elegido.
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
                Por cada uno de tus 3 contextos elegidos, escribí una especialidad concreta — el nicho o tema específico donde vas a dejar tu huella dentro de ese contexto. La frase final se arma sola.
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
            ? "Paso 1 de 3 — agregá al menos 3 por sección"
            : step === "select"
            ? "Paso 2 de 3 — elegí exactamente 3 por sección"
            : "Paso 3 de 3 — escribí una especialidad por cada contexto"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pirámide (y recap en el paso 3) SIEMPRE centrada verticalmente en
            el viewport en pantallas grandes.
            Truco: sticky top-[50vh] + -translate-y-1/2. `top: 50vh` es
            absoluto respecto al viewport (a diferencia de `top: 50%`, que
            resuelve contra el bloque contenedor y con la celda estirada al
            alto del formulario tiraba el pegoteo a 1000+ px, fuera de la
            pantalla). El translateY(-50%) sube al elemento la mitad de su
            propia altura, dejando su centro exactamente a 50vh = centro del
            viewport, sin importar cuánto scroll se hizo. Requiere que la
            columna izquierda tenga la altura del formulario (por eso
            quitamos `lg:items-start` de la grid). */}
        <div className="space-y-4 lg:sticky lg:top-[50vh] lg:-translate-y-1/2">
          <PyramidSVG active={activeLevel} onLevel={handlePyramidClick} />
          {step !== "especialidad" && (
            <p className="text-xs text-center text-muted-foreground">Hacé click en un nivel para ir a esa sección</p>
          )}
          {step === "especialidad" && <SelectionRecap selected={selected} />}
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
              onClick={() => setStep("select")}
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
        ) : step === "select" ? (
          <div className="space-y-6">
            <div className="rounded-xl bg-brand-accent/5 border border-brand-accent/20 p-4 text-sm text-foreground">
              Ahora quedate con <strong>solo 3</strong> por sección — las que más te representan. Hacé click en las que elijas.
            </div>

            {SECTIONS.map((section) => {
              const sel = selected[section.key]
              const done = sel.length === 3
              const isActive = activeLevel === section.key
              return (
                <div
                  key={section.key}
                  ref={(el) => { sectionRefs.current[section.key] = el }}
                  className={cn(
                    "bg-white rounded-xl border-2 p-5 space-y-3 transition-colors",
                    isActive
                      ? "border-brand-accent"
                      : done
                        ? "border-border"
                        : "border-amber-300 bg-amber-50/30",
                  )}
                  onFocus={() => setActiveLevel(section.key)}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <h2 className="font-serif text-lg text-foreground">{section.title}</h2>
                      <InfoHint text={section.hint} />
                    </div>
                    <span className={cn(
                      "text-xs font-medium",
                      done ? "text-brand-accent" : "text-amber-700",
                    )}>
                      {done ? "✓ 3/3" : `${sel.length}/3 · faltan ${3 - sel.length}`}
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

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("brainstorm")}
              >
                ← Volver al brainstorm
              </Button>
              <Button
                onClick={() => {
                  if (!canGoEspecialidad) {
                    // Botón habilitado siempre para que el click dé feedback
                    // concreto (dónde falta) en vez de quedar mudo.
                    const list = missingSelect.map((m) => m.short).join(", ")
                    toast({
                      title: "Te faltan selecciones",
                      description: `Elegí 3 en: ${list}.`,
                    })
                    scrollToFirstMissingSelect()
                    return
                  }
                  setStep("especialidad")
                }}
                className="flex-1 bg-brand-accent hover:bg-brand-accent-dark"
              >
                Continuar → mi especialidad
              </Button>
            </div>
            {!canGoEspecialidad && (
              <button
                type="button"
                onClick={scrollToFirstMissingSelect}
                className="mx-auto block text-xs text-amber-700 hover:text-amber-900 underline decoration-dotted underline-offset-2"
              >
                Te falta elegir en {missingSelect.map((m) => `${m.short} (${m.need})`).join(", ")} — tocá para ir al primer pendiente
              </button>
            )}
          </div>
        ) : (
          // step === "especialidad"
          <div className="space-y-6">
            <div className="rounded-xl bg-brand-accent/5 border border-brand-accent/20 p-4 text-sm text-foreground space-y-2">
              <p><strong>Último paso.</strong> Por cada uno de tus <strong>3 contextos</strong>, escribí una especialidad concreta — el <strong>nicho o tema específico</strong> donde vas a dejar tu huella dentro de ese contexto.</p>
              <p className="text-xs text-muted-foreground">A la izquierda podés ver lo que ya elegiste en las secciones anteriores.</p>
            </div>

            <div
              ref={(el) => { sectionRefs.current["especialidad"] = el }}
              className={cn(
                "bg-white rounded-xl border-2 p-5 space-y-4 transition-colors",
                activeLevel === "especialidad" ? "border-brand-accent" : "border-border",
              )}
              onFocus={() => setActiveLevel("especialidad")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-serif text-lg text-foreground">5. MI ESPECIALIDAD</h2>
                  <InfoHint text={ESPECIALIDAD_HINT} />
                </div>
                <SaveIndicator
                  value={especialidadEntries.map((e) => `${e.contexto}:${e.texto}`).join("|")}
                  draftKey={DRAFT_KEY(assignmentId)}
                  enabled={hydrated}
                />
              </div>

              <div className="space-y-3">
                {especialidadEntries.map((entry) => (
                  <div key={entry.contexto} className="space-y-1">
                    <label className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide">
                      <span
                        className="rounded-full bg-brand-accent/15 text-brand-accent px-2 py-0.5 max-w-full truncate"
                        title={entry.contexto}
                      >
                        {entry.contexto}
                      </span>
                      <span className="text-muted-foreground normal-case tracking-normal font-normal">
                        → tu especialidad dentro de este contexto
                      </span>
                    </label>
                    <Input
                      value={especialidades[entry.contexto] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.slice(0, ESPECIALIDAD_MAX_LEN)
                        setEspecialidades((prev) => ({ ...prev, [entry.contexto]: v }))
                        setActiveLevel("especialidad")
                      }}
                      maxLength={ESPECIALIDAD_MAX_LEN}
                      placeholder="Escribí acá tu especialidad concreta..."
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("select")}
              >
                ← Volver a la selección
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
                Escribí una especialidad para cada contexto para poder enviar.
              </p>
            )}
          </div>
        )}
      </div>

      {(step === "select" || step === "especialidad") && (
        <div className="sticky bottom-4 bg-gray-900 text-white rounded-xl p-5 shadow-xl">
          <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Mi propósito</p>
          <p className="text-sm leading-relaxed text-gray-100">{synth}</p>
        </div>
      )}
    </div>
  )
}
