import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil } from "lucide-react"
import { formatShortDate } from "@/lib/date"
import { apiJson } from "@/lib/api"

type SessionRecord = {
  id: string
  sessionNum: number
  sessionDate: string
  coacheeName: string
  client: { id: string; name: string }
  createdAt: string
}

export default function RegistrosPage() {
  const [records, setRecords] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiJson<SessionRecord[]>("/student/sessions")
      .then((data) => { setRecords(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const byClient = records.reduce<Record<string, { clientName: string; sessions: SessionRecord[] }>>((acc, r) => {
    const key = r.client.id
    if (!acc[key]) acc[key] = { clientName: r.client.name, sessions: [] }
    acc[key].sessions.push(r)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-foreground mb-1">Mis Registros</h1>
          <p className="text-muted-foreground text-sm">Registro de todas tus sesiones de coaching</p>
        </div>
        <Button className="bg-brand-accent hover:bg-brand-accent-dark" asChild>
          <Link to="/student/registros/nuevo">
            <Plus className="h-4 w-4 mr-2" /> Nuevo registro
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : Object.keys(byClient).length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No hay registros aún. Creá el primero.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(byClient).map(([clientId, { clientName, sessions }]) => (
            <div key={clientId} className="space-y-3">
              <h2 className="font-serif text-lg text-foreground">{clientName}</h2>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <Link
                    key={s.id}
                    to={`/student/registros/${s.id}/editar`}
                    className="bg-white rounded-lg border border-border px-4 py-3 flex items-center gap-3 text-sm hover:shadow-sm hover:border-brand-accent/40 transition-all"
                  >
                    <Badge variant="outline">Sesión #{s.sessionNum}</Badge>
                    <span className="text-foreground">{s.coacheeName}</span>
                    <span className="text-muted-foreground">{formatShortDate(s.sessionDate)}</span>
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Pencil className="h-3 w-3" /> Editar
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
