import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Plus, Copy, Eye, Pencil, Trash2, MoreHorizontal, Send, RefreshCw } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { api, apiJson, apiPost } from "@/lib/api"
import { EditableResult } from "@/components/EditableResult"

const TEST_INFO: Record<string, { title: string; comingSoon?: boolean }> = {
  ANCLAS_CARRERA: { title: "Test de Anclas de Carrera" },
  TABLERO_IDEAS: { title: "Tablero de Ideas" },
  PLAN_VITAL: { title: "Plan Vital Integral®", comingSoon: true },
  PIRAMIDE_PROPOSITO: { title: "Pirámide del Propósito" },
  MODELO_NEGOCIO: { title: "Exploración" },
}

// "Exploración" (MODELO_NEGOCIO) is a post-test of "Tablero de Ideas", so it
// sits indented right below it. `order` is the label shown before the title.
const TEST_ORDER: { type: string; order: string; indent?: boolean }[] = [
  { type: "ANCLAS_CARRERA", order: "1" },
  { type: "TABLERO_IDEAS", order: "2" },
  { type: "MODELO_NEGOCIO", order: "2.1", indent: true },
  { type: "PLAN_VITAL", order: "3" },
  { type: "PIRAMIDE_PROPOSITO", order: "4" },
]

type Assignment = {
  id: string
  test: { id: string; type: string; title: string }
  completedAt: string | null
  accessToken: string | null
  response: { responses: Record<string, unknown> } | null
  supervision: { id: string; status: string } | null
  resetRequests?: { id: string; status: "PENDING" | "APPROVED" | "REJECTED" }[]
}

type SessionRecord = {
  id: string
  sessionNum: number
  sessionDate: string
  coacheeName: string
}

