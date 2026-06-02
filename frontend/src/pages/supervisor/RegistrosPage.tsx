import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { formatShortDate } from "@/lib/date"
import { apiJson } from "@/lib/api"

type SessionRecord = {
  id: string
  sessionNum: number
  sessionDate: string
  coacheeName: string
  coacheeAge: string
  coacheeSex: string
  coacheeWorks: boolean
  coacheePosition: string | null
  mainOutputs: string
  toolsAndResults: string
  conclusions: string
  student: { id: string; name: string }
  client: { id: string; name: string }
  createdAt: string
}

export default function SupervisorRegistrosPage() {
  const [records, setRecords] = useState<SessionRecord[]>([])
  const [filterStudent, setFilterStudent] = useState<string>("all")
  const [filterClient, setFilterClient] = useState<string>("all")
  const [selected, setSelected] = useState<SessionRecord | null>(null)

  useEffect(() => {
    apiJson<SessionRecord[]>("/supervisor/sessions").then(setRecords).catch(() => {})
  }, [])

  const students = Array.from(new Map(records.map((r) => [r.student.id, r.student])).values())
  const clients = Array.from(new Map(records.map((r) => [r.client.id, r.client])).values())

  const filtered = records.filter((r) => {
    if (filterStudent !== "all" && r.student.id !== filterStudent) return false
    if (filterClient !== "all" && r.client.id !== filterClient) return false
    return true
  })

  const sessionsByStudent = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.student.id] = (acc[r.student.id] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Registros de Sesión</h1>
        <p className="text-muted-foreground text-sm">Todos los registros de sesiones de coaching</p>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Alumno</Label>
          <Select value={filterStudent} onValueChange={setFilterStudent}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los alumnos</SelectItem>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({sessionsByStudent[s.id] || 0}/6)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cliente</Label>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No hay registros</p>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelected(r)}
              className="bg-white rounded-lg border border-border px-4 py-3 flex items-center gap-4 cursor-pointer hover:shadow-sm transition-shadow"
            >
              <Badge variant="outline" className="shrink-0">Sesión #{r.sessionNum}</Badge>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-foreground text-sm">{r.student.name}</span>
                <span className="text-muted-foreground text-sm mx-2">·</span>
                <span className="text-muted-foreground text-sm">{r.client.name}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{formatShortDate(r.sessionDate)}</span>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">
              Sesión #{selected?.sessionNum} — {selected?.client.name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Coachee</p>
                  <p className="text-foreground">{selected.coacheeName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Alumno/Coach</p>
                  <p className="text-foreground">{selected.student.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Edad</p>
                  <p className="text-foreground">{selected.coacheeAge}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sexo</p>
                  <p className="text-foreground">{selected.coacheeSex}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">¿Trabaja?</p>
                  <p className="text-foreground">{selected.coacheeWorks ? "Sí" : "No"}</p>
                </div>
                {selected.coacheePosition && (
                  <div>
                    <p className="text-xs text-muted-foreground">Posición</p>
                    <p className="text-foreground">{selected.coacheePosition}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="text-foreground">{formatShortDate(selected.sessionDate)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Principales outputs</p>
                <p className="text-foreground whitespace-pre-wrap bg-muted rounded p-3">{selected.mainOutputs}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Herramientas utilizadas y resultados</p>
                <p className="text-foreground whitespace-pre-wrap bg-muted rounded p-3">{selected.toolsAndResults}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Conclusiones</p>
                <p className="text-foreground whitespace-pre-wrap bg-muted rounded p-3">{selected.conclusions}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
