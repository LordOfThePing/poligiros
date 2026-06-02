import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatShortDate } from "@/lib/date"
import { apiJson } from "@/lib/api"

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

export default function SupervisorSupervisionPage() {
  const [requests, setRequests] = useState<SupervisionRequest[]>([])

  useEffect(() => {
    apiJson<SupervisionRequest[]>("/supervisor/supervision").then(setRequests).catch(() => {})
  }, [])

  const pending = requests.filter((r) => r.status === "PENDING")
  const reviewed = requests.filter((r) => r.status === "REVIEWED")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Supervisión</h1>
        <p className="text-muted-foreground text-sm">Revisá las solicitudes de tus alumnos</p>
      </div>

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
