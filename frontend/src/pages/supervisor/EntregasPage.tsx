import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Check, Mail } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiTry } from "@/lib/api"
import { Markdown } from "@/components/Markdown"
import { MarkdownEditor } from "@/components/MarkdownEditor"

type Submission = {
  id: string
  text: string
  submittedAt: string
  feedback: string | null
  reviewedAt: string | null
  coach: { id: string; name: string; email: string }
  cohorts: string[]
  item: { id: string; title: string }
  module: { id: string; title: string }
}

type Filter = "pending" | "reviewed" | "all"

export default function EntregasPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [filter, setFilter] = useState<Filter>("pending")
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<Submission | null>(null)
  const [feedback, setFeedback] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  function load() {
    setLoading(true)
    apiJson<Submission[]>(`/supervisor/submissions?status=${filter}`)
      .then((s) => { setSubmissions(s); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(load, [filter])

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
        <h1 className="font-serif text-3xl text-foreground mb-1">Entregas</h1>
        <p className="text-muted-foreground text-sm">
          Lo que los coaches entregan en las tarjetas de tipo Entrega. Al devolver, el coach recibe
          un mail y lo ve en su clase.
        </p>
      </div>

      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Estado</Label>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Sin devolver</SelectItem>
              <SelectItem value="reviewed">Devueltas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : submissions.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No hay entregas {filter === "pending" ? "sin devolver" : "en este estado"}.
        </p>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <Card key={s.id} className="bg-white">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground">{s.coach.name}</h3>
                      {s.cohorts.map((c) => (
                        <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                      ))}
                      {s.reviewedAt ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          Devuelta
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                          Sin devolver
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {s.module.title} · {s.item.title}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3" /> {s.coach.email} · entregó el{" "}
                      {formatShortDate(s.submittedAt)}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant={s.reviewedAt ? "outline" : "default"}
                    className={s.reviewedAt ? "" : "bg-brand-accent hover:bg-brand-accent-dark"}
                    onClick={() => { setReviewing(s); setFeedback(s.feedback ?? "") }}
                  >
                    {s.reviewedAt ? "Ver devolución" : "Devolver"}
                  </Button>
                </div>

                <div className="bg-muted/40 rounded-lg p-3">
                  <Markdown>{s.text}</Markdown>
                </div>

                {s.feedback && (
                  <div className="bg-brand-accent/10 border border-brand-accent/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Tu devolución
                    </p>
                    <Markdown>{s.feedback}</Markdown>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
                Al guardar, el coach recibe un mail y la entrega queda cerrada a nuevas ediciones.
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
