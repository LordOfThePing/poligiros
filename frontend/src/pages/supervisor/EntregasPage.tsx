import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Check, ChevronDown, Mail } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiTry } from "@/lib/api"
import { LoadingBadge } from "@/components/LoadingBadge"
import { Markdown } from "@/components/Markdown"
import { MarkdownEditor } from "@/components/MarkdownEditor"
import { usePersistedState } from "@/lib/persistedState"

type Submission = {
  id: string
  text: string
  submittedAt: string
  feedback: string | null
  reviewedAt: string | null
  /** Set = corrected after a devolución, so a pending row here is a re-review. */
  editedAt: string | null
  coach: { id: string; name: string; email: string }
  cohorts: string[]
  item: { id: string; title: string }
  module: { id: string; title: string }
}

type PracticeRecord = {
  id: string
  coach: { id: string; name: string; email: string }
  coachee: { id: string; name: string }
  cohorts: string[]
  item: { id: string; title: string }
  module: { id: string; title: string }
  sessionDate: string | null
  mainOutputs: string
  toolsAndResults: string
  conclusions: string
  submittedAt: string
  feedback: string | null
  reviewedAt: string | null
  /** Set = the coach used their one post-review correction, so this is a re-review. */
  editedAt: string | null
}

type Filter = "pending" | "reviewed" | "all"
type SortOrder = "recent" | "name"
type TypeFilter = "all" | "entrega" | "registro"

