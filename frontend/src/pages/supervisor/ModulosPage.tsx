import { useEffect, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  GripVertical, Plus, Edit2, Trash2, ExternalLink, ChevronDown, ChevronRight, Link2,
  Upload, FileText, Loader2, Copy,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiJson, apiRaw, apiTry, apiUpload } from "@/lib/api"
import { MarkdownEditor } from "@/components/MarkdownEditor"
import { LoadingBadge } from "@/components/LoadingBadge"
import {
  ITEM_KINDS, KIND_BADGE, KIND_LABEL, stripMarkdown, formatBytes,
  type Module, type ModuleItem, type ModuleItemKind, type ModuleLink, type LinkedTest,
} from "@/lib/modules"

function getEmbedUrl(url: string): string | null {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

/* ─────────────────────────────────────────
   Content editor: cards and the links inside them
───────────────────────────────────────── */

type ItemDraft = {
  id?: string
  title: string
  description: string
  kind: ModuleItemKind
  testId: string
}

/**
 * One draggable card row. The grip is the only drag handle — the row is full of
 * buttons, inputs and links, and making the whole thing draggable would swallow
 * their clicks.
 */
function SortableItemRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-muted/40 rounded-lg p-3 space-y-2 ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
          aria-label="Reordenar ítem"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0 space-y-2">{children}</div>
      </div>
    </div>
  )
}

