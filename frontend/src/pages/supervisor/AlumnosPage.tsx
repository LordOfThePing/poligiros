import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { UserPlus, Copy, Check } from "lucide-react"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiPost } from "@/lib/api"
import { LoadingBadge } from "@/components/LoadingBadge"
import { useToast } from "@/hooks/use-toast"

type Student = {
  id: string
  name: string
  email: string
  cohort: string
  cohorts: { id: string; name: string }[]
  pools: { id: string; name: string }[]
  clientCount: number
  modulesDone: number
  modulesTotal: number
  itemsDone: number
  itemsTotal: number
  ownTestsSubmitted: number
  pending: boolean
  lastActivity: string
}

type Cohort = { id: string; name: string }

export default function AlumnosPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  const [open, setOpen] = useState(false)
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [cicFilter, setCicFilter] = useState<string>("all")
  const [tipoFilter, setTipoFilter] = useState<"all" | "alumno" | "coach">("all")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cohortId, setCohortId] = useState("")
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState("")
  const [copied, setCopied] = useState(false)

  function load() {
    apiJson<Student[]>("/supervisor/students")
      .then((data) => { setStudents(data); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [])

  useEffect(() => {
    if (open && cohorts.length === 0) {
      apiJson<Cohort[]>("/supervisor/cohorts").then(setCohorts).catch(() => {})
    }
  }, [open, cohorts.length])

  async function handleInvite() {
    if (!name.trim() || !email.trim()) {
      toast({ title: "Nombre y email son requeridos", variant: "destructive" })
      return
    }
    setInviting(true)
    try {
      const res = await apiPost<{ link: string }>("/supervisor/coaches/invite", {
        name, email, cohortId: cohortId || undefined,
      })
      setInviteLink(res.link)
      toast({ title: "Invitación creada" })
      load()
    } catch {
      toast({ title: "No se pudo invitar (¿email ya en uso?)", variant: "destructive" })
    }
    setInviting(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function reset() {
    setOpen(false)
    setName(""); setEmail(""); setCohortId(""); setInviteLink(""); setCopied(false)
  }

  // Distinct group names (CICs + pools) present among students, for the filter
  // dropdown. Prefixed so we can tell them apart when filtering.
  const groupOptions = (() => {
    const cics = new Set<string>()
    const pools = new Set<string>()
    for (const s of students) {
      s.cohorts?.forEach((c) => cics.add(c.name))
      s.pools?.forEach((p) => pools.add(p.name))
    }
    return {
      cics: Array.from(cics).sort(),
      pools: Array.from(pools).sort(),
    }
  })()

  function matchesGroupFilter(s: Student): boolean {
    if (cicFilter === "all") return true
    if (cicFilter.startsWith("cic:")) {
      const name = cicFilter.slice(4)
      return s.cohorts?.some((c) => c.name === name) ?? false
    }
    if (cicFilter.startsWith("pool:")) {
      const name = cicFilter.slice(5)
      return s.pools?.some((p) => p.name === name) ?? false
    }
    return true
  }
  function matchesTipoFilter(s: Student): boolean {
    if (tipoFilter === "all") return true
    if (tipoFilter === "alumno") return (s.cohorts?.length ?? 0) > 0
    if (tipoFilter === "coach") return (s.pools?.length ?? 0) > 0
    return true
  }
  const visibleStudents = students.filter((s) => matchesGroupFilter(s) && matchesTipoFilter(s))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground mb-1">Alumnos</h1>
          <p className="text-muted-foreground text-sm">Todos los coaches de la plataforma</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-brand-accent hover:bg-brand-accent-dark shrink-0">
          <UserPlus className="h-4 w-4 mr-2" /> Invitar coach
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select value={tipoFilter} onValueChange={(v) => setTipoFilter(v as typeof tipoFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="alumno">Alumnos</SelectItem>
              <SelectItem value="coach">Coaches</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Grupo</Label>
          <Select value={cicFilter} onValueChange={setCicFilter}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {groupOptions.cics.length > 0 && (
                <>
                  <div className="px-2 pt-2 pb-1 text-[0.65rem] uppercase tracking-wider text-muted-foreground">CICs</div>
                  {groupOptions.cics.map((n) => (
                    <SelectItem key={`cic:${n}`} value={`cic:${n}`}>{n}</SelectItem>
                  ))}
                </>
              )}
              {groupOptions.pools.length > 0 && (
                <>
                  <div className="px-2 pt-2 pb-1 text-[0.65rem] uppercase tracking-wider text-muted-foreground">Pools</div>
                  {groupOptions.pools.map((n) => (
                    <SelectItem key={`pool:${n}`} value={`pool:${n}`}>{n}</SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Grupos</TableHead>
                <TableHead className="text-center">Coachees</TableHead>
                <TableHead className="text-center">Progreso de contenidos</TableHead>
                <TableHead className="text-center">Módulos completos</TableHead>
                <TableHead className="text-center">Tests propios enviados</TableHead>
                <TableHead>Última actividad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7}><LoadingBadge compact /></TableCell></TableRow>
              ) : visibleStudents.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay coaches en este grupo</TableCell></TableRow>
              ) : (
                visibleStudents.map((s) => {
                  const itemsPct = s.itemsTotal > 0 ? Math.round((s.itemsDone / s.itemsTotal) * 100) : 0
                  const modsPct = s.modulesTotal > 0 ? Math.round((s.modulesDone / s.modulesTotal) * 100) : 0
                  const groups: { label: string; kind: "cic" | "pool" }[] = [
                    ...(s.cohorts?.map((c) => ({ label: c.name, kind: "cic" as const })) ?? []),
                    ...(s.pools?.map((p) => ({ label: p.name, kind: "pool" as const })) ?? []),
                  ]
                  const firstGroup = groups[0]
                  const extraGroups = groups.length - 1
                  return (
                    <TableRow
                      key={s.id}
                      onClick={() => navigate(`/supervisor/alumnos/${s.id}`)}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {s.name}
                          {s.pending && <Badge variant="secondary" className="text-[0.65rem]">Pendiente</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{s.email}</div>
                      </TableCell>
                      <TableCell>
                        {firstGroup ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge
                              variant={firstGroup.kind === "pool" ? "secondary" : "outline"}
                              className={
                                firstGroup.kind === "pool"
                                  ? "text-xs bg-brand-accent/10 text-brand-accent-dark hover:bg-brand-accent/10"
                                  : "text-xs"
                              }
                            >
                              {firstGroup.label}
                            </Badge>
                            {extraGroups > 0 && (
                              <span className="text-xs text-muted-foreground">+{extraGroups}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{s.clientCount}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">{s.itemsDone}/{s.itemsTotal} ítems</span>
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-brand-accent rounded-full" style={{ width: `${itemsPct}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">{s.modulesDone}/{s.modulesTotal}</span>
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-brand-secondary rounded-full" style={{ width: `${modsPct}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{s.ownTestsSubmitted}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatShortDate(s.lastActivity)}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : reset())}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Invitar nuevo coach</DialogTitle></DialogHeader>

          {inviteLink ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Invitación creada. Compartí este enlace con el coach para que complete su registro
                (también se envió por email si está configurado):
              </p>
              <div className="flex gap-2">
                <Input readOnly value={inviteLink} className="text-xs" />
                <Button variant="outline" onClick={copyLink} className="shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label>Nombre completo</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del coach" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="coach@email.com" />
              </div>
              <div className="space-y-2">
                <Label>CIC (opcional)</Label>
                <Select value={cohortId} onValueChange={setCohortId}>
                  <SelectTrigger><SelectValue placeholder="Elegí un CIC" /></SelectTrigger>
                  <SelectContent>
                    {cohorts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            {inviteLink ? (
              <Button onClick={reset} className="bg-brand-accent hover:bg-brand-accent-dark">Listo</Button>
            ) : (
              <>
                <Button variant="outline" onClick={reset}>Cancelar</Button>
                <Button onClick={handleInvite} disabled={inviting} className="bg-brand-accent hover:bg-brand-accent-dark">
                  {inviting ? "Enviando..." : "Crear invitación"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
