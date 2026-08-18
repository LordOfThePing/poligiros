import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus, UserPlus, Pencil, Copy, Check, ChevronDown, ChevronRight, Video, Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiPost, apiRaw, apiTry } from "@/lib/api"
import { copyToClipboard, isSignupLinkActive, signupUrl, type SignupLink } from "@/lib/signup"

type Enrollment = { id: string; user: { id: string; name: string; email: string } }
type Cohort = {
  id: string
  name: string
  startDate: string
  active: boolean
  zoomUrl: string | null
  clientsEnabled: boolean
  testsEnabled: boolean
  enrollments: Enrollment[]
  _count: { enrollments: number }
}

/** One row of the release grid: a module plus its state for THIS cohort. */
type Release = {
  moduleId: string
  title: string
  orderIndex: number
  published: boolean
  itemCount: number
  released: boolean
  availableFrom: string | null
}

/* ─────────────────────────────────────────
   Per-cohort module release panel
───────────────────────────────────────── */

function ReleasePanel({ cohort, cohorts }: { cohort: Cohort; cohorts: Cohort[] }) {
  const { toast } = useToast()
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [copyFrom, setCopyFrom] = useState("")

  useEffect(() => {
    apiJson<Release[]>(`/supervisor/cohorts/${cohort.id}/releases`)
      .then((r) => { setReleases(r); setLoading(false) })
      .catch(() => setLoading(false))
  }, [cohort.id])

  async function toggle(moduleId: string, released: boolean) {
    setReleases((prev) => prev.map((r) => (r.moduleId === moduleId ? { ...r, released } : r)))
    const res = await apiTry(`/supervisor/cohorts/${cohort.id}/releases/${moduleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ released }),
    })
    if (!res.ok) {
      // Put the switch back where it was.
      setReleases((prev) => prev.map((r) => (r.moduleId === moduleId ? { ...r, released: !released } : r)))
      toast({ title: "No se pudo actualizar", variant: "destructive" })
    }
  }

  async function setDate(moduleId: string, value: string) {
    setReleases((prev) =>
      prev.map((r) => (r.moduleId === moduleId ? { ...r, availableFrom: value || null } : r))
    )
    await apiRaw(`/supervisor/cohorts/${cohort.id}/releases/${moduleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ availableFrom: value || null }),
    })
  }

  async function handleCopy() {
    if (!copyFrom) return
    const res = await apiTry(`/supervisor/cohorts/${cohort.id}/releases/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromCohortId: copyFrom }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: j.error || "Error al copiar", variant: "destructive" })
      return
    }
    const fresh = await apiJson<Release[]>(`/supervisor/cohorts/${cohort.id}/releases`)
    setReleases(fresh)
    setCopyFrom("")
    toast({ title: "Liberaciones copiadas" })
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando módulos...</p>
  if (releases.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay módulos creados todavía.</p>
  }

  const others = cohorts.filter((c) => c.id !== cohort.id)

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {releases.map((r) => (
          <div
            key={r.moduleId}
            className="flex flex-wrap items-center gap-3 bg-muted/40 rounded-lg px-3 py-2"
          >
            <Switch checked={r.released} onCheckedChange={(v) => toggle(r.moduleId, v)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-foreground">{r.title}</span>
                {!r.published && (
                  <Badge variant="secondary" className="text-xs">Borrador</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {r.itemCount} {r.itemCount === 1 ? "ítem" : "ítems"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Desde</Label>
              <Input
                type="date"
                value={r.availableFrom ? r.availableFrom.slice(0, 10) : ""}
                onChange={(e) => setDate(r.moduleId, e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Un módulo en borrador no se ve aunque esté liberado. Si ponés fecha, se abre solo ese día.
      </p>

      {others.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          <Label className="text-xs text-muted-foreground">Copiar liberaciones de</Label>
          <Select value={copyFrom} onValueChange={setCopyFrom}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Elegí un CIC" />
            </SelectTrigger>
            <SelectContent>
              {others.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8" disabled={!copyFrom} onClick={handleCopy}>
            Copiar
          </Button>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────
   Page
───────────────────────────────────────── */

export default function CohortesPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDate, setNewDate] = useState("")
  const [enrollEmail, setEnrollEmail] = useState("")
  const [enrollingCohortId, setEnrollingCohortId] = useState<string | null>(null)
  // The CIC being edited, held as a draft so Cancelar discards cleanly.
  const [editing, setEditing] = useState<
    { id: string; name: string; startDate: string; zoomUrl: string } | null
  >(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  // Public signup link for the CIC whose Inscribir dialog is open.
  const [inviteLink, setInviteLink] = useState<SignupLink | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [copiedInvite, setCopiedInvite] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    apiJson<Cohort[]>("/supervisor/cohorts").then(setCohorts).catch(() => {})
  }, [])

  // When the Inscribir dialog opens, look for a usable public signup link bound
  // to that CIC so Gaby can just copy it instead of going to Inscripciones.
  useEffect(() => {
    if (!enrollingCohortId) {
      setInviteLink(null)
      setCopiedInvite(false)
      return
    }
    let cancelled = false
    setLoadingInvite(true)
    apiJson<SignupLink[]>("/supervisor/signup-links")
      .then((links) => {
        if (cancelled) return
        const usable = links.find(
          (l) => l.cohort?.id === enrollingCohortId && isSignupLinkActive(l)
        )
        setInviteLink(usable ?? null)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingInvite(false) })
    return () => { cancelled = true }
  }, [enrollingCohortId])

  async function generateInviteLink() {
    if (!enrollingCohortId) return
    setLoadingInvite(true)
    const res = await apiTry("/supervisor/signup-links", {
      method: "POST",
      body: JSON.stringify({ cohortId: enrollingCohortId }),
    })
    setLoadingInvite(false)
    if (!res.ok) {
      toast({ title: "No se pudo generar el link", variant: "destructive" })
      return
    }
    setInviteLink(await res.json())
    toast({ title: "Link generado" })
  }

  async function copyInviteLink() {
    if (!inviteLink) return
    if (await copyToClipboard(signupUrl(inviteLink), "Copiá el link de inscripción:")) {
      setCopiedInvite(true)
      setTimeout(() => setCopiedInvite(false), 2000)
      toast({ title: "Link copiado" })
    }
  }

  async function handleCreate() {
    if (!newName || !newDate) return
    const cohort = await apiPost<Cohort>("/supervisor/cohorts", { name: newName, startDate: newDate })
    setCohorts((prev) => [cohort, ...prev])
    setNewName("")
    setNewDate("")
    setShowCreate(false)
    toast({ title: "CIC creado" })
  }

  /** Patch one field of a cohort (active / clientsEnabled / testsEnabled). */
  async function patch(id: string, body: Record<string, unknown>) {
    const updated = await apiJson<Cohort>(`/supervisor/cohorts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setCohorts((prev) => prev.map((c) => (c.id === id ? updated : c)))
  }

  function startEditing(cohort: Cohort) {
    // <input type="date"> wants YYYY-MM-DD; the API returns a full ISO string.
    setEditing({
      id: cohort.id,
      name: cohort.name,
      startDate: cohort.startDate.slice(0, 10),
      zoomUrl: cohort.zoomUrl ?? "",
    })
  }

  async function handleSaveEdit() {
    if (!editing) return
    if (!editing.name.trim() || !editing.startDate) return
    const res = await apiTry(`/supervisor/cohorts/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editing.name.trim(),
        startDate: editing.startDate,
        zoomUrl: editing.zoomUrl.trim(),
      }),
    })
    if (res.ok) {
      const updated: Cohort = await res.json()
      // Re-sort: the list is ordered by startDate desc, and the date may have
      // changed. ISO strings compare chronologically.
      setCohorts((prev) =>
        prev
          .map((c) => (c.id === updated.id ? updated : c))
          .sort((a, b) => b.startDate.localeCompare(a.startDate))
      )
      setEditing(null)
      toast({ title: "CIC actualizado" })
    } else {
      const json = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: json.error || "Error al guardar", variant: "destructive" })
    }
  }

  async function handleEnroll() {
    if (!enrollEmail || !enrollingCohortId) return
    const res = await apiTry(`/supervisor/cohorts/${enrollingCohortId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: enrollEmail }),
    })
    if (res.ok) {
      apiJson<Cohort[]>("/supervisor/cohorts").then(setCohorts).catch(() => {})
      setEnrollEmail("")
      setEnrollingCohortId(null)
      toast({ title: "Alumno inscripto" })
    } else {
      const json = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: json.error || "Error al inscribir", variant: "destructive" })
    }
  }

  /** Copy every enrolled email, ready to paste into a Zoom invite. */
  async function handleCopyEmails(cohort: Cohort) {
    const data = await apiJson<{ emails: string; count: number }>(
      `/supervisor/cohorts/${cohort.id}/emails`
    )
    if (!data.count) {
      toast({ title: "Este CIC todavía no tiene alumnos" })
      return
    }
    try {
      await navigator.clipboard.writeText(data.emails)
      setCopiedId(cohort.id)
      setTimeout(() => setCopiedId(null), 2000)
      toast({ title: `${data.count} emails copiados` })
    } catch {
      // Clipboard needs a secure context; show them the list as a fallback.
      window.prompt("Copiá los emails:", data.emails)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground mb-1">CIC</h1>
          <p className="text-muted-foreground text-sm">
            Certificación en Coaching de Carrera y Bienestar Laboral — gestioná las camadas, su
            contenido liberado y sus permisos
          </p>
        </div>
        <Button
          className="bg-brand-accent hover:bg-brand-accent-dark shrink-0"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4 mr-2" /> Nuevo CIC
        </Button>
      </div>

      <div className="space-y-4">
        {cohorts.map((cohort) => (
          <Card key={cohort.id} className="bg-white">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="font-sans text-base font-medium">{cohort.name}</CardTitle>
                  <Badge
                    variant={cohort.active ? "default" : "secondary"}
                    className={cohort.active ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                  >
                    {cohort.active ? "Activa" : "Inactiva"}
                  </Badge>
                  {cohort.zoomUrl && (
                    <a
                      href={cohort.zoomUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-accent hover:underline flex items-center gap-1"
                    >
                      <Video className="h-3 w-3" /> Zoom
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Switch checked={cohort.active} onCheckedChange={(v) => patch(cohort.id, { active: v })} />
                  <Button size="sm" variant="outline" onClick={() => startEditing(cohort)}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleCopyEmails(cohort)}>
                    {copiedId === cohort.id ? (
                      <Check className="h-3 w-3 mr-1" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    Copiar emails
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEnrollingCohortId(cohort.id)}>
                    <UserPlus className="h-3 w-3 mr-1" /> Inscribir
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Inicio: {formatShortDate(cohort.startDate)} · {cohort._count.enrollments} alumnos
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={cohort.clientsEnabled}
                    onCheckedChange={(v) => patch(cohort.id, { clientsEnabled: v })}
                  />
                  <span className="text-foreground">Pueden cargar coachees</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={cohort.testsEnabled}
                    onCheckedChange={(v) => patch(cohort.id, { testsEnabled: v })}
                  />
                  <span className="text-foreground">Pueden tomar tests</span>
                </label>
              </div>

              {cohort.enrollments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {cohort.enrollments.map((e) => (
                    <span key={e.id} className="text-xs bg-muted px-2 py-1 rounded text-foreground">
                      {e.user.name}
                    </span>
                  ))}
                </div>
              )}

              <div>
                <button
                  onClick={() => setExpanded((prev) => (prev === cohort.id ? null : cohort.id))}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {expanded === cohort.id ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Módulos liberados
                </button>
                {expanded === cohort.id && (
                  <div className="mt-3">
                    <ReleasePanel cohort={cohort} cohorts={cohorts} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {cohorts.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No hay CIC aún.</p>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Nuevo CIC</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: CIC 14" />
            </div>
            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button className="bg-brand-accent hover:bg-brand-accent-dark" onClick={handleCreate}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Editar CIC</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={editing?.name ?? ""}
                onChange={(e) => setEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                placeholder="Ej: CIC 14"
                onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Input
                type="date"
                value={editing?.startDate ?? ""}
                onChange={(e) => setEditing((prev) => (prev ? { ...prev, startDate: e.target.value } : prev))}
              />
            </div>
            <div className="space-y-2">
              <Label>Link de Zoom (opcional)</Label>
              <Input
                value={editing?.zoomUrl ?? ""}
                onChange={(e) => setEditing((prev) => (prev ? { ...prev, zoomUrl: e.target.value } : prev))}
                placeholder="https://us02web.zoom.us/j/..."
              />
              <p className="text-xs text-muted-foreground">
                Los inscriptos lo ven arriba de todo en Mi Programa.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              className="bg-brand-accent hover:bg-brand-accent-dark"
              disabled={!editing?.name.trim() || !editing?.startDate}
              onClick={handleSaveEdit}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!enrollingCohortId} onOpenChange={(open) => !open && setEnrollingCohortId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Inscribir alumno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email del alumno</Label>
              <Input
                type="email"
                value={enrollEmail}
                onChange={(e) => setEnrollEmail(e.target.value)}
                placeholder="alumno@email.com"
                onKeyDown={(e) => e.key === "Enter" && handleEnroll()}
              />
              <p className="text-xs text-muted-foreground">
                Inscribe a alguien que ya tiene cuenta.
              </p>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <Label>Link de inscripción</Label>
              {loadingInvite ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                </p>
              ) : inviteLink ? (
                <>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={signupUrl(inviteLink)} className="text-xs" />
                    <Button variant="outline" size="icon" className="shrink-0" onClick={copyInviteLink}>
                      {copiedInvite ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Para quien todavía no tiene cuenta: se anota solo y queda pendiente de tu
                    aprobación. Vence el {formatShortDate(inviteLink.expiresAt)}.
                  </p>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={generateInviteLink}>
                    <Plus className="h-3 w-3 mr-1" /> Generar link de inscripción
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Este CIC no tiene un link vigente. El nuevo queda atado a esta camada.
                  </p>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollingCohortId(null)}>Cancelar</Button>
            <Button className="bg-brand-accent hover:bg-brand-accent-dark" onClick={handleEnroll}>Inscribir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
