import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
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
import { useToast } from "@/hooks/use-toast"

type Student = {
  id: string
  name: string
  email: string
  cohort: string
  clientCount: number
  testsSubmitted: number
  modulesCompleted: number
  pending: boolean
  lastActivity: string
}

type Cohort = { id: string; name: string }

export default function AlumnosPage() {
  const { toast } = useToast()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  const [open, setOpen] = useState(false)
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [sicFilter, setSicFilter] = useState<string>("all")
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

  // Distinct SIC names present among students, for the filter dropdown.
  const sicNames = Array.from(new Set(students.map((s) => s.cohort))).sort()
  const visibleStudents =
    sicFilter === "all" ? students : students.filter((s) => s.cohort === sicFilter)

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

      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">SIC</Label>
          <Select value={sicFilter} onValueChange={setSicFilter}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los SIC</SelectItem>
              {sicNames.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
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
                <TableHead>SIC</TableHead>
                <TableHead className="text-center">Clientes</TableHead>
                <TableHead className="text-center">Tests enviados</TableHead>
                <TableHead className="text-center">Módulos</TableHead>
                <TableHead>Última actividad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : visibleStudents.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay coaches en este SIC</TableCell></TableRow>
              ) : (
                visibleStudents.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <Link to={`/supervisor/alumnos/${s.id}`} className="block">
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {s.name}
                          {s.pending && <Badge variant="secondary" className="text-[0.65rem]">Pendiente</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{s.email}</div>
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{s.cohort}</Badge></TableCell>
                    <TableCell className="text-center">{s.clientCount}</TableCell>
                    <TableCell className="text-center">{s.testsSubmitted}</TableCell>
                    <TableCell className="text-center">{s.modulesCompleted}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatShortDate(s.lastActivity)}</TableCell>
                  </TableRow>
                ))
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
                <Label>SIC (opcional)</Label>
                <Select value={cohortId} onValueChange={setCohortId}>
                  <SelectTrigger><SelectValue placeholder="Elegí un SIC" /></SelectTrigger>
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
