import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PasswordCard } from "@/components/PasswordCard"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { apiJson, apiTry } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { Copy, Check, LogOut, KeyRound, Mail, MoreHorizontal, LogIn, ShieldCheck } from "lucide-react"

type AdminUser = {
  id: string
  name: string
  email: string
  role: "SUPERVISOR" | "STUDENT_COACH" | "ADMIN"
  createdAt: string
  pending: boolean
  linked: boolean
  cohorts: { id: string; name: string }[]
  pools: { id: string; name: string }[]
}

type LoginCheck = {
  found: boolean
  account?: { name: string; email: string; role: string; linked: boolean }
  pending?: boolean
  mustChange?: boolean
  passwordOk?: boolean
}

function loginCheckMessage(r: LoginCheck): string {
  if (!r.found || !r.account) return "No existe ninguna cuenta con ese email."
  const who = `${r.account.name} (${r.account.role}${r.account.linked ? ", vinculada" : ""}, ${r.account.email})`
  if (r.pending) return `Ese email es de ${who}, que todavía no se registró.`
  if (!r.passwordOk) return `Ese email es de ${who}, pero la contraseña no coincide.`
  return `El login funciona: entra como ${who}.${r.mustChange ? " Al entrar le va a pedir elegir una contraseña nueva." : ""}`
}

type CoacheeAssignment = {
  id: string
  accessToken: string
  completeBy: string | null
  resultsViewableUntil: string | null
  completedAt: string | null
  test: { title: string; type: string }
  client: {
    id: string
    name: string
    email: string
    student: { id: string; name: string; email: string }
  }
}

/**
 * Admin control panel. Two lists:
 *   - Every registered user, with a button to impersonate them and a per-row
 *     menu to change their email or password, or to test a login.
 *   - Every coachee's magic link (the coachees have no login — the link IS the
 *     credential), copied to clipboard so the admin can open it in an incognito
 *     tab to see what the coachee sees.
 */
