import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Pencil, KeyRound, Ban, RotateCcw } from "lucide-react"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiPost, apiTry } from "@/lib/api"
import { LoadingBadge } from "@/components/LoadingBadge"
import { useToast } from "@/hooks/use-toast"

const TEST_CODES: Record<string, string> = {
  ANCLAS_CARRERA: "AC",
  TABLERO_IDEAS: "TI",
  PLAN_VITAL: "PV",
  PIRAMIDE_PROPOSITO: "PP",
  MODELO_NEGOCIO: "MN",
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  unassigned: "bg-gray-100 text-gray-500",
}

type Test = { id: string; type: string; title: string }
type CoachAssignment = {
  id: string
  completedAt: string | null
  /** True when a still-pending self-test was revoked by the supervisor. */
  revoked?: boolean
  test: { type: string }
}

export default function AlumnoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [student, setStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [allTests, setAllTests] = useState<Test[]>([])
  const [coachTests, setCoachTests] = useState<CoachAssignment[]>([])
  const [assigning, setAssigning] = useState<string | null>(null)

  // Edit profile dialog.
  const [editOpen, setEditOpen] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", especialidad: "", bio: "" })

  // Reset password dialog.
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetPassword, setResetPassword] = useState("")
  const [resetResult, setResetResult] = useState<string | null>(null)
  const [resetError, setResetError] = useState("")

  function loadCoachTests() {
    apiJson<any[]>(`/supervisor/coaches/${id}/tests`)
      .then((data) =>
        setCoachTests(
          data.map((a) => ({
            id: a.id,
            completedAt: a.completedAt,
            test: a.test,
            revoked: a.completedAt === null && Boolean(a.accessRevokedAt),
          }))
        )
      )
      .catch(() => {})
  }

  async function setRevoked(assignment: CoachAssignment, revoked: boolean) {
    const res = await apiTry(
      `/supervisor/assignments/${assignment.id}/${revoked ? "revoke" : "reopen"}`,
      { method: "POST" }
    )
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast({ title: j.error || "No se pudo actualizar el acceso", variant: "destructive" })
      return
    }
    toast({ title: revoked ? "Acceso revocado al test" : "Acceso restablecido al test" })
    loadCoachTests()
    loadStudent()
  }

  /** Wipe a completed test so the user can take it again (direct, no request). */
  async function handleResetDirect(assignment: { id: string }) {
    if (
      !confirm(
        "¿Borrar el resultado y reabrir este test para que lo vuelva a hacer? El resultado y su supervisión se eliminan."
      )
    ) {
      return
    }
    const res = await apiTry(`/supervisor/assignments/${assignment.id}/reset-direct`, { method: "POST" })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast({ title: j.error || "No se pudo reabrir el test", variant: "destructive" })
      return
    }
    toast({ title: "Test reabierto para rehacerlo" })
    loadCoachTests()
    loadStudent()
  }

  function loadStudent() {
    apiJson<any>(`/supervisor/students/${id}`)
      .then((data) => { setStudent(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadStudent()
    apiJson<Test[]>("/supervisor/tests").then(setAllTests).catch(() => {})
    loadCoachTests()
  }, [id])

  function openEdit() {
    if (!student) return
    setEditForm({
      name: student.name ?? "",
      email: student.email ?? "",
      phone: student.phone ?? "",
      especialidad: student.especialidad ?? "",
      bio: student.bio ?? "",
    })
    setEditOpen(true)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    setSavingEdit(true)
    const res = await apiTry(`/supervisor/students/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone || null,
        especialidad: editForm.especialidad || null,
        bio: editForm.bio || null,
      }),
    })
    setSavingEdit(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast({ title: json.error || "No se pudieron guardar los cambios", variant: "destructive" })
      return
    }
    toast({ title: "Datos actualizados" })
    setEditOpen(false)
    loadStudent()
  }

  function openReset() {
    setResetPassword("")
    setResetResult(null)
    setResetError("")
    setResetOpen(true)
  }

  async function handleResetPassword() {
    setResetting(true)
    setResetError("")
    const res = await apiTry(`/supervisor/students/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password: resetPassword || undefined }),
    })
    setResetting(false)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setResetError(json.error || "No se pudo restablecer la contraseña")
      return
    }
    setResetResult(json.tempPassword)
    toast({ title: "Contraseña restablecida" })
  }

  async function handleResendInvite() {
    try {
      const res = await apiPost<{ link: string }>(`/supervisor/coaches/${id}/resend-invite`, {})
      await navigator.clipboard.writeText(res.link).catch(() => {})
      toast({ title: "Nuevo enlace copiado al portapapeles" })
    } catch {
      toast({ title: "No se pudo reenviar la invitación", variant: "destructive" })
    }
  }

  async function handleAssignToCoach(testId: string) {
    setAssigning(testId)
    try {
      await apiPost(`/supervisor/coaches/${id}/assign`, { testId })
      toast({ title: "Test asignado al coach" })
      loadCoachTests()
    } catch {
      toast({ title: "Error al asignar", variant: "destructive" })
    }
    setAssigning(null)
  }

  if (loading) return <LoadingBadge />
  if (!student) return <div className="text-muted-foreground text-sm py-8">Alumno no encontrado</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/supervisor/alumnos" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl text-foreground">{student.name}</h1>
            {student.pending && <Badge variant="secondary" className="text-xs">Pendiente</Badge>}
          </div>
          <p className="text-muted-foreground text-sm">{student.email}</p>
        </div>
        {!student.pending && (
          <Button variant="outline" size="sm" onClick={openReset}>
            <KeyRound className="h-4 w-4 mr-1" /> Reset contraseña
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={openEdit}>
          <Pencil className="h-4 w-4 mr-1" /> Editar datos
        </Button>
        {student.pending && (
          <Button variant="outline" size="sm" onClick={handleResendInvite}>
            Reenviar invitación
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="font-serif text-xl">Clientes</h2>
        {student.clients.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin clientes asignados</p>
        ) : (
          student.clients.map((client: any) => (
            <Card key={client.id} className="bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-sans text-base font-medium">{client.name}</CardTitle>
                  <span className="text-xs text-muted-foreground">{client.email}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap items-center">
                  {["ANCLAS_CARRERA", "TABLERO_IDEAS", "PLAN_VITAL", "PIRAMIDE_PROPOSITO", "MODELO_NEGOCIO"].map((type) => {
                    const assignment = client.assignments.find((a: any) => a.test.type === type)
                    const revoked = assignment && !assignment.completedAt && Boolean(assignment.accessRevokedAt)
                    let status = "unassigned"
                    if (revoked) status = "revoked"
                    else if (assignment?.completedAt) status = "completed"
                    else if (assignment) status = "pending"
                    const st = revoked
                      ? "bg-red-100 text-red-700"
                      : STATUS_COLORS[status]
                    return (
                      <span key={type} className="inline-flex items-center gap-1">
                        <span
                          className={`text-xs px-2 py-1 rounded font-medium ${st}`}
                          title={revoked ? "Acceso suspendido" : undefined}
                        >
                          {TEST_CODES[type]}
                          {status === "completed" && " ✓"}
                          {status === "pending" && " …"}
                        </span>
                        {assignment && !assignment.completedAt && !revoked && (
                          <button
                            onClick={() => setRevoked(assignment, true)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Revocar acceso a este test pendiente"
                          >
                            <Ban className="h-3 w-3" />
                          </button>
                        )}
                        {revoked && (
                          <button
                            onClick={() => setRevoked(assignment, false)}
                            className="text-muted-foreground hover:text-brand-accent"
                            title="Reabrir acceso a este test"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                        {assignment?.completedAt && (
                          <button
                            onClick={() => handleResetDirect(assignment)}
                            className="text-muted-foreground hover:text-brand-accent"
                            title="Borrar resultado y volver a hacerlo"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    )
                  })}
                </div>
                {client.sessions.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {client.sessions.length} sesiones registradas
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="font-serif text-xl">Tests del coach</h2>
          <p className="text-sm text-muted-foreground">Tests que asignás a {student.name} (los hace logueado/a en su panel)</p>
        </div>
        <Card className="bg-white">
          <CardContent className="py-4 space-y-2">
            {allTests
              .map((t) => {
                const assignment = coachTests.find((a) => a.test.type === t.type)
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-border last:border-0">
                    <span className="text-sm font-medium text-foreground">{t.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {assignment?.completedAt && (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Completado ✓</Badge>
                      )}
                      {assignment && !assignment.completedAt && assignment.revoked && (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">Suspendido</Badge>
                      )}
                      {assignment && !assignment.completedAt && !assignment.revoked && (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">Pendiente</Badge>
                      )}
                      {assignment && !assignment.completedAt && !assignment.revoked && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRevoked(assignment, true)}
                        >
                          <Ban className="h-3 w-3 mr-1" /> Revocar
                        </Button>
                      )}
                      {assignment && !assignment.completedAt && assignment.revoked && (
                        <Button size="sm" variant="outline" onClick={() => setRevoked(assignment, false)}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Reabrir
                        </Button>
                      )}
                      {assignment?.completedAt && (
                        <Button size="sm" variant="outline" onClick={() => handleResetDirect(assignment)}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Rehacer
                        </Button>
                      )}
                      {!assignment && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={assigning === t.id}
                          onClick={() => handleAssignToCoach(t.id)}
                        >
                          {assigning === t.id ? "Asignando..." : "Asignar"}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="font-serif text-xl">Módulos completados</h2>
        {student.moduleProgress.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ninguno completado aún</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {student.moduleProgress.map((mp: any) => (
              <Badge key={mp.id} className="bg-brand-accent text-white">
                {mp.module.title}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {student.sessionRecords.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-serif text-xl">Registros de sesión</h2>
          <div className="space-y-2">
            {student.sessionRecords.map((sr: any) => (
              <div key={sr.id} className="flex items-center gap-3 text-sm bg-white rounded-lg px-4 py-3 border border-border">
                <Badge variant="outline">Sesión #{sr.sessionNum}</Badge>
                <span className="text-foreground">{sr.coacheeName}</span>
                <span className="text-muted-foreground">{formatShortDate(sr.sessionDate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit profile dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar datos del coach</DialogTitle>
            <DialogDescription>Actualizá los datos de perfil de {student.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre y apellido *</Label>
              <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email *</Label>
              <Input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Teléfono</Label>
                <Input id="edit-phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-especialidad">Especialidad</Label>
                <Input id="edit-especialidad" value={editForm.especialidad} onChange={(e) => setEditForm({ ...editForm, especialidad: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-bio">Bio</Label>
              <Textarea id="edit-bio" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} className="min-h-[80px]" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingEdit} className="bg-brand-accent hover:bg-brand-accent-dark">
                {savingEdit ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={resetOpen} onOpenChange={(open) => { setResetOpen(open); if (!open) setResetResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>
              {resetResult
                ? "Guardá esta contraseña temporal y entregásela a " + student.name + "."
                : "El coach va a tener que elegir una contraseña nueva en su próximo ingreso."}
            </DialogDescription>
          </DialogHeader>

          {resetResult ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-brand-accent/10 border border-brand-accent/20 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Contraseña temporal</p>
                <p className="font-mono text-xl font-semibold text-brand-accent break-all">{resetResult}</p>
              </div>
              <Button className="w-full bg-brand-accent hover:bg-brand-accent-dark" onClick={() => setResetOpen(false)}>
                Listo
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-password">
                  Contraseña temporal <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Input
                  id="reset-password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Si la dejás vacía, generamos una y se la enviamos por email"
                />
              </div>
              {resetError && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{resetError}</p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>Cancelar</Button>
                <Button onClick={handleResetPassword} disabled={resetting} className="bg-brand-accent hover:bg-brand-accent-dark">
                  {resetting ? "Restableciendo..." : "Restablecer contraseña"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
