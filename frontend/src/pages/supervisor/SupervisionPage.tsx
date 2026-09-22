import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiPost } from "@/lib/api"
import { LoadingBadge } from "@/components/LoadingBadge"
import { testTitle } from "@/lib/testInfo"

type Cohort = { id: string; name: string }

type SupervisionRequest = {
  id: string
  status: "PENDING" | "REVIEWED"
  studentNotes: string | null
  supervisorNotes: string | null
  createdAt: string
  reviewedAt: string | null
  student: { name: string; cohorts: Cohort[] }
  assignment: {
    test: { type: string; title: string }
    client: { name: string }
    response: { editedAt: string | null; editedBy: string | null } | null
  }
}

type ResetRequest = {
  id: string
  reason: string | null
  createdAt: string
  requestedBy: { name: string }
  assignment: { test: { type: string; title: string }; client: { name: string } }
}

type SortOrder = "recent" | "name"
type StateTab = "pending" | "reviewed" | "all"

export default function SupervisorSupervisionPage() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<SupervisionRequest[]>([])
  const [resetRequests, setResetRequests] = useState<ResetRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [cohortFilter, setCohortFilter] = useState<string>("all")
  const [testFilter, setTestFilter] = useState<string>("all")
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent")
  const [stateTab, setStateTab] = useState<StateTab>("pending")

  function loadResetRequests() {
    apiJson<ResetRequest[]>("/supervisor/reset-requests").then(setResetRequests).catch(() => {})
  }

  useEffect(() => {
    apiJson<SupervisionRequest[]>("/supervisor/supervision")
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false))
    loadResetRequests()
  }, [])

  async function resolveReset(id: string, action: "approve" | "reject") {
    setActingId(id)
    try {
      await apiPost(`/supervisor/reset-requests/${id}/${action}`, {})
      setResetRequests((prev) => prev.filter((r) => r.id !== id))
      toast({ title: action === "approve" ? "Resultado eliminado y test reabierto" : "Solicitud rechazada" })
    } catch {
      toast({ title: "No se pudo procesar la solicitud", variant: "destructive" })
    }
    setActingId(null)
  }

  const cohorts = Array.from(new Map(requests.flatMap((r) => r.student.cohorts).map((c) => [c.id, c])).values())
  const testTypes = Array.from(new Set(requests.map((r) => r.assignment.test.type))).sort()
  const visibleRequests = requests.filter(
    (r) =>
      (cohortFilter === "all" || r.student.cohorts.some((c) => c.id === cohortFilter)) &&
      (testFilter === "all" || r.assignment.test.type === testFilter)
  )
  const pending = visibleRequests
    .filter((r) => r.status === "PENDING")
    .sort((a, b) =>
      sortOrder === "name"
        ? a.student.name.localeCompare(b.student.name)
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  const reviewed = visibleRequests
    .filter((r) => r.status === "REVIEWED")
    .sort((a, b) =>
      sortOrder === "name"
        ? a.student.name.localeCompare(b.student.name)
        : new Date(b.reviewedAt ?? b.createdAt).getTime() - new Date(a.reviewedAt ?? a.createdAt).getTime()
    )

  const byRecent = (r: SupervisionRequest) =>
    new Date(r.status === "PENDING" ? r.createdAt : r.reviewedAt ?? r.createdAt).getTime()
  const shown =
    stateTab === "pending"
      ? pending
      : stateTab === "reviewed"
        ? reviewed
        : [...pending, ...reviewed].sort((a, b) =>
            sortOrder === "name" ? a.student.name.localeCompare(b.student.name) : byRecent(b) - byRecent(a)
          )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Tests</h1>
        <p className="text-muted-foreground text-sm">Revisá las solicitudes de tus alumnos</p>
      </div>

      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">CIC</Label>
          <Select value={cohortFilter} onValueChange={setCohortFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los CIC</SelectItem>
              {cohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Test</Label>
          <Select value={testFilter} onValueChange={setTestFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tests</SelectItem>
              {testTypes.map((t) => (
                <SelectItem key={t} value={t}>{testTitle(t, t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ordenar por</Label>
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Más recientes</SelectItem>
              <SelectItem value="name">Nombre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {resetRequests.length > 0 && (
        <Card className="bg-white border-red-200">
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Solicitudes de eliminación
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{resetRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resetRequests.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm">{testTitle(r.assignment.test.type, r.assignment.test.title)}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.requestedBy.name} · {r.assignment.client.name} · {formatShortDate(r.createdAt)}
                  </p>
                  {r.reason && <p className="text-sm text-muted-foreground italic mt-1">"{r.reason}"</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Aprobar borra el resultado enviado y reabre el test para rehacerlo.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actingId === r.id}
                    onClick={() => resolveReset(r.id, "reject")}
                  >
                    Rechazar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={actingId === r.id}
                    onClick={() => resolveReset(r.id, "approve")}
                  >
                    Aprobar eliminación
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs value={stateTab} onValueChange={(v) => setStateTab(v as StateTab)}>
        <TabsList>
          <TabsTrigger value="pending">
            Sin revisar {pending.length > 0 && <Badge className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-100">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="reviewed">Revisados ({reviewed.length})</TabsTrigger>
          <TabsTrigger value="all">Todos ({pending.length + reviewed.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {loading ? (
          <LoadingBadge />
        ) : shown.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            {stateTab === "pending" ? "No hay solicitudes pendientes" : stateTab === "reviewed" ? "Sin revisiones aún" : "No hay solicitudes"}
          </p>
        ) : (
          shown.map((req) => (
            <Link key={req.id} to={`/supervisor/supervision/${req.id}`}>
              <Card className="bg-white hover:shadow-sm transition-shadow cursor-pointer">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">{testTitle(req.assignment.test.type, req.assignment.test.title)}</p>
                        {req.status === "PENDING" && req.reviewedAt && (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">
                            2da revisión · editado por {req.assignment.response?.editedBy === "coachee" ? "el coachee" : "el coach"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {req.student.name} · {req.assignment.client.name}
                      </p>
                      {req.status === "PENDING"
                        ? req.studentNotes && (
                            <p className="text-sm text-muted-foreground mt-1 italic line-clamp-1">
                              "{req.studentNotes}"
                            </p>
                          )
                        : req.supervisorNotes && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{req.supervisorNotes}</p>
                          )}
                    </div>
                    <div className="text-right shrink-0">
                      {req.status === "PENDING" ? (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendiente</Badge>
                      ) : (
                        <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">Revisado</Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatShortDate(req.status === "PENDING" ? req.createdAt : req.reviewedAt ?? req.createdAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
