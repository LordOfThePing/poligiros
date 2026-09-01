import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CheckCircle2, ChevronDown, ChevronRight, Video, ArrowLeft, Circle, ExternalLink, FileText,
  ClipboardCheck, PanelLeftClose, PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { apiJson, apiTry } from "@/lib/api"
import { Markdown } from "@/components/Markdown"
import { MarkdownEditor } from "@/components/MarkdownEditor"
import { RegistroCard } from "@/components/modules/RegistroCard"
import { PartnerTestResult } from "@/components/results/PartnerTestResult"
import { GroupEntregas } from "@/components/modules/GroupEntregas"
import { LoadingBadge } from "@/components/LoadingBadge"
import { CommentPanel } from "@/components/modules/CommentPanel"
import {
  KIND_BADGE, KIND_LABEL, formatBytes,
  type StudentModule, type StudentModuleItem,
} from "@/lib/modules"
import type { CoachAccess } from "@/lib/access"

/** Which item is open, kept as a pair so the header can name its module. */
type Selection = { moduleId: string; itemId: string }

/** True at the `lg` breakpoint (1024px) and up. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return isDesktop
}

export default function ProgramaPage() {
  const [modules, setModules] = useState<StudentModule[]>([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState<CoachAccess["zoom"]>([])
  // The CICs this coach belongs to + which one is currently being viewed.
  const [cohorts, setCohorts] = useState<CoachAccess["cohorts"]>([])
  const [selectedCohortId, setSelectedCohortId] = useState<string>("")
  // Accordion: at most one module open at a time, so the index stays short
  // enough to scan instead of turning into one long scroll.
  const [openModuleId, setOpenModuleId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [saving, setSaving] = useState(false)
  // Left modules index: pinned open (fixed) or a thin rail that only expands on
  // hover ("auto"), so the item + discussion get more room.
  const [indexPinned, setIndexPinned] = useState(true)
  const [indexHover, setIndexHover] = useState(false)
  // Discussion panel is collapsible, shown by default, closable on demand.
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  // Draft text for the ENTREGA card currently open.
  const [entrega, setEntrega] = useState("")

  const loadModules = useCallback((cohortId: string) => {
    setSelected(null)
    setLoading(true)
    const qs = cohortId ? `?cohortId=${cohortId}` : ""
    apiJson<StudentModule[]>(`/student/modules${qs}`)
      .then((data) => {
        setModules(data)
        // Default to the last available (most recently released) module.
        setOpenModuleId(data[data.length - 1]?.id ?? null)
      })
      .catch(() => setModules([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    apiJson<CoachAccess>("/student/access")
      .then((a) => {
        setZoom(a.zoom)
        setCohorts(a.cohorts)
        // Default to the first enrolled CIC; if only one, no selector shown.
        setSelectedCohortId((prev) => prev || a.cohorts[0]?.id || "")
      })
      .catch(() => {})
  }, [])

  // Load the modules for the currently selected CIC.
  useEffect(() => {
    loadModules(selectedCohortId)
  }, [selectedCohortId, loadModules])

  const allItems = useMemo(() => modules.flatMap((m) => m.items), [modules])
  const doneCount = allItems.filter((i) => i.completed).length
  const totalCount = allItems.length
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0

  // Only collapses to a rail at the lg breakpoint; on mobile the module index
  // always shows full so items stay tappable.
  const indexExpanded = !isDesktop || indexPinned || indexHover

  const current: { module: StudentModule; item: StudentModuleItem } | null = useMemo(() => {
    if (!selected) return null
    const mod = modules.find((m) => m.id === selected.moduleId)
    const item = mod?.items.find((i) => i.id === selected.itemId)
    return mod && item ? { module: mod, item } : null
  }, [selected, modules])

  // Reset the draft to whatever is stored when a different card opens, so
  // switching cards never carries someone else text over.
  useEffect(() => {
    if (!selected) return
    const mod = modules.find((m) => m.id === selected.moduleId)
    const item = mod?.items.find((i) => i.id === selected.itemId)
    setEntrega(item?.submission?.text ?? "")
  }, [selected, modules])

  async function submitEntrega(item: StudentModuleItem) {
    if (!entrega.trim()) return
    setSaving(true)
    const res = await apiTry(`/student/module-items/${item.id}/submission`, {
      method: "PUT",
      body: JSON.stringify({ text: entrega }),
    })
    setSaving(false)
    if (!res.ok) return
    // The card completion and module progress are derived server-side.
    apiJson<StudentModule[]>("/student/modules").then(setModules).catch(() => {})
  }

  /** Opening one closes whichever was open; clicking the open one collapses it. */
  function toggleModule(id: string) {
    setOpenModuleId((prev) => (prev === id ? null : id))
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

  /**
   * TEST cards do not get a manual checkbox: the assignment is created on first
   * open and the card counts as done once the test is submitted.
   */
  async function openTest(item: StudentModuleItem) {
    if (item.assignmentId) {
      navigate(`/student/my-tests/${item.assignmentId}`)
      return
    }
    setSaving(true)
    const res = await apiTry(`/student/module-items/${item.id}/start`, { method: "POST" })
    setSaving(false)
    if (!res.ok) return
    const { assignmentId } = await res.json()
    navigate(`/student/my-tests/${assignmentId}`)
  }

  const circumference = 2 * Math.PI * 40
  const strokeDash = (pct / 100) * circumference

  return (
    <div className="space-y-6">
      {/* Header stays centered; the modules/discussion below use full width. */}
      <div className="w-full max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Mi Programa</h1>
        <p className="text-muted-foreground text-sm">
          Las clases se van habilitando a medida que avanza la cursada
        </p>
      </div>

      {cohorts.length > 1 && (
        <div className="max-w-xs">
          <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
            <SelectTrigger>
              <SelectValue placeholder="Elegí un CIC" />
            </SelectTrigger>
            <SelectContent>
              {cohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
      </div>

      {loading ? (
        <LoadingBadge />
      ) : modules.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay clases habilitadas para tu CIC. Gaby las va abriendo a medida que avanza
          la cursada.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          {/* Modules index: a thin rail by default that expands on hover, or
              stays pinned open. The pin button fixes/auto-hides it. */}
          <div
            onMouseEnter={() => setIndexHover(true)}
            onMouseLeave={() => setIndexHover(false)}
            className={cn(
              "transition-[width] duration-200 ease-in-out overflow-hidden w-full",
              indexExpanded ? "lg:w-[320px]" : "lg:w-14"
            )}
          >
            <div
              className={cn(
                "bg-white rounded-lg border border-border mb-3 flex items-center",
                indexExpanded ? "justify-between px-4 py-2.5" : "justify-center px-1 py-2"
              )}
            >
              {indexExpanded ? (
                <>
                  <span className="text-sm font-medium text-foreground">Contenido</span>
                  <button
                    onClick={() => setIndexPinned((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    title={indexPinned ? "Auto-ocultar los módulos" : "Mantener los módulos fijos"}
                  >
                    {indexPinned ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                    {indexPinned ? "Auto" : "Fijo"}
                  </button>
                </>
              ) : (
                <button onClick={() => setIndexPinned(true)} className="text-muted-foreground hover:text-foreground">
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              )}
            </div>

            {indexExpanded ? (
              <div className="space-y-3">
                {modules.map((mod, idx) => {
                  const open = openModuleId === mod.id
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
            ) : (
              /* Collapsed rail: numbered module chips only. */
              <div className="space-y-2">
                {modules.map((mod, idx) => (
                  <div
                    key={mod.id}
                    className="bg-white rounded-lg border border-border h-12 flex items-center justify-center relative"
                    title={mod.title}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                      mod.completed ? "bg-brand-accent text-white" : "bg-brand-accent/10 text-brand-accent"
                    )}>
                      {mod.completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail + discussion. The item keeps a stable width and never shrinks;
              the modules rail and the discussion are what give way. */}
          <div className="min-w-0">
            {current ? (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-border p-5 space-y-4">
                {current.item.coverImageUrl && (
                  <img
                    src={current.item.coverImageUrl}
                    alt={`Portada de ${current.item.title}`}
                    className="rounded-lg border border-border w-full aspect-[2/1] object-cover bg-muted"
                  />
                )}
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
                  <span className="flex items-start gap-2 shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${KIND_BADGE[current.item.kind]}`}
                    >
                      {KIND_LABEL[current.item.kind]}
                    </span>
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
                  {current.item.kind === "REGISTRO" ? (
                    <RegistroCard
                      item={current.item}
                      onSaved={() =>
                        apiJson<StudentModule[]>("/student/modules")
                          .then(setModules)
                          .catch(() => {})
                      }
                    />
                  ) : current.item.kind === "ENTREGA" ? (
                    <div className="space-y-3">
                      {current.item.submission?.reviewedAt ? (
                        <>
                          <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                            <CheckCircle2 className="h-4 w-4" /> Entregado y revisado
                          </div>
                          <div className="bg-muted/40 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">Tu entrega</p>
                            <Markdown>{current.item.submission.text}</Markdown>
                          </div>
                          {current.item.submission.feedback && (
                            <div className="bg-brand-accent/10 border border-brand-accent/30 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground mb-1">Devolución de Gaby</p>
                              <Markdown>{current.item.submission.feedback}</Markdown>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">Tu entrega</p>
                            {current.item.submission && (
                              <span className="text-xs text-muted-foreground">
                                Entregado · podés editarlo hasta que Gaby lo revise
                              </span>
                            )}
                          </div>
                          <MarkdownEditor
                            value={entrega}
                            onChange={setEntrega}
                            rows={10}
                            placeholder="Escribí acá tu reflexión..."
                          />
                          <Button
                            className="bg-brand-accent hover:bg-brand-accent-dark"
                            disabled={saving || !entrega.trim()}
                            onClick={() => submitEntrega(current.item)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            {current.item.submission ? "Guardar cambios" : "Enviar entrega"}
                          </Button>
                        </>
                      )}
                      <GroupEntregas itemId={current.item.id} />
                    </div>
                  ) : current.item.kind === "TEST" ? (
                    <>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      {current.item.submitted ? (
                        <span className="flex items-center gap-2 text-green-700 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4" /> Enviado
                        </span>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Al enviarlo le llega a Gaby para su devolución.
                        </p>
                      )}
                      <Button
                        className={current.item.submitted ? "" : "bg-brand-accent hover:bg-brand-accent-dark"}
                        variant={current.item.submitted ? "outline" : "default"}
                        disabled={saving}
                        onClick={() => openTest(current.item)}
                      >
                        <ClipboardCheck className="h-4 w-4 mr-2" />
                        {current.item.submitted ? "Ver mi resultado" : "Realizar test"}
                      </Button>
                    </div>
                    {current.item.supervision?.feedback && (
                      <div className="mt-4 bg-brand-accent/10 border border-brand-accent/30 rounded-lg p-4 space-y-1.5">
                        <p className="text-xs text-muted-foreground">Feedback de Gaby</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {current.item.supervision.feedback}
                        </p>
                      </div>
                    )}
                    </>
                    ) : current.item.kind === "DUPLA" ? (
                      <div className="space-y-4">
                        <PartnerTestResult itemId={current.item.id} />
                        {current.item.completed ? (
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <span className="flex items-center gap-2 text-green-700 text-sm font-medium">
                              <CheckCircle2 className="h-4 w-4" /> Completado
                            </span>
                            <Button variant="outline" size="sm" disabled={saving} onClick={() => toggleItemDone(current.item)}>
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
                    ) : current.item.completed ? (
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
                <div className="bg-white rounded-lg border border-border p-4 h-[min(80vh,760px)]">
                  <CommentPanel itemId={current.item.id} />
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