export default function EntregasPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [practices, setPractices] = useState<PracticeRecord[]>([])
  // Which practice record is being given feedback (separate endpoint from entregas).
  const [reviewingPractice, setReviewingPractice] = useState<PracticeRecord | null>(null)
  const [filter, setFilter] = usePersistedState<Filter>("entregas.state", "pending")
  const [cohortFilter, setCohortFilter] = usePersistedState<string>("entregas.cohort", "all")
  const [itemFilter, setItemFilter] = usePersistedState<string>("entregas.item", "all")
  const [typeFilter, setTypeFilter] = usePersistedState<TypeFilter>("entregas.type", "all")
  const [sortOrder, setSortOrder] = usePersistedState<SortOrder>("entregas.sort", "recent")
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<Submission | null>(null)
  const [feedback, setFeedback] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Everything is loaded once and the state tabs filter client-side, so each tab
  // can show its count.
  function load() {
    Promise.all([
      apiJson<Submission[]>("/supervisor/submissions?status=all").then(setSubmissions),
      apiJson<PracticeRecord[]>("/supervisor/practice-records?status=all").then(setPractices),
    ])
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const cohortNames = Array.from(
    new Set([...submissions.flatMap((s) => s.cohorts), ...practices.flatMap((r) => r.cohorts)])
  ).sort()
  const itemTitles = Array.from(
    new Set([...submissions.map((s) => s.item.title), ...practices.map((r) => r.item.title)])
  ).sort()
  const matchesState = (reviewedAt: string | null) =>
    filter === "all" || (filter === "pending" ? !reviewedAt : !!reviewedAt)
  const visibleSubmissions = submissions
    .filter(
      (s) =>
        matchesState(s.reviewedAt) &&
        (typeFilter === "all" || typeFilter === "entrega") &&
        (cohortFilter === "all" || s.cohorts.includes(cohortFilter)) &&
        (itemFilter === "all" || s.item.title === itemFilter)
    )
  const visiblePractices = practices
    .filter(
      (r) =>
        matchesState(r.reviewedAt) &&
        (typeFilter === "all" || typeFilter === "registro") &&
        (cohortFilter === "all" || r.cohorts.includes(cohortFilter)) &&
        (itemFilter === "all" || r.item.title === itemFilter)
    )
  // Tab counts follow the other filters (CIC/Tipo/Tarea) but not the state tab itself.
  const matchesOthers = (kind: "entrega" | "registro", cohorts: string[], title: string) =>
    (typeFilter === "all" || typeFilter === kind) &&
    (cohortFilter === "all" || cohorts.includes(cohortFilter)) &&
    (itemFilter === "all" || title === itemFilter)
  const allRows = [
    ...submissions.filter((s) => matchesOthers("entrega", s.cohorts, s.item.title)),
    ...practices.filter((r) => matchesOthers("registro", r.cohorts, r.item.title)),
  ]
  const pendingCount = allRows.filter((r) => !r.reviewedAt).length
  const reviewedCount = allRows.length - pendingCount

  type FeedItem =
    | { kind: "entrega"; sortKey: string; sortName: string; data: Submission }
    | { kind: "registro"; sortKey: string; sortName: string; data: PracticeRecord }
  const feed: FeedItem[] = [
    ...visibleSubmissions.map(
      (s): FeedItem => ({ kind: "entrega", sortKey: s.submittedAt, sortName: s.coach.name, data: s })
    ),
    ...visiblePractices.map(
      (r): FeedItem => ({ kind: "registro", sortKey: r.submittedAt, sortName: r.coach.name, data: r })
    ),
  ].sort((a, b) =>
    sortOrder === "name"
      ? a.sortName.localeCompare(b.sortName)
      : new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime()
  )

  async function submitPracticeReview() {
    if (!reviewingPractice || !feedback.trim()) return
    setSaving(true)
    const res = await apiTry(`/supervisor/practice-records/${reviewingPractice.id}/review`, {
      method: "POST",
      body: JSON.stringify({ feedback }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: j.error || "No se pudo guardar", variant: "destructive" })
      return
    }
    setReviewingPractice(null)
    setFeedback("")
    toast({ title: "Devolución enviada" })
    load()
  }

  async function submitReview() {
    if (!reviewing || !feedback.trim()) return
    setSaving(true)
    const res = await apiTry(`/supervisor/submissions/${reviewing.id}/review`, {
      method: "POST",
      body: JSON.stringify({ feedback }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: j.error || "No se pudo guardar", variant: "destructive" })
      return
    }
    setReviewing(null)
    setFeedback("")
    toast({ title: "Devolución enviada" })
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Tareas</h1>
        <p className="text-muted-foreground text-sm">
          Lo que los coaches entregan en las tarjetas de tipo Entrega y sus registros de sesión.
          Al devolver, el coach recibe un mail y lo ve en su clase.
        </p>
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">CIC</Label>
          <Select value={cohortFilter} onValueChange={setCohortFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los CIC</SelectItem>
              {cohortNames.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="entrega">Entregas</SelectItem>
              <SelectItem value="registro">Registros de sesión</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tarea</Label>
          <Select value={itemFilter} onValueChange={setItemFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las tareas</SelectItem>
              {itemTitles.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ordenar por</Label>
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Más recientes</SelectItem>
              <SelectItem value="name">Nombre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="pending">
            Sin devolver{" "}
            {pendingCount > 0 && (
              <Badge className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-100">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviewed">Devueltas ({reviewedCount})</TabsTrigger>
          <TabsTrigger value="all">Todas ({allRows.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <LoadingBadge />
      ) : feed.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No hay tareas {filter === "pending" ? "sin devolver" : "en este estado"}.
        </p>
      ) : (
        <div className="space-y-3">
          {feed.map((f) => {
            const d = f.data
            return (
              <Collapsible key={`${f.kind}-${d.id}`} asChild>
                <Card className="bg-white">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {f.kind === "entrega" ? "Entrega" : "Registro"}
                          </Badge>
                          <h3 className="font-medium text-foreground">{d.coach.name}</h3>
                          {f.kind === "registro" && (
                            <>
                              <span className="text-sm text-muted-foreground">entrevistó a</span>
                              <h3 className="font-medium text-foreground">{f.data.coachee.name}</h3>
                            </>
                          )}
                          {d.cohorts.map((c) => (
                            <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                          ))}
                          {d.reviewedAt ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              Devuelta
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                              Sin devolver
                            </Badge>
                          )}
                          {d.editedAt && (
                            <Badge variant="outline" className="text-xs">
                              Editado tras tu devolución
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {d.module.title} · {d.item.title}
                        </p>
                        {f.kind === "entrega" ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3" /> {d.coach.email} · entregó el{" "}
                            {formatShortDate(d.submittedAt)}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {f.data.sessionDate && `Sesión del ${formatShortDate(f.data.sessionDate)} · `}
                            entregado el {formatShortDate(d.submittedAt)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant={d.reviewedAt ? "outline" : "default"}
                          className={d.reviewedAt ? "" : "bg-brand-accent hover:bg-brand-accent-dark"}
                          onClick={() => {
                            if (f.kind === "entrega") setReviewing(f.data)
                            else setReviewingPractice(f.data)
                            setFeedback(d.feedback ?? "")
                          }}
                        >
                          {d.reviewedAt ? "Editar devolución" : "Devolver"}
                        </Button>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="group h-8 w-8 p-0">
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    <CollapsibleContent className="space-y-3">
                      {f.kind === "entrega" ? (
                        <div className="bg-muted/40 rounded-lg p-3">
                          <Markdown>{f.data.text}</Markdown>
                        </div>
                      ) : (
                        <div className="bg-muted/40 rounded-lg p-3 space-y-3">
                          {[
                            ["Principales emergentes", f.data.mainOutputs],
                            ["Herramientas y resultados", f.data.toolsAndResults],
                            ["Conclusiones", f.data.conclusions],
                          ].map(([label, body]) => (
                            <div key={label}>
                              <p className="text-xs font-medium text-foreground mb-1">{label}</p>
                              <Markdown>{body}</Markdown>
                            </div>
                          ))}
                        </div>
                      )}

                      {d.feedback && (
                        <div className="bg-brand-accent/10 border border-brand-accent/30 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Check className="h-3 w-3" /> Tu devolución
                          </p>
                          <Markdown>{d.feedback}</Markdown>
                        </div>
                      )}
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
            )
          })}
        </div>
      )}

      <Dialog
        open={!!reviewingPractice}
        onOpenChange={(open) => !open && setReviewingPractice(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">
              Devolución para {reviewingPractice?.coach.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <p className="text-xs text-muted-foreground">
              {reviewingPractice?.module.title} · {reviewingPractice?.item.title} · sesión con{" "}
              {reviewingPractice?.coachee.name}
            </p>
            <div className="space-y-2">
              <Label>Tu devolución</Label>
              <MarkdownEditor value={feedback} onChange={setFeedback} rows={8} />
              <p className="text-xs text-muted-foreground">
                {reviewingPractice?.reviewedAt
                  ? "Podés seguir editando tu devolución cuando quieras — el coach no recibe un mail de nuevo."
                  : "Al guardar, el coach recibe un mail y el registro queda cerrado a nuevas ediciones de su parte."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewingPractice(null)}>Cancelar</Button>
            <Button
              className="bg-brand-accent hover:bg-brand-accent-dark"
              disabled={saving || !feedback.trim()}
              onClick={submitPracticeReview}
            >
              Enviar devolución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewing} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">
              Devolución para {reviewing?.coach.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">
                {reviewing?.module.title} · {reviewing?.item.title}
              </p>
              {reviewing && <Markdown>{reviewing.text}</Markdown>}
            </div>
            <div className="space-y-2">
              <Label>Tu devolución</Label>
              <MarkdownEditor value={feedback} onChange={setFeedback} rows={8} />
              <p className="text-xs text-muted-foreground">
                {reviewing?.reviewedAt
                  ? "Podés seguir editando tu devolución cuando quieras — el coach no recibe un mail de nuevo."
                  : "Al guardar, el coach recibe un mail y la entrega queda cerrada a nuevas ediciones de su parte."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>Cancelar</Button>
            <Button
              className="bg-brand-accent hover:bg-brand-accent-dark"
              disabled={saving || !feedback.trim()}
              onClick={submitReview}
            >
              Enviar devolución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