type Client = {
  id: string
  name: string
  email: string
  assignments: Assignment[]
  sessions: SessionRecord[]
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [client, setClient] = useState<Client | null>(null)
  const [tests, setTests] = useState<{ id: string; type: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [supervisionModal, setSupervisionModal] = useState<{ assignmentId: string; testTitle: string } | null>(null)
  const [supervisionNotes, setSupervisionNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [resetModal, setResetModal] = useState<{ assignmentId: string; testTitle: string } | null>(null)
  const [resetReason, setResetReason] = useState("")
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resultModal, setResultModal] = useState<{
    assignmentId: string
    title: string
    testType: string
    responses: Record<string, unknown>
    completedAt: string
  } | null>(null)

  function refreshClient() {
    return apiJson<Client>(`/student/clients/${id}`)
      .then(setClient)
  }

  useEffect(() => {
    apiJson<Client>(`/student/clients/${id}`)
      .then((data) => { setClient(data); setLoading(false) })
      .catch(() => setLoading(false))

    apiJson<{ id: string; type: string }[]>("/tests")
      .then(setTests)
      .catch(() => {})
  }, [id])

  async function handleAssign(testType: string) {
    const test = tests.find((t) => t.type === testType)
    if (!test) return

    const result = await apiPost<{ assignment: Assignment; link: string }>(`/student/clients/${id}/assign`, { testId: test.id })
    await refreshClient()
    toast({ title: "Test asignado", description: `Enlace: ${result.link}` })
  }

  async function handleResend(assignmentId: string) {
    const result = await apiPost<{ link: string }>(`/student/assignments/${assignmentId}/resend`, {})
    toast({ title: "Enlace regenerado", description: result.link })
    // Copy to clipboard
    navigator.clipboard.writeText(result.link).catch(() => {})
  }

  async function handleSendSupervision() {
    if (!supervisionModal) return
    setSubmitting(true)
    await apiPost("/student/supervision", { assignmentId: supervisionModal.assignmentId, studentNotes: supervisionNotes })
    await refreshClient()
    setSupervisionModal(null)
    setSupervisionNotes("")
    toast({ title: "Enviado a supervisión" })
    setSubmitting(false)
  }

  async function handleRequestReset() {
    if (!resetModal) return
    setResetSubmitting(true)
    try {
      await apiPost(`/student/assignments/${resetModal.assignmentId}/reset-request`, { reason: resetReason })
      await refreshClient()
      setResetModal(null)
      setResetReason("")
      toast({ title: "Solicitud enviada", description: "La supervisora debe aprobar la eliminación." })
    } catch {
      toast({ title: "No se pudo solicitar la eliminación", variant: "destructive" })
    }
    setResetSubmitting(false)
  }

  function copyLink(token: string) {
    const link = `${window.location.origin}/t/${token}`
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: "Enlace copiado" })
    }).catch(() => {})
  }

  if (loading) return <div className="text-muted-foreground text-sm py-8">Cargando...</div>
  if (!client) return <div className="text-muted-foreground text-sm py-8">Cliente no encontrado</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/student/clientes" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-serif text-3xl text-foreground">{client.name}</h1>
          <p className="text-muted-foreground text-sm">{client.email}</p>
        </div>
      </div>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {TEST_ORDER.map(({ type, order, indent }) => {
            const info = TEST_INFO[type]
            const assignment = client.assignments.find((a) => a.test.type === type)
            const isComingSoon = info.comingSoon
            const resetPending = assignment?.resetRequests?.[0]?.status === "PENDING"

            return (
              <div
                key={type}
                className={`flex items-center justify-between py-2 border-b border-border last:border-0 ${indent ? "pl-6 border-l-2 border-l-border ml-1" : ""}`}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-muted-foreground tabular-nums">{order}.</span>
                  <span className="text-sm font-medium text-foreground">{info.title}</span>
                  {isComingSoon && <Badge variant="secondary" className="text-xs">Próximamente</Badge>}
                  {assignment?.completedAt && <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Completado ✓</Badge>}
                  {assignment && !assignment.completedAt && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">Pendiente</Badge>}
                  {assignment?.supervision && (
                    <Badge className={`text-xs ${assignment.supervision.status === "REVIEWED" ? "bg-indigo-100 text-indigo-800" : "bg-gray-100 text-gray-600"} hover:bg-current`}>
                      {assignment.supervision.status === "REVIEWED" ? "Revisado" : "En supervisión"}
                    </Badge>
                  )}
                  {resetPending && (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">Eliminación solicitada</Badge>
                  )}
                </div>

                {!isComingSoon && (
                  <div className="flex gap-2">
                    {!assignment && (
                      <Button size="sm" variant="outline" onClick={() => handleAssign(type)}>
                        Asignar
                      </Button>
                    )}
                    {assignment && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Acciones">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {assignment.accessToken && (
                            <DropdownMenuItem onSelect={() => copyLink(assignment.accessToken!)}>
                              <Copy className="h-4 w-4" /> Copiar enlace
                            </DropdownMenuItem>
                          )}
                          {!assignment.completedAt && (
                            <DropdownMenuItem onSelect={() => handleResend(assignment.id)}>
                              <RefreshCw className="h-4 w-4" /> Reenviar
                            </DropdownMenuItem>
                          )}
                          {assignment.completedAt && assignment.accessToken && (
                            <DropdownMenuItem
                              onSelect={() =>
                                window.open(`${window.location.origin}/t/${assignment.accessToken}`, "_blank", "noopener")
                              }
                            >
                              <Eye className="h-4 w-4" /> Ver resultado
                            </DropdownMenuItem>
                          )}
                          {assignment.completedAt && assignment.response && (
                            <DropdownMenuItem
                              onSelect={() =>
                                setResultModal({
                                  assignmentId: assignment.id,
                                  title: info.title,
                                  testType: assignment.test.type,
                                  responses: assignment.response!.responses,
                                  completedAt: assignment.completedAt!,
                                })
                              }
                            >
                              <Pencil className="h-4 w-4" /> Editar
                            </DropdownMenuItem>
                          )}
                          {assignment.completedAt && !assignment.supervision && (
                            <DropdownMenuItem
                              onSelect={() => setSupervisionModal({ assignmentId: assignment.id, testTitle: info.title })}
                            >
                              <Send className="h-4 w-4" /> Enviar a supervisión
                            </DropdownMenuItem>
                          )}
                          {assignment.completedAt && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={resetPending}
                                onSelect={() => setResetModal({ assignmentId: assignment.id, testTitle: info.title })}
                              >
                                <Trash2 className="h-4 w-4" />
                                {resetPending ? "Pendiente de aprobación" : "Solicitar eliminación"}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-lg">Sesiones</CardTitle>
            <Button size="sm" className="bg-brand-accent hover:bg-brand-accent-dark" asChild>
              <Link to={`/student/registros/nuevo?clientId=${id}`}>
                <Plus className="h-3 w-3 mr-1" /> Nueva sesión
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {client.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin sesiones registradas aún</p>
          ) : (
            <div className="space-y-2">
              {client.sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <Badge variant="outline">Sesión #{s.sessionNum}</Badge>
                  <span className="text-foreground">{s.coacheeName}</span>
                  <span className="text-muted-foreground">{formatShortDate(s.sessionDate)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!supervisionModal} onOpenChange={(open) => !open && setSupervisionModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Enviar a supervisión</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">{supervisionModal?.testTitle}</p>
            <Label>Notas para Gaby (opcional)</Label>
            <Textarea
              value={supervisionNotes}
              onChange={(e) => setSupervisionNotes(e.target.value)}
              placeholder="Comentarios, dudas o contexto sobre este cliente..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupervisionModal(null)}>Cancelar</Button>
            <Button
              className="bg-brand-accent hover:bg-brand-accent-dark"
              onClick={handleSendSupervision}
              disabled={submitting}
            >
              {submitting ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetModal} onOpenChange={(open) => !open && setResetModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Solicitar eliminación del resultado</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">{resetModal?.testTitle}</p>
            <p className="text-sm text-muted-foreground">
              Esto borra el resultado enviado y vuelve a habilitar el test para rehacerlo.
              La eliminación se aplica solo cuando la supervisora la aprueba.
            </p>
            <Label>Motivo (opcional)</Label>
            <Textarea
              value={resetReason}
              onChange={(e) => setResetReason(e.target.value)}
              placeholder="¿Por qué hay que rehacer este test?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetModal(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleRequestReset}
              disabled={resetSubmitting}
            >
              {resetSubmitting ? "Enviando..." : "Solicitar eliminación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resultModal} onOpenChange={(open) => !open && setResultModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Editar resultado — {resultModal?.title}</DialogTitle>
          </DialogHeader>
          {resultModal && (
            <EditableResult
              testType={resultModal.testType}
              responses={resultModal.responses}
              onSave={async (responses) => {
                await api(`/student/responses/${resultModal.assignmentId}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ responses }),
                })
                toast({ title: "Resultado actualizado" })
                setResultModal(null)
                refreshClient()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
