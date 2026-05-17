"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

const DRAFT_KEY = (id: string) => `tablero-ideas-draft-${id}`

export default function TableroIdeasPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [saber, setSaber] = useState<string[]>(Array(10).fill(""))
  const [querer, setQuerer] = useState<string[]>(Array(10).fill(""))
  const [sonar, setSonar] = useState<string[]>(Array(10).fill(""))
  const [brainstorming, setBrainstorming] = useState("")
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Load draft from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY(assignmentId))
    if (raw) {
      try {
        const draft = JSON.parse(raw)
        if (draft.saber) setSaber(draft.saber)
        if (draft.querer) setQuerer(draft.querer)
        if (draft.sonar) setSonar(draft.sonar)
        if (draft.brainstorming) setBrainstorming(draft.brainstorming)
      } catch {}
    }
  }, [assignmentId])

  // Auto-save draft to localStorage every 30s
  const saveDraft = useCallback(() => {
    localStorage.setItem(DRAFT_KEY(assignmentId), JSON.stringify({ saber, querer, sonar, brainstorming }))
    setLastSaved(new Date())
  }, [assignmentId, saber, querer, sonar, brainstorming])

  useEffect(() => {
    const interval = setInterval(saveDraft, 30000)
    return () => clearInterval(interval)
  }, [saveDraft])

  function updateArray(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string
  ) {
    setter((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  async function handleSubmit() {
    setSaving(true)
    saveDraft()

    const res = await fetch(`/api/client/assignments/${assignmentId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses: { saber, querer, sonar, brainstorming } }),
    })

    setSaving(false)

    if (res.ok) {
      localStorage.removeItem(DRAFT_KEY(assignmentId))
      toast({ title: "¡Tablero enviado!" })
      router.push("/client")
    } else {
      toast({ title: "Error al enviar", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Tablero de Ideas</h1>
        <p className="text-sm text-muted-foreground">
          Completá las tres columnas y luego hacé tu brainstorming
          {lastSaved && (
            <span className="ml-2 text-xs text-green-600">· Guardado automáticamente</span>
          )}
        </p>
      </div>

      {/* Three columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SABER */}
        <div className="space-y-3">
          <div className="bg-brand-accent text-white rounded-lg px-4 py-3">
            <h2 className="font-serif text-lg font-medium">SABER</h2>
            <p className="text-xs mt-0.5 opacity-90">Mi experiencia específica</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Principales áreas de experiencia, funciones/roles/tareas en las que tengo experiencia laboral (formal, informal, ad-honorem, voluntariado)
          </p>
          <div className="space-y-2">
            {saber.map((val, i) => (
              <Input
                key={i}
                value={val}
                onChange={(e) => updateArray(setSaber, i, e.target.value)}
                placeholder="Ej: Preparar reportes financieros"
                className="text-sm"
              />
            ))}
          </div>
        </div>

        {/* QUERER */}
        <div className="space-y-3">
          <div className="bg-brand-secondary text-white rounded-lg px-4 py-3">
            <h2 className="font-serif text-lg font-medium">QUERER</h2>
            <p className="text-xs mt-0.5 opacity-90">Acciones en las que fluyo</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Todo lo que me gusta hacer, actividades que disfruto, tanto de mi vida personal como laboral (hobbies, actividades informales)
          </p>
          <div className="space-y-2">
            {querer.map((val, i) => (
              <Input
                key={i}
                value={val}
                onChange={(e) => updateArray(setQuerer, i, e.target.value)}
                placeholder="Ej: Mountain bike"
                className="text-sm"
              />
            ))}
          </div>
        </div>

        {/* SOÑAR */}
        <div className="space-y-3">
          <div className="bg-indigo-600 text-white rounded-lg px-4 py-3">
            <h2 className="font-serif text-lg font-medium">SOÑAR</h2>
            <p className="text-xs mt-0.5 opacity-90">Aspiraciones a futuro</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Aspiraciones futuras respecto de lo que me gustaría hacer. Conocimientos/aprendizajes que desearía adquirir.
          </p>
          <div className="space-y-2">
            {sonar.map((val, i) => (
              <Input
                key={i}
                value={val}
                onChange={(e) => updateArray(setSonar, i, e.target.value)}
                placeholder="Ej: Aprender a tirarme en paracaídas"
                className="text-sm"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Brainstorming */}
      <div className="space-y-3">
        <div className="bg-gray-800 text-white rounded-lg px-4 py-3">
          <h2 className="font-serif text-lg font-medium">BRAINSTORMING: Conectando Datos</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          A partir de unir, mezclar los datos de las tres columnas, escribí todas las posibilidades que se te ocurren: nuevas ideas de negocio, trabajos, ocupaciones, proyectos laborales que te resultan atractivos. No descartes ninguna posibilidad por considerarla difícil o inviable.
        </p>
        <Textarea
          value={brainstorming}
          onChange={(e) => setBrainstorming(e.target.value)}
          placeholder="Escribí todas tus ideas aquí..."
          className="min-h-[160px] text-sm"
        />
      </div>

      <div className="flex gap-3">
        <Button
          onClick={saveDraft}
          variant="outline"
        >
          Guardar borrador
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-brand-accent hover:bg-brand-accent-dark flex-1"
        >
          {saving ? "Enviando..." : "Enviar tablero"}
        </Button>
      </div>
    </div>
  )
}
