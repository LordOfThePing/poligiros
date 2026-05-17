"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

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

export default function PiramidePropositoPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [rol, setRol] = useState("")
  const [valores, setValores] = useState("")
  const [fortalezas, setFortalezas] = useState("")
  const [contextos, setContextos] = useState("")
  const [especialidad, setEspecialidad] = useState("")
  const [activeLevel, setActiveLevel] = useState("rol")
  const [saving, setSaving] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Load draft
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY(assignmentId))
    if (raw) {
      try {
        const d = JSON.parse(raw)
        if (d.rol) setRol(d.rol)
        if (d.valores) setValores(d.valores)
        if (d.fortalezas) setFortalezas(d.fortalezas)
        if (d.contextos) setContextos(d.contextos)
        if (d.especialidad) setEspecialidad(d.especialidad)
      } catch {}
    }
  }, [assignmentId])

  // Auto-save draft
  const saveDraft = useCallback(() => {
    localStorage.setItem(DRAFT_KEY(assignmentId), JSON.stringify({ rol, valores, fortalezas, contextos, especialidad }))
  }, [assignmentId, rol, valores, fortalezas, contextos, especialidad])

  useEffect(() => {
    const interval = setInterval(saveDraft, 30000)
    return () => clearInterval(interval)
  }, [saveDraft])

  function handlePyramidClick(key: string) {
    setActiveLevel(key)
    sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function appendText(setter: React.Dispatch<React.SetStateAction<string>>, item: string) {
    setter((prev) => prev ? `${prev}, ${item}` : item)
  }

  // Live synthesis
  const synth = `Mi propósito es ${rol || "___"} alineado a mis valores de ${valores || "___"}, y conectado con mis principales fortalezas: ${fortalezas || "___"}, para lograr impactar en ${contextos || "___"}, dejando mi huella a través de ${especialidad || "___"}.`

  async function handleSubmit() {
    setSaving(true)
    saveDraft()

    const propositoFinal = synth
    const res = await fetch(`/api/client/assignments/${assignmentId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses: { rol, valores, fortalezas, contextos, especialidad, propositoFinal } }),
    })

    setSaving(false)

    if (res.ok) {
      localStorage.removeItem(DRAFT_KEY(assignmentId))
      toast({ title: "¡Pirámide enviada!" })
      router.push("/client")
    } else {
      toast({ title: "Error al enviar", variant: "destructive" })
    }
  }

  const sections = [
    {
      key: "rol",
      title: "1. MI ROL",
      instruction: "¿Qué hacés? Elegí verbos de acción que te representen.",
      helperLabel: "Ver lista de verbos →",
      helpers: VERBS,
      value: rol,
      setter: setRol,
    },
    {
      key: "valores",
      title: "2. MIS VALORES CENTRALES",
      instruction: "¿Qué es lo más importante para vos en tu vida y trabajo?",
      helperLabel: "Ver lista de valores →",
      helpers: VALUES,
      value: valores,
      setter: setValores,
    },
    {
      key: "fortalezas",
      title: "3. MIS FORTALEZAS",
      instruction: "¿En qué sos realmente bueno/a? ¿Qué capacidades te destacan?",
      helperLabel: "Ver fortalezas →",
      helpers: FORTALEZAS,
      value: fortalezas,
      setter: setFortalezas,
    },
    {
      key: "contextos",
      title: "4. CONTEXTOS DE IMPACTO",
      instruction: "¿A quién querés ayudar o impactar? ¿En qué ámbitos o contextos?",
      helperLabel: null,
      helpers: [],
      value: contextos,
      setter: setContextos,
    },
    {
      key: "especialidad",
      title: "5. MI ESPECIALIDAD",
      instruction: "¿Cuál es tu área de expertise o tema de especialización?",
      helperLabel: null,
      helpers: [],
      value: especialidad,
      setter: setEspecialidad,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Mi Pirámide del Propósito</h1>
        <p className="text-sm text-muted-foreground">Construí tu propósito profesional completando cada nivel</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: SVG pyramid */}
        <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
          <PyramidSVG active={activeLevel} onLevel={handlePyramidClick} />
          <p className="text-xs text-center text-muted-foreground">Hacé click en un nivel para ir a esa sección</p>
        </div>

        {/* Right: form sections */}
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
              <h2 className="font-serif text-lg text-foreground">{section.title}</h2>
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

      {/* Sticky synthesis */}
      <div className="sticky bottom-4 bg-gray-900 text-white rounded-xl p-5 shadow-xl">
        <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Mi propósito</p>
        <p className="text-sm leading-relaxed text-gray-100">{synth}</p>
      </div>
    </div>
  )
}