export default function AdminPage() {
  const { user, logout } = useAuth()
  const { toast } = useToast()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [coachees, setCoachees] = useState<CoacheeAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [userQuery, setUserQuery] = useState("")
  const [coacheeQuery, setCoacheeQuery] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null)
  const [pwValue, setPwValue] = useState("")
  const [pwMustChange, setPwMustChange] = useState(true)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState("")
  const [pwResult, setPwResult] = useState<string | null>(null)

  const [emailTarget, setEmailTarget] = useState<AdminUser | null>(null)
  const [emailValue, setEmailValue] = useState("")
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState("")

  const [checkOpen, setCheckOpen] = useState(false)
  const [checkEmail, setCheckEmail] = useState("")
  const [checkPassword, setCheckPassword] = useState("")
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<LoginCheck | null>(null)

  useEffect(() => {
    Promise.all([
      apiJson<AdminUser[]>("/admin/users"),
      apiJson<CoacheeAssignment[]>("/admin/coachees"),
    ])
      .then(([u, c]) => {
        setUsers(u)
        setCoachees(c)
      })
      .catch(() => toast({ title: "No se pudo cargar la lista", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [toast])

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    )
  }, [users, userQuery])

  const filteredCoachees = useMemo(() => {
    const q = coacheeQuery.trim().toLowerCase()
    if (!q) return coachees
    return coachees.filter(
      (a) =>
        a.client.name.toLowerCase().includes(q) ||
        a.client.email.toLowerCase().includes(q) ||
        a.client.student.name.toLowerCase().includes(q) ||
        a.test.title.toLowerCase().includes(q)
    )
  }, [coachees, coacheeQuery])

  async function impersonate(target: AdminUser) {
    if (target.role === "ADMIN") {
      toast({ title: "No se puede impersonar a un admin", variant: "destructive" })
      return
    }
    const res = await apiTry(`/admin/impersonate/${target.id}`, { method: "POST" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast({ title: err.error ?? "No se pudo impersonar", variant: "destructive" })
      return
    }
    // Full reload as the target — every page refetches via /auth/me and the
    // ProtectedRoute redirect logic sends them to that role's home.
    window.location.href = target.role === "SUPERVISOR" ? "/supervisor/panel" : "/student/programa"
  }

  function openPasswordDialog(target: AdminUser) {
    setPwTarget(target)
    setPwValue("")
    setPwMustChange(true)
    setPwError("")
    setPwResult(null)
  }

  async function savePassword() {
    if (!pwTarget) return
    setPwSaving(true)
    setPwError("")
    const res = await apiTry(`/admin/users/${pwTarget.id}/password`, {
      method: "POST",
      body: JSON.stringify({ password: pwValue || undefined, mustChange: pwMustChange }),
    })
    setPwSaving(false)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPwError(json.error || "No se pudo cambiar la contraseña")
      return
    }
    setPwResult(json.password)
    toast({ title: "Contraseña actualizada" })
  }

  function openEmailDialog(target: AdminUser) {
    setEmailTarget(target)
    setEmailValue(target.email)
    setEmailError("")
  }

  async function saveEmail() {
    if (!emailTarget) return
    setEmailSaving(true)
    setEmailError("")
    const res = await apiTry(`/admin/users/${emailTarget.id}/email`, {
      method: "PUT",
      body: JSON.stringify({ email: emailValue }),
    })
    setEmailSaving(false)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setEmailError(json.error || "No se pudo cambiar el email")
      return
    }
    setUsers((list) => list.map((u) => (u.id === emailTarget.id ? { ...u, email: json.email } : u)))
    setEmailTarget(null)
    toast({ title: "Email actualizado" })
  }

  function openLoginCheck(target: AdminUser) {
    setCheckEmail(target.email)
    setCheckPassword("")
    setCheckResult(null)
    setCheckOpen(true)
  }

  async function runLoginCheck() {
    setChecking(true)
    setCheckResult(null)
    const res = await apiTry("/admin/login-check", {
      method: "POST",
      body: JSON.stringify({ email: checkEmail, password: checkPassword }),
    })
    setChecking(false)
    if (!res.ok) {
      toast({ title: "No se pudo probar el login", variant: "destructive" })
      return
    }
    setCheckResult(await res.json())
  }

  async function copyLink(a: CoacheeAssignment) {
    const link = `${window.location.origin}/t/${a.accessToken}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(a.id)
      setTimeout(() => setCopiedId((id) => (id === a.id ? null : id)), 1500)
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Panel Admin</h1>
          <p className="text-sm text-muted-foreground">
            Hola {user?.name}. Desde acá podés entrar como cualquier usuario, o abrir el link de un coachee.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" />
          Salir
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle>Usuarios ({filteredUsers.length})</CardTitle>
          <Input
            placeholder="Buscar por nombre, email o rol…"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Grupos</TableHead>
                  <TableHead>Alta</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.name}
                      {u.pending && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Invitación pendiente
                        </Badge>
                      )}
                      {u.linked && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Vinculada
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>{u.role}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[...u.cohorts.map((c) => c.name), ...u.pools.map((p) => `pool: ${p.name}`)].join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatShortDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                      {/* Opens to the left: on the right it would be cut off by
                          the table's edge. */}
                      <div className="relative group">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => impersonate(u)}
                          disabled={u.role === "ADMIN"}
                          aria-label={`Entrar como ${u.name}`}
                        >
                          <LogIn className="h-4 w-4" />
                        </Button>
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute right-full top-1/2 z-10 mr-1 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          {u.role === "ADMIN" ? "No se puede entrar como un admin" : `Entrar como ${u.name}`}
                        </span>
                      </div>
                      {/* modal={false}: a modal menu closing as the Dialog opens
                          can leave pointer-events: none stuck on <body>. */}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label={`Acciones de ${u.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onSelect={() => openEmailDialog(u)}>
                            <Mail className="h-4 w-4 mr-2" />
                            Cambiar email
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => openPasswordDialog(u)}
                            disabled={u.pending || u.id === user?.id}
                          >
                            <KeyRound className="h-4 w-4 mr-2" />
                            Cambiar contraseña
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openLoginCheck(u)}>
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Probar login
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                      Sin resultados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Coachees (magic links)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Los coachees no tienen login. Copiá el link y abrilo en una pestaña incógnita para ver lo que ellos ven.
            </p>
          </div>
          <Input
            placeholder="Buscar por coachee, coach o test…"
            value={coacheeQuery}
            onChange={(e) => setCoacheeQuery(e.target.value)}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coachee</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCoachees.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.client.name}</div>
                      <div className="text-xs text-muted-foreground">{a.client.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{a.client.student.name}</TableCell>
                    <TableCell className="text-sm">{a.test.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.completedAt
                        ? `Enviado ${formatShortDate(a.completedAt)}`
                        : a.completeBy
                          ? `Vence ${formatShortDate(a.completeBy)}`
                          : "Pendiente"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => copyLink(a)}>
                        {copiedId === a.id ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Copiar link
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCoachees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      Sin coachees
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PasswordCard />

      <Dialog open={checkOpen} onOpenChange={setCheckOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Probar login</DialogTitle>
            <DialogDescription>
              Comprueba estos datos igual que la pantalla de ingreso. No abre sesión ni cambia nada.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              runLoginCheck()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="login-check-email">Email</Label>
              <Input
                id="login-check-email"
                required
                autoComplete="off"
                value={checkEmail}
                onChange={(e) => setCheckEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-check-password">Contraseña</Label>
              <Input
                id="login-check-password"
                required
                autoComplete="off"
                value={checkPassword}
                onChange={(e) => setCheckPassword(e.target.value)}
              />
            </div>
            {checkResult && (
              <p className="text-sm bg-muted/40 px-3 py-2 rounded-md break-words">
                {loginCheckMessage(checkResult)}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCheckOpen(false)}>Cerrar</Button>
              <Button type="submit" disabled={checking}>
                {checking ? "Probando..." : "Probar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!emailTarget} onOpenChange={(open) => { if (!open) setEmailTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Email de {emailTarget?.name}</DialogTitle>
            <DialogDescription>
              {emailTarget?.pending
                ? "La invitación ya enviada deja de funcionar: reenviala después desde la ficha del alumno."
                : "Va a entrar con este email. El anterior deja de servir, y no se le avisa por mail."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              saveEmail()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="admin-new-email">Email nuevo</Label>
              <Input
                id="admin-new-email"
                type="email"
                required
                autoComplete="off"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
              />
            </div>
            {emailError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{emailError}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEmailTarget(null)}>Cancelar</Button>
              <Button type="submit" disabled={emailSaving}>
                {emailSaving ? "Guardando..." : "Cambiar email"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwTarget} onOpenChange={(open) => { if (!open) setPwTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contraseña de {pwTarget?.name}</DialogTitle>
            <DialogDescription>
              {pwResult
                ? `Entra con ${pwTarget?.email}. Esta es la única vez que se muestra y no se manda por mail: pasásela vos.`
                : "La contraseña actual deja de funcionar. No se le avisa por mail."}
            </DialogDescription>
          </DialogHeader>

          {pwResult ? (
            <div className="space-y-4">
              <p className="rounded-lg border p-4 text-center font-mono text-xl font-semibold break-all">
                {pwResult}
              </p>
              <DialogFooter>
                <Button onClick={() => setPwTarget(null)}>Listo</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-new-password">
                  Contraseña nueva <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Input
                  id="admin-new-password"
                  autoComplete="off"
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  placeholder="Si la dejás vacía, generamos una"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="admin-must-change">Obligar a cambiarla al entrar</Label>
                <Switch
                  id="admin-must-change"
                  checked={pwMustChange}
                  onCheckedChange={setPwMustChange}
                />
              </div>
              {pwError && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{pwError}</p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setPwTarget(null)}>Cancelar</Button>
                <Button onClick={savePassword} disabled={pwSaving}>
                  {pwSaving ? "Guardando..." : "Cambiar contraseña"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
