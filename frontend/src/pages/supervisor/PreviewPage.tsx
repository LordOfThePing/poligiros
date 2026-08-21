import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, ExternalLink, FileText, MessageSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { apiJson } from "@/lib/api"
import { LoadingBadge } from "@/components/LoadingBadge"
import { CommentPanel } from "@/components/modules/CommentPanel"
import { Markdown } from "@/components/Markdown"
import {
  KIND_BADGE, KIND_LABEL, formatBytes,
  type Module, type ModuleItem, type StudentModule, type StudentModuleItem,
} from "@/lib/modules"

type Cohort = { id: string; name: string }

/**
 * Supervisor view of "Mi Programa" for a chosen CIC: what a coach of that
 * cohort currently sees (published + released modules), with the discussion
 * panel so the supervisor can post comments. Read-only otherwise.
 */
export default function PreviewPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [cohortId, setCohortId] = useState<string>("")
  const [modules, setModules] = useState<StudentModule[]>([])
  const [loading, setLoading] = useState(false)
  const [selection, setSelection] = useState<{ moduleId: string; itemId: string } | null>(null)
  const [openModules, setOpenModules] = useState<Set<string>>(new Set())
  const [discussionOpen, setDiscussionOpen] = useState(true)

  // Remember the last CIC viewed so re-opening the page lands on it.
  const STORAGE_KEY = "poligiros.preview-cohort"

  useEffect(() => {
    apiJson<Cohort[]>("/supervisor/cohorts").then((list) => {
      setCohorts(list)
      // Restore the last selected CIC if it still exists.
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && list.some((c) => c.id === saved)) {
        setCohortId(saved)
        loadModules(saved)
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loadModules(id: string) {
    if (!id) { setModules([]); setSelection(null); return }
    setLoading(true)
    apiJson<StudentModule[]>(`/supervisor/preview-modules?cohortId=${id}`)
      .then((data) => {
        setModules(data)
        setSelection(null)
        setOpenModules(data.length > 0 ? new Set([data[0].id]) : new Set())
      })
      .catch(() => setModules([]))
      .finally(() => setLoading(false))
  }

  function selectCohort(id: string) {
    setCohortId(id)
    localStorage.setItem(STORAGE_KEY, id)
    loadModules(id)
  }

  const selectedItem: StudentModuleItem | null = useMemo(() => {
    if (!selection) return null
    const mod = modules.find((m) => m.id === selection.moduleId)
    return mod?.items.find((i) => i.id === selection.itemId) ?? null
  }, [selection, modules])

  function toggleModule(id: string) {
    setOpenModules((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="max-w-5xl mx-auto w-full space-y-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground mb-1">Mi Programa (vista de un CIC)</h1>
          <p className="text-muted-foreground text-sm">
            Elegí un CIC para ver las clases que ven sus coaches y comentar en cada tarea.
          </p>
        </div>
        <div className="max-w-xs">
          <Select value={cohortId} onValueChange={selectCohort}>
            <SelectTrigger><SelectValue placeholder="Elegí un CIC" /></SelectTrigger>
            <SelectContent>
              {cohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!cohortId && (
        <p className="text-muted-foreground text-sm text-center py-12">
          Seleccioná un CIC para ver su programa.
        </p>
      )}

      {cohortId && loading && <LoadingBadge />}

      {cohortId && !loading && modules.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-12">
          Todavía no hay clases habilitadas para este CIC.
        </p>
      )}

      {cohortId && !loading && modules.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Modules index */}
          <div className="space-y-3">
            {modules.map((mod) => {
              const open = openModules.has(mod.id)
              return (
                <div key={mod.id} className="bg-white rounded-lg border border-border">
                  <button
                    onClick={() => toggleModule(mod.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-brand-accent/10 text-brand-accent text-sm font-bold">
                      {mod.orderIndex}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground">{mod.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {mod.items.length === 0 ? "Sin contenido" : `${mod.items.length} ítems`}
                      </p>
                    </div>
                    {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {open && mod.items.length > 0 && (
                    <div className="border-t border-border p-2 space-y-1">
                      {mod.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSelection({ moduleId: mod.id, itemId: item.id })}
                          className={cn(
                            "w-full flex items-start gap-2 rounded-md px-2 py-2 text-left",
                            selection?.itemId === item.id ? "bg-brand-accent/10" : "hover:bg-muted"
                          )}
                        >
                          <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-foreground">{item.title}</span>
                            <span className={cn("inline-block mt-1 text-xs px-2 py-0.5 rounded-full", KIND_BADGE[item.kind])}>
                              {KIND_LABEL[item.kind]}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Item + discussion */}
          <div className="min-w-0">
            {selectedItem ? (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-border p-5 space-y-4">
                  {selectedItem.coverImageUrl && (
                    <img src={selectedItem.coverImageUrl} alt="Portada" className="rounded-lg border border-border w-full aspect-[2/1] object-cover bg-muted" />
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-serif text-2xl text-foreground">{selectedItem.title}</h2>
                    </div>
                    <button
                      onClick={() => setDiscussionOpen((v) => !v)}
                      className={cn(
                        "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border shrink-0 transition-colors",
                        discussionOpen
                          ? "bg-brand-accent/10 border-brand-accent/30 text-brand-accent"
                          : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Discusión
                    </button>
                  </div>
                  {selectedItem.description && <Markdown>{selectedItem.description}</Markdown>}
                  {selectedItem.links.length > 0 && (
                    <div className="space-y-1.5 border-t border-border pt-4">
                      {selectedItem.links.map((l) => (
                        <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-brand-accent hover:underline break-all">
                          {l.storageKey ? <FileText className="h-3.5 w-3.5 shrink-0" /> : <ExternalLink className="h-3.5 w-3.5 shrink-0" />}
                          {l.title}
                          {l.sizeBytes != null && <span className="text-muted-foreground text-xs shrink-0">{formatBytes(l.sizeBytes)}</span>}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {discussionOpen && (
                  <div className="bg-white rounded-lg border border-border p-4 h-[min(80vh,760px)]">
                    <CommentPanel itemId={selectedItem.id} />
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden lg:flex items-center justify-center h-full min-h-[240px] bg-white rounded-lg border border-dashed border-border">
                <p className="text-sm text-muted-foreground">
                  Elegí un contenido de la izquierda para verlo acá.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
