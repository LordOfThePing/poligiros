import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Lock, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiJson } from "@/lib/api"

type Module = {
  id: string
  title: string
  description: string | null
  videoUrl: string | null
  orderIndex: number
  completed: boolean
  locked: boolean
  materials: { id: string; title: string; fileUrl: string }[]
}

export default function ProgramaPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiJson<Module[]>("/student/modules")
      .then((data) => { setModules(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const completedCount = modules.filter((m) => m.completed).length
  const totalCount = modules.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const circumference = 2 * Math.PI * 40
  const strokeDash = (pct / 100) * circumference

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Mi Programa</h1>
        <p className="text-muted-foreground text-sm">Completá los módulos en orden para avanzar</p>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative">
          <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="40" fill="none" stroke="#2D6A4F" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${circumference}`}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-brand-accent">{pct}%</span>
          </div>
        </div>
        <div>
          <p className="font-medium text-foreground">{completedCount} de {totalCount} módulos completados</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {completedCount === totalCount && totalCount > 0
              ? "¡Programa completado!"
              : "Continuá con el próximo módulo"}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando módulos...</p>
      ) : modules.length === 0 ? (
        <p className="text-muted-foreground text-sm">No hay módulos publicados aún.</p>
      ) : (
        <div className="space-y-3">
          {modules.map((mod, idx) => (
            <div
              key={mod.id}
              className={cn(
                "bg-white rounded-lg border border-border p-4 transition-all",
                mod.locked ? "opacity-60" : "hover:shadow-sm"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                  mod.completed
                    ? "bg-brand-accent text-white"
                    : mod.locked
                    ? "bg-muted text-muted-foreground"
                    : "bg-brand-accent/10 text-brand-accent"
                )}>
                  {mod.completed ? <CheckCircle2 className="h-4 w-4" /> : mod.locked ? <Lock className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={cn("font-medium", mod.locked ? "text-muted-foreground" : "text-foreground")}>
                      {mod.title}
                    </h3>
                    {mod.completed && (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Completado</Badge>
                    )}
                  </div>
                  {mod.description && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{mod.description}</p>
                  )}
                </div>
                {!mod.locked && (
                  <Link to={`/student/programa/${mod.id}`}>
                    <ChevronRight className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
