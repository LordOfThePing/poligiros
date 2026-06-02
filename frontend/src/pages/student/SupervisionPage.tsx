import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiPost } from "@/lib/api"

type Assignment = {
  id: string
  test: { title: string }
  client: { name: string }
  completedAt: string
}

type SupervisionRequest = {
  id: string
  status: "PENDING" | "REVIEWED"
  studentNotes: string | null
  supervisorNotes: string | null
  createdAt: string
  reviewedAt: string | null
  assignment: Assignment & { response: unknown }
  supervisor: { name: string } | null
}

export default function StudentSupervisionPage() {
  const { toast } = useToast()
  const [toSend, setToSend] = useState<Assignment[]>([])
  const [history, setHistory] = useState<SupervisionRequest[]>([])
  const [modal, setModal] = useState<{ assignmentId: string; title: string } | null>(null)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  function loadData() {
    apiJson<{ toSend: Assignment[]; history: SupervisionRequest[] }>("/student/supervision")
      .then(({ toSend, history }) => { setToSend(toSend); setHistory(history) })
      .catch(() => {})
  }

  useEffect(() => { loadData() }, [])

  async function handleSend() {
    if (!modal) return
    setSubmitting(true)
    await apiPost("/student/supervision", { assignmentId: modal.assignmentId, studentNotes: notes })
    loadData()
    setModal(null)
    setNotes("")
    toast({ title: "Enviado a supervisión" })
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Supervisión</h1>
        <p className="text-muted-foreground text-sm">Enviá tus tests a Gaby para recibir feedback</p>
      </div>

      <Tabs defaultValue="para-enviar">
        <TabsList>
          <TabsTrigger value="para-enviar">
            Para enviar {toSend.length > 0 && <Badge className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-100">{toSend.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="para-enviar" className="mt-4 space-y-3">
          {toSend.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No tenés tests pendientes de enviar a supervisión
            </p>
          ) : (
            toSend.map((a) => (
              <Card key={a.id} className="bg-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{a.test.title}</p>
                      <p className="text-sm text-muted-foreground">{a.client.name} · Completado {formatShortDate(a.completedAt)}</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-brand-accent hover:bg-brand-accent-dark"
                      onClick={() => setModal({ assignmentId: a.id, title: a.test.title })}
                    >
                      Enviar a supervisión
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="historial" className="mt-4 space-y-3">
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No hay supervisiones en historial</p>
          ) : (
            history.map((req) => (
              <Card key={req.id} className="bg-white">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">{req.assignment.test.title}</p>
                        <p className="text-sm text-muted-foreground">· {req.assignment.client.name}</p>
                        <Badge className={req.status === "REVIEWED" ? "bg-indigo-100 text-indigo-800 hover:bg-indigo-100" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}>
                          {req.status === "REVIEWED" ? "Revisado" : "Pendiente"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Enviado {formatShortDate(req.createdAt)}</p>
                      {req.studentNotes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">"{req.studentNotes}"</p>
                      )}
                      {req.supervisorNotes && (
                        <div className="mt-3 bg-indigo-50 rounded-lg px-3 py-2">
                          <p className="text-xs font-medium text-indigo-700 mb-1">Feedback de Gaby:</p>
                          <p className="text-sm text-indigo-900">{req.supervisorNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!modal} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Enviar a supervisión</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">{modal?.title}</p>
            <Label>Notas para Gaby (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Comentarios, dudas o contexto sobre este cliente..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button className="bg-brand-accent hover:bg-brand-accent-dark" onClick={handleSend} disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
