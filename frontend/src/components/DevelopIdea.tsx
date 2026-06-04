import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Briefcase, Lightbulb, Save } from "lucide-react"
import type { TestApi } from "@/lib/testApi"

// Post-test workspace (F7): the user develops the idea they chose in the Tablero.
// The app is only the platform — all content is authored by the user, no AI.
// Business idea → Business Model Canvas; job idea → a research workspace.

const CANVAS_BLOCKS: { key: string; label: string }[] = [
  { key: "sociosClave", label: "Socios clave" },
  { key: "actividadesClave", label: "Actividades clave" },
  { key: "recursosClave", label: "Recursos clave" },
  { key: "propuestaValor", label: "Propuesta de valor" },
  { key: "relacionClientes", label: "Relación con clientes" },
  { key: "canales", label: "Canales" },
  { key: "segmentos", label: "Segmentos de clientes" },
  { key: "estructuraCostos", label: "Estructura de costos" },
  { key: "fuentesIngresos", label: "Fuentes de ingresos" },
]

const JOB_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "roles", label: "Puestos / roles a investigar", placeholder: "Uno por línea..." },
  { key: "busquedas", label: "Búsquedas y job postings", placeholder: "Dónde y qué buscaste..." },
  { key: "links", label: "Links encontrados", placeholder: "Pegá los links relevantes..." },
  { key: "notas", label: "Notas", placeholder: "Requisitos, observaciones, próximos pasos..." },
]

export function DevelopIdea({ api }: { api: TestApi }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [selectedIdea, setSelectedIdea] = useState("")
  const [kind, setKind] = useState<string | null>(null)
  const [content, setContent] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getDevelopment().then((d) => {
      setSelectedIdea(d.selectedIdea)
      setKind(d.kind)
      setContent((d.content as Record<string, string>) ?? {})
      setLoading(false)
    })
  }, [api])

  function set(key: string, value: string) {
    setContent((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    if (!kind) return
    setSaving(true)
    const res = await api.saveDevelopment({ kind, content })
    setSaving(false)
    toast(res.ok ? { title: "Guardado" } : { title: "Error al guardar", variant: "destructive" })
  }

  // No workspace until the test is done and an idea was chosen.
  if (loading || !selectedIdea) return null

  return (
    <div className="space-y-4 rounded-xl border border-border bg-white p-5">
      <div>
        <h3 className="font-serif text-xl text-foreground">Desarrollá tu idea</h3>
        <p className="text-sm text-muted-foreground">
          Idea elegida: <strong>{selectedIdea}</strong>
        </p>
      </div>

      {!kind && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">¿Qué tipo de idea es?</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setKind("CANVAS")} className="flex-1">
              <Lightbulb className="h-4 w-4 mr-2" /> Idea de negocio — Canvas
            </Button>
            <Button variant="outline" onClick={() => setKind("JOB")} className="flex-1">
              <Briefcase className="h-4 w-4 mr-2" /> Puesto de trabajo — Investigación
            </Button>
          </div>
        </div>
      )}

      {kind === "CANVAS" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CANVAS_BLOCKS.map((b) => (
            <div key={b.key}>
              <p className="text-xs font-medium text-muted-foreground mb-1">{b.label}</p>
              <Textarea
                value={content[b.key] ?? ""}
                onChange={(e) => set(b.key, e.target.value)}
                className="text-sm min-h-[90px]"
              />
            </div>
          ))}
        </div>
      )}

      {kind === "JOB" && (
        <div className="space-y-3">
          {JOB_FIELDS.map((f) => (
            <div key={f.key}>
              <p className="text-xs font-medium text-muted-foreground mb-1">{f.label}</p>
              <Textarea
                value={content[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="text-sm min-h-[80px]"
              />
            </div>
          ))}
        </div>
      )}

      {kind && (
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving} className="bg-brand-accent hover:bg-brand-accent-dark">
            <Save className="h-4 w-4 mr-2" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setKind(kind === "CANVAS" ? "JOB" : "CANVAS")}>
            Cambiar tipo
          </Button>
        </div>
      )}
    </div>
  )
}
