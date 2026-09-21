import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Plus, UserPlus, Pencil, Copy, Check, Loader2, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiJson, apiPost, apiTry } from "@/lib/api"
import { copyToClipboard, isSignupLinkActive, signupUrl, type SignupLink } from "@/lib/signup"
import { LoadingBadge } from "@/components/LoadingBadge"
import type { TestType } from "@/lib/access"

type CoachOption = { id: string; name: string; email: string }

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
  const [enrollName, setEnrollName] = useState("")
  const [enrollingPoolId, setEnrollingPoolId] = useState<string | null>(null)
  const [enrollTab, setEnrollTab] = useState<"existing" | "invite" | "link">("existing")
  const [coachOptions, setCoachOptions] = useState<CoachOption[]>([])
  const [coachSearch, setCoachSearch] = useState("")
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
      setEnrollTab("existing")
      setCoachSearch("")
      setEnrollEmail("")
      setEnrollName("")
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
    apiJson<CoachOption[]>("/supervisor/coaches")
      .then((list) => { if (!cancelled) setCoachOptions(list) })
      .catch(() => {})
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

  async function enrollWith(email: string, name: string) {
    if (!email || !enrollingPoolId) return
    const res = await apiTry(`/supervisor/pools/${enrollingPoolId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    })
    if (res.ok) {
      const json = await res.json().catch(() => ({ invited: false }))
      apiJson<Pool[]>("/supervisor/pools").then(setPools).catch(() => {})
      setEnrollingPoolId(null)
      toast({
        title: json.invited ? "Invitación enviada" : "Coach agregado",
        description: json.invited
          ? "Le llegó un mail para crear su cuenta."
          : "Le avisamos por mail que ya puede entrar.",
      })
    } else {
      const json = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: json.error || "Error al agregar", variant: "destructive" })
    }
  }

  // Existing-coach tab: only members not already in this pool.
  const currentPool = pools.find((p) => p.id === enrollingPoolId)
  const alreadyInPool = new Set(currentPool?.members.map((m) => m.user.id) ?? [])
  const availableCoaches = coachOptions
    .filter((c) => !alreadyInPool.has(c.id))
    .filter((c) => {
      if (!coachSearch.trim()) return true
      const q = coachSearch.trim().toLowerCase()
      return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    })
    .slice(0, 20)

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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Agregar coach al pool</DialogTitle>
          </DialogHeader>

          <Tabs value={enrollTab} onValueChange={(v) => setEnrollTab(v as typeof enrollTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="existing">Coach existente</TabsTrigger>
              <TabsTrigger value="invite">Invitar por mail</TabsTrigger>
              <TabsTrigger value="link">Link público</TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">
                Sumá a alguien que ya tiene cuenta. Le mandamos un mail avisándole.
              </p>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={coachSearch}
                  onChange={(e) => setCoachSearch(e.target.value)}
                  placeholder="Buscar por nombre o email..."
                  className="pl-8"
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {availableCoaches.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {coachOptions.length === 0
                      ? "Cargando coaches..."
                      : coachSearch
                        ? "Ningún coach coincide."
                        : "No hay coaches disponibles."}
                  </p>
                ) : (
                  availableCoaches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => enrollWith(c.email, c.name)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors"
                    >
                      <div className="text-sm font-medium text-foreground">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                    </button>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="invite" className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">
                Para alguien que todavía no está en la plataforma. Le mandamos una invitación
                para que cree su cuenta.
              </p>
              <div className="space-y-2">
                <Label>Nombre y apellido</Label>
                <Input
                  value={enrollName}
                  onChange={(e) => setEnrollName(e.target.value)}
                  placeholder="Nombre del coach"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={enrollEmail}
                  onChange={(e) => setEnrollEmail(e.target.value)}
                  placeholder="coach@email.com"
                  onKeyDown={(e) =>
                    e.key === "Enter" && enrollName.trim() && enrollEmail.trim() &&
                    enrollWith(enrollEmail.trim(), enrollName.trim())
                  }
                />
              </div>
              <Button
                className="w-full bg-brand-accent hover:bg-brand-accent-dark"
                disabled={!enrollEmail.trim() || !enrollName.trim()}
                onClick={() => enrollWith(enrollEmail.trim(), enrollName.trim())}
              >
                Enviar invitación
              </Button>
            </TabsContent>

            <TabsContent value="link" className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">
                Un link autoservicio: quien lo abra se anota solo y queda pendiente de tu
                aprobación en Inscripciones.
              </p>
              {loadingInvite ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando link vigente...
                </p>
              ) : inviteLink ? (
                <div className="flex items-center gap-2">
                  <Input readOnly value={signupUrl(inviteLink)} className="text-xs" />
                  <Button variant="outline" size="icon" className="shrink-0" onClick={copyInviteLink}>
                    {copiedInvite ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={generateInviteLink}>
                    <Plus className="h-3 w-3 mr-1" /> Generar link
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Este pool no tiene un link vigente. El nuevo queda atado a este pool.
                  </p>
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollingPoolId(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
