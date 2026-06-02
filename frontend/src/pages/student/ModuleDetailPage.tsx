import { useEffect, useState } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiJson, apiRaw } from "@/lib/api"

type Module = {
  id: string
  title: string
  description: string | null
  videoUrl: string | null
  completed: boolean
  locked: boolean
  materials: { id: string; title: string; fileUrl: string; fileType: string }[]
}

function getEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

export default function ModuleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [module, setModule] = useState<Module | null>(null)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    apiJson<Module[]>("/student/modules")
      .then((modules: Module[]) => {
        const found = modules.find((m) => m.id === id)
        if (!found || found.locked) {
          navigate("/student/programa", { replace: true })
        } else {
          setModule(found)
        }
      })
      .catch(() => navigate("/student/programa", { replace: true }))
  }, [id, navigate])

  async function handleComplete() {
    if (!module || module.completed) return
    setCompleting(true)
    await apiRaw(`/student/modules/${id}/complete`, { method: "POST" })
    setModule((prev) => prev ? { ...prev, completed: true } : prev)
    toast({ title: "¡Módulo completado!" })
    setCompleting(false)
  }

  if (!module) return <div className="text-muted-foreground text-sm py-8">Cargando...</div>

  const embedUrl = module.videoUrl ? getEmbedUrl(module.videoUrl) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/student/programa" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl text-foreground">{module.title}</h1>
          {module.completed && (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completado</Badge>
          )}
        </div>
      </div>

      {embedUrl && (
        <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden bg-black">
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {module.description && (
        <p className="text-foreground leading-relaxed">{module.description}</p>
      )}

      {module.materials.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-serif text-lg">Materiales</h2>
          <div className="space-y-2">
            {module.materials.map((m) => (
              <a
                key={m.id}
                href={m.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white rounded-lg border border-border px-4 py-3 hover:shadow-sm transition-shadow"
              >
                <Download className="h-4 w-4 text-brand-accent" />
                <span className="text-sm text-foreground">{m.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {!module.completed ? (
        <Button
          onClick={handleComplete}
          disabled={completing}
          className="bg-brand-accent hover:bg-brand-accent-dark"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          {completing ? "Guardando..." : "Marcar como completado"}
        </Button>
      ) : (
        <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4" />
          Completado
        </div>
      )}
    </div>
  )
}
