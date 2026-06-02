import { useEffect, useState, useRef } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { GripVertical, Plus, Edit2, Trash2, Upload, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiJson, apiRaw } from "@/lib/api"

type Material = { id: string; title: string; fileUrl: string; fileType: string }
type Module = {
  id: string
  title: string
  description: string | null
  videoUrl: string | null
  orderIndex: number
  published: boolean
  materials: Material[]
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

function SortableModule({ mod, onEdit, onDelete, onTogglePublish, onUpload }: {
  mod: Module
  onEdit: (m: Module) => void
  onDelete: (id: string) => void
  onTogglePublish: (id: string, published: boolean) => void
  onUpload: (id: string, file: File, title: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: mod.id })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const embedUrl = mod.videoUrl ? getEmbedUrl(mod.videoUrl) : null

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start gap-3">
        <button {...attributes} {...listeners} className="mt-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-foreground">{mod.title}</h3>
            <Badge variant={mod.published ? "default" : "secondary"} className={mod.published ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
              {mod.published ? "Publicado" : "Borrador"}
            </Badge>
          </div>
          {mod.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{mod.description}</p>
          )}
          {mod.materials.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {mod.materials.map((m) => (
                <a key={m.id} href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 text-brand-accent hover:underline">
                  <ExternalLink className="h-3 w-3" /> {m.title}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={mod.published} onCheckedChange={(v) => onTogglePublish(mod.id, v)} />
          <Button size="icon" variant="ghost" onClick={() => onEdit(mod)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(mod.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.ppt,.pptx,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUpload(mod.id, file, file.name)
              e.target.value = ""
            }}
          />
        </div>
      </div>
      {embedUrl && (
        <div className="relative w-full pt-[30%]">
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full rounded"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  )
}

export default function ModulosPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [editingModule, setEditingModule] = useState<Partial<Module> | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    apiJson<Module[]>("/supervisor/modules").then(setModules).catch(() => {})
  }, [])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = modules.findIndex((m) => m.id === active.id)
    const newIndex = modules.findIndex((m) => m.id === over.id)
    const reordered = arrayMove(modules, oldIndex, newIndex)

    setModules(reordered.map((m, i) => ({ ...m, orderIndex: i + 1 })))

    await Promise.all(
      reordered.map((m, i) =>
        apiRaw(`/supervisor/modules/${m.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...m, orderIndex: i + 1 }),
        })
      )
    )
  }

  async function handleSave() {
    if (!editingModule?.title) return
    const isNew = !editingModule.id

    const saved = await apiJson<Module>(
      isNew ? "/supervisor/modules" : `/supervisor/modules/${editingModule.id}`,
      {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingModule),
      }
    )

    if (isNew) {
      setModules((prev) => [...prev, saved])
    } else {
      setModules((prev) => prev.map((m) => (m.id === saved.id ? saved : m)))
    }

    setEditingModule(null)
    setIsCreating(false)
    toast({ title: isNew ? "Módulo creado" : "Módulo actualizado" })
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este módulo?")) return
    await apiRaw(`/supervisor/modules/${id}`, { method: "DELETE" })
    setModules((prev) => prev.filter((m) => m.id !== id))
    toast({ title: "Módulo eliminado" })
  }

  async function handleTogglePublish(id: string, published: boolean) {
    const mod = modules.find((m) => m.id === id)!
    const updated = await apiJson<Module>(`/supervisor/modules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...mod, published }),
    })
    setModules((prev) => prev.map((m) => (m.id === id ? updated : m)))
  }

  async function handleUpload(moduleId: string, file: File, title: string) {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("title", title)

    toast({ title: "Subiendo archivo..." })
    const res = await apiRaw(`/supervisor/modules/${moduleId}/materials`, {
      method: "POST",
      body: formData,
    })

    if (res.ok) {
      const material = await res.json()
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId ? { ...m, materials: [...m.materials, material] } : m
        )
      )
      toast({ title: "Archivo subido" })
    } else {
      toast({ title: "Error al subir el archivo", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-foreground mb-1">Módulos</h1>
          <p className="text-muted-foreground text-sm">Arrastrá para reordenar</p>
        </div>
        <Button
          className="bg-brand-accent hover:bg-brand-accent-dark"
          onClick={() => { setEditingModule({}); setIsCreating(true) }}
        >
          <Plus className="h-4 w-4 mr-2" /> Nuevo módulo
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {modules.map((mod) => (
              <SortableModule
                key={mod.id}
                mod={mod}
                onEdit={(m) => { setEditingModule(m); setIsCreating(false) }}
                onDelete={handleDelete}
                onTogglePublish={handleTogglePublish}
                onUpload={handleUpload}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {modules.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No hay módulos aún. Creá el primero.</p>
      )}

      <Dialog open={!!editingModule} onOpenChange={(open) => !open && setEditingModule(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {isCreating ? "Nuevo módulo" : "Editar módulo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={editingModule?.title ?? ""}
                onChange={(e) => setEditingModule((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Introducción al coaching de carrera"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={editingModule?.description ?? ""}
                onChange={(e) => setEditingModule((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Descripción del módulo..."
              />
            </div>
            <div className="space-y-2">
              <Label>URL de video (YouTube o Vimeo)</Label>
              <Input
                value={editingModule?.videoUrl ?? ""}
                onChange={(e) => setEditingModule((prev) => ({ ...prev, videoUrl: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingModule(null)}>Cancelar</Button>
            <Button className="bg-brand-accent hover:bg-brand-accent-dark" onClick={handleSave}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
