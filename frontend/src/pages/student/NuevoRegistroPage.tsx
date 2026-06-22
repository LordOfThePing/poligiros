import { useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { apiJson, apiPost } from "@/lib/api"

type Client = { id: string; name: string }

type SessionRecord = {
  id: string
  clientId: string
  sessionNum: number
  coacheeName: string
  coacheeAge: string
  coacheeSex: string
  coacheeWorks: boolean
  coacheePosition: string | null
  sessionDate: string
  mainOutputs: string
  toolsAndResults: string
  conclusions: string
}

export default function NuevoRegistroPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const preselectedClientId = searchParams.get("clientId") ?? ""

  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState(preselectedClientId)
  const [sessionNum, setSessionNum] = useState("1")
  const [coacheeName, setCoacheeName] = useState("")
  const [coacheeAge, setCoacheeAge] = useState("")
  const [coacheeSex, setCoacheeSex] = useState("")
  const [coacheeWorks, setCoacheeWorks] = useState(false)
  const [coacheePosition, setCoacheePosition] = useState("")
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10))
  const [mainOutputs, setMainOutputs] = useState("")
  const [toolsAndResults, setToolsAndResults] = useState("")
  const [conclusions, setConclusions] = useState("")
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(!isEdit)

  useEffect(() => {
    apiJson<Client[]>("/student/clients").then((data: Client[]) => {
      setClients(data)
      if (!isEdit && preselectedClientId) {
        const found = data.find((c) => c.id === preselectedClientId)
        if (found) setCoacheeName(found.name)
      }
    }).catch(() => {})
  }, [preselectedClientId, isEdit])

  // Edit mode: hydrate the form from the existing record.
  useEffect(() => {
    if (!isEdit || !id) return
    apiJson<SessionRecord>(`/student/sessions/${id}`)
      .then((r) => {
        setClientId(r.clientId)
        setSessionNum(String(r.sessionNum))
        setCoacheeName(r.coacheeName)
        setCoacheeAge(r.coacheeAge)
        setCoacheeSex(r.coacheeSex)
        setCoacheeWorks(r.coacheeWorks)
        setCoacheePosition(r.coacheePosition ?? "")
        setSessionDate(r.sessionDate.slice(0, 10))
        setMainOutputs(r.mainOutputs)
        setToolsAndResults(r.toolsAndResults)
        setConclusions(r.conclusions)
        setLoaded(true)
      })
      .catch(() => {
        toast({ title: "No se encontró el registro", variant: "destructive" })
        navigate("/student/registros")
      })
  }, [id, isEdit, navigate, toast])

  useEffect(() => {
    // Only auto-fill the coachee name from the client when creating a new record.
    if (!isEdit && clientId) {
      const found = clients.find((c) => c.id === clientId)
      if (found) setCoacheeName(found.name)
    }
  }, [clientId, clients, isEdit])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) { toast({ title: "Seleccioná un cliente", variant: "destructive" }); return }

    setSaving(true)
    const payload = {
      clientId, sessionNum, coacheeName, coacheeAge, coacheeSex,
      coacheeWorks, coacheePosition, sessionDate, mainOutputs,
      toolsAndResults, conclusions,
    }
    if (isEdit) {
      await apiJson(`/student/sessions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } else {
      await apiPost("/student/sessions", payload)
    }

    setSaving(false)
    toast({ title: isEdit ? "Registro actualizado" : "Sesión registrada" })
    navigate("/student/registros")
  }

  if (!loaded) return <div className="text-muted-foreground text-sm py-8">Cargando...</div>

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">
          {isEdit ? "Editar Registro de Sesión" : "Nuevo Registro de Sesión"}
        </h1>
        <p className="text-muted-foreground text-sm">Completá los datos de la sesión de coaching</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-white">
          <CardHeader><CardTitle className="font-serif text-lg">Datos del coachee</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Coachee *</Label>
                <Input value={coacheeName} onChange={(e) => setCoacheeName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Edad *</Label>
                <Input value={coacheeAge} onChange={(e) => setCoacheeAge(e.target.value)} required placeholder="Ej: 35" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sexo *</Label>
              <Select value={coacheeSex} onValueChange={setCoacheeSex}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Femenino">Femenino</SelectItem>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Prefiero no decir">Prefiero no decir</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={coacheeWorks} onCheckedChange={setCoacheeWorks} id="works" />
              <Label htmlFor="works">¿Trabaja actualmente?</Label>
            </div>

            {coacheeWorks && (
              <div className="space-y-2">
                <Label>Posición actual</Label>
                <Input value={coacheePosition} onChange={(e) => setCoacheePosition(e.target.value)} placeholder="Ej: Gerente de Marketing" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader><CardTitle className="font-serif text-lg">Datos de la sesión</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Participante/Coach *</Label>
              <Input value={user?.name ?? ""} readOnly className="bg-muted" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de sesión *</Label>
                <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Número de sesión *</Label>
                <Select value={sessionNum} onValueChange={setSessionNum}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={String(n)}>Sesión {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Principales outputs *</Label>
              <Textarea value={mainOutputs} onChange={(e) => setMainOutputs(e.target.value)} rows={4} required placeholder="Describí los principales resultados de la sesión..." />
            </div>

            <div className="space-y-2">
              <Label>Herramientas utilizadas y resultados *</Label>
              <Textarea value={toolsAndResults} onChange={(e) => setToolsAndResults(e.target.value)} rows={4} required placeholder="¿Qué herramientas usaste y cuáles fueron los resultados?" />
            </div>

            <div className="space-y-2">
              <Label>Conclusiones *</Label>
              <Textarea value={conclusions} onChange={(e) => setConclusions(e.target.value)} rows={4} required placeholder="Conclusiones y próximos pasos..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1 bg-brand-accent hover:bg-brand-accent-dark" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar registro"}
          </Button>
        </div>
      </form>
    </div>
  )
}
