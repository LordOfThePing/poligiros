import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, UserPlus, Pencil, Copy, Check, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiJson, apiPost, apiTry } from "@/lib/api"
import { copyToClipboard, isSignupLinkActive, signupUrl, type SignupLink } from "@/lib/signup"
import { LoadingBadge } from "@/components/LoadingBadge"
import type { TestType } from "@/lib/access"

type Member = { id: string; user: { id: string; name: string; email: string } }
type Pool = {
  id: string
  name: string
  active: boolean
  enabledTests: TestType[]
  members: Member[]
  _count: { members: number }
}

const TEST_LABELS: { type: TestType; label: string }[] = [
  { type: "ANCLAS_CARRERA", label: "Anclas de Carrera" },
  { type: "TABLERO_IDEAS", label: "Tablero de Ideas" },
  { type: "MODELO_NEGOCIO", label: "Exploración" },
  { type: "TAREAS_EXPLORACION", label: "Tareas de Exploración" },
  { type: "PLAN_VITAL", label: "Plan Vital Integral®" },
  { type: "PIRAMIDE_PROPOSITO", label: "Pirámide del Propósito" },
]

export default function PoolsPage() {
  const [pools, setPools] = useState<Pool[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [enrollEmail, setEnrollEmail] = useState("")
  const [enrollingPoolId, setEnrollingPoolId] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<SignupLink | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [copiedInvite, setCopiedInvite] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    apiJson<Pool[]>("/supervisor/pools")
      .then(setPools)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!enrollingPoolId) {
      setInviteLink(null)
      setCopiedInvite(false)
      return
    }
    let cancelled = false
    setLoadingInvite(true)
    apiJson<SignupLink[]>("/supervisor/signup-links")
      .then((links) => {
        if (cancelled) return
        const usable = links.find((l) => l.pool?.id === enrollingPoolId && isSignupLinkActive(l))
        setInviteLink(usable ?? null)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingInvite(false) })
    return () => { cancelled = true }
  }, [enrollingPoolId])

  async function generateInviteLink() {
    if (!enrollingPoolId) return
    setLoadingInvite(true)
    const res = await apiTry("/supervisor/signup-links", {
      method: "POST",
      body: JSON.stringify({ poolId: enrollingPoolId }),
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
    if (!newName.trim()) return
    const pool = await apiPost<Pool>("/supervisor/pools", { name: newName })
    setPools((prev) => [pool, ...prev])
    setNewName("")
    setShowCreate(false)
    toast({ title: "Pool creado" })
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const updated = await apiJson<Pool>(`/supervisor/pools/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setPools((prev) => prev.map((p) => (p.id === id ? updated : p)))
  }

  function toggleTest(pool: Pool, type: TestType, on: boolean) {
    const enabledTests = on
      ? [...pool.enabledTests, type]
      : pool.enabledTests.filter((t) => t !== type)
    patch(pool.id, { enabledTests })
  }

  async function handleSaveEdit() {
    if (!editing || !editing.name.trim()) return
    const res = await apiTry(`/supervisor/pools/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editing.name.trim() }),
    })
    if (res.ok) {
      const updated: Pool = await res.json()
      setPools((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setEditing(null)
      toast({ title: "Pool actualizado" })
    } else {
      const json = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: json.error || "Error al guardar", variant: "destructive" })
    }
  }

  async function handleEnroll() {
    if (!enrollEmail || !enrollingPoolId) return
    const res = await apiTry(`/supervisor/pools/${enrollingPoolId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: enrollEmail }),
    })
    if (res.ok) {
      apiJson<Pool[]>("/supervisor/pools").then(setPools).catch(() => {})
      setEnrollEmail("")
      setEnrollingPoolId(null)
      toast({ title: "Coach agregado" })
    } else {
      const json = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: json.error || "Error al agregar", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground mb-1">Coaches certificados</h1>
          <p className="text-muted-foreground text-sm">
            Grupos de coaches ya certificados que siguen practicando con coachees reales — sin
            módulos de aprendizaje, solo tests
          </p>
        </div>
        <Button
          className="bg-brand-accent hover:bg-brand-accent-dark shrink-0"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4 mr-2" /> Nuevo pool
        </Button>
      </div>

      <div className="space-y-4">
        {pools.map((pool) => (
          <Card key={pool.id} className="bg-white">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="font-sans text-base font-medium">{pool.name}</CardTitle>
                  <Badge
                    variant={pool.active ? "default" : "secondary"}
                    className={pool.active ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                  >
                    {pool.active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Switch checked={pool.active} onCheckedChange={(v) => patch(pool.id, { active: v })} />
                  <Button size="sm" variant="outline" onClick={() => setEditing({ id: pool.id, name: pool.name })}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEnrollingPoolId(pool.id)}>
                    <UserPlus className="h-3 w-3 mr-1" /> Agregar coach
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{pool._count.members} coaches</p>
            </CardHeader>

            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-foreground mb-2">Tests habilitados</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TEST_LABELS.map(({ type, label }) => (
                    <label key={type} className="flex items-center gap-2 text-sm bg-muted/40 rounded-lg px-2 py-1.5">
                      <Switch
                        checked={pool.enabledTests.includes(type)}
                        onCheckedChange={(v) => toggleTest(pool, type, v)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {pool.members.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pool.members.map((m) => (
                    <span key={m.id} className="text-xs bg-muted px-2 py-1 rounded text-foreground">
                      {m.user.name}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {loading && <LoadingBadge />}
        {!loading && pools.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No hay pools todavía.</p>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Nuevo pool</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Coaches certificados 2026"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
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
            <DialogTitle className="font-serif">Editar pool</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={editing?.name ?? ""}
                onChange={(e) => setEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              className="bg-brand-accent hover:bg-brand-accent-dark"
              disabled={!editing?.name.trim()}
              onClick={handleSaveEdit}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!enrollingPoolId} onOpenChange={(open) => !open && setEnrollingPoolId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Agregar coach al pool</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email del coach</Label>
              <Input
                type="email"
                value={enrollEmail}
                onChange={(e) => setEnrollEmail(e.target.value)}
                placeholder="coach@email.com"
                onKeyDown={(e) => e.key === "Enter" && handleEnroll()}
              />
              <p className="text-xs text-muted-foreground">Agrega a alguien que ya tiene cuenta.</p>
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
                    Para quien todavía no tiene cuenta: se anota solo y queda pendiente de tu aprobación.
                  </p>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={generateInviteLink}>
                    <Plus className="h-3 w-3 mr-1" /> Generar link de inscripción
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Este pool no tiene un link vigente. El nuevo queda atado a este pool.
                  </p>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollingPoolId(null)}>Cancelar</Button>
            <Button className="bg-brand-accent hover:bg-brand-accent-dark" onClick={handleEnroll}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
