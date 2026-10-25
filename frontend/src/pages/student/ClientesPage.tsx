import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { apiJson, apiPost } from "@/lib/api"
import { LoadingBadge } from "@/components/LoadingBadge"
import { Tooltip } from "@/components/ui/tooltip"
import { TEST_TITLES } from "@/lib/testInfo"

// Mirrors ClientDetailPage TEST_ORDER (canonical program order).
const TEST_ORDER = [
  "ANCLAS_CARRERA",
  "TABLERO_IDEAS",
  "TAREAS_EXPLORACION",
  "MODELO_NEGOCIO",
  "PLAN_VITAL",
  "PIRAMIDE_PROPOSITO",
  "COLLAGE",
  "OBJETIVO_CARRERA",
  "OBJETIVO_CARRERA_LARGO",
  "PLAN_ACCION",
]
const TEST_CODES: Record<string, string> = {
  ANCLAS_CARRERA: "AC",
  TABLERO_IDEAS: "TI",
  TAREAS_EXPLORACION: "TE",
  MODELO_NEGOCIO: "DI",
  PLAN_VITAL: "PV",
  PIRAMIDE_PROPOSITO: "PP",
  COLLAGE: "CO",
  OBJETIVO_CARRERA: "O1",
  OBJETIVO_CARRERA_LARGO: "O2",
  PLAN_ACCION: "PA",
}

type Assignment = {
  testId: string
  test: { type: string }
  completedAt: string | null
  response: unknown
}

type Client = {
  id: string
  name: string
  email: string
  assignments: Assignment[]
}

function TestDot({ status }: { status: "completed" | "pending" | "unassigned" }) {
  return (
    <span className={cn(
      "inline-block w-2 h-2 rounded-full",
      status === "completed" && "bg-green-500",
      status === "pending" && "bg-amber-400",
      status === "unassigned" && "bg-gray-200",
    )} />
  )
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    apiJson<Client[]>("/student/clients")
      .then(setClients)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleAddClient() {
    if (!newName || !newEmail) return
    const client = await apiPost<Client>("/student/clients", { name: newName, email: newEmail })
    setClients((prev) => [...prev, client])
    setNewName("")
    setNewEmail("")
    setShowAdd(false)
    toast({ title: "Coachee agregado" })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-foreground mb-1">Mis Coachees</h1>
          <p className="text-muted-foreground text-sm">{clients.length} coachees</p>
        </div>
        <Button className="bg-brand-accent hover:bg-brand-accent-dark" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" /> Agregar coachee
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {clients.map((client) => (
          <Link key={client.id} to={`/student/clientes/${client.id}`}>
            <Card className="bg-white hover:shadow-sm transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <div className="font-medium text-foreground">{client.name}</div>
                <div className="text-xs text-muted-foreground">{client.email}</div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 flex-wrap">
                  {TEST_ORDER.map((type) => {
                    const assignment = client.assignments.find((a) => a.test.type === type)
                    const status = assignment?.completedAt
                      ? "completed"
                      : assignment
                      ? "pending"
                      : "unassigned"
                    return (
                      <Tooltip key={type} label={TEST_TITLES[type] ?? type}>
                        <span className="flex items-center gap-1">
                          <TestDot status={status} />
                          <span className="text-xs text-muted-foreground">{TEST_CODES[type]}</span>
                        </span>
                      </Tooltip>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {loading && <LoadingBadge className="col-span-2" />}

        {!loading && clients.length === 0 && (
          <div className="col-span-2 text-center text-muted-foreground py-12">
            No tenés coachees aún. Agregá el primero.
          </div>
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Agregar coachee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del coachee" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="coachee@email.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button className="bg-brand-accent hover:bg-brand-accent-dark" onClick={handleAddClient}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
