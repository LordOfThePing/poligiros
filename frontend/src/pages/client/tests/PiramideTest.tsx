import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
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

function HelperPanel({ items, onSelect }: { items: string[]; onSelect: (item: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto p-2">
      {items.map((item) => (
        <button
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

export default function PiramideTest({ api, assignmentId }: PiramideTestProps) {
  const { toast } = useToast()

  const [rol, setRol] = useState("")
  const [valores, setValores] = useState("")
  const [fortalezas, setFortalezas] = useState("")
  const [contextos, setContextos] = useState("")
  const [especialidad, setEspecialidad] = useState("")
  const [activeLevel, setActiveLevel] = useState("rol")
  const [showIntro, setShowIntro] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const d = loadDraft<Record<string, string>>(DRAFT_KEY(assignmentId))
    if (d) {
      if (d.rol) setRol(d.rol)
      if (d.valores) setValores(d.valores)
      if (d.fortalezas) setFortalezas(d.fortalezas)
      if (d.contextos) setContextos(d.contextos)
      if (d.especialidad) setEspecialidad(d.especialidad)
    }
    setHydrated(true)
  }, [assignmentId])

  useAutosave(
    DRAFT_KEY(assignmentId),
    { rol, valores, fortalezas, contextos, especialidad },
    hydrated && !submitted,
  )

  function handlePyramidClick(key: string) {
    setActiveLevel(key)
    sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function appendText(setter: React.Dispatch<React.SetStateAction<string>>, item: string) {
    setter((prev) => prev ? `${prev}, ${item}` : item)
  }

  const synth = `Mi propósito es ${rol || "___"} alineado a mis valores de ${valores || "___"}, y conectado con mis principales fortalezas: ${fortalezas || "___"}, para lograr impactar en ${contextos || "___"}, dejando mi huella a través de ${especialidad || "___"}.`

  async function handleSubmit() {
    setSaving(true)

    const propositoFinal = synth
    const res = await api.submit({ rol, valores, fortalezas, contextos, especialidad, propositoFinal })

    setSaving(false)

    if (res.ok) {
      discardDraft(DRAFT_KEY(assignmentId))
      toast({ title: "¡Pirámide enviada!" })
      setSubmitted(true)
    } else {
      toast({ title: "Error al enviar", variant: "destructive" })
    }
  }

  const sections = [
    {
      key: "rol",
      title: "1. MI ROL",
      instruction: "¿Qué tareas me gusta hacer? ¿Qué acciones son las que más disfruto?",
      hint: "Marcá todos los verbos que te representen y después reducí a solo 3 — los que más te resuenen.",
      helperLabel: "Ver lista de verbos →",
      helpers: VERBS,
      value: rol,
      setter: setRol,
    },
    {
      key: "valores",
      title: "2. MIS VALORES CENTRALES",
      instruction: "¿Qué valores son los más importantes para mí? ¿Qué creencias profundas guían mi vida?",
      hint: "Elegí todos los que te resuenen y después reducí a solo 3 — los que más te representen.",
      helperLabel: "Ver lista de valores →",
      helpers: VALUES,
      value: valores,
      setter: setValores,
    },
    {
      key: "fortalezas",
      title: "3. MIS FORTALEZAS",
      instruction: "¿Qué fortalezas de personalidad tengo más desarrolladas?",
      hint: "Marcá todas las que te representen y después reducí a solo 3 — las más desarrolladas.",
      helperLabel: "Ver fortalezas →",
      helpers: FORTALEZAS,
      value: fortalezas,
      setter: setFortalezas,
    },
    {
      key: "contextos",
      title: "4. CONTEXTOS DE IMPACTO",
      instruction: "¿Al servicio de quién o de qué querés disponer tu tiempo y energía? ¿En qué áreas querés generar impacto?",
      hint: "Pensá en \"los otros a quien querés servir\", NO en tus intereses personales. Ej.: si elegís VIAJAR es porque querés impactar en la gente que viaja — no porque quieras viajar vos. Elegí 3.",
      helperLabel: null as string | null,
      helpers: [] as string[],
      value: contextos,
      setter: setContextos,
    },
    {
      key: "especialidad",
      title: "5. MI ESPECIALIDAD",
      instruction: "¿Dónde querés dejar tu huella? ¿Cuál es tu nicho o tema específico dentro de cada contexto elegido?",
      hint: "Identificá al menos 3 especialidades — una por cada contexto de la hoja anterior. Ej.: contextos ESPIRITUALIDAD / COACHING / GÉNERO → \"Facilitadora de retiros espirituales, Coach de bienestar, Talleres para mujeres\".",
      helperLabel: null as string | null,
      helpers: [] as string[],
      value: especialidad,
      setter: setEspecialidad,
    },
  ]

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
            El test tiene <strong className="text-foreground">4 áreas</strong> (ROL, VALORES, FORTALEZAS, CONTEXTOS) + un cierre de <strong className="text-foreground">ESPECIALIDAD</strong> y una <strong className="text-foreground">frase final</strong> que integra todo.
          </p>

          <div className="space-y-3">
            <div>
              <p className="font-medium text-foreground">a) Pre-selección</p>
              <p className="text-muted-foreground">
                Leé con <strong className="text-foreground">velocidad y honestidad</strong> y marcá todas las opciones de la lista que te resuenen. No hay límite.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">b) Selección final</p>
              <p className="text-muted-foreground">
                Volvé a leer las marcadas y quedate con <strong className="text-foreground">3 palabras</strong> — las que más te representan.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">c) Especialidad y frase final</p>
              <p className="text-muted-foreground">
                Al terminar las 4 áreas, definís tus especialidades (nichos concretos dentro de los 3 contextos elegidos) y se arma sola la frase final de tu propósito.
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
        <p className="text-sm text-muted-foreground">Construí tu propósito profesional completando cada nivel</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
          <PyramidSVG active={activeLevel} onLevel={handlePyramidClick} />
          <p className="text-xs text-center text-muted-foreground">Hacé click en un nivel para ir a esa sección</p>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <div
              key={section.key}
              ref={(el) => { sectionRefs.current[section.key] = el }}
              className={cn(
                "bg-white rounded-xl border-2 p-5 space-y-3 transition-colors",
                activeLevel === section.key ? "border-brand-accent" : "border-border"
              )}
              onFocus={() => setActiveLevel(section.key)}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-serif text-lg text-foreground">{section.title}</h2>
                  <InfoHint text={section.hint} />
                </div>
                <SaveIndicator value={section.value} draftKey={DRAFT_KEY(assignmentId)} enabled={hydrated} />
              </div>
              <p className="text-sm text-muted-foreground">{section.instruction}</p>

              {section.helperLabel && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-brand-accent hover:text-brand-accent-dark p-0 h-auto">
                      {section.helperLabel} <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 border border-border rounded-lg overflow-hidden">
                    <HelperPanel
                      items={section.helpers}
                      onSelect={(item) => appendText(section.setter, item)}
                    />
                  </CollapsibleContent>
                </Collapsible>
              )}

              <Textarea
                value={section.value}
                onChange={(e) => { section.setter(e.target.value); setActiveLevel(section.key) }}
                rows={3}
                placeholder="Escribí aquí..."
                className="text-sm"
              />
            </div>
          ))}

          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-brand-accent hover:bg-brand-accent-dark"
          >
            {saving ? "Enviando..." : "Enviar mi pirámide"}
          </Button>
        </div>
      </div>

      <div className="sticky bottom-4 bg-gray-900 text-white rounded-xl p-5 shadow-xl">
        <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Mi propósito</p>
        <p className="text-sm leading-relaxed text-gray-100">{synth}</p>
      </div>
    </div>
  )
}
