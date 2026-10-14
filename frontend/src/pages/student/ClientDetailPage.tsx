import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Plus, Copy, Eye, Pencil, Trash2, MoreHorizontal, Send, RefreshCw, Download } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiPost, apiTry } from "@/lib/api"
import { EditableResult } from "@/components/EditableResult"
import { LoadingBadge } from "@/components/LoadingBadge"
import { useCoachAccess } from "@/lib/useCoachAccess"
import { useAuth } from "@/lib/auth"
import type { TestType } from "@/lib/access"
import { TEST_TITLES } from "@/lib/testInfo"
import { downloadBulkSessionRecordsPdf } from "@/lib/bulkSessionPdf"

const TEST_INFO: Record<string, { title: string; comingSoon?: boolean }> = Object.fromEntries(
  Object.entries(TEST_TITLES).map(([type, title]) => [type, { title }]),
)

// TAREAS_EXPLORACION and MODELO_NEGOCIO are post-tests of "Tablero de Ideas",
// so they sit indented right below it. `order` is the label shown before the title.
const TEST_ORDER: { type: string; order: string; indent?: boolean }[] = [
  { type: "ANCLAS_CARRERA", order: "1" },
  { type: "TABLERO_IDEAS", order: "2" },
  { type: "TAREAS_EXPLORACION", order: "2.1", indent: true },
  { type: "MODELO_NEGOCIO", order: "2.2", indent: true },
  { type: "PLAN_VITAL", order: "3" },
  { type: "PIRAMIDE_PROPOSITO", order: "4" },
  { type: "COLLAGE", order: "5" },
  { type: "OBJETIVO_CARRERA", order: "6" },
  { type: "PLAN_ACCION", order: "7" },
]

type Assignment = {
  id: string
  test: { id: string; type: string; title: string }
  completedAt: string | null
  accessToken: string | null
  response: { responses: Record<string, unknown>; editedAt: string | null } | null
  supervision: { id: string; status: string; reviewedAt: string | null } | null
  resetRequests?: { id: string; status: "PENDING" | "APPROVED" | "REJECTED" }[]
}

type SessionRecord = {
  id: string
  sessionNum: number
  sessionDate: string
  coacheeName: string
  coacheeAge: string
  coacheeSex: string
  coacheeWorks: boolean
  coacheePosition: string | null
  mainOutputs: string
  toolsAndResults: string
  conclusions: string
}

