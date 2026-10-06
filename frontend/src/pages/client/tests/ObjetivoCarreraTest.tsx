import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Info, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { TestApi } from "@/lib/testApi"
import { loadDraft, discardDraft, useAutosave } from "@/lib/draft"

interface Prefill {
  rol: string
  valores: string
  propositoFinal: string
}

interface ObjetivoCarreraTestProps {
  api: TestApi
  assignmentId: string
  prefillPiramide?: Prefill
}

const DRAFT_KEY = (id: string) => `objetivo-carrera-draft-${id}`

type Form = {
  puesto: string
  tareas: string
  area: string
  tipoOrganizacion: string
  rubro: string
  condiciones: string
  valores: string
}

const EMPTY: Form = {
  puesto: "",
  tareas: "",
  area: "",
  tipoOrganizacion: "",
  rubro: "",
  condiciones: "",
  valores: "",
}

/** La frase síntesis que se arma sola a partir de los campos. */
function buildSintesis(f: Form): string {
  const parts = [
    `Mi OBJETIVO ES: un puesto / rol de ${f.puesto.trim() || "___"},`,
    `realizando tareas que incluyan ${f.tareas.trim() || "___"}.`,
    `En el área ${f.area.trim() || "___"}.`,
    `En una ORGANIZACIÓN / NEGOCIO que sea ${f.tipoOrganizacion.trim() || "___"}.`,
    `En el RUBRO O NICHO ${f.rubro.trim() || "___"}.`,
    `Bajo las siguientes condiciones de satisfacción: ${f.condiciones.trim() || "___"},`,
    `acorde a mis principales VALORES, que no estoy dispuesto a dejar de lado y que son: ${f.valores.trim() || "___"}.`,
  ]
  return parts.join(" ")
}

const SECTIONS: {
  key: keyof Form
  label: string
  helper: string
  examples: string
  placeholder: string
  multiline?: boolean
}[] = [
  {
    key: "puesto",
    label: "1. Puesto / Rol / Función",
    helper: "¿Qué rol querés ocupar? ¿Analista, Coordinador, Jefe, Gerente, Director? ¿Local o regional? ¿Socio, consultor, emprendedor?",
    examples: "Analista · Coordinador · Jefe · Gerente · Director · Ejecutivo de cuentas · Líder de proyecto · Local o regional · Con base en Argentina o en otro país · Socio · Accionista · Consultor",
    placeholder: "Ej.: Líder de proyecto, con base en Argentina",
  },
  {
    key: "tareas",
    label: "2. Tareas / Responsabilidades",
    helper: "¿Qué tareas concretas vas a estar haciendo? Describí la actividad.",
    examples: "Diseñar programas de desarrollo · Coordinar equipos interdisciplinarios · Facilitar talleres · Hacer análisis estratégico · Vender · Enseñar",
    placeholder: "Ej.: facilitar talleres de liderazgo y acompañar procesos individuales",
    multiline: true,
  },
  {
    key: "area",
    label: "3. Área",
    helper: "¿En qué área querés trabajar? ¿Gerencia General, staff (RRHH, Finanzas, Sistemas…), no-staff (Comercial, Marketing, Publicidad…), Carrera / Negocios?",
    examples: "Gerencia General · RRHH · Finanzas · Sistemas · Comercial · Marketing · Publicidad · Carrera · Negocios",
    placeholder: "Ej.: Desarrollo de Carrera / Capital humano",
  },
  {
    key: "tipoOrganizacion",
    label: "4. Tipo de Organización / Negocio",
    helper: "¿Empresa, grupo empresario, institución privada o estatal, ONG, organismo internacional? ¿Qué capital y alcance? ¿De qué origen?",
    examples: "Empresa · Grupo empresario · Universidad · ONG nacional o internacional · El estado · Organismo internacional (BID, OEA) · Multinacional · Nacional · Regional · De origen suizo, brasilero, americano, chino, etc.",
    placeholder: "Ej.: Multinacional con oficina regional en Argentina",
  },
  {
    key: "rubro",
    label: "5. Rubro / Nicho",
    helper: "¿Qué industria o nicho? Si pensás en un nicho nuevo e inexistente, ponelo igual.",
    examples: "Tecnología · Telcos · Sistemas · Consumo masivo · Productos o servicios · Financiera · Agro · Consultoría · Deportes · Turismo · Gastronómico · Un nicho nuevo e inexistente",
    placeholder: "Ej.: Consultoría de carrera para profesionales de la salud",
  },
  {
    key: "condiciones",
    label: "6. Condiciones laborales",
    helper: "Contrato, horario, lugar, salario (mínimo aceptable y óptimo), paquete de beneficios, desarrollo de carrera, cultura/clima.",
    examples: "Relación de dependencia / contrato por proyectos / honorarios · Full-time (¿cuántas horas?) · Part-time · Flexible · Por objetivos · Desde casa · Oficina fija · Viajes (% y a qué lugares) · Salario de mercado / mínimo / óptimo · Fijo o variable · Beneficios (celular, OSDE, auto…) · Desarrollo de carrera · Cultura y liderazgo",
    placeholder: "Ej.: contrato por proyectos, flexible, mayormente desde casa, salario de mercado para la posición...",
    multiline: true,
  },
  {
    key: "valores",
    label: "7. Mis valores centrales",
    helper: "Los valores que no estás dispuesta/o a dejar de lado.",
    examples: "Honestidad · Libertad · Familia · Crecimiento · Desarrollo personal · Trabajo en equipo · Impacto social · Equilibrio · Aprendizaje",
    placeholder: "Ej.: amor, salud, armonía",
  },
]

