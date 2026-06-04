import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiPost } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

const TEST_CODES: Record<string, string> = {
  ANCLAS_CARRERA: "AC",
  TABLERO_IDEAS: "TI",
  PLAN_VITAL: "PV",
  PIRAMIDE_PROPOSITO: "PP",
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  unassigned: "bg-gray-100 text-gray-500",
}

type Test = { id: string; type: string; title: string }
type CoachAssignment = { id: string; completedAt: string | null; test: { type: string } }

export default function AlumnoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [student, setStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [allTests, setAllTests] = useState<Test[]>([])
  const [coachTests, setCoachTests] = useState<CoachAssignment[]>([])
  const [assigning, setAssigning] = useState<string | null>(null)

  function loadCoachTests() {
    apiJson<CoachAssignment[]>(`/supervisor/coaches/${id}/tests`).then(setCoachTests).catch(() => {})
  }

  useEffect(() => {
    apiJson<any>(`/supervisor/students/${id}`)
      .then((data) => { setStudent(data); setLoading(false) })
      .catch(() => setLoading(false))
    apiJson<Test[]>("/supervisor/tests").then(setAllTests).catch(() => {})
    loadCoachTests()
  }, [id])

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

  if (loading) return <div className="text-muted-foreground text-sm py-8">Cargando...</div>
  if (!student) return <div className="text-muted-foreground text-sm py-8">Alumno no encontrado</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/supervisor/alumnos" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-serif text-3xl text-foreground">{student.name}</h1>
          <p className="text-muted-foreground text-sm">{student.email}</p>
        </div>
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
                <div className="flex gap-2 flex-wrap">
                  {["ANCLAS_CARRERA", "TABLERO_IDEAS", "PLAN_VITAL", "PIRAMIDE_PROPOSITO"].map((type) => {
                    const assignment = client.assignments.find((a: any) => a.test.type === type)
                    let status = "unassigned"
                    if (assignment?.completedAt) status = "completed"
                    else if (assignment) status = "pending"
                    return (
                      <span
                        key={type}
                        className={`text-xs px-2 py-1 rounded font-medium ${STATUS_COLORS[status]}`}
                      >
                        {TEST_CODES[type]}
                        {status === "completed" && " ✓"}
                        {status === "pending" && " …"}
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
              .filter((t) => t.type !== "PLAN_VITAL")
              .map((t) => {
                const assignment = coachTests.find((a) => a.test.type === t.type)
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-border last:border-0">
                    <span className="text-sm font-medium text-foreground">{t.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {assignment?.completedAt && (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Completado ✓</Badge>
                      )}
                      {assignment && !assignment.completedAt && (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">Pendiente</Badge>
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
    </div>
  )
}
