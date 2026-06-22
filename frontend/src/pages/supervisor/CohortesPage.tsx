import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, UserPlus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiPost, apiRaw } from "@/lib/api"

type Enrollment = { id: string; user: { id: string; name: string; email: string } }
type Cohort = {
  id: string
  name: string
  startDate: string
  active: boolean
  enrollments: Enrollment[]
  _count: { enrollments: number }
}

export default function CohortesPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDate, setNewDate] = useState("")
  const [enrollEmail, setEnrollEmail] = useState("")
  const [enrollingCohortId, setEnrollingCohortId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    apiJson<Cohort[]>("/supervisor/cohorts").then(setCohorts).catch(() => {})
  }, [])

  async function handleCreate() {
    if (!newName || !newDate) return
    const cohort = await apiPost<Cohort>("/supervisor/cohorts", { name: newName, startDate: newDate })
    setCohorts((prev) => [cohort, ...prev])
    setNewName("")
    setNewDate("")
    setShowCreate(false)
    toast({ title: "SIC creado" })
  }

  async function handleToggleActive(id: string, active: boolean) {
    const updated = await apiJson<Cohort>(`/supervisor/cohorts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    })
    setCohorts((prev) => prev.map((c) => (c.id === id ? updated : c)))
  }

  async function handleEnroll() {
    if (!enrollEmail || !enrollingCohortId) return
    const res = await apiRaw(`/supervisor/cohorts/${enrollingCohortId}/enroll`, {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-foreground mb-1">SIC</h1>
          <p className="text-muted-foreground text-sm">Gestioná los SIC y sus alumnos</p>
        </div>
        <Button className="bg-brand-accent hover:bg-brand-accent-dark" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo SIC
        </Button>
      </div>

      <div className="space-y-4">
        {cohorts.map((cohort) => (
          <Card key={cohort.id} className="bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="font-sans text-base font-medium">{cohort.name}</CardTitle>
                  <Badge variant={cohort.active ? "default" : "secondary"} className={cohort.active ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                    {cohort.active ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={cohort.active} onCheckedChange={(v) => handleToggleActive(cohort.id, v)} />
                  <Button size="sm" variant="outline" onClick={() => setEnrollingCohortId(cohort.id)}>
                    <UserPlus className="h-3 w-3 mr-1" /> Inscribir
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Inicio: {formatShortDate(cohort.startDate)} · {cohort._count.enrollments} alumnos</p>
            </CardHeader>
            {cohort.enrollments.length > 0 && (
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {cohort.enrollments.map((e) => (
                    <span key={e.id} className="text-xs bg-muted px-2 py-1 rounded text-foreground">
                      {e.user.name}
                    </span>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
        {cohorts.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No hay SIC aún.</p>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Nuevo SIC</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: SIC 14" />
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

      <Dialog open={!!enrollingCohortId} onOpenChange={(open) => !open && setEnrollingCohortId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Inscribir alumno</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Email del alumno</Label>
            <Input
              type="email"
              value={enrollEmail}
              onChange={(e) => setEnrollEmail(e.target.value)}
              placeholder="alumno@email.com"
              onKeyDown={(e) => e.key === "Enter" && handleEnroll()}
            />
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
