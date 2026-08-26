import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, X, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { TestApi } from "@/lib/testApi"

interface TareasExploracionTestProps {
  api: TestApi
  assignmentId: string
  initialResponses?: Record<string, unknown>
  onDone?: () => void
}

/**
 * "Tareas de exploración" — test separado (post-Tablero). El coach anota qué
 * va a investigar después: cursos, eventos, nichos o industrias ligadas a sus ideas.
 */
export default function TareasExploracionTest({ api, initialResponses, onDone }: TareasExploracionTestProps) {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<string[]>(Array(3).fill(""))
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (initialResponses && Array.isArray((initialResponses.tasks as unknown) ?? initialResponses.explorationTasks)) {
      const arr = Array.isArray(initialResponses.tasks) ? initialResponses.tasks : (initialResponses.explorationTasks as unknown[])
      const strs = (arr as unknown[]).filter((x): x is string => typeof x === "string")
      if (strs.length) setTasks([...strs, ...Array(Math.max(0, 3 - strs.length)).fill("")])
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(i: number, v: string) {
    setTasks((prev) => prev.map((x, idx) => (idx === i ? v : x)))
  }
  function add() { setTasks((prev) => [...prev, ""]) }
  function remove(i: number) { setTasks((prev) => prev.filter((_, idx) => idx !== i)) }

  async function submit() {
    setSaving(true)
    const res = await api.submit({ tasks: tasks.map((s) => s.trim()).filter(Boolean) })
    setSaving(false)
    if (res.ok) {
      if (onDone) onDone();
      else { setDone(true); }
    } else {
      toast({ title: res.status === 409 ? "Ya completaste este test" : "Error al enviar", variant: "destructive" })
    }
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-3">
        <p className="text-4xl">✓</p>
        <h2 className="font-serif text-2xl text-foreground">¡Tareas de exploración enviadas!</h2>
        <p className="text-muted-foreground">Tus respuestas fueron guardadas correctamente.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto">
      <div>
        <h2 className="font-serif text-2xl text-foreground mb-1">Tareas de exploración</h2>
        <p className="text-sm text-muted-foreground">
          Anotá qué te llevás para investigar después del Tablero: cursos, eventos, nichos o
          industrias ligadas a tus ideas (por ejemplo el mundo gastronómico, el gaming, la
          fotografía o el contenido deportivo). Son tus próximos pasos para explorar.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-brand-accent/20 bg-brand-accent/5 px-3 py-2.5 text-sm text-foreground">
        <Sparkles className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
        <p>Escribí por lo menos <strong>una tarea</strong> concreta. Cuanto más específica sea, mejor para tus próximos pasos.</p>
      </div>

      <div className="space-y-2">
        {tasks.map((val, i) => (
          <div key={i} className="flex items-center gap-1">
            <Input
              value={val}
              onChange={(e) => update(i, e.target.value)}
              placeholder={"Ej: Investigar cursos de filmmaking deportivo"}
              className="text-sm"
            />
            {tasks.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Quitar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={add} className="w-full">
        <Plus className="h-3 w-3 mr-1" /> Agregar
      </Button>

      <Button
        className="bg-brand-accent hover:bg-brand-accent-dark w-full"
        disabled={saving || !tasks.map((s) => s.trim()).filter(Boolean).length}
        onClick={submit}
      >
        {saving ? "Enviando..." : "Finalizar test"}
      </Button>
    </div>
  )
}