function ModuleContentEditor({
  mod,
  onModuleChange,
}: {
  mod: Module
  onModuleChange: (m: Module) => void
}) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<ItemDraft | null>(null)
  // Which card is currently having a link added, plus that link fields.
  const [linkFor, setLinkFor] = useState<string | null>(null)
  const [linkTitle, setLinkTitle] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [tests, setTests] = useState<LinkedTest[]>([])

  useEffect(() => {
    // PLAN_VITAL is a permanent placeholder with no form — never offer it.
    apiJson<LinkedTest[]>("/tests")
      .then((all) => setTests(all.filter((t) => t.type !== "PLAN_VITAL")))
      .catch(() => {})
  }, [])

  const itemSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = mod.items.findIndex((i) => i.id === active.id)
    const newIndex = mod.items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(mod.items, oldIndex, newIndex)

    onModuleChange({ ...mod, items: reordered })

    const res = await apiTry(`/supervisor/modules/${mod.id}/items/reorder`, {
      method: "PUT",
      body: JSON.stringify({ ids: reordered.map((i) => i.id) }),
    })
    if (!res.ok) {
      toast({ title: "No se pudo reordenar", variant: "destructive" })
      onModuleChange({ ...mod, items: mod.items })
    }
  }

  function replaceItem(item: ModuleItem) {
    onModuleChange({
      ...mod,
      items: mod.items.some((i) => i.id === item.id)
        ? mod.items.map((i) => (i.id === item.id ? item : i))
        : [...mod.items, item],
    })
  }

  async function saveItem() {
    if (!draft?.title.trim()) return
    const isNew = !draft.id
    const res = await apiTry(
      isNew ? `/supervisor/modules/${mod.id}/items` : `/supervisor/module-items/${draft.id}`,
      {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description || null,
          kind: draft.kind,
          testId: draft.kind === "TEST" ? draft.testId : null,
        }),
      }
    )
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: j.error || "Error al guardar", variant: "destructive" })
      return
    }
    replaceItem(await res.json())
    setDraft(null)
    toast({ title: isNew ? "Ítem agregado" : "Ítem actualizado" })
  }

  async function deleteItem(itemId: string) {
    if (!confirm("¿Eliminar este ítem y sus links?")) return
    await apiRaw(`/supervisor/module-items/${itemId}`, { method: "DELETE" })
    onModuleChange({ ...mod, items: mod.items.filter((i) => i.id !== itemId) })
  }

  async function addLink(itemId: string) {
    if (!linkUrl.trim()) return
    const res = await apiTry(`/supervisor/module-items/${itemId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: linkTitle, url: linkUrl }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: j.error || "Link inválido", variant: "destructive" })
      return
    }
    const link: ModuleLink = await res.json()
    onModuleChange({
      ...mod,
      items: mod.items.map((i) => (i.id === itemId ? { ...i, links: [...i.links, link] } : i)),
    })
    setLinkTitle("")
    setLinkUrl("")
    setLinkFor(null)
  }

  async function uploadFile(itemId: string, file: File) {
    setUploadingFor(itemId)
    const form = new FormData()
    form.append("file", file)

    const res = await apiUpload(`/supervisor/module-items/${itemId}/files`, form)
    setUploadingFor(null)

    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: j.error || "No se pudo subir el archivo", variant: "destructive" })
      return
    }
    const link: ModuleLink = await res.json()
    onModuleChange({
      ...mod,
      items: mod.items.map((i) => (i.id === itemId ? { ...i, links: [...i.links, link] } : i)),
    })
    toast({ title: "Archivo subido" })
  }

  /** Lets the supervisor paste a file into the consigna as ![](url) or [](url). */
  async function copyLinkUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: "URL copiada" })
    } catch {
      window.prompt("Copiá la URL:", url)
    }
  }

  async function deleteLink(itemId: string, linkId: string) {
    await apiRaw(`/supervisor/module-links/${linkId}`, { method: "DELETE" })
    onModuleChange({
      ...mod,
      items: mod.items.map((i) =>
        i.id === itemId ? { ...i, links: i.links.filter((l) => l.id !== linkId) } : i
      ),
    })
  }

  return (
    <div className="border-t border-border pt-3 space-y-3">
      {mod.items.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin contenido todavía.</p>
      )}

      <DndContext
        sensors={itemSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleItemDragEnd}
      >
      <SortableContext items={mod.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
      {mod.items.map((item) => (
        <SortableItemRow key={item.id} id={item.id}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-foreground">{item.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${KIND_BADGE[item.kind]}`}>
                  {KIND_LABEL[item.kind]}
                </span>
                {item.test && (
                  <span className="text-xs text-muted-foreground">{item.test.title}</span>
                )}
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {stripMarkdown(item.description)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() =>
                  setDraft({
                    id: item.id,
                    title: item.title,
                    description: item.description ?? "",
                    kind: item.kind,
                    testId: item.testId ?? "",
                  })
                }
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => deleteItem(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {item.links.map((link) => (
            <div key={link.id} className="flex items-center gap-2 text-xs">
              {link.storageKey ? (
                <FileText className="h-3 w-3 text-brand-accent shrink-0" />
              ) : (
                <ExternalLink className="h-3 w-3 text-brand-accent shrink-0" />
              )}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-accent hover:underline truncate"
              >
                {link.title}
              </a>
              {link.sizeBytes != null && (
                <span className="text-muted-foreground shrink-0">{formatBytes(link.sizeBytes)}</span>
              )}
              <button
                onClick={() => copyLinkUrl(link.url)}
                className="text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Copiar URL"
                title="Copiar URL (para embeberla en la consigna)"
              >
                <Copy className="h-3 w-3" />
              </button>
              <button
                onClick={() => deleteLink(item.id, link.id)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Eliminar link"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}

          {linkFor === item.id ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Nombre (opcional)"
                className="h-8 text-xs w-40"
              />
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="h-8 text-xs flex-1 min-w-[200px]"
                onKeyDown={(e) => e.key === "Enter" && addLink(item.id)}
              />
              <Button
                size="sm"
                className="h-8 bg-brand-accent hover:bg-brand-accent-dark"
                onClick={() => addLink(item.id)}
              >
                Agregar
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setLinkFor(null)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setLinkFor(item.id); setLinkTitle(""); setLinkUrl("") }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Link2 className="h-3 w-3" /> Agregar link
              </button>
              <label className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer">
                {uploadingFor === item.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                {uploadingFor === item.id ? "Subiendo..." : "Subir archivo"}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploadingFor === item.id}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.rtf,.png,.jpg,.jpeg,.webp,.gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadFile(item.id, file)
                    e.target.value = ""
                  }}
                />
              </label>
            </div>
          )}
        </SortableItemRow>
      ))}
      </SortableContext>
      </DndContext>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setDraft({ title: "", description: "", kind: "RECURSO", testId: "" })}
      >
        <Plus className="h-3.5 w-3.5 mr-1" /> Agregar ítem
      </Button>

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {draft?.id ? "Editar ítem" : "Nuevo ítem"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={draft?.title ?? ""}
                onChange={(e) => setDraft((p) => (p ? { ...p, title: e.target.value } : p))}
                placeholder="Ej: TAREA 1"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={draft?.kind ?? "RECURSO"}
                onValueChange={(v) => setDraft((p) => (p ? { ...p, kind: v as ModuleItemKind } : p))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITEM_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {draft?.kind === "TEST" && (
              <div className="space-y-2">
                <Label>Test *</Label>
                <Select
                  value={draft?.testId ?? ""}
                  onValueChange={(v) => setDraft((p) => (p ? { ...p, testId: v } : p))}
                >
                  <SelectTrigger><SelectValue placeholder="Elegí el test" /></SelectTrigger>
                  <SelectContent>
                    {tests.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Los coaches del CIC lo hacen cuando liberás esta clase, y al enviarlo te llega a
                  Supervisión.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Consigna / descripción</Label>
              <MarkdownEditor
                value={draft?.description ?? ""}
                onChange={(v) => setDraft((p) => (p ? { ...p, description: v } : p))}
                rows={10}
                placeholder={"## Tareas para la clase 1\n\n**a) Competencias del coaching**\n\nCONSIGNA: Leer las competencias..."}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button className="bg-brand-accent hover:bg-brand-accent-dark" onClick={saveItem}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─────────────────────────────────────────
   Module row
───────────────────────────────────────── */

function SortableModule({ mod, onEdit, onDelete, onTogglePublish, onModuleChange }: {
  mod: Module
  onEdit: (m: Module) => void
  onDelete: (id: string) => void
  onTogglePublish: (id: string, published: boolean) => void
  onModuleChange: (m: Module) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: mod.id })
  const [expanded, setExpanded] = useState(false)
  const embedUrl = mod.videoUrl ? getEmbedUrl(mod.videoUrl) : null

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-foreground">{mod.title}</h3>
            <Badge
              variant={mod.published ? "default" : "secondary"}
              className={mod.published ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
            >
              {mod.published ? "Publicado" : "Borrador"}
            </Badge>
          </div>
          {mod.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {stripMarkdown(mod.description)}
            </p>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-2"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Contenido ({mod.items.length})
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={mod.published} onCheckedChange={(v) => onTogglePublish(mod.id, v)} />
          <Button size="icon" variant="ghost" onClick={() => onEdit(mod)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(mod.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
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

      {expanded && <ModuleContentEditor mod={mod} onModuleChange={onModuleChange} />}
    </div>
  )
}

/* ─────────────────────────────────────────
   Page
───────────────────────────────────────── */

export default function ModulosPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [loadingModules, setLoadingModules] = useState(true)
  const [editingModule, setEditingModule] = useState<Partial<Module> | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    apiJson<Module[]>("/supervisor/modules")
      .then(setModules)
      .catch(() => {})
      .finally(() => setLoadingModules(false))
  }, [])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = modules.findIndex((m) => m.id === active.id)
    const newIndex = modules.findIndex((m) => m.id === over.id)
    const reordered = arrayMove(modules, oldIndex, newIndex)

    setModules(reordered.map((m, i) => ({ ...m, orderIndex: i + 1 })))

    // Only the order changed, so send just that — the module PUT treats every
    // field as optional.
    await Promise.all(
      reordered.map((m, i) =>
        apiRaw(`/supervisor/modules/${m.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIndex: i + 1 }),
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
        body: JSON.stringify({
          title: editingModule.title,
          description: editingModule.description ?? null,
          videoUrl: editingModule.videoUrl ?? null,
        }),
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

  async function handleCoverUpload(file: File) {
    if (!editingModule?.id) return
    setUploadingCover(true)
    const form = new FormData()
    form.append("file", file)
    const res = await apiUpload(`/supervisor/modules/${editingModule.id}/cover`, form)
    setUploadingCover(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast({ title: j.error || "No se pudo subir la portada", variant: "destructive" })
      return
    }
    const { coverImageUrl } = await res.json()
    setEditingModule((prev) => ({ ...prev, coverImageUrl }))
    setModules((prev) =>
      prev.map((m) => (m.id === editingModule.id ? { ...m, coverImageUrl } : m))
    )
    toast({ title: "Portada actualizada" })
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este módulo? Se borra su contenido y su liberación en todos los CIC.")) return
    await apiRaw(`/supervisor/modules/${id}`, { method: "DELETE" })
    setModules((prev) => prev.filter((m) => m.id !== id))
    toast({ title: "Módulo eliminado" })
  }

  async function handleTogglePublish(id: string, published: boolean) {
    const updated = await apiJson<Module>(`/supervisor/modules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    })
    setModules((prev) => prev.map((m) => (m.id === id ? updated : m)))
  }

  function handleModuleChange(updated: Module) {
    setModules((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground mb-1">Módulos</h1>
          <p className="text-muted-foreground text-sm">
            El contenido es el mismo para todos los CIC. Cuándo lo ve cada camada se define en
            la pantalla de CIC.
          </p>
        </div>
        <Button
          className="bg-brand-accent hover:bg-brand-accent-dark shrink-0"
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
                onModuleChange={handleModuleChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {loadingModules ? (
        <LoadingBadge />
      ) : modules.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No hay módulos aún. Creá el primero.</p>
      ) : null}

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
                placeholder="Ej: CLASE 1"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <MarkdownEditor
                value={editingModule?.description ?? ""}
                onChange={(v) => setEditingModule((prev) => ({ ...prev, description: v }))}
                rows={4}
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
            {!isCreating && (
              <div className="space-y-2">
                <Label>Portada del módulo</Label>
                {editingModule?.coverImageUrl ? (
                  <img
                    src={editingModule.coverImageUrl}
                    alt="Portada"
                    className="rounded-lg border border-border h-28 w-full object-cover bg-muted"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Sin portada. Subí una imagen.</p>
                )}
                <label className="block">
                  <span className="inline-flex items-center gap-1 text-sm text-brand-accent cursor-pointer hover:underline">
                    <Upload className="h-3.5 w-3.5" />
                    {editingModule?.coverImageUrl ? "Cambiar portada" : "Subir portada"}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploadingCover}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleCoverUpload(f)
                      e.target.value = ""
                    }}
                  />
                </label>
                {uploadingCover && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Subiendo portada...
                  </p>
                )}
              </div>
            )}
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
