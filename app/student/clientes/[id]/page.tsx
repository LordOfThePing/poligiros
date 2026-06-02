"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"

const TEST_INFO: Record<string, { title: string; route: string; comingSoon?: boolean }> = {
  ANCLAS_CARRERA: { title: "Test de Anclas de Carrera", route: "anclas-carrera" },
  TABLERO_IDEAS: { title: "Tablero de Ideas", route: "tablero-ideas" },
  PLAN_VITAL: { title: "Plan Vital Integral®", route: "plan-vital", comingSoon: true },
  PIRAMIDE_PROPOSITO: { title: "Pirámide del Propósito", route: "piramide-proposito" },
}
const TEST_ORDER = ["ANCLAS_CARRERA", "TABLERO_IDEAS", "PLAN_VITAL", "PIRAMIDE_PROPOSITO"]

type Assignment = {
  id: string
  test: { id: string; type: string; title: string }
  completedAt: string | null
  response: unknown
  supervision: { id: string; status: string } | null
}

type SessionRecord = {
  id: string
  sessionNum: number
  sessionDate: string
  coacheeName: string
}

type Client = {
  id: string
  name: string
  email: string
  assignments: Assignment[]
  sessions: SessionRecord[]
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const [client, setClient] = useState<Client | null>(null)
  const [tests, setTests] = useState<{ id: string; type: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [supervisionModal, setSupervisionModal] = useState<{ assignmentId: string; testTitle: string } | null>(null)
  const [supervisionNotes, setSupervisionNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/student/clients/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data)
        setLoading(false)
      })
  }, [id])

  // [T4] Single source of truth for the test list. The old code had a second
  // useEffect hitting /api/client/tests (a 404 that failed silently) plus a
  // re-fetch inside handleAssign — both removed; assign now uses `tests` state.
  useEffect(() => {
    fetch("/api/tests").then((r) => r.json()).then(setTests).catch(() => {})
  }, [])

  async function handleAssign(testType: string) {
    const test = tests.find((t) => t.type === testType)
    if (!test) return

    const r = await fetch(`/api/student/clients/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId: test.id }),
    })

    if (r.ok) {
      const updated = await fetch(`/api/student/clients/${id}`).then((res) => res.json())
      setClient(updated)
      toast({ title: "Test asignado" })
    }
  }

  async function handleSendSupervision() {
    if (!supervisionModal) return
    setSubmitting(true)

    const res = await fetch("/api/student/supervision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId: supervisionModal.assignmentId, studentNotes: supervisionNotes }),
    })

    if (res.ok) {
      const updated = await fetch(`/api/student/clients/${id}`).then((r) => r.json())
      setClient(updated)
      setSupervisionModal(null)
      setSupervisionNotes("")
      toast({ title: "Enviado a supervisión" })
    } else {
      toast({ title: "Error al enviar", variant: "destructive" })
    }
    setSubmitting(false)
  }

  if (loading) return <div className="text-muted-foreground text-sm py-8">Cargando...</div>
  if (!client) return <div className="text-muted-foreground text-sm py-8">Cliente no encontrado</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/student/clientes" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-serif text-3xl text-foreground">{client.name}</h1>
          <p className="text-muted-foreground text-sm">{client.email}</p>
        </div>
      </div>

      {/* Tests */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {TEST_ORDER.map((type) => {
            const info = TEST_INFO[type]
            const assignment = client.assignments.find((a) => a.test.type === type)
            const isComingSoon = info.comingSoon

            return (
              <div key={type} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{info.title}</span>
                  {isComingSoon && <Badge variant="secondary" className="text-xs">Próximamente</Badge>}
                  {assignment?.completedAt && <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Completado ✓</Badge>}
                  {assignment && !assignment.completedAt && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">Pendiente</Badge>}
                  {assignment?.supervision && (
                    <Badge className={`text-xs ${assignment.supervision.status === "REVIEWED" ? "bg-indigo-100 text-indigo-800" : "bg-gray-100 text-gray-600"} hover:bg-current`}>
                      {assignment.supervision.status === "REVIEWED" ? "Revisado" : "En supervisión"}
                    </Badge>
                  )}
                </div>

                {!isComingSoon && (
                  <div className="flex gap-2">
                    {!assignment && (
                      <Button size="sm" variant="outline" onClick={() => handleAssign(type)}>
                        Asignar
                      </Button>
                    )}
                    {assignment?.completedAt && !assignment.supervision && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSupervisionModal({ assignmentId: assignment.id, testTitle: info.title })}
                      >
                        Enviar a supervisión
                      </Button>
                    )}
                    {assignment?.completedAt && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/client/test/${info.route}/${assignment.id}`}>Ver resultado</Link>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Session records */}
      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-lg">Sesiones</CardTitle>
            <Button size="sm" className="bg-brand-accent hover:bg-brand-accent-dark" asChild>
              <Link href={`/student/registros/nuevo?clientId=${id}`}>
                <Plus className="h-3 w-3 mr-1" /> Nueva sesión
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {client.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin sesiones registradas aún</p>
          ) : (
            <div className="space-y-2">
              {client.sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <Badge variant="outline">Sesión #{s.sessionNum}</Badge>
                  <span className="text-foreground">{s.coacheeName}</span>
                  <span className="text-muted-foreground">{formatShortDate(s.sessionDate)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supervision modal */}
      <Dialog open={!!supervisionModal} onOpenChange={(open) => !open && setSupervisionModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Enviar a supervisión</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">{supervisionModal?.testTitle}</p>
            <Label>Notas para Gaby (opcional)</Label>
            <Textarea
              value={supervisionNotes}
              onChange={(e) => setSupervisionNotes(e.target.value)}
              placeholder="Comentarios, dudas o contexto sobre este cliente..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupervisionModal(null)}>Cancelar</Button>
            <Button
              className="bg-brand-accent hover:bg-brand-accent-dark"
              onClick={handleSendSupervision}
              disabled={submitting}
            >
              {submitting ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