type Client = {
  id: string
  name: string
  email: string
  age: string | null
  sex: string | null
  works: boolean | null
  position: string | null
  assignments: Assignment[]
  sessions: SessionRecord[]
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { access } = useCoachAccess()
  const { user } = useAuth()
  const [bulkDownloading, setBulkDownloading] = useState(false)
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

  if (loading) return <LoadingBadge />
  if (!client) return <div className="text-muted-foreground text-sm py-8">Coachee no encontrado</div>

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/student/clientes" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-serif text-3xl text-foreground">{client.name}</h1>
          <p className="text-muted-foreground text-sm">{client.email}</p>
        </div>
      </div>

      <CoacheeProfileCard
        client={client}
        onSaved={() => refreshClient()}
      />

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
            const notEnabled =
              !!access?.enabledTestTypes &&
              !access.enabledTestTypes.includes(type as TestType)
            // Editable only while the supervisor's review stands: saving sends it
            // back to her, and it stays frozen until she reviews it again.
            const canEdit =
              Boolean(assignment?.completedAt) &&
              Boolean(assignment?.response) &&
              assignment?.supervision?.status === "REVIEWED"

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
                  {assignment?.response?.editedAt && (
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">Editado</Badge>
                  )}
                  {resetPending && (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">Eliminación solicitada</Badge>
                  )}
                </div>

                {!isComingSoon && (
                  <div className="flex gap-2">
                    {!assignment && notEnabled && (
                      <span className="text-xs text-muted-foreground">No habilitado para tu pool</span>
                    )}
                    {!assignment && !notEnabled && (
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
                          {canEdit && (
                            <DropdownMenuItem
                              onSelect={() => {
                                // Modelo de Negocio canvas needs the full
                                // viewport width — a 2xl Dialog would compress
                                // its 5-column reference layout into a stack.
                                if (assignment.test.type === "MODELO_NEGOCIO") {
                                  navigate(
                                    `/student/clientes/${id}/editar/${assignment.id}`,
                                  )
                                  return
                                }
                                setResultModal({
                                  assignmentId: assignment.id,
                                  title: info.title,
                                  testType: assignment.test.type,
                                  responses: assignment.response!.responses,
                                  completedAt: assignment.completedAt!,
                                })
                              }}
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="font-serif text-lg">Registros de sesión</CardTitle>
            <div className="flex items-center gap-2">
              {client.sessions.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkDownloading}
                  onClick={async () => {
                    setBulkDownloading(true)
                    try {
                      await downloadBulkSessionRecordsPdf(
                        client.sessions,
                        user?.name ?? "",
                        client.name,
                        `registros-${client.name.toLowerCase().replace(/\s+/g, "-")}.pdf`,
                      )
                    } finally {
                      setBulkDownloading(false)
                    }
                  }}
                >
                  <Download className="h-3 w-3 mr-1" />
                  {bulkDownloading ? "Generando..." : "Descargar todos"}
                </Button>
              )}
              <Button size="sm" className="bg-brand-accent hover:bg-brand-accent-dark" asChild>
                <Link to={`/student/registros/nuevo?clientId=${id}`}>
                  <Plus className="h-3 w-3 mr-1" /> Nuevo registro
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {client.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros de sesión aún</p>
          ) : (
            <div className="space-y-2">
              {client.sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <Badge variant="outline">Registro #{s.sessionNum}</Badge>
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
              placeholder="Comentarios, dudas o contexto sobre este coachee..."
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
          <p className="text-xs text-muted-foreground -mt-2">
            Podés editar las veces que quieras. Cada edición vuelve a supervisión y le avisa a Gaby
            para que lea la versión más nueva.
          </p>
          {resultModal && (
            <EditableResult
              testType={resultModal.testType}
              responses={resultModal.responses}
              onSave={async (responses) => {
                const res = await apiTry(`/student/responses/${resultModal.assignmentId}`, {
                  method: "PUT",
                  body: JSON.stringify({ responses }),
                })
                if (!res.ok) {
                  const j = await res.json().catch(() => ({ message: "No se pudo guardar" }))
                  toast({ title: j.message || "No se pudo guardar", variant: "destructive" })
                  return
                }
                toast({ title: "Resultado actualizado", description: "Vuelve a supervisión para una nueva revisión." })
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

function CoacheeProfileCard({
  client,
  onSaved,
}: {
  client: Client
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [age, setAge] = useState(client.age ?? "")
  const [sex, setSex] = useState(client.sex ?? "")
  const [works, setWorks] = useState<boolean>(client.works ?? false)
  const [position, setPosition] = useState(client.position ?? "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setAge(client.age ?? "")
    setSex(client.sex ?? "")
    setWorks(client.works ?? false)
    setPosition(client.position ?? "")
  }, [client.id, client.age, client.sex, client.works, client.position])

  async function save() {
    setSaving(true)
    try {
      await apiJson<Client>(`/student/clients/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age, sex, works, position: works ? position : null }),
      })
      toast({ title: "Datos del coachee guardados" })
      setEditing(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const hasData =
    client.age || client.sex || typeof client.works === "boolean" || client.position

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-serif text-lg">Datos del coachee</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
            <Pencil className="h-3 w-3 mr-1" /> {editing ? "Cancelar" : "Editar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!editing ? (
          hasData ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Edad</p>
                <p className="text-foreground">{client.age || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Sexo</p>
                <p className="text-foreground">{client.sex || "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-0.5">¿Trabaja?</p>
                <p className="text-foreground">
                  {typeof client.works === "boolean" ? (client.works ? "Sí" : "No") : "—"}
                  {client.works && client.position ? ` · ${client.position}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no cargaste los datos del coachee. Se completan solos la primera vez
              que grabes un registro de sesión, o podés editarlos acá.
            </p>
          )
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Edad</Label>
                <Input value={age} onChange={(e) => setAge(e.target.value)} placeholder="Ej: 35" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sexo</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger><SelectValue placeholder="Seleccioná" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Femenino">Femenino</SelectItem>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Prefiero no decir">Prefiero no decir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={works} onCheckedChange={setWorks} id="works-profile" />
              <Label htmlFor="works-profile">¿Trabaja actualmente?</Label>
            </div>
            {works && (
              <div className="space-y-1">
                <Label className="text-xs">Posición actual</Label>
                <Input
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Ej: Gerente de Marketing"
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving} className="bg-brand-accent hover:bg-brand-accent-dark">
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
