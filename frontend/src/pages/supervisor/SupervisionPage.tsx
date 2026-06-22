import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiPost } from "@/lib/api"

type SupervisionRequest = {
  id: string
  status: "PENDING" | "REVIEWED"
  studentNotes: string | null
  supervisorNotes: string | null
  createdAt: string
  reviewedAt: string | null
  student: { name: string }
  supervisor: { name: string } | null
  assignment: { test: { title: string }; client: { name: string } }
}

type ResetRequest = {
  id: string
  reason: string | null
  createdAt: string
  requestedBy: { name: string }
  assignment: { test: { title: string }; client: { name: string } }
}

export default function SupervisorSupervisionPage() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<SupervisionRequest[]>([])
  const [resetRequests, setResetRequests] = useState<ResetRequest[]>([])
  const [actingId, setActingId] = useState<string | null>(null)

  function loadResetRequests() {
    apiJson<ResetRequest[]>("/supervisor/reset-requests").then(setResetRequests).catch(() => {})
  }

  useEffect(() => {
    apiJson<SupervisionRequest[]>("/supervisor/supervision").then(setRequests).catch(() => {})
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

  const pending = requests.filter((r) => r.status === "PENDING")
  const reviewed = requests.filter((r) => r.status === "REVIEWED")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Supervisión</h1>
        <p className="text-muted-foreground text-sm">Revisá las solicitudes de tus alumnos</p>
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
                  <p className="font-medium text-foreground text-sm">{r.assignment.test.title}</p>
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

      <Tabs defaultValue="pendientes">
        <TabsList>
          <TabsTrigger value="pendientes">
            Pendientes {pending.length > 0 && <Badge className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-100">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="revisados">Revisados ({reviewed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes" className="mt-4 space-y-3">
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No hay solicitudes pendientes</p>
          ) : (
            pending.map((req) => (
              <Link key={req.id} to={`/supervisor/supervision/${req.id}`}>
                <Card className="bg-white hover:shadow-sm transition-shadow cursor-pointer">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{req.assignment.test.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {req.student.name} · {req.assignment.client.name}
                        </p>
                        {req.studentNotes && (
                          <p className="text-sm text-muted-foreground mt-1 italic line-clamp-1">
                            "{req.studentNotes}"
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendiente</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{formatShortDate(req.createdAt)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="revisados" className="mt-4 space-y-3">
          {reviewed.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Sin revisiones aún</p>
          ) : (
            reviewed.map((req) => (
              <Link key={req.id} to={`/supervisor/supervision/${req.id}`}>
                <Card className="bg-white hover:shadow-sm transition-shadow cursor-pointer">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{req.assignment.test.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {req.student.name} · {req.assignment.client.name}
                        </p>
                        {req.supervisorNotes && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{req.supervisorNotes}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">Revisado</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {req.reviewedAt ? formatShortDate(req.reviewedAt) : ""}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
