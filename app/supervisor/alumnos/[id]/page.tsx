"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { formatShortDate } from "@/lib/date"

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

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [student, setStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/supervisor/students/${id}`)
      .then((r) => r.json())
      .then((data) => { setStudent(data); setLoading(false) })
  }, [id])

  if (loading) {
    return <div className="text-muted-foreground text-sm py-8">Cargando...</div>
  }
  if (!student) {
    return <div className="text-muted-foreground text-sm py-8">Alumno no encontrado</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/supervisor/alumnos" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-serif text-3xl text-foreground">{student.name}</h1>
          <p className="text-muted-foreground text-sm">{student.email}</p>
        </div>
      </div>

      {/* Clients */}
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

      {/* Module progress */}
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

      {/* Session records */}
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
