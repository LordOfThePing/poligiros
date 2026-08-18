import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check, X, Mail, Phone } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiTry } from "@/lib/api"
import { SignupLinksPanel } from "@/components/supervisor/SignupLinksPanel"

type SignupStatus = "PENDING" | "APPROVED" | "REJECTED"

type Signup = {
  id: string
  name: string
  email: string
  phone: string | null
  especialidad: string | null
  motivation: string | null
  status: SignupStatus
  createdAt: string
  reviewedAt: string | null
  reviewNote: string | null
  cohort: { id: string; name: string } | null
}

const STATUS_LABEL: Record<SignupStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
}

const STATUS_BADGE: Record<SignupStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  APPROVED: "bg-green-100 text-green-800 hover:bg-green-100",
  REJECTED: "bg-slate-100 text-slate-600 hover:bg-slate-100",
}

export default function InscripcionesPage() {
  const [signups, setSignups] = useState<Signup[]>([])
  const [filter, setFilter] = useState<SignupStatus | "ALL">("PENDING")
  const [loading, setLoading] = useState(true)
  const [rejecting, setRejecting] = useState<Signup | null>(null)
  const [note, setNote] = useState("")
  const { toast } = useToast()

  function load() {
    const qs = filter === "ALL" ? "" : `?status=${filter}`
    apiJson<Signup[]>(`/supervisor/signups${qs}`)
      .then((s) => { setSignups(s); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(load, [filter])

  async function approve(signup: Signup) {
    const res = await apiTry(`/supervisor/signups/${signup.id}/approve`, { method: "POST" })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: j.error || "No se pudo aprobar", variant: "destructive" })
      return
    }
    toast({ title: `${signup.name} fue aprobado` })
    load()
  }

  async function reject() {
    if (!rejecting) return
    const res = await apiTry(`/supervisor/signups/${rejecting.id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: j.error || "No se pudo rechazar", variant: "destructive" })
      return
    }
    setRejecting(null)
    setNote("")
    toast({ title: "Inscripción rechazada" })
    load()
  }

  const pendingCount = signups.filter((s) => s.status === "PENDING").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Inscripciones</h1>
        <p className="text-muted-foreground text-sm">
          Solicitudes del link público. El usuario recién se crea cuando aprobás.
        </p>
      </div>

      <SignupLinksPanel />

      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Estado</Label>
          <Select value={filter} onValueChange={(v) => setFilter(v as SignupStatus | "ALL")}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pendientes</SelectItem>
              <SelectItem value="APPROVED">Aprobadas</SelectItem>
              <SelectItem value="REJECTED">Rechazadas</SelectItem>
              <SelectItem value="ALL">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {filter === "PENDING" && pendingCount > 0 && (
          <p className="text-sm text-muted-foreground pb-2">
            {pendingCount} esperando respuesta
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : signups.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No hay inscripciones {filter === "PENDING" ? "pendientes" : "en este estado"}.
        </p>
      ) : (
        <div className="space-y-3">
          {signups.map((s) => (
            <Card key={s.id} className="bg-white">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground">{s.name}</h3>
                      <Badge className={STATUS_BADGE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                      {s.cohort && (
                        <Badge variant="secondary" className="text-xs">{s.cohort.name}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 flex-wrap text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {s.email}
                      </span>
                      {s.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {s.phone}
                        </span>
                      )}
                      {s.especialidad && <span>{s.especialidad}</span>}
                    </div>
                  </div>

                  {s.status === "PENDING" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-brand-accent hover:bg-brand-accent-dark"
                        onClick={() => approve(s)}
                      >
                        <Check className="h-3 w-3 mr-1" /> Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { setRejecting(s); setNote("") }}
                      >
                        <X className="h-3 w-3 mr-1" /> Rechazar
                      </Button>
                    </div>
                  )}
                </div>

                {s.motivation && (
                  <p className="text-sm text-foreground whitespace-pre-line bg-muted/40 rounded-lg p-3">
                    {s.motivation}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Se inscribió el {formatShortDate(s.createdAt)}
                  {s.reviewedAt && ` · Resuelta el ${formatShortDate(s.reviewedAt)}`}
                  {s.reviewNote && ` · ${s.reviewNote}`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Rechazar inscripción</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              {rejecting?.name} no va a recibir ningún email. La nota es solo para vos.
            </p>
            <Label>Nota (opcional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: se anota en la próxima camada"
              onKeyDown={(e) => e.key === "Enter" && reject()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={reject}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
