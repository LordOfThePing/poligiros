import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ChevronRight, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiJson } from "@/lib/api"
import type { StudentModule } from "@/lib/modules"
import type { CoachAccess } from "@/lib/access"

export default function ProgramaPage() {
  const [modules, setModules] = useState<StudentModule[]>([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState<CoachAccess["zoom"]>([])

  useEffect(() => {
    apiJson<StudentModule[]>("/student/modules")
      .then((data) => { setModules(data); setLoading(false) })
      .catch(() => setLoading(false))
    apiJson<CoachAccess>("/student/access")
      .then((a) => setZoom(a.zoom))
      .catch(() => {})
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
        <p className="text-muted-foreground text-sm">
          Las clases se van habilitando a medida que avanza la cursada
        </p>
      </div>

      {zoom.map((z) => (
        <a
          key={z.cohortId}
          href={z.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-brand-accent/10 border border-brand-accent/30 rounded-lg px-4 py-3 hover:bg-brand-accent/15 transition-colors"
        >
          <Video className="h-4 w-4 text-brand-accent shrink-0" />
          <span className="text-sm text-foreground">
            Link de Zoom de <strong>{z.cohortName}</strong>
          </span>
        </a>
      ))}

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
        <p className="text-muted-foreground text-sm">
          Todavía no hay clases habilitadas para tu CIC. Gaby las va abriendo a medida que avanza la cursada.
        </p>
      ) : (
        <div className="space-y-3">
          {modules.map((mod, idx) => (
            <Link
              key={mod.id}
              to={`/student/programa/${mod.id}`}
              className="block bg-white rounded-lg border border-border p-4 transition-all hover:shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                  mod.completed
                    ? "bg-brand-accent text-white"
                    : "bg-brand-accent/10 text-brand-accent"
                )}>
                  {mod.completed ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{mod.title}</h3>
                    {mod.completed && (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Completado</Badge>
                    )}
                  </div>
                  {mod.description && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{mod.description}</p>
                  )}
                  {mod.items.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {mod.items.length} {mod.items.length === 1 ? "ítem" : "ítems"}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
