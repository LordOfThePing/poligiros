import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2, ChevronDown, ChevronRight, Video, ArrowLeft, Circle, ExternalLink, FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { apiJson, apiTry } from "@/lib/api"
import { Markdown } from "@/components/Markdown"
import {
  KIND_BADGE, KIND_LABEL, formatBytes,
  type StudentModule, type StudentModuleItem,
} from "@/lib/modules"
import type { CoachAccess } from "@/lib/access"

/** Which item is open, kept as a pair so the header can name its module. */
type Selection = { moduleId: string; itemId: string }

export default function ProgramaPage() {
  const [modules, setModules] = useState<StudentModule[]>([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState<CoachAccess["zoom"]>([])
  const [openModules, setOpenModules] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Selection | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiJson<StudentModule[]>("/student/modules")
      .then((data) => {
        setModules(data)
        setLoading(false)
        // Open the first module that still has something pending, so the page
        // lands on where the coach left off instead of collapsed.
        const next = data.find((m) => !m.completed) ?? data[0]
        if (next) setOpenModules(new Set([next.id]))
      })
      .catch(() => setLoading(false))
    apiJson<CoachAccess>("/student/access")
      .then((a) => setZoom(a.zoom))
      .catch(() => {})
  }, [])

  const allItems = useMemo(() => modules.flatMap((m) => m.items), [modules])
  const doneCount = allItems.filter((i) => i.completed).length
  const totalCount = allItems.length
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0

  const current: { module: StudentModule; item: StudentModuleItem } | null = useMemo(() => {
    if (!selected) return null
    const mod = modules.find((m) => m.id === selected.moduleId)
    const item = mod?.items.find((i) => i.id === selected.itemId)
    return mod && item ? { module: mod, item } : null
  }, [selected, modules])

  function toggleModule(id: string) {
    setOpenModules((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function toggleItemDone(item: StudentModuleItem) {
    const nextDone = !item.completed
    setSaving(true)

    // Optimistic: the checkbox should not lag behind the click.
    setModules((prev) =>
      prev.map((m) => ({
        ...m,
        items: m.items.map((i) => (i.id === item.id ? { ...i, completed: nextDone } : i)),
      }))
    )

    const res = await apiTry(`/student/module-items/${item.id}/complete`, {
      method: nextDone ? "POST" : "DELETE",
    })
    setSaving(false)

    if (!res.ok) {
      // Roll back and resync so the derived module state stays honest.
      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          items: m.items.map((i) => (i.id === item.id ? { ...i, completed: !nextDone } : i)),
        }))
      )
      return
    }

    // The module-level flag is derived server-side; refetch to pick it up.
    apiJson<StudentModule[]>("/student/modules").then(setModules).catch(() => {})
  }

  const circumference = 2 * Math.PI * 40
  const strokeDash = (pct / 100) * circumference

  return (
    <div className="space-y-6">
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
          <p className="font-medium text-foreground">
            {doneCount} de {totalCount} {totalCount === 1 ? "ítem" : "ítems"} completados
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalCount > 0 && doneCount === totalCount
              ? "¡Programa completado!"
              : "Marcá cada contenido a medida que lo trabajás"}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando módulos...</p>
      ) : modules.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay clases habilitadas para tu CIC. Gaby las va abriendo a medida que avanza
          la cursada.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Index. On mobile it hides once an item is open, so the detail gets
              the full width instead of sitting below a long list. */}
          <div className={cn("space-y-3", current && "hidden lg:block")}>
            {modules.map((mod, idx) => {
              const open = openModules.has(mod.id)
              const done = mod.items.filter((i) => i.completed).length
              return (
                <div key={mod.id} className="bg-white rounded-lg border border-border">
                  <button
                    onClick={() => toggleModule(mod.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                      mod.completed
                        ? "bg-brand-accent text-white"
                        : "bg-brand-accent/10 text-brand-accent"
                    )}>
                      {mod.completed ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground">{mod.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {mod.items.length === 0
                          ? "Sin contenido"
                          : `${done} de ${mod.items.length} completados`}
                      </p>
                    </div>
                    {open ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {open && mod.items.length > 0 && (
                    <div className="border-t border-border p-2 space-y-1">
                      {mod.items.map((item) => {
                        const active = selected?.itemId === item.id
                        return (
                          <button
                            key={item.id}
                            onClick={() => setSelected({ moduleId: mod.id, itemId: item.id })}
                            className={cn(
                              "w-full flex items-start gap-2 rounded-md px-2 py-2 text-left transition-colors",
                              active ? "bg-brand-accent/10" : "hover:bg-muted"
                            )}
                          >
                            {item.completed ? (
                              <CheckCircle2 className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            )}
                            <span className="flex-1 min-w-0">
                              <span
                                className={cn(
                                  "block text-sm",
                                  item.completed ? "text-muted-foreground" : "text-foreground"
                                )}
                              >
                                {item.title}
                              </span>
                              <span
                                className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${KIND_BADGE[item.kind]}`}
                              >
                                {KIND_LABEL[item.kind]}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Detail panel */}
          <div>
            {current ? (
              <div className="bg-white rounded-lg border border-border p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      onClick={() => setSelected(null)}
                      className="lg:hidden text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
                    >
                      <ArrowLeft className="h-4 w-4" /> Volver
                    </button>
                    <p className="text-xs text-muted-foreground">{current.module.title}</p>
                    <h2 className="font-serif text-2xl text-foreground">{current.item.title}</h2>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${KIND_BADGE[current.item.kind]}`}
                  >
                    {KIND_LABEL[current.item.kind]}
                  </span>
                </div>

                {current.item.description && <Markdown>{current.item.description}</Markdown>}

                {current.item.links.length > 0 && (
                  <div className="space-y-1.5 border-t border-border pt-4">
                    {current.item.links.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-brand-accent hover:underline break-all"
                      >
                        {link.storageKey ? (
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {link.title}
                        {link.sizeBytes != null && (
                          <span className="text-muted-foreground text-xs shrink-0">
                            {formatBytes(link.sizeBytes)}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                )}

                <div className="border-t border-border pt-4">
                  {current.item.completed ? (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="flex items-center gap-2 text-green-700 text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4" /> Completado
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => toggleItemDone(current.item)}
                      >
                        Desmarcar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="bg-brand-accent hover:bg-brand-accent-dark"
                      disabled={saving}
                      onClick={() => toggleItemDone(current.item)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Marcar como completado
                    </Button>
                  )}
                </div>
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