export default function ObjetivoCarreraTest({
  api,
  assignmentId,
  prefillPiramide,
}: ObjetivoCarreraTestProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const d = loadDraft<Partial<Form>>(DRAFT_KEY(assignmentId))
    if (d) {
      setForm({ ...EMPTY, ...d })
    } else if (prefillPiramide) {
      // Si no hay borrador, pre-llenar rol + valores desde la Pirámide (editable).
      setForm({
        ...EMPTY,
        puesto: prefillPiramide.rol,
        valores: prefillPiramide.valores,
      })
    }
    setHydrated(true)
  }, [assignmentId, prefillPiramide])

  useAutosave(DRAFT_KEY(assignmentId), form, hydrated && !submitted)

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const sintesis = buildSintesis(form)
  const canSubmit = SECTIONS.every((s) => form[s.key].trim().length > 0)

  async function submit() {
    setSaving(true)
    const payload = { ...form, sintesis }
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
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <p className="text-4xl">✓</p>
        <h2 className="font-serif text-2xl text-foreground">¡Objetivo enviado!</h2>
        <div className="bg-gray-900 text-white rounded-xl p-5 text-left">
          <p className="text-xs text-gray-400 mb-2">Tu objetivo</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{sintesis}</p>
        </div>
      </div>
    )
  }

  const hasPiramidePrefill = Boolean(
    prefillPiramide && (prefillPiramide.rol || prefillPiramide.valores),
  )

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto">
      <div>
        <h2 className="font-serif text-2xl text-foreground mb-1">Objetivo de Carrera</h2>
        <p className="text-sm text-muted-foreground">
          Completá los factores con la información pertinente, de acuerdo a tus
          motivaciones. Mientras escribís se va armando la frase síntesis de tu
          objetivo.
        </p>
      </div>

      {hasPiramidePrefill && (
        <div className="flex items-start gap-2 rounded-lg border border-brand-accent/20 bg-brand-accent/5 px-3 py-2.5 text-sm text-foreground">
          <Sparkles className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
          <p>
            Pre-llenamos <strong>rol</strong> y <strong>valores</strong> con lo que elegiste en tu Pirámide del
            Propósito. Son editables — ajustalos si querés para este objetivo específico.
          </p>
        </div>
      )}

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4" /> Ver anexo con ejemplos de factores
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
          <p>
            Si no se te ocurre qué poner en cada factor, mirá los ejemplos. Cada
            campo del formulario tiene su propia lista debajo.
          </p>
        </CollapsibleContent>
      </Collapsible>

      {SECTIONS.map((s) => (
        <div key={s.key} className="bg-white rounded-xl border border-border p-5 space-y-3">
          <div>
            <Label className="text-sm font-serif text-foreground block mb-1">{s.label}</Label>
            <p className="text-xs text-muted-foreground">{s.helper}</p>
          </div>

          {s.multiline ? (
            <Textarea
              value={form[s.key]}
              onChange={(e) => set(s.key, e.target.value)}
              placeholder={s.placeholder}
              className="text-sm min-h-[90px]"
            />
          ) : (
            <Input
              value={form[s.key]}
              onChange={(e) => set(s.key, e.target.value)}
              placeholder={s.placeholder}
              className="text-sm"
            />
          )}

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-brand-accent hover:text-brand-accent-dark p-0 h-auto text-xs"
              >
                Ver ejemplos del anexo <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground leading-relaxed">
              {s.examples}
            </CollapsibleContent>
          </Collapsible>
        </div>
      ))}

      <div className="sticky bottom-4 bg-gray-900 text-white rounded-xl p-5 shadow-xl">
        <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Tu objetivo</p>
        <p className="text-sm leading-relaxed text-gray-100 whitespace-pre-wrap">{sintesis}</p>
      </div>

      <Button
        className="w-full bg-brand-accent hover:bg-brand-accent-dark"
        disabled={!canSubmit || saving}
        onClick={submit}
      >
        {saving ? "Enviando..." : "Enviar objetivo"}
      </Button>
      {!canSubmit && (
        <p className="text-xs text-muted-foreground text-center">
          Completá todos los campos para poder enviar.
        </p>
      )}
    </div>
  )
}
